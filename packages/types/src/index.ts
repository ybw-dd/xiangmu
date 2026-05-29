/**
 * @lingxun/types - 灵讯 IM 系统共享类型定义
 */

// ==========================================
// 用户相关类型
// ==========================================
export interface User {
  id: string;
  username: string;
  nickname: string;
  email: string;
  avatar: string | null;
  status: UserStatus;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  AWAY = 'away',
  BUSY = 'busy',
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  username: string;
  email: string;
  iat?: number;
  exp?: number;
}

// ==========================================
// 会话相关类型
// ==========================================
export interface Conversation {
  id: string;
  type: ConversationType;
  name: string | null;
  avatar: string | null;
  lastMessageId: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
  // 服务端计算的显示名（私聊取对方昵称）
  displayName?: string | null;
  displayAvatar?: string | null;
  // 好友列表信息
  participants?: ConversationParticipant[];
  // 群组信息（仅群组会话）
  group?: { id: string; name: string } | null;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  lastReadSeq: number;
  joinedAt: Date;
  user?: User;
}

export enum ConversationType {
  PRIVATE = 'private',
  GROUP = 'group',
}

// ==========================================
// 消息相关类型
// ==========================================
export interface Message {
  id: string;
  clientId?: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  content: string;
  metadata: Record<string, unknown> | null;
  seq: number;
  status: MessageStatus;
  replyToId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export enum MessageType {
  TEXT = 'text',
  IMAGE = 'image',
  FILE = 'file',
  AUDIO = 'audio',
  VIDEO = 'video',
  SYSTEM = 'system',
  AI = 'ai',
}

export enum MessageStatus {
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
}

export interface MessageRead {
  userId: string;
  messageId: string;
  readAt: Date;
}

// ==========================================
// 好友相关类型
// ==========================================
export interface Friend {
  id: string;
  userId: string;
  friendId: string;
  remark: string | null;
  status: FriendStatus;
  createdAt: Date;
}

export enum FriendStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  BLOCKED = 'blocked',
}

// ==========================================
// 群组相关类型
// ==========================================
export interface Group {
  id: string;
  name: string;
  avatar: string | null;
  description: string | null;
  ownerId: string;
  maxMembers: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: GroupRole;
  nickname: string | null;
  joinedAt: Date;
}

export enum GroupRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  MEMBER = 'member',
}

// ==========================================
// 附件相关类型
// ==========================================
export interface Attachment {
  id: string;
  url: string;
  filename: string;
  mimetype: string;
  size: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  uploaderId: string;
  createdAt: Date;
}

// ==========================================
// 通话相关类型
// ==========================================
export enum CallType {
  AUDIO = 'audio',
  VIDEO = 'video',
}

export enum CallStatus {
  IDLE = 'idle',
  CALLING = 'calling',
  RINGING = 'ringing',
  CONNECTING = 'connecting',
  IN_CALL = 'in_call',
  ENDED = 'ended',
}

export interface CallInvitePayload {
  conversationId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string | null;
  calleeId: string;
  callType: CallType;
}

export interface CallAcceptPayload {
  conversationId: string;
  calleeId: string;
  callerId: string;
}

export interface CallRejectPayload {
  conversationId: string;
  calleeId: string;
  callerId: string;
}

export interface CallOfferPayload {
  conversationId: string;
  targetUserId: string;
  offer: RTCSessionDescriptionInit;
}

export interface CallAnswerPayload {
  conversationId: string;
  targetUserId: string;
  answer: RTCSessionDescriptionInit;
}

export interface CallIceCandidatePayload {
  conversationId: string;
  targetUserId: string;
  candidate: RTCIceCandidateInit;
}

export interface CallEndPayload {
  conversationId: string;
  targetUserId: string;
}

// ==========================================
// 通知相关类型
// ==========================================
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  content: string;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: Date;
}

export enum NotificationType {
  FRIEND_REQUEST = 'friend_request',
  FRIEND_ACCEPTED = 'friend_accepted',
  GROUP_INVITE = 'group_invite',
  GROUP_JOIN = 'group_join',
  MENTION = 'mention',
  SYSTEM = 'system',
}

// ==========================================
// Socket.IO 事件类型
// ==========================================
export interface SocketEvents {
  // 客户端 -> 服务端
  'message:send': (data: SendMessagePayload) => void;
  'message:ack': (data: MessageAckPayload) => void;
  'message:read': (data: MessageReadPayload) => void;
  'presence:update': (data: PresenceUpdatePayload) => void;
  'typing:start': (data: TypingPayload) => void;
  'typing:stop': (data: TypingPayload) => void;
  'conversation:join': (data: { conversationId: string }) => void;
  'conversation:leave': (data: { conversationId: string }) => void;

  // 通话信令（客户端 <-> 服务端 双向）
  'call:invite': (data: CallInvitePayload) => void;
  'call:accept': (data: CallAcceptPayload) => void;
  'call:reject': (data: CallRejectPayload) => void;
  'call:offer': (data: CallOfferPayload) => void;
  'call:answer': (data: CallAnswerPayload) => void;
  'call:ice-candidate': (data: CallIceCandidatePayload) => void;
  'call:end': (data: CallEndPayload) => void;

  // 服务端 -> 客户端
  'message:new': (data: Message) => void;
  'message:status': (data: MessageStatusUpdate) => void;
  'presence:changed': (data: { userId: string; status: UserStatus }) => void;
  'typing:update': (data: TypingUpdatePayload) => void;
  'notification:new': (data: Notification) => void;
  'sync:offline': (data: OfflineSyncPayload) => void;
}

export interface SendMessagePayload {
  clientId: string;
  conversationId: string;
  type: MessageType;
  content: string;
  metadata?: Record<string, unknown>;
  replyToId?: string;
}

export interface MessageAckPayload {
  clientId: string;
  messageId: string;
  seq: number;
}

export interface MessageReadPayload {
  conversationId: string;
  lastReadSeq: number;
}

export interface PresenceUpdatePayload {
  status: UserStatus;
}

export interface TypingPayload {
  conversationId: string;
}

export interface TypingUpdatePayload {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

export interface MessageStatusUpdate {
  clientId: string;
  messageId: string;
  status: MessageStatus;
  seq: number;
}

export interface OfflineSyncPayload {
  messages: Message[];
  notifications: Notification[];
  lastSeq: number;
}

// ==========================================
// API 响应类型
// ==========================================
export interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
  timestamp: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  cursor?: string;
}
