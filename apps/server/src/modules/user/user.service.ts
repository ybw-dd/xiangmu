import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../config/redis.service';

const USER_SELECT = {
  id: true,
  username: true,
  nickname: true,
  email: true,
  avatar: true,
  status: true,
  lastSeenAt: true,
  createdAt: true,
} as const;

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * 根据 ID 获取用户
   */
  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    // 附加在线状态（从 Redis 缓存读取）
    const cachedStatus = await this.redis.hget('user:status', id);
    return {
      ...user,
      status: cachedStatus || user.status,
    };
  }

  /**
   * 搜索用户（按用户名/昵称/邮箱模糊匹配）
   */
  async search(query: string, page = 1, pageSize = 20) {
    if (!query || query.trim().length === 0) {
      return { items: [], total: 0, page, pageSize, hasMore: false };
    }

    const where = {
      OR: [
        { username: { contains: query } },
        { nickname: { contains: query } },
      ],
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: USER_SELECT,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }

  /**
   * 更新用户信息
   */
  async update(
    userId: string,
    data: { nickname?: string; avatar?: string },
  ) {
    // 过滤掉 undefined 的字段
    const updateData: Record<string, string> = {};
    if (data.nickname !== undefined) updateData.nickname = data.nickname;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;

    if (Object.keys(updateData).length === 0) {
      return this.findById(userId);
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: USER_SELECT,
    });

    this.logger.log(`用户资料更新: ${userId}`);
    return user;
  }

  /**
   * 更新在线状态
   */
  async updateStatus(userId: string, status: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { status, lastSeenAt: new Date() },
    });

    // 缓存在线状态到 Redis（5分钟过期）
    await this.redis.hset('user:status', userId, status);

    this.logger.debug(`用户状态更新: ${userId} -> ${status}`);
  }

  /**
   * 获取用户在线状态
   */
  async getStatus(userId: string): Promise<string> {
    const status = await this.redis.hget('user:status', userId);
    return status || 'offline';
  }

  /**
   * 批量获取用户信息
   */
  async findByIds(ids: string[]) {
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: USER_SELECT,
    });

    // 转换为 Map 方便查找
    const userMap = new Map(users.map((u) => [u.id, u]));
    return ids.map((id) => userMap.get(id) || null);
  }
}
