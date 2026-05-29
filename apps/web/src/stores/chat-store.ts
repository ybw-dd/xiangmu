'use client';

import { create } from 'zustand';
import type { Conversation, Message, MessageStatus } from '@lingxun/types';

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Map<string, Message[]>; // conversationId -> messages
  typingUsers: Map<string, Set<string>>; // conversationId -> userIds

  // 操作
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessageStatus: (clientId: string, status: MessageStatus, messageId?: string, seq?: number) => void;
  markConversationAsRead: (conversationId: string, lastReadSeq: number) => void;
  setMessages: (conversationId: string, messages: Message[]) => void;
  prependMessages: (conversationId: string, messages: Message[]) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  incrementUnread: (conversationId: string) => void;
  clearUnread: (conversationId: string) => void;
}

export const useChatStore = create<ChatState>()((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: new Map(),
  typingUsers: new Map(),

  setConversations: (conversations) => set({ conversations }),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  addMessage: (conversationId, message) => {
    set((state) => {
      const messages = new Map(state.messages);
      const existing = messages.get(conversationId) || [];

      // 幂等：检查是否已存在
      const alreadyExists = existing.some(
        (m) => m.id === message.id || m.clientId === message.clientId,
      );
      if (alreadyExists) return state;

      messages.set(conversationId, [...existing, message]);

      // 更新会话的最后消息时间
      const conversations = state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, lastMessageAt: message.createdAt, lastMessageId: message.id }
          : c,
      );

      return { messages, conversations };
    });
  },

  updateMessageStatus: (clientId, status, messageId, seq) => {
    set((state) => {
      const messages = new Map(state.messages);
      let updated = false;

      messages.forEach((msgs, convId) => {
        const newMsgs = msgs.map((m) => {
          if (m.clientId === clientId) {
            updated = true;
            return { ...m, status, ...(messageId && { id: messageId }), ...(seq && { seq }) };
          }
          return m;
        });
        if (updated) {
          messages.set(convId, newMsgs);
        }
      });

      return { messages };
    });
  },

  setMessages: (conversationId, msgs) => {
    set((state) => {
      const messages = new Map(state.messages);
      messages.set(conversationId, msgs);
      return { messages };
    });
  },

  prependMessages: (conversationId, newMessages) => {
    set((state) => {
      const messages = new Map(state.messages);
      const existing = messages.get(conversationId) || [];
      messages.set(conversationId, [...newMessages, ...existing]);
      return { messages };
    });
  },

  setTyping: (conversationId, userId, isTyping) => {
    set((state) => {
      const typingUsers = new Map(state.typingUsers);
      const users = new Set(typingUsers.get(conversationId) || []);

      if (isTyping) {
        users.add(userId);
      } else {
        users.delete(userId);
      }

      typingUsers.set(conversationId, users);
      return { typingUsers };
    });
  },

  incrementUnread: (conversationId) => {
    set((state) => {
      const conversations = state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } : c,
      );
      return { conversations };
    });
  },

  clearUnread: (conversationId) => {
    set((state) => {
      const conversations = state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c,
      );
      return { conversations };
    });
  },

  markConversationAsRead: (conversationId, lastReadSeq) => {
    set((state) => {
      const messages = new Map(state.messages);
      const msgs = messages.get(conversationId);
      if (msgs) {
        messages.set(
          conversationId,
          msgs.map((m) =>
            m.seq > 0 && m.seq <= lastReadSeq && m.status !== 'read'
              ? { ...m, status: 'read' as MessageStatus }
              : m,
          ),
        );
      }
      // 同时清除未读徽标
      const conversations = state.conversations.map((c) =>
        c.id === conversationId ? { ...c, unreadCount: 0 } : c,
      );
      return { messages, conversations };
    });
  },
}));
