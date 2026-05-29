'use client';

import { api } from '@/lib/api';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export async function aiChatApi(messages: ChatMessage[], model?: string): Promise<string> {
  const data = await api.post<{ response: string }>('/ai/chat', { messages, model });
  return data.response;
}

export async function aiTranslateApi(text: string, targetLang: string): Promise<string> {
  const data = await api.post<{ translation: string }>('/ai/translate', { text, targetLang });
  return data.translation;
}

export async function aiSummarizeApi(
  messages: { sender: string; content: string; time: string }[],
): Promise<string> {
  const data = await api.post<{ summary: string }>('/ai/summarize', { messages });
  return data.summary;
}
