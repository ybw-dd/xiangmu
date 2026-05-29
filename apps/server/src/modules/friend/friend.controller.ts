import { Controller, Post, Get, Delete, Param, Body } from '@nestjs/common';
import { FriendService } from './friend.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@lingxun/types';
import { IsOptional, IsString } from 'class-validator';

class SendFriendRequestDto {
  @IsString()
  declare friendId: string;

  @IsOptional()
  @IsString()
  remark?: string;
}

@Controller('friends')
export class FriendController {
  constructor(private friendService: FriendService) {}

  @Post('request')
  async sendRequest(@CurrentUser() user: JwtPayload, @Body() dto: SendFriendRequestDto) {
    return this.friendService.sendRequest(user.sub, dto.friendId, dto.remark);
  }

  @Post('accept/:id')
  async acceptRequest(@Param('id') id: string) {
    return this.friendService.acceptRequest(id);
  }

  @Post('reject/:id')
  async rejectRequest(@Param('id') id: string) {
    return this.friendService.rejectRequest(id);
  }

  @Get()
  async getFriends(@CurrentUser() user: JwtPayload) {
    return this.friendService.getFriends(user.sub);
  }

  @Get('requests/pending')
  async getPendingRequests(@CurrentUser() user: JwtPayload) {
    return this.friendService.getPendingRequests(user.sub);
  }

  @Delete(':friendId')
  async removeFriend(@CurrentUser() user: JwtPayload, @Param('friendId') friendId: string) {
    return this.friendService.removeFriend(user.sub, friendId);
  }
}
