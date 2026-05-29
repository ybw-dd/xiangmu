'use client';

import { api } from '@/lib/api';
import type { Conversation, Message } from '@lingxun/types';

export async function getConversationsApi(page = 1): Promise<Conversation[]> {
  return api.get<Conversation[]>('/chats', { page });
}

export async function createPrivateChatApi(friendId: string): Promise<Conversation> {
  return api.post<Conversation>('/chats/private', { friendId });
}

export async function getMessagesApi(
  conversationId: string,
  cursor?: string,
  limit = 20,
): Promise<{ items: Message[]; hasMore: boolean; cursor: string | null }> {
  const params: Record<string, string | number> = { limit };
  if (cursor) params.cursor = cursor;
  return api.get(`/messages/conversation/${conversationId}`, params);
}

export async function markAsReadApi(conversationId: string, lastReadSeq: number): Promise<void> {
  return api.post(`/messages/conversation/${conversationId}/read`, { lastReadSeq });
}
