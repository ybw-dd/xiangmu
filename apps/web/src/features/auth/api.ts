'use client';

import { api } from '@/lib/api';
import type { User, AuthTokens } from '@lingxun/types';

interface LoginData {
  username: string;
  password: string;
}

interface RegisterData {
  username: string;
  email: string;
  password: string;
  nickname: string;
}

interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

interface ChangePasswordData {
  oldPassword: string;
  newPassword: string;
}

interface UpdateProfileData {
  nickname?: string;
  avatar?: string;
  status?: string;
}

/**
 * 登录
 */
export async function loginApi(data: LoginData): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/login', data);
}

/**
 * 注册
 */
export async function registerApi(data: RegisterData): Promise<AuthResponse> {
  return api.post<AuthResponse>('/auth/register', data);
}

/**
 * 登出
 */
export async function logoutApi(): Promise<void> {
  return api.post('/auth/logout');
}

/**
 * 刷新 Token
 */
export async function refreshTokenApi(refreshToken: string): Promise<AuthTokens> {
  return api.post<AuthTokens>('/auth/refresh', { refreshToken });
}

/**
 * 获取当前用户信息
 */
export async function getProfileApi(): Promise<User> {
  return api.get<User>('/auth/profile');
}

/**
 * 修改密码
 */
export async function changePasswordApi(data: ChangePasswordData): Promise<void> {
  return api.patch('/auth/password', data);
}

/**
 * 更新用户资料
 */
export async function updateProfileApi(data: UpdateProfileData): Promise<User> {
  return api.patch<User>('/users/me', data);
}

/**
 * 获取用户信息
 */
export async function getUserApi(userId: string): Promise<User> {
  return api.get<User>(`/users/${userId}`);
}
