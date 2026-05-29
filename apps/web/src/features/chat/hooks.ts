'use client';

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useChatStore } from '@/stores/chat-store';
import { getConversationsApi, createPrivateChatApi, getMessagesApi, markAsReadApi } from './api';

export function useConversations() {
  const { setConversations } = useChatStore();

  return useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const data = await getConversationsApi();
      setConversations(data);
      return data;
    },
    staleTime: 30 * 1000, // 30秒
  });
}

export function useMessages(conversationId: string | null) {
  const { setMessages } = useChatStore();

  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return { items: [], hasMore: false, cursor: null };
      const data = await getMessagesApi(conversationId);
      setMessages(conversationId, data.items);
      return data;
    },
    enabled: !!conversationId,
    staleTime: 10 * 1000,
  });
}

/**
 * 消息分页加载 - 滚动到顶部加载更多历史消息
 */
export function useLoadMoreMessages(conversationId: string | null) {
  const { prependMessages } = useChatStore();
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadMore = useCallback(async () => {
    if (!conversationId || !hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const data = await getMessagesApi(conversationId, cursor || undefined);
      if (data.items.length > 0) {
        prependMessages(conversationId, data.items);
        setCursor(data.cursor);
      }
      setHasMore(data.hasMore);
    } finally {
      setIsLoadingMore(false);
    }
  }, [conversationId, cursor, hasMore, isLoadingMore, prependMessages]);

  // 重置状态（切换会话时）
  const reset = useCallback(() => {
    setCursor(null);
    setHasMore(true);
    setIsLoadingMore(false);
  }, []);

  return { loadMore, hasMore, isLoadingMore, reset };
}

export function useCreatePrivateChat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPrivateChatApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useMarkAsRead() {
  const { clearUnread } = useChatStore();

  return useMutation({
    mutationFn: ({ conversationId, lastReadSeq }: { conversationId: string; lastReadSeq: number }) =>
      markAsReadApi(conversationId, lastReadSeq),
    onSuccess: (_, { conversationId }) => {
      clearUnread(conversationId);
    },
  });
}
