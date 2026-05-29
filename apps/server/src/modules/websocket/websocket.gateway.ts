import {
  WebSocketGateway as WsGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MessageService } from '../message/message.service';
import { ChatService } from '../chat/chat.service';
import { UserService } from '../user/user.service';
import { RedisService } from '../../config/redis.service';
import type {
  JwtPayload,
  SendMessagePayload,
  MessageReadPayload,
  CallInvitePayload,
  CallAcceptPayload,
  CallRejectPayload,
  CallOfferPayload,
  CallAnswerPayload,
  CallIceCandidatePayload,
  CallEndPayload,
} from '@lingxun/types';
import { SOCKET_EVENTS, userRoom, conversationRoom, HEARTBEAT_CONFIG } from '@lingxun/socket';

@WsGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/',
  pingInterval: HEARTBEAT_CONFIG.INTERVAL,
  pingTimeout: HEARTBEAT_CONFIG.TIMEOUT,
})
export class WebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WebSocketGateway.name);
  private readonly heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();
  private readonly typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private messageService: MessageService,
    private chatService: ChatService,
    private userService: UserService,
    private redis: RedisService,
  ) {}

  // ==========================================
  // 连接生命周期
  // ==========================================

  async handleConnection(client: Socket) {
    try {
      // 1. 从 handshake 提取 token
      const token =
        client.handshake.auth?.token ||
        (client.handshake.headers?.authorization as string)?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`连接拒绝: 无 token - ${client.id}`);
        client.emit(SOCKET_EVENTS.ERROR, { code: 'NO_TOKEN', message: '未提供认证 token' });
        client.disconnect();
        return;
      }

      // 2. 验证 JWT
      let payload: JwtPayload;
      try {
        payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
      } catch {
        this.logger.warn(`连接拒绝: token 无效 - ${client.id}`);
        client.emit(SOCKET_EVENTS.ERROR, { code: 'INVALID_TOKEN', message: 'token 无效或已过期' });
        client.disconnect();
        return;
      }

      // 3. 检查是否已有同一用户的旧连接（踢掉旧连接）
      const oldSocketId = await this.redis.hget('user:socket', payload.sub);
      if (oldSocketId && oldSocketId !== client.id) {
        const oldSocket = this.server.sockets.sockets.get(oldSocketId);
        if (oldSocket) {
          oldSocket.emit(SOCKET_EVENTS.ERROR, {
            code: 'KICKED',
            message: '您的账号在其他设备登录',
          });
          oldSocket.disconnect();
        }
      }

      // 4. 绑定用户信息
      client.data.userId = payload.sub;
      client.data.username = payload.username;
      client.data.connectedAt = Date.now();
      client.data.lastHeartbeat = Date.now();

      // 5. 加入用户房间（用于接收私聊消息）
      client.join(userRoom(payload.sub));

      // 6. 加入用户所有会话房间
      const conversations = await this.chatService.getConversations(payload.sub);
      for (const conv of conversations) {
        client.join(conversationRoom(conv.id));
      }

      // 7. 记录在线状态到 Redis
      await Promise.all([
        this.redis.sadd('online:users', payload.sub),
        this.redis.hset('user:socket', payload.sub, client.id),
        this.userService.updateStatus(payload.sub, 'online'),
      ]);

      // 8. 启动心跳检测
      this.setupHeartbeat(client);

      // 9. 广播在线状态给所有用户的好友
      this.server.emit(SOCKET_EVENTS.PRESENCE_CHANGED, {
        userId: payload.sub,
        status: 'online',
      });

      this.logger.log(`用户连接: ${payload.username} [${payload.sub}] socket:${client.id}`);

      // 10. 发送连接成功确认
      client.emit('connected', {
        userId: payload.sub,
        socketId: client.id,
        conversationCount: conversations.length,
      });

      // 11. 同步离线消息
      await this.syncOfflineData(client, payload.sub);
    } catch (error) {
      this.logger.error(`连接处理异常: ${client.id}`, (error as Error).stack);
      client.emit(SOCKET_EVENTS.ERROR, { code: 'INTERNAL', message: '服务器内部错误' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId;
    if (!userId) return;

    // 1. 清除心跳定时器
    const heartTimer = this.heartbeatTimers.get(client.id);
    if (heartTimer) {
      clearInterval(heartTimer);
      this.heartbeatTimers.delete(client.id);
    }

    // 2. 清除输入状态定时器
    this.typingTimers.delete(`${userId}:*`);

    // 3. 更新在线状态
    await Promise.all([
      this.redis.srem('online:users', userId),
      this.redis.hdel('user:socket', userId),
      this.userService.updateStatus(userId, 'offline'),
    ]);

    // 4. 广播离线状态
    this.server.emit(SOCKET_EVENTS.PRESENCE_CHANGED, {
      userId,
      status: 'offline',
    });

    const duration = Date.now() - (client.data.connectedAt || Date.now());
    this.logger.log(
      `用户断开: ${userId} socket:${client.id} 在线时长:${Math.round(duration / 1000)}s`,
    );
  }

  // ==========================================
  // 消息事件
  // ==========================================

  /**
   * 发送消息（核心事件）
   *
   * 流程：
   * 1. 幂等检查（clientId 去重）
   * 2. 存储到数据库
   * 3. 返回 ACK 给发送者（含 messageId + seq）
   * 4. 广播给会话中其他在线用户
   */
  @SubscribeMessage(SOCKET_EVENTS.MESSAGE_SEND)
  async handleMessageSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: SendMessagePayload,
  ) {
    const userId = client.data.userId;

    try {
      // 参数校验
      if (!data.clientId || !data.conversationId || !data.content) {
        client.emit(SOCKET_EVENTS.ERROR, {
          event: SOCKET_EVENTS.MESSAGE_SEND,
          code: 'INVALID_PARAMS',
          message: '消息参数不完整',
          clientId: data.clientId,
        });
        return;
      }

      // 存储消息
      const message = await this.messageService.sendMessage({
        clientId: data.clientId,
        conversationId: data.conversationId,
        senderId: userId,
        type: data.type || 'text',
        content: data.content,
        metadata: data.metadata,
        replyToId: data.replyToId,
      });

      // Step 1: 立即返回 ACK 给发送者（表示服务端已接收）
      client.emit(SOCKET_EVENTS.MESSAGE_ACK, {
        clientId: data.clientId,
        messageId: message.id,
        seq: message.seq,
        status: 'sent',
      });

      // Step 2: 广播消息给会话中其他参与者
      this.server
        .to(conversationRoom(data.conversationId))
        .emit(SOCKET_EVENTS.MESSAGE_NEW, {
          ...message,
          // 附加发送者信息
          sender: {
            id: userId,
            username: client.data.username,
          },
        });

      this.logger.debug(`消息: ${data.clientId} -> ${message.id} seq:${message.seq}`);
    } catch (error) {
      const errMsg = (error as Error).message;
      this.logger.error(`消息发送失败: ${data.clientId}`, errMsg);

      client.emit(SOCKET_EVENTS.MESSAGE_STATUS, {
        clientId: data.clientId,
        status: 'failed',
        error: errMsg,
      });
    }
  }

  /**
   * 消息已读
   *
   * 流程：
   * 1. 更新数据库已读位置
   * 2. 通知会话中其他用户（消息状态变更为 read）
   * 3. 清除未读计数缓存
   */
  @SubscribeMessage(SOCKET_EVENTS.MESSAGE_READ)
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: MessageReadPayload,
  ) {
    const userId = client.data.userId;

    try {
      await this.messageService.markAsRead(data.conversationId, userId, data.lastReadSeq);

      // 通知会话中其他用户
      client
        .to(conversationRoom(data.conversationId))
        .emit(SOCKET_EVENTS.MESSAGE_STATUS, {
          conversationId: data.conversationId,
          userId,
          lastReadSeq: data.lastReadSeq,
          status: 'read',
        });

      this.logger.debug(
        `已读: user:${userId} conv:${data.conversationId} seq:${data.lastReadSeq}`,
      );
    } catch (error) {
      this.logger.error(`标记已读失败`, (error as Error).message);
    }
  }

  // ==========================================
  // 会话房间事件
  // ==========================================

  @SubscribeMessage(SOCKET_EVENTS.CONVERSATION_JOIN)
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data.conversationId) return;
    client.join(conversationRoom(data.conversationId));
    this.logger.debug(`加入房间: user:${client.data.userId} conv:${data.conversationId}`);
  }

  @SubscribeMessage(SOCKET_EVENTS.CONVERSATION_LEAVE)
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data.conversationId) return;
    client.leave(conversationRoom(data.conversationId));
    this.logger.debug(`离开房间: user:${client.data.userId} conv:${data.conversationId}`);
  }

  // ==========================================
  // 输入状态事件（带防抖）
  // ==========================================

  @SubscribeMessage(SOCKET_EVENTS.TYPING_START)
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data.conversationId) return;

    const userId = client.data.userId;
    const timerKey = `${userId}:${data.conversationId}`;

    // 清除之前的停止定时器
    const existingTimer = this.typingTimers.get(timerKey);
    if (existingTimer) clearTimeout(existingTimer);

    // 广播输入中
    client
      .to(conversationRoom(data.conversationId))
      .emit(SOCKET_EVENTS.TYPING_UPDATE, {
        conversationId: data.conversationId,
        userId,
        isTyping: true,
      });

    // 5 秒后自动发送停止输入
    const timer = setTimeout(() => {
      client
        .to(conversationRoom(data.conversationId))
        .emit(SOCKET_EVENTS.TYPING_UPDATE, {
          conversationId: data.conversationId,
          userId,
          isTyping: false,
        });
      this.typingTimers.delete(timerKey);
    }, 5000);

    this.typingTimers.set(timerKey, timer);
  }

  @SubscribeMessage(SOCKET_EVENTS.TYPING_STOP)
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    if (!data.conversationId) return;

    const userId = client.data.userId;
    const timerKey = `${userId}:${data.conversationId}`;

    // 清除自动停止定时器
    const existingTimer = this.typingTimers.get(timerKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.typingTimers.delete(timerKey);
    }

    client
      .to(conversationRoom(data.conversationId))
      .emit(SOCKET_EVENTS.TYPING_UPDATE, {
        conversationId: data.conversationId,
        userId,
        isTyping: false,
      });
  }

  // ==========================================
  // 心跳
  // ==========================================

  @SubscribeMessage(SOCKET_EVENTS.HEARTBEAT)
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    client.data.lastHeartbeat = Date.now();
    client.emit(SOCKET_EVENTS.HEARTBEAT_ACK, { timestamp: Date.now() });
  }

  // ==========================================
  // 通话信令事件
  // ==========================================

  @SubscribeMessage(SOCKET_EVENTS.CALL_INVITE)
  async handleCallInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallInvitePayload,
  ) {
    const userId = client.data.userId;
    if (userId !== data.callerId) return;

    const calleeOnline = await this.isUserOnline(data.calleeId);
    if (!calleeOnline) {
      client.emit(SOCKET_EVENTS.CALL_REJECT, {
        conversationId: data.conversationId,
        calleeId: data.calleeId,
        callerId: data.callerId,
      });
      return;
    }

    this.server
      .to(userRoom(data.calleeId))
      .emit(SOCKET_EVENTS.CALL_INVITE, data);

    this.logger.debug(`通话邀请: ${data.callerId} -> ${data.calleeId} (${data.callType})`);
  }

  @SubscribeMessage(SOCKET_EVENTS.CALL_ACCEPT)
  handleCallAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallAcceptPayload,
  ) {
    this.server
      .to(userRoom(data.callerId))
      .emit(SOCKET_EVENTS.CALL_ACCEPT, data);

    this.logger.debug(`通话接受: ${data.calleeId} -> ${data.callerId}`);
  }

  @SubscribeMessage(SOCKET_EVENTS.CALL_REJECT)
  handleCallReject(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: CallRejectPayload,
  ) {
    this.server
      .to(userRoom(data.callerId))
      .emit(SOCKET_EVENTS.CALL_REJECT, data);

    this.logger.debug(`通话拒绝: ${data.calleeId} -> ${data.callerId}`);
  }

  @SubscribeMessage(SOCKET_EVENTS.CALL_OFFER)
  handleCallOffer(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: CallOfferPayload,
  ) {
    this.server
      .to(userRoom(data.targetUserId))
      .emit(SOCKET_EVENTS.CALL_OFFER, data);
  }

  @SubscribeMessage(SOCKET_EVENTS.CALL_ANSWER)
  handleCallAnswer(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: CallAnswerPayload,
  ) {
    this.server
      .to(userRoom(data.targetUserId))
      .emit(SOCKET_EVENTS.CALL_ANSWER, data);
  }

  @SubscribeMessage(SOCKET_EVENTS.CALL_ICE_CANDIDATE)
  handleCallIceCandidate(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: CallIceCandidatePayload,
  ) {
    this.server
      .to(userRoom(data.targetUserId))
      .emit(SOCKET_EVENTS.CALL_ICE_CANDIDATE, data);
  }

  @SubscribeMessage(SOCKET_EVENTS.CALL_END)
  handleCallEnd(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: CallEndPayload,
  ) {
    this.server
      .to(userRoom(data.targetUserId))
      .emit(SOCKET_EVENTS.CALL_END, data);

    this.logger.debug(`通话结束: conv:${data.conversationId}`);
  }

  // ==========================================
  // 私有方法
  // ==========================================

  private setupHeartbeat(client: Socket) {
    const timer = setInterval(() => {
      if (!client.connected) {
        clearInterval(timer);
        this.heartbeatTimers.delete(client.id);
        return;
      }

      const lastBeat = client.data.lastHeartbeat || 0;
      const elapsed = Date.now() - lastBeat;

      if (elapsed > HEARTBEAT_CONFIG.INTERVAL * (HEARTBEAT_CONFIG.MAX_MISSED + 1)) {
        this.logger.warn(`心跳超时: ${client.data.userId} (${elapsed}ms 无响应)`);
        client.disconnect();
      }
    }, HEARTBEAT_CONFIG.INTERVAL);

    this.heartbeatTimers.set(client.id, timer);
  }

  /**
   * 同步离线数据
   * 用户连接后，推送其离线期间的消息
   */
  private async syncOfflineData(client: Socket, userId: string) {
    try {
      // 获取用户所有会话
      const conversations = await this.chatService.getConversations(userId);

      let totalSynced = 0;

      for (const conv of conversations) {
        // 获取该会话上次已读位置
        const lastReadSeq = conv.lastReadSeq || 0;

        // 获取该位置之后的消息
        const messages = await this.messageService.getOfflineMessages(
          conv.id,
          lastReadSeq,
          50,
        );

        if (messages.length > 0) {
          client.emit(SOCKET_EVENTS.SYNC_OFFLINE, {
            conversationId: conv.id,
            messages,
            count: messages.length,
          });
          totalSynced += messages.length;
        }
      }

      if (totalSynced > 0) {
        this.logger.log(`离线同步: ${userId} 共 ${totalSynced} 条消息`);
      }
    } catch (error) {
      this.logger.error(`离线同步失败: ${userId}`, (error as Error).message);
    }
  }

  // ==========================================
  // 公共方法（供其他模块调用）
  // ==========================================

  /**
   * 向指定用户发送事件
   */
  sendToUser(userId: string, event: string, data: unknown) {
    this.server.to(userRoom(userId)).emit(event, data);
  }

  /**
   * 向指定会话发送事件
   */
  sendToConversation(conversationId: string, event: string, data: unknown) {
    this.server.to(conversationRoom(conversationId)).emit(event, data);
  }

  /**
   * 检查用户是否在线
   */
  async isUserOnline(userId: string): Promise<boolean> {
    return this.redis.sismember('online:users', userId);
  }
}
