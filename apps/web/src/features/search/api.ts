'use client';

import { api } from '@/lib/api';

export interface SearchResult {
  id: string;
  content: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  type: string;
  createdAt: string;
  highlight?: string | null;
  // DB fallback fields
  sender?: {
    id: string;
    username: string;
    nickname: string;
    avatar: string | null;
  };
  metadata?: string | null;
}

export interface SearchResponse {
  items: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export async function searchMessagesApi(query: string, page = 1): Promise<SearchResponse> {
  return api.get<SearchResponse>('/search/messages', { q: query, page });
}
