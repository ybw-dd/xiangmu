import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('OPENAI_API_KEY', '');
    this.baseUrl = this.configService.get<string>('OPENAI_BASE_URL', 'https://api.openai.com/v1');
  }

  /**
   * AI 对话
   */
  async chat(messages: { role: string; content: string }[], model = 'gpt-4o-mini') {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ model, messages, stream: false }),
      });

      const data = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      this.logger.error('AI 对话失败', error);
      return 'AI 服务暂时不可用，请稍后再试。';
    }
  }

  /**
   * AI 总结群聊
   */
  async summarizeConversation(messages: { sender: string; content: string; time: string }[]) {
    const chatContent = messages
      .map((m) => `[${m.time}] ${m.sender}: ${m.content}`)
      .join('\n');

    return this.chat([
      {
        role: 'system',
        content: '你是一个专业的群聊总结助手。请用简洁的语言总结以下群聊内容，列出关键讨论点和结论。',
      },
      {
        role: 'user',
        content: `请总结以下群聊内容：\n\n${chatContent}`,
      },
    ]);
  }

  /**
   * AI 翻译
   */
  async translate(text: string, targetLang: string) {
    return this.chat([
      {
        role: 'system',
        content: `你是一个翻译助手。请将用户发送的内容翻译成${targetLang}。只输出翻译结果，不要添加解释。`,
      },
      { role: 'user', content: text },
    ]);
  }

  /**
   * AI 自动回复建议
   */
  async getSuggestedReplies(conversationContext: string) {
    const response = await this.chat([
      {
        role: 'system',
        content: '根据对话内容，提供3个简短的回复建议。用JSON数组格式返回，例如：["建议1", "建议2", "建议3"]',
      },
      { role: 'user', content: conversationContext },
    ]);

    try {
      return JSON.parse(response);
    } catch {
      return [];
    }
  }
}
