import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../config/redis.service';
import { SearchService } from '../search/search.service';
import { MessageType } from '@lingxun/types';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private searchService: SearchService,
  ) {}

  /**
   * 发送消息（核心方法）
   */
  async sendMessage(data: {
    clientId: string;
    conversationId: string;
    senderId: string;
    type: MessageType;
    content: string;
    metadata?: Record<string, unknown>;
    replyToId?: string;
  }) {
    // 幂等检查：检查 clientId 是否已存在
    const existing = await this.prisma.message.findUnique({
      where: { clientId: data.clientId },
    });

    if (existing) {
      this.logger.warn(`消息幂等命中: ${data.clientId}`);
      return existing;
    }

    // 获取下一个序列号
    const seq = await this.getNextSeq(data.conversationId);

    // 创建消息
    const message = await this.prisma.message.create({
      data: {
        clientId: data.clientId,
        conversationId: data.conversationId,
        senderId: data.senderId,
        type: data.type,
        content: data.content,
        metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
        replyToId: data.replyToId,
        seq,
        status: 'sent',
      },
    });

    // 更新会话最后消息
    await this.prisma.conversation.update({
      where: { id: data.conversationId },
      data: {
        lastMessageId: message.id,
        lastMessageAt: message.createdAt,
      },
    });

    // 增加未读数缓存
    await this.incrementUnreadCount(data.conversationId, data.senderId);

    // 异步索引到 ES（不阻塞响应）
    this.searchService
      .indexMessage({
        id: message.id,
        content: message.content,
        conversationId: message.conversationId,
        senderId: message.senderId,
        type: message.type,
        createdAt: message.createdAt,
      })
      .catch((err) => this.logger.warn(`ES 索引异步失败: ${err.message}`));

    this.logger.log(`消息已发送: ${message.id} seq:${seq}`);
    return message;
  }

  /**
   * 获取会话消息列表（分页 + 游标）
   */
  async getMessages(conversationId: string, cursor?: string, limit = 20) {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { seq: 'desc' },
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    });

    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, -1) : messages;

    return {
      items: items.reverse(),
      hasMore,
      cursor: items.length > 0 ? items[0].id : null,
    };
  }

  /**
   * 获取离线消息
   */
  async getOfflineMessages(conversationId: string, lastSeq: number, limit = 100) {
    return this.prisma.message.findMany({
      where: {
        conversationId,
        seq: { gt: lastSeq },
      },
      orderBy: { seq: 'asc' },
      take: limit,
    });
  }

  /**
   * 标记消息已读
   */
  async markAsRead(conversationId: string, userId: string, lastReadSeq: number) {
    // 更新参与者的已读位置
    await this.prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { lastReadSeq },
    });

    // 更新该用户在此会话之前所有消息的已读状态
    await this.prisma.message.updateMany({
      where: {
        conversationId,
        seq: { lte: lastReadSeq },
        senderId: { not: userId },
        status: { not: 'read' },
      },
      data: { status: 'read' },
    });

    // 清除未读缓存
    await this.redis.del(`unread:${conversationId}:${userId}`);
  }

  /**
   * 获取下一个消息序列号
   */
  private async getNextSeq(conversationId: string): Promise<number> {
    // 使用 Redis 原子递增
    const key = `msg:seq:${conversationId}`;
    const seq = await this.redis.getClient().incr(key);

    // 首次递增时设置过期（防止内存泄漏，实际场景会话不会永远存在）
    if (seq === 1) {
      await this.redis.getClient().expire(key, 86400 * 365); // 1年
    }

    return seq;
  }

  /**
   * 增加未读计数
   */
  private async incrementUnreadCount(conversationId: string, excludeUserId: string) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { conversationId, userId: { not: excludeUserId } },
    });

    for (const p of participants) {
      const key = `unread:${conversationId}:${p.userId}`;
      await this.redis.getClient().incr(key);
      // 设置 24 小时过期，防止孤儿 key
      await this.redis.getClient().expire(key, 86400);
    }
  }
}
