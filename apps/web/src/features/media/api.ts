'use client';

import { api } from '@/lib/api';
import type { Attachment } from '@lingxun/types';

interface UploadResponse extends Attachment {
  messageType: string;
}

/**
 * 上传文件
 */
export async function uploadFileApi(
  file: File,
  onProgress?: (progress: number) => void,
): Promise<UploadResponse> {
  return api.upload('/media/upload', file, onProgress);
}

/**
 * 拼接完整的附件 URL
 */
export function getAttachmentUrl(url: string): string {
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
  // url 格式: /uploads/2026/05/xxx.jpg
  // 需要拼接为: http://localhost:3001/uploads/2026/05/xxx.jpg
  // 注意：uploads 路径不在 /api 前缀下
  const baseUrl = API_BASE_URL.replace(/\/api$/, '');
  return `${baseUrl}${url}`;
}
