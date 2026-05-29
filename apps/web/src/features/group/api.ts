'use client';

import { api } from '@/lib/api';
import type { Group, GroupMember } from '@lingxun/types';

interface GroupWithMembers extends Group {
  members: (GroupMember & {
    user: { id: string; username: string; nickname: string; avatar: string | null; status?: string };
  })[];
}

interface GroupMembership {
  id: string;
  userId: string;
  groupId: string;
  role: string;
  group: Group & { _count?: { members: number } };
}

export async function createGroupApi(
  name: string,
  description: string | undefined,
  memberIds: string[],
): Promise<GroupWithMembers> {
  return api.post('/groups', { name, description, memberIds });
}

export async function getMyGroupsApi(): Promise<GroupMembership[]> {
  return api.get('/groups');
}

export async function getGroupDetailApi(groupId: string): Promise<GroupWithMembers> {
  return api.get(`/groups/${groupId}`);
}

export async function updateGroupApi(
  groupId: string,
  data: { name?: string; description?: string; avatar?: string },
): Promise<Group> {
  return api.patch(`/groups/${groupId}`, data);
}

export async function deleteGroupApi(groupId: string): Promise<void> {
  return api.delete(`/groups/${groupId}`);
}

export async function addMemberApi(groupId: string, userId: string): Promise<GroupMember> {
  return api.post(`/groups/${groupId}/members`, { userId });
}

export async function removeMemberApi(groupId: string, userId: string): Promise<void> {
  return api.delete(`/groups/${groupId}/members/${userId}`);
}

export async function updateMemberRoleApi(
  groupId: string,
  userId: string,
  role: 'admin' | 'member',
): Promise<void> {
  return api.patch(`/groups/${groupId}/members/${userId}/role`, { role });
}

export async function leaveGroupApi(groupId: string): Promise<void> {
  return api.delete(`/groups/${groupId}/leave`);
}

// 好友列表（用于选择群成员）
export async function getFriendsApi(): Promise<
  { id: string; username: string; nickname: string; avatar: string | null }[]
> {
  return api.get('/friends');
}
