'use client';

import { useMutation } from '@tanstack/react-query';
import { aiChatApi, aiTranslateApi, aiSummarizeApi, type ChatMessage } from './api';

export function useAIChat() {
  const mutation = useMutation({
    mutationFn: (messages: ChatMessage[]) => aiChatApi(messages),
  });

  return {
    sendAIMessage: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
  };
}

export function useAITranslate() {
  const mutation = useMutation({
    mutationFn: ({ text, targetLang }: { text: string; targetLang: string }) =>
      aiTranslateApi(text, targetLang),
  });

  return {
    translate: mutation.mutateAsync,
    isLoading: mutation.isPending,
  };
}

export function useAISummarize() {
  const mutation = useMutation({
    mutationFn: (messages: { sender: string; content: string; time: string }[]) =>
      aiSummarizeApi(messages),
  });

  return {
    summarize: mutation.mutateAsync,
    isLoading: mutation.isPending,
  };
}
