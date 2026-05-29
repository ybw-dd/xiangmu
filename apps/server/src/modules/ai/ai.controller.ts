import { Controller, Post, Body } from '@nestjs/common';
import { AIService } from './ai.service';
import { IsString, IsArray, IsOptional } from 'class-validator';

class AIChatDto {
  @IsArray()
  declare messages: { role: string; content: string }[];

  @IsOptional()
  @IsString()
  model?: string;
}

class AITranslateDto {
  @IsString()
  declare text: string;

  @IsString()
  declare targetLang: string;
}

class AISummarizeDto {
  @IsArray()
  declare messages: { sender: string; content: string; time: string }[];
}

@Controller('ai')
export class AIController {
  constructor(private aiService: AIService) {}

  @Post('chat')
  async chat(@Body() dto: AIChatDto) {
    const response = await this.aiService.chat(dto.messages, dto.model);
    return { response };
  }

  @Post('translate')
  async translate(@Body() dto: AITranslateDto) {
    const response = await this.aiService.translate(dto.text, dto.targetLang);
    return { translation: response };
  }

  @Post('summarize')
  async summarize(@Body() dto: AISummarizeDto) {
    const summary = await this.aiService.summarizeConversation(dto.messages);
    return { summary };
  }
}
