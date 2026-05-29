'use client';

import { api } from '@/lib/api';
import type { User } from '@lingxun/types';

// ==========================================
// 好友相关 API
// ==========================================

export interface FriendRequest {
  id: string;
  userId: string;
  friendId: string;
  remark?: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  createdAt: string;
  updatedAt: string;
  user?: User;
  friend?: User;
}

export interface FriendRequestPayload {
  friendId: string;
  remark?: string;
}

/**
 * 发送好友请求
 */
export async function sendFriendRequestApi(
  friendId: string,
  remark?: string,
): Promise<FriendRequest> {
  return api.post<FriendRequest>('/friends/request', {
    friendId,
    remark,
  });
}

/**
 * 接受好友请求
 */
export async function acceptFriendRequestApi(
  requestId: string,
): Promise<FriendRequest> {
  return api.post<FriendRequest>(`/friends/accept/${requestId}`);
}

/**
 * 拒绝好友请求
 */
export async function rejectFriendRequestApi(
  requestId: string,
): Promise<FriendRequest> {
  return api.post<FriendRequest>(`/friends/reject/${requestId}`);
}

/**
 * 获取好友列表
 */
export async function getFriendsApi(): Promise<User[]> {
  return api.get<User[]>('/friends');
}

/**
 * 获取待处理的好友请求
 */
export async function getPendingRequestsApi(): Promise<FriendRequest[]> {
  return api.get<FriendRequest[]>('/friends/requests/pending');
}

/**
 * 删除好友
 */
export async function removeFriendApi(friendId: string): Promise<void> {
  return api.delete(`/friends/${friendId}`);
}

/**
 * 搜索用户（按用户名/昵称）
 */
export async function searchUsersApi(
  query: string,
  page = 1,
): Promise<{
  items: User[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}> {
  return api.get('/users/search', { q: query, page });
}
