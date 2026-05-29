/**
 * API 客户端 - 封装 HTTP 请求
 * 支持：自动 Token 注入、401 自动续签、请求重试
 */

import { refreshTokenApi } from '@/features/auth/api';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean>;
}

class ApiClient {
  private baseUrl: string;
  private isRefreshing = false;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('accessToken');
  }

  private getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken');
  }

  private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const { params, headers, ...rest } = config;

    // 构建 URL
    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        searchParams.append(key, String(value));
      });
      url += `?${searchParams.toString()}`;
    }

    // 请求头
    const requestHeaders: HeadersInit = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const token = this.getAccessToken();
    if (token) {
      (requestHeaders as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...rest,
      headers: requestHeaders,
    });

    // 处理 401 - Token 过期，尝试自动续签
    if (response.status === 401) {
      // 排除登录/注册/刷新Token接口
      if (endpoint.includes('/auth/login') || endpoint.includes('/auth/register') || endpoint.includes('/auth/refresh')) {
        return this.handleResponse<T>(response);
      }

      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        // 重试请求
        const newToken = this.getAccessToken();
        if (newToken) {
          (requestHeaders as Record<string, string>)['Authorization'] = `Bearer ${newToken}`;
          const retryResponse = await fetch(url, { ...rest, headers: requestHeaders });
          return this.handleResponse<T>(retryResponse);
        }
      }

      // Token 刷新失败
      this.clearAuth();
      throw new Error('登录已过期，请重新登录');
    }

    return this.handleResponse<T>(response);
  }

  private async tryRefreshToken(): Promise<boolean> {
    // 防止多个请求同时刷新
    if (this.isRefreshing && this.refreshPromise) {
      return this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.doRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  private async doRefresh(): Promise<boolean> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) return false;

      const tokens = await refreshTokenApi(refreshToken);

      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);

      // 更新 Zustand store
      if (typeof window !== 'undefined') {
        const event = new CustomEvent('token-refreshed', { detail: tokens });
        window.dispatchEvent(event);
      }

      return true;
    } catch {
      return false;
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '请求失败' }));

      // 提取错误消息（支持 NestJS 验证错误格式）
      let message = error.message || `请求失败 (${response.status})`;
      if (Array.isArray(error.message)) {
        message = error.message.join('; ');
      }

      throw new Error(message);
    }

    const data = await response.json();
    return data.data !== undefined ? data.data : data;
  }

  private clearAuth() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      // 触发登出事件
      window.dispatchEvent(new CustomEvent('auth-logout'));
    }
  }

  // ==========================================
  // HTTP 方法
  // ==========================================

  get<T>(endpoint: string, params?: Record<string, string | number | boolean>) {
    return this.request<T>(endpoint, { method: 'GET', params });
  }

  post<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  put<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  patch<T>(endpoint: string, data?: unknown) {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  delete<T>(endpoint: string) {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  // 文件上传
  async upload<T>(
    endpoint: string,
    file: File,
    onProgress?: (progress: number) => void,
  ): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);

    const token = this.getAccessToken();

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const response = JSON.parse(xhr.responseText);
          resolve(response.data || response);
        } else {
          reject(new Error(`上传失败 (${xhr.status})`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('上传失败')));

      xhr.open('POST', `${this.baseUrl}${endpoint}`);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
    });
  }
}

export const api = new ApiClient(API_BASE_URL);
