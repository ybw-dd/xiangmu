import { Controller, Get, Patch, Param, Query, Body } from '@nestjs/common';
import { UserService } from './user.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@lingxun/types';
import { IsOptional, IsString, MaxLength, IsEnum } from 'class-validator';

const VALID_STATUSES = ['online', 'offline', 'away', 'busy'] as const;

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  nickname?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsEnum(VALID_STATUSES, { message: '状态值无效' })
  status?: string;
}

@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  /**
   * GET /api/users/me
   * 获取当前用户信息
   */
  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.userService.findById(user.sub);
  }

  /**
   * PATCH /api/users/me
   * 更新当前用户资料
   */
  @Patch('me')
  async updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    // 如果更新状态，走专门的状态更新路径
    if (dto.status) {
      await this.userService.updateStatus(user.sub, dto.status);
    }
    return this.userService.update(user.sub, {
      nickname: dto.nickname,
      avatar: dto.avatar,
    });
  }

  /**
   * GET /api/users/search?q=xxx
   * 搜索用户
   */
  @Get('search')
  async searchUsers(
    @Query('q') query: string,
    @Query('page') page = '1',
  ) {
    return this.userService.search(query, Number(page));
  }

  /**
   * GET /api/users/:id
   * 获取指定用户信息
   */
  @Get(':id')
  async getUser(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  /**
   * GET /api/users/:id/status
   * 获取用户在线状态
   */
  @Get(':id/status')
  async getStatus(@Param('id') id: string) {
    const status = await this.userService.getStatus(id);
    return { userId: id, status };
  }
}
