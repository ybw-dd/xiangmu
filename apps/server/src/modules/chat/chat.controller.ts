import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { ChatService } from './chat.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@lingxun/types';
import { IsString } from 'class-validator';

class CreatePrivateChatDto {
  @IsString()
  declare friendId: string;
}

@Controller('chats')
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get()
  async getConversations(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = 1,
  ) {
    return this.chatService.getConversations(user.sub, Number(page));
  }

  @Post('private')
  async createPrivateChat(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreatePrivateChatDto,
  ) {
    return this.chatService.createPrivateConversation(user.sub, dto.friendId);
  }

  @Get(':id')
  async getConversation(@Param('id') id: string) {
    return this.chatService.getConversation(id);
  }
}
