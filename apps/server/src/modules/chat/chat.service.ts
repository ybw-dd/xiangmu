import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../config/redis.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * 获取用户的会话列表
   */
  async getConversations(userId: string, page = 1, pageSize = 20) {
    const conversations = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: {
              include: {
                user: {
                  select: { id: true, username: true, nickname: true, avatar: true, status: true },
                },
              },
            },
            group: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { conversation: { lastMessageAt: 'desc' } },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // 获取未读数 + 计算私聊显示名
    const result = await Promise.all(
      conversations.map(async (cp) => {
        const unreadCount = await this.getUnreadCount(cp.conversationId, userId, cp.lastReadSeq);

        // 私聊：取对方用户信息作为显示名
        let displayName = cp.conversation.name;
        let displayAvatar = cp.conversation.avatar;

        if (cp.conversation.type === 'private') {
          const other = cp.conversation.participants.find((p) => p.userId !== userId);
          if (other?.user) {
            displayName = other.user.nickname || other.user.username;
            displayAvatar = other.user.avatar;
          }
        }

        return {
          ...cp.conversation,
          displayName,
          displayAvatar,
          unreadCount,
          lastReadSeq: cp.lastReadSeq,
        };
      }),
    );

    return result;
  }

  /**
   * 创建私聊会话
   */
  async createPrivateConversation(userId: string, friendId: string) {
    // 检查是否已存在私聊会话
    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: 'private',
        participants: {
          every: {
            userId: { in: [userId, friendId] },
          },
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.conversation.create({
      data: {
        type: 'private',
        participants: {
          create: [{ userId }, { userId: friendId }],
        },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, username: true, nickname: true, avatar: true } },
          },
        },
      },
    });
  }

  /**
   * 获取会话详情
   */
  async getConversation(conversationId: string) {
    return this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: { select: { id: true, username: true, nickname: true, avatar: true, status: true } },
          },
        },
      },
    });
  }

  /**
   * 更新已读位置
   */
  async markAsRead(conversationId: string, userId: string, lastReadSeq: number) {
    await this.prisma.conversationParticipant.updateMany({
      where: { conversationId, userId },
      data: { lastReadSeq },
    });
  }

  /**
   * 获取未读消息数
   */
  private async getUnreadCount(
    conversationId: string,
    userId: string,
    lastReadSeq: number,
  ): Promise<number> {
    // 先从 Redis 缓存获取
    const cached = await this.redis.get(`unread:${conversationId}:${userId}`);
    if (cached !== null) {
      return parseInt(cached, 10);
    }

    // 从数据库查询
    const count = await this.prisma.message.count({
      where: {
        conversationId,
        seq: { gt: lastReadSeq },
        senderId: { not: userId },
      },
    });

    // 缓存5分钟
    await this.redis.set(`unread:${conversationId}:${userId}`, String(count), 300);
    return count;
  }
}
