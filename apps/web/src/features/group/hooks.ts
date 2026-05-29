'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createGroupApi,
  getMyGroupsApi,
  getGroupDetailApi,
  updateGroupApi,
  deleteGroupApi,
  addMemberApi,
  removeMemberApi,
  updateMemberRoleApi,
  leaveGroupApi,
  getFriendsApi,
} from './api';

export function useMyGroups() {
  return useQuery({
    queryKey: ['my-groups'],
    queryFn: getMyGroupsApi,
    staleTime: 30 * 1000,
  });
}

export function useGroupDetail(groupId: string | null) {
  return useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroupDetailApi(groupId!),
    enabled: !!groupId,
    staleTime: 30 * 1000,
  });
}

export function useFriends() {
  return useQuery({
    queryKey: ['friends'],
    queryFn: getFriendsApi,
    staleTime: 60 * 1000,
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      name,
      description,
      memberIds,
    }: {
      name: string;
      description?: string;
      memberIds: string[];
    }) => createGroupApi(name, description, memberIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useUpdateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      data,
    }: {
      groupId: string;
      data: { name?: string; description?: string; avatar?: string };
    }) => updateGroupApi(groupId, data),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useDeleteGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteGroupApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useAddMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      addMemberApi(groupId, userId),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      removeMemberApi(groupId, userId),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      groupId,
      userId,
      role,
    }: {
      groupId: string;
      userId: string;
      role: 'admin' | 'member';
    }) => updateMemberRoleApi(groupId, userId, role),
    onSuccess: (_, { groupId }) => {
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
    },
  });
}

export function useLeaveGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leaveGroupApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
