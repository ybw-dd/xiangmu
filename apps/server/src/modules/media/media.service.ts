import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as path from 'path';
import * as fs from 'fs';

// 允许的 MIME 类型白名单
const ALLOWED_MIME_TYPES = [
  // 图片
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
  // 文档
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  // 压缩包
  'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
  // 音频
  'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac',
  // 视频
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo',
];

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly uploadDir: string;

  constructor(private prisma: PrismaService) {
    this.uploadDir = process.env.UPLOAD_DIR || './uploads';
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  /**
   * 校验文件类型
   */
  validateFile(mimetype: string, originalName: string): void {
    if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
      throw new BadRequestException(`不支持的文件类型: ${mimetype}`);
    }

    const ext = path.extname(originalName).toLowerCase();
    const dangerousExts = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi', '.com', '.scr'];
    if (dangerousExts.includes(ext)) {
      throw new BadRequestException(`不允许上传该类型的文件: ${ext}`);
    }
  }

  /**
   * 安全化文件名
   */
  sanitizeFilename(originalName: string): string {
    // 移除路径分隔符和特殊字符，保留字母数字中文点横线下划线
    return originalName
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/^\.+/, '')
      .slice(0, 200);
  }

  /**
   * 根据 MIME 类型判断消息类型
   */
  getMessageType(mimetype: string): string {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('audio/')) return 'audio';
    if (mimetype.startsWith('video/')) return 'video';
    return 'file';
  }

  /**
   * 保存附件记录
   */
  async saveAttachment(data: {
    url: string;
    filename: string;
    mimetype: string;
    size: number;
    width?: number;
    height?: number;
    duration?: number;
    uploaderId: string;
  }) {
    return this.prisma.attachment.create({ data });
  }

  /**
   * 获取附件详情
   */
  async getAttachment(id: string) {
    return this.prisma.attachment.findUnique({ where: { id } });
  }

  /**
   * 生成上传路径
   */
  generateUploadPath(originalName: string): string {
    const ext = path.extname(originalName);
    const date = new Date();
    const dir = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    const fullPath = path.join(this.uploadDir, dir);

    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }

    return path.join(dir, filename);
  }
}
