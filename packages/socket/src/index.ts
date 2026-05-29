/**
 * @lingxun/socket - Socket.IO 共享事件协议定义
 */

// ==========================================
// Socket.IO 事件常量
// ==========================================
export const SOCKET_EVENTS = {
  // 连接事件
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',

  // 心跳
  HEARTBEAT: 'heartbeat',
  HEARTBEAT_ACK: 'heartbeat_ack',

  // 消息事件
  MESSAGE_SEND: 'message:send',
  MESSAGE_NEW: 'message:new',
  MESSAGE_ACK: 'message:ack',
  MESSAGE_STATUS: 'message:status',
  MESSAGE_READ: 'message:read',
  MESSAGE_RECALL: 'message:recall',

  // 输入状态
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  TYPING_UPDATE: 'typing:update',

  // 在线状态
  PRESENCE_UPDATE: 'presence:update',
  PRESENCE_CHANGED: 'presence:changed',

  // 会话
  CONVERSATION_JOIN: 'conversation:join',
  CONVERSATION_LEAVE: 'conversation:leave',
  CONVERSATION_UPDATE: 'conversation:update',

  // 离线同步
  SYNC_OFFLINE: 'sync:offline',
  SYNC_REQUEST: 'sync:request',

  // 通知
  NOTIFICATION_NEW: 'notification:new',

  // 通话
  CALL_INVITE: 'call:invite',
  CALL_ACCEPT: 'call:accept',
  CALL_REJECT: 'call:reject',
  CALL_OFFER: 'call:offer',
  CALL_ANSWER: 'call:answer',
  CALL_ICE_CANDIDATE: 'call:ice-candidate',
  CALL_END: 'call:end',

  // 错误
  ERROR: 'error',

  // 好友
  FRIEND_REQUEST: 'friend:request',
  FRIEND_ACCEPTED: 'friend:accepted',
  FRIEND_REJECTED: 'friend:rejected',
  FRIEND_ADDED: 'friend:added',
  FRIEND_REMOVED: 'friend:removed',
} as const;

// ==========================================
// 心跳配置
// ==========================================
export const HEARTBEAT_CONFIG = {
  INTERVAL: 25_000, // 25秒
  TIMEOUT: 10_000, // 10秒超时
  MAX_MISSED: 3, // 最多丢失3次心跳
} as const;

// ==========================================
// 重连配置
// ==========================================
export const RECONNECT_CONFIG = {
  MAX_ATTEMPTS: 10,
  INITIAL_DELAY: 1_000,
  MAX_DELAY: 30_000,
  BACKOFF_FACTOR: 1.5,
} as const;

// ==========================================
// Socket 房间名生成
// ==========================================
export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}

export function groupRoom(groupId: string): string {
  return `group:${groupId}`;
}
