import { Controller, Post, Get, Patch, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { IsString, IsEmail, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';
import type { JwtPayload } from '@lingxun/types';

// ==========================================
// DTO 定义
// ==========================================

class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: '用户名只能包含字母、数字和下划线' })
  declare username: string;

  @IsEmail({}, { message: '邮箱格式不正确' })
  declare email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: '密码必须包含大小写字母和数字',
  })
  declare password: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  nickname?: string;
}

class LoginDto {
  @IsString()
  @MinLength(1)
  declare username: string;

  @IsString()
  @MinLength(1)
  declare password: string;

  @IsOptional()
  @IsString()
  clientId?: string;
}

class RefreshTokenDto {
  @IsString()
  declare refreshToken: string;

  @IsOptional()
  @IsString()
  clientId?: string;
}

class ChangePasswordDto {
  @IsString()
  declare oldPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: '新密码必须包含大小写字母和数字',
  })
  declare newPassword: string;
}

// ==========================================
// Controller
// ==========================================

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  /**
   * POST /api/auth/register
   * 用户注册
   */
  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.authService.register({
      username: dto.username,
      email: dto.email,
      password: dto.password,
      nickname: dto.nickname || dto.username,
    });
    return result;
  }

  /**
   * POST /api/auth/login
   * 用户登录
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login({
      username: dto.username,
      password: dto.password,
      clientId: dto.clientId,
    });
  }

  /**
   * POST /api/auth/refresh
   * 刷新 Token
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto.refreshToken, dto.clientId);
  }

  /**
   * POST /api/auth/logout
   * 登出
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: JwtPayload,
    @Body('clientId') clientId?: string,
  ) {
    await this.authService.logout(user.sub, clientId);
    return { message: '已登出' };
  }

  /**
   * GET /api/auth/profile
   * 获取当前用户信息
   */
  @Get('profile')
  async getProfile(@CurrentUser() user: JwtPayload) {
    return this.authService.getProfile(user.sub);
  }

  /**
   * PATCH /api/auth/password
   * 修改密码
   */
  @Patch('password')
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user.sub, dto.oldPassword, dto.newPassword);
    return { message: '密码修改成功，请重新登录' };
  }
}
