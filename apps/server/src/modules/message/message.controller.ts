import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { MessageService } from './message.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@lingxun/types';

@Controller('messages')
export class MessageController {
  constructor(private messageService: MessageService) {}

  @Get('conversation/:id')
  async getMessages(
    @Param('id') conversationId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit = 20,
  ) {
    return this.messageService.getMessages(conversationId, cursor, Number(limit));
  }

  @Get('conversation/:id/offline')
  async getOfflineMessages(
    @Param('id') conversationId: string,
    @Query('lastSeq') lastSeq: number,
  ) {
    return this.messageService.getOfflineMessages(conversationId, Number(lastSeq));
  }

  @Post('conversation/:id/read')
  async markAsRead(
    @Param('id') conversationId: string,
    @Body('lastReadSeq') lastReadSeq: number,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.messageService.markAsRead(conversationId, user.sub, lastReadSeq);
    return { success: true };
  }
}
