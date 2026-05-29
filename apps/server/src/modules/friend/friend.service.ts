import { Injectable, ConflictException, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class FriendService {
  private readonly logger = new Logger(FriendService.name);

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => WebsocketGateway))
    private websocketGateway: WebsocketGateway,
  ) {}

  async acceptRequest(requestId: string) {
    const request = await this.prisma.friend.update({
      where: { id: requestId },
      data: { status: 'accepted' },
      include: {
        user: { select: { id: true, username: true, nickname: true, avatar: true } },
        friend: { select: { id: true, username: true, nickname: true, avatar: true } },
      },
    });

    // 创建私聊会话
    const conversation = await this.prisma.conversation.create({
      data: {
        type: 'private',
        participants: {
          create: [
            { userId: request.userId },
            { userId: request.friendId },
          ],
        },
      },
    });

    this.logger.log(`好友请求已接受: ${requestId}, 会话: ${conversation.id}`);

    // 通知双方好友状态变更
    const friendInfo = request.user.id === request.friendId ? request.friend : request.user;
    this.websocketGateway.sendToUser(request.friendId, 'friend:added', {
      friend: { ...friendInfo, status: 'offline' },
      conversationId: conversation.id,
    });
    this.websocketGateway.sendToUser(request.userId, 'friend:added', {
      friend: { ...request.friend, status: 'offline' },
      conversationId: conversation.id,
    });

    return request;
  }

  /**
   * 拒绝好友请求
   */
  async rejectRequest(requestId: string) {
    const request = await this.prisma.friend.findUnique({
      where: { id: requestId },
      include: { user: { select: { id: true, username: true, nickname: true } } },
    });

    await this.prisma.friend.update({
      where: { id: requestId },
      data: { status: 'rejected' },
    });

    // 通知发送方请求被拒绝
    if (request) {
      this.websocketGateway.sendToUser(request.userId, 'friend:rejected', {
        requestId,
        rejectedBy: request.friendId,
      });
    }

    return request;
  }

  /**
   * 发送好友请求
   */
  async sendRequest(userId: string, friendId: string, remark?: string) {
    if (userId === friendId) {
      throw new ConflictException('不能添加自己为好友');
    }

    // 检查是否已经是好友
    const existing = await this.prisma.friend.findFirst({
      where: {
        OR: [
          { userId, friendId, status: 'accepted' },
          { userId: friendId, friendId: userId, status: 'accepted' },
        ],
      },
    });

    if (existing) {
      throw new ConflictException('已经是好友了');
    }

    // 检查是否已有待处理的请求
    const pending = await this.prisma.friend.findFirst({
      where: {
        OR: [
          { userId, friendId, status: 'pending' },
          { userId: friendId, friendId: userId, status: 'pending' },
        ],
      },
    });

    if (pending) {
      throw new ConflictException('好友请求已存在');
    }

    const request = await this.prisma.friend.create({
      data: { userId, friendId, remark, status: 'pending' },
      include: {
        user: { select: { id: true, username: true, nickname: true, avatar: true } },
      },
    });

    this.logger.log(`好友请求: ${userId} -> ${friendId}`);

    // 通知接收方有新好友请求
    this.websocketGateway.sendToUser(friendId, 'friend:request', {
      id: request.id,
      user: request.user,
      remark: request.remark,
      createdAt: request.createdAt,
    });

    return request;
  }

  /**
   * 获取好友列表
   */
  async getFriends(userId: string) {
    const friends = await this.prisma.friend.findMany({
      where: {
        OR: [{ userId }, { friendId: userId }],
        status: 'accepted',
      },
      include: {
        user: { select: { id: true, username: true, nickname: true, avatar: true, status: true } },
        friend: { select: { id: true, username: true, nickname: true, avatar: true, status: true } },
      },
    });

    return friends.map((f) => (f.userId === userId ? f.friend : f.user));
  }

  /**
   * 获取待处理的请求
   */
  async getPendingRequests(userId: string) {
    return this.prisma.friend.findMany({
      where: {
        friendId: userId,
        status: 'pending',
      },
      include: {
        user: { select: { id: true, username: true, nickname: true, avatar: true } },
      },
    });
  }

  /**
   * 删除好友
   */
  async removeFriend(userId: string, friendId: string) {
    return this.prisma.friend.deleteMany({
      where: {
        OR: [
          { userId, friendId },
          { userId: friendId, friendId: userId },
        ],
      },
    });
  }
}
