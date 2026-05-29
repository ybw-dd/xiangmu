'use client';

import { useQuery } from '@tanstack/react-query';
import { searchMessagesApi } from './api';

export function useSearchMessages(query: string) {
  return useQuery({
    queryKey: ['search', 'messages', query],
    queryFn: () => searchMessagesApi(query),
    enabled: query.trim().length >= 2,
    staleTime: 10 * 1000, // 10 秒
  });
}
