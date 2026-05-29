'use client';

/**
 * Socket.IO 客户端管理
 */
import { io, Socket } from 'socket.io-client';
import { SOCKET_EVENTS, HEARTBEAT_CONFIG, RECONNECT_CONFIG } from '@lingxun/socket';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';

class SocketManager {
  private socket: Socket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private listeners: Map<string, Set<Function>> = new Map();

  /**
   * 连接 WebSocket
   */
  connect(token: string): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: RECONNECT_CONFIG.MAX_ATTEMPTS,
      reconnectionDelay: RECONNECT_CONFIG.INITIAL_DELAY,
      reconnectionDelayMax: RECONNECT_CONFIG.MAX_DELAY,
      timeout: 10000,
    });

    this.setupEventListeners();
    return this.socket;
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.reconnectAttempts = 0;
  }

  /**
   * 获取 Socket 实例
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * 发送消息
   */
  emit(event: string, data: unknown) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    }
  }

  /**
   * 监听事件
   */
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    this.socket?.on(event, callback as any);
  }

  /**
   * 取消监听
   */
  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback);
    this.socket?.off(event, callback as any);
  }

  /**
   * 设置事件监听
   */
  private setupEventListeners() {
    if (!this.socket) return;

    // 连接成功
    this.socket.on('connect', () => {
      console.log('[Socket] 连接成功:', this.socket?.id);
      this.reconnectAttempts = 0;
      this.startHeartbeat();
    });

    // 连接错误
    this.socket.on('connect_error', (error) => {
      console.error('[Socket] 连接错误:', error.message);
      this.reconnectAttempts++;
    });

    // 断开连接
    this.socket.on('disconnect', (reason) => {
      console.log('[Socket] 断开连接:', reason);
      this.stopHeartbeat();
    });

    // 心跳响应
    this.socket.on(SOCKET_EVENTS.HEARTBEAT_ACK, () => {
      // 心跳正常
    });

    // 重新注册所有监听器
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach((callback) => {
        this.socket?.on(event, callback as any);
      });
    });
  }

  /**
   * 启动心跳
   */
  private startHeartbeat() {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit(SOCKET_EVENTS.HEARTBEAT, { timestamp: Date.now() });
      }
    }, HEARTBEAT_CONFIG.INTERVAL);
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

// 单例
export const socketManager = new SocketManager();
