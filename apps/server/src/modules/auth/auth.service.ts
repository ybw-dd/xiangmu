import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../config/redis.service';
import * as bcrypt from 'bcryptjs';
import type { JwtPayload, AuthTokens } from '@lingxun/types';

/** 最大登录失败次数 */
const MAX_LOGIN_ATTEMPTS = 5;
/** 登录锁定时间（秒） */
const LOGIN_LOCKOUT_SECONDS = 900; // 15分钟

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTokenTtl: number;
  private readonly refreshTokenTtl: number;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redis: RedisService,
  ) {
    // 解析 token TTL（默认 7d / 30d）
    const accessExp = this.configService.get<string>('JWT_EXPIRES_IN', '7d');
    const refreshExp = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '30d');
    this.accessTokenTtl = this.parseExpiryToSeconds(accessExp);
    this.refreshTokenTtl = this.parseExpiryToSeconds(refreshExp);
  }

  // ==========================================
  // 注册
  // ==========================================
  async register(data: {
    username: string;
    email: string;
    password: string;
    nickname: string;
  }): Promise<{ user: Omit<any, 'password'>; tokens: AuthTokens }> {
    // 检查用户名和邮箱是否已存在
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: data.username }, { email: data.email }],
      },
    });

    if (existing) {
      if (existing.username === data.username) {
        throw new ConflictException('用户名已被使用');
      }
      throw new ConflictException('邮箱已被注册');
    }

    // 加密密码（bcrypt rounds=12）
    const hashedPassword = await bcrypt.hash(data.password, 12);

    // 创建用户（事务：用户 + 通知偏好）
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: data.username,
          email: data.email,
          password: hashedPassword,
          nickname: data.nickname || data.username,
        },
      });

      // 创建系统欢迎通知
      await tx.notification.create({
        data: {
          userId: created.id,
          type: 'system',
          title: '欢迎加入灵讯',
          content: `你好 ${created.nickname}！欢迎使用灵讯即时通讯系统。`,
        },
      });

      return created;
    });

    // 生成 Token
    const tokens = await this.generateTokens(user.id, user.username, user.email);

    this.logger.log(`新用户注册: ${user.username} (${user.id})`);

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, tokens };
  }

  // ==========================================
  // 登录（带速率限制）
  // ==========================================
  async login(data: {
    username: string;
    password: string;
    clientId?: string;
  }): Promise<{ user: Omit<any, 'password'>; tokens: AuthTokens }> {
    const loginKey = `login:attempts:${data.username}`;

    // 检查是否被锁定
    const lockRemaining = await this.redis.getClient().ttl(loginKey);
    if (lockRemaining > 0) {
      const attempts = parseInt((await this.redis.get(loginKey)) || '0', 10);
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        throw new ForbiddenException(
          `登录失败次数过多，请 ${Math.ceil(lockRemaining / 60)} 分钟后重试`,
        );
      }
    }

    // 查找用户（支持用户名或邮箱登录）
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: data.username }, { email: data.username }],
      },
    });

    if (!user) {
      await this.recordFailedLogin(loginKey);
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(data.password, user.password);
    if (!isPasswordValid) {
      await this.recordFailedLogin(loginKey);
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 登录成功 - 清除失败计数
    await this.redis.del(loginKey);

    // 更新最后活跃时间
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date() },
    });

    // 生成 Token（支持多端登录：每个 clientId 独立 token）
    const tokens = await this.generateTokens(
      user.id,
      user.username,
      user.email,
      data.clientId,
    );

    this.logger.log(`用户登录: ${user.username} (${user.id})`);

    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, tokens };
  }

  // ==========================================
  // 刷新 Token（滑动窗口续签）
  // ==========================================
  async refreshTokens(
    refreshToken: string,
    clientId?: string,
  ): Promise<AuthTokens> {
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>(
          'JWT_REFRESH_SECRET',
          'lingxun-refresh-secret-key-change-in-production',
        ),
      });
    } catch {
      throw new UnauthorizedException('Refresh token 无效或已过期');
    }

    // 检查 refresh token 是否在 Redis 中有效（支持多端）
    const redisKey = clientId
      ? `refresh:${payload.sub}:${clientId}`
      : `refresh:${payload.sub}`;
    const storedToken = await this.redis.get(redisKey);

    if (storedToken !== refreshToken) {
      // Token 被替换（可能是其他端登录后强制下线）
      throw new UnauthorizedException('Refresh token 已失效，请重新登录');
    }

    // 验证用户仍然存在
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      await this.redis.del(redisKey);
      throw new UnauthorizedException('用户不存在');
    }

    // 滑动窗口：重新生成 token 并延长过期时间
    const tokens = await this.generateTokens(
      user.id,
      user.username,
      user.email,
      clientId,
    );

    this.logger.debug(`Token 续签: ${user.username}`);
    return tokens;
  }

  // ==========================================
  // 登出
  // ==========================================
  async logout(userId: string, clientId?: string): Promise<void> {
    if (clientId) {
      // 仅登出指定端
      await this.redis.del(`refresh:${userId}:${clientId}`);
    } else {
      // 登出所有端
      const keys = await this.redis.getClient().keys(`refresh:${userId}*`);
      if (keys.length > 0) {
        await this.redis.getClient().del(...keys);
      }
    }

    this.logger.log(`用户登出: ${userId}${clientId ? ` (client: ${clientId})` : ' (全部端)'}`);
  }

  // ==========================================
  // 验证 Token（给 JwtStrategy 调用）
  // ==========================================
  async validateToken(payload: JwtPayload): Promise<boolean> {
    // 检查用户是否仍然存在
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true },
    });

    return !!user;
  }

  // ==========================================
  // 获取当前用户信息
  // ==========================================
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        nickname: true,
        email: true,
        avatar: true,
        status: true,
        lastSeenAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return user;
  }

  // ==========================================
  // 修改密码
  // ==========================================
  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      throw new UnauthorizedException('原密码错误');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // 修改密码后强制所有端重新登录
    const keys = await this.redis.getClient().keys(`refresh:${userId}*`);
    if (keys.length > 0) {
      await this.redis.getClient().del(...keys);
    }

    this.logger.log(`用户修改密码: ${userId}`);
  }

  // ==========================================
  // 私有方法
  // ==========================================

  /** 记录登录失败 */
  private async recordFailedLogin(key: string): Promise<void> {
    const client = this.redis.getClient();
    const attempts = await client.incr(key);

    if (attempts === 1) {
      await client.expire(key, LOGIN_LOCKOUT_SECONDS);
    }

    if (attempts >= MAX_LOGIN_ATTEMPTS) {
      this.logger.warn(`登录被锁定: ${key} (${attempts} 次失败)`);
    }
  }

  /** 生成双 Token */
  private async generateTokens(
    userId: string,
    username: string,
    email: string,
    clientId?: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, username, email };

    const refreshSecret = this.configService.get<string>(
      'JWT_REFRESH_SECRET',
      'lingxun-refresh-secret-key-change-in-production',
    );

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '30d') as any,
      }),
    ]);

    // 存储 refresh token 到 Redis（支持多端）
    const redisKey = clientId
      ? `refresh:${userId}:${clientId}`
      : `refresh:${userId}`;
    await this.redis.set(redisKey, refreshToken, this.refreshTokenTtl);

    return { accessToken, refreshToken };
  }

  /** 解析过期时间字符串为秒数 */
  private parseExpiryToSeconds(exp: string): number {
    const match = exp.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return 7 * 24 * 60 * 60; // 默认 7 天

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 3600;
      case 'd':
        return value * 86400;
      default:
        return 7 * 86400;
    }
  }
}
