import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly esUrl: string;
  private esAvailable = false;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.esUrl = this.configService.get<string>('ELASTICSEARCH_URL', 'http://localhost:9200');
  }

  async onModuleInit() {
    await this.ensureIndex();
  }

  /**
   * 确保 ES messages index 存在
   */
  async ensureIndex() {
    try {
      const res = await fetch(`${this.esUrl}/messages`, { method: 'HEAD' });
      if (res.status === 404) {
        // 创建 index
        await fetch(`${this.esUrl}/messages`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: {
              number_of_shards: 1,
              number_of_replicas: 0,
              analysis: {
                analyzer: {
                  message_analyzer: {
                    type: 'standard',
                    stopwords: '_none_',
                  },
                },
              },
            },
            mappings: {
              properties: {
                content: { type: 'text', analyzer: 'message_analyzer' },
                conversationId: { type: 'keyword' },
                senderId: { type: 'keyword' },
                senderName: { type: 'keyword' },
                participants: { type: 'keyword' },
                type: { type: 'keyword' },
                createdAt: { type: 'date' },
              },
            },
          }),
        });
        this.logger.log('ES messages index 已创建');
      }
      this.esAvailable = true;
      this.logger.log('Elasticsearch 连接成功');
    } catch {
      this.esAvailable = false;
      this.logger.warn('Elasticsearch 不可用，将使用数据库搜索');
    }
  }

  /**
   * 索引单条消息到 ES
   */
  async indexMessage(message: {
    id: string;
    content: string;
    conversationId: string;
    senderId: string;
    type: string;
    createdAt: Date;
  }) {
    if (!this.esAvailable) return;

    try {
      // 获取会话参与者
      const participants = await this.prisma.conversationParticipant.findMany({
        where: { conversationId: message.conversationId },
        select: { userId: true },
      });

      // 获取发送者名称
      const sender = await this.prisma.user.findUnique({
        where: { id: message.senderId },
        select: { nickname: true, username: true },
      });

      await fetch(`${this.esUrl}/messages/_doc/${message.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: message.content,
          conversationId: message.conversationId,
          senderId: message.senderId,
          senderName: sender?.nickname || sender?.username || '',
          participants: participants.map((p) => p.userId),
          type: message.type,
          createdAt: message.createdAt.toISOString(),
        }),
      });
    } catch (error) {
      this.logger.warn(`ES 索引失败: ${(error as Error).message}`);
    }
  }

  /**
   * 从 ES 删除消息索引
   */
  async removeMessage(messageId: string) {
    if (!this.esAvailable) return;

    try {
      await fetch(`${this.esUrl}/messages/_doc/${messageId}`, {
        method: 'DELETE',
      });
    } catch {
      // 忽略删除失败
    }
  }

  /**
   * 搜索消息：优先 ES，不可用时 fallback 到数据库
   */
  async searchMessages(query: string, userId: string, page = 1, pageSize = 20) {
    if (!query?.trim()) {
      return { items: [], total: 0, page, pageSize, hasMore: false };
    }

    if (this.esAvailable) {
      try {
        return await this.searchWithES(query, userId, page, pageSize);
      } catch (error) {
        this.logger.warn(`ES 搜索失败，回退到数据库: ${(error as Error).message}`);
      }
    }

    return this.searchWithDB(query, userId, page, pageSize);
  }

  /**
   * Elasticsearch 搜索
   */
  private async searchWithES(query: string, userId: string, page: number, pageSize: number) {
    const response = await fetch(`${this.esUrl}/messages/_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: {
          bool: {
            must: [{ match: { content: query } }],
            filter: [{ term: { participants: userId } }],
          },
        },
        from: (page - 1) * pageSize,
        size: pageSize,
        sort: [{ createdAt: 'desc' }],
        highlight: {
          fields: { content: { pre_tags: ['<mark>'], post_tags: ['</mark>'] } },
        },
      }),
    });

    const data = (await response.json()) as {
      hits?: {
        hits?: { _source: Record<string, unknown>; highlight?: Record<string, string[]>; _id: string }[];
        total?: { value: number };
      };
    };

    const items =
      data.hits?.hits?.map((hit) => ({
        id: hit._id,
        ...(hit._source as object),
        highlight: hit.highlight?.content?.[0] || null,
      })) || [];

    return {
      items,
      total: data.hits?.total?.value || 0,
      page,
      pageSize,
      hasMore: page * pageSize < (data.hits?.total?.value || 0),
    };
  }

  /**
   * 数据库搜索（fallback）
   */
  private async searchWithDB(query: string, userId: string, page: number, pageSize: number) {
    const userConversations = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true },
    });

    const conversationIds = userConversations.map((c) => c.conversationId);

    if (conversationIds.length === 0) {
      return { items: [], total: 0, page, pageSize, hasMore: false };
    }

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId: { in: conversationIds },
        content: { contains: query },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        sender: {
          select: { id: true, username: true, nickname: true, avatar: true },
        },
      },
    });

    const total = await this.prisma.message.count({
      where: {
        conversationId: { in: conversationIds },
        content: { contains: query },
      },
    });

    return {
      items: messages.map((m) => ({ ...m, highlight: null })),
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    };
  }
}
