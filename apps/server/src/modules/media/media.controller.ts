import {
  Controller,
  Post,
  Get,
  Param,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '@lingxun/types';
import * as fs from 'fs';

interface UploadedFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Controller('media')
export class MediaController {
  constructor(private mediaService: MediaService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  }))
  async uploadFile(
    @UploadedFile() file: UploadedFile,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) {
      throw new BadRequestException('请选择文件');
    }

    // 校验文件类型
    this.mediaService.validateFile(file.mimetype, file.originalname);

    // 安全化文件名
    const safeName = this.mediaService.sanitizeFilename(file.originalname);

    const uploadPath = this.mediaService.generateUploadPath(safeName);

    // 保存文件
    const fullPath = `./uploads/${uploadPath}`;
    fs.writeFileSync(fullPath, file.buffer);

    // 保存附件记录
    const attachment = await this.mediaService.saveAttachment({
      url: `/uploads/${uploadPath}`,
      filename: safeName,
      mimetype: file.mimetype,
      size: file.size,
      uploaderId: user.sub,
    });

    // 返回附件信息 + 消息类型
    return {
      ...attachment,
      messageType: this.mediaService.getMessageType(file.mimetype),
    };
  }

  @Get(':id')
  async getAttachment(@Param('id') id: string) {
    return this.mediaService.getAttachment(id);
  }
}
