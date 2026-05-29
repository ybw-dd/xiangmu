'use client';

import { useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import { socketManager } from '@/lib/socket';
import { SOCKET_EVENTS } from '@lingxun/socket';
import { MessageStatus } from '@lingxun/types';
import type { Message, MessageAckPayload, TypingUpdatePayload } from '@lingxun/types';

interface SyncOfflinePayload {
  conversationId: string;
  messages: Message[];
  count: number;
}

interface ReadStatusPayload {
  conversationId: string;
  userId: string;
  lastReadSeq: number;
  status: string;
}

export function useWebSocket() {
  const { accessToken, isAuthenticated } = useAuthStore();
  const {
    addMessage,
    updateMessageStatus,
    markConversationAsRead,
    setTyping,
    incrementUnread,
    clearUnread,
    setMessages,
  } = useChatStore();

  useEffect(() => {
    if (!accessToken || !isAuthenticated) return;

    const socket = socketManager.connect(accessToken);

    const onNewMessage = (message: Message) => {
      addMessage(message.conversationId, message);
      const activeConvId = useChatStore.getState().activeConversationId;
      if (message.conversationId !== activeConvId) {
        incrementUnread(message.conversationId);
      }
    };

    const onMessageAck = (data: MessageAckPayload) => {
      updateMessageStatus(data.clientId, MessageStatus.SENT, data.messageId, data.seq);
    };

    const onMessageStatus = (data: ReadStatusPayload) => {
      if (data.status === 'read') {
        // 其他用户已读了我们的消息，批量标记为已读
        markConversationAsRead(data.conversationId, data.lastReadSeq);
      }
    };

    const onSyncOffline = (data: SyncOfflinePayload) => {
      if (!data.messages?.length) return;
      const currentMessages = useChatStore.getState().messages.get(data.conversationId) || [];
      const existingIds = new Set(currentMessages.map((m) => m.id));
      const newMessages = data.messages.filter((m) => !existingIds.has(m.id));
      if (newMessages.length > 0) {
        setMessages(data.conversationId, [...currentMessages, ...newMessages]);
      }
      // 离线同步完成，清除未读徽标（用户已连接并收到消息）
      clearUnread(data.conversationId);
    };

    const onTypingUpdate = (data: TypingUpdatePayload) => {
      setTyping(data.conversationId, data.userId, data.isTyping);
    };

    const onError = (error: { code: string; message: string }) => {
      console.error('[WS] 错误:', error.code, error.message);
    };

    socket.on(SOCKET_EVENTS.MESSAGE_NEW, onNewMessage);
    socket.on(SOCKET_EVENTS.MESSAGE_ACK, onMessageAck);
    socket.on(SOCKET_EVENTS.MESSAGE_STATUS, onMessageStatus);
    socket.on(SOCKET_EVENTS.SYNC_OFFLINE, onSyncOffline);
    socket.on(SOCKET_EVENTS.TYPING_UPDATE, onTypingUpdate);
    socket.on(SOCKET_EVENTS.ERROR, onError);

    return () => {
      socket.off(SOCKET_EVENTS.MESSAGE_NEW, onNewMessage);
      socket.off(SOCKET_EVENTS.MESSAGE_ACK, onMessageAck);
      socket.off(SOCKET_EVENTS.MESSAGE_STATUS, onMessageStatus);
      socket.off(SOCKET_EVENTS.SYNC_OFFLINE, onSyncOffline);
      socket.off(SOCKET_EVENTS.TYPING_UPDATE, onTypingUpdate);
      socket.off(SOCKET_EVENTS.ERROR, onError);
    };
  }, [accessToken, isAuthenticated, addMessage, updateMessageStatus, markConversationAsRead, setTyping, incrementUnread, clearUnread, setMessages]);

  const sendMessage = useCallback(
    (payload: {
      clientId: string;
      conversationId: string;
      type: string;
      content: string;
      metadata?: Record<string, unknown>;
      replyToId?: string;
    }) => {
      socketManager.emit(SOCKET_EVENTS.MESSAGE_SEND, payload);
    },
    [],
  );

  const markAsRead = useCallback((conversationId: string, lastReadSeq: number) => {
    socketManager.emit(SOCKET_EVENTS.MESSAGE_READ, { conversationId, lastReadSeq });
  }, []);

  const joinConversation = useCallback((conversationId: string) => {
    socketManager.emit(SOCKET_EVENTS.CONVERSATION_JOIN, { conversationId });
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    socketManager.emit(SOCKET_EVENTS.CONVERSATION_LEAVE, { conversationId });
  }, []);

  const startTyping = useCallback((conversationId: string) => {
    socketManager.emit(SOCKET_EVENTS.TYPING_START, { conversationId });
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    socketManager.emit(SOCKET_EVENTS.TYPING_STOP, { conversationId });
  }, []);

  return {
    isConnected: () => socketManager.isConnected(),
    sendMessage,
    markAsRead,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
  };
}
