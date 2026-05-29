'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { socketManager } from '@/lib/socket';
import {
  loginApi,
  registerApi,
  logoutApi,
  getProfileApi,
  changePasswordApi,
  updateProfileApi,
} from './api';

/**
 * 登录 Hook
 */
export function useLogin() {
  const router = useRouter();
  const { login } = useAuthStore();

  return useMutation({
    mutationFn: loginApi,
    onSuccess: (data) => {
      login(data.user, data.tokens);
      socketManager.connect(data.tokens.accessToken);
      router.push('/chat');
    },
  });
}

/**
 * 注册 Hook
 */
export function useRegister() {
  const router = useRouter();
  const { login } = useAuthStore();

  return useMutation({
    mutationFn: registerApi,
    onSuccess: (data) => {
      login(data.user, data.tokens);
      socketManager.connect(data.tokens.accessToken);
      router.push('/chat');
    },
  });
}

/**
 * 登出 Hook
 */
export function useLogout() {
  const router = useRouter();
  const { logout } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutApi,
    onSettled: () => {
      socketManager.disconnect();
      logout();
      queryClient.clear();
      router.push('/login');
    },
  });
}

/**
 * 获取当前用户信息 Hook
 */
export function useProfile() {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: ['profile'],
    queryFn: getProfileApi,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 分钟
    retry: 1,
  });
}

/**
 * 修改密码 Hook
 */
export function useChangePassword() {
  const { logout } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: changePasswordApi,
    onSuccess: () => {
      // 密码修改成功后需要重新登录
      socketManager.disconnect();
      logout();
      router.push('/login');
    },
  });
}

/**
 * 更新用户资料 Hook
 */
export function useUpdateProfile() {
  const { updateUser } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProfileApi,
    onSuccess: (data) => {
      updateUser(data);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}
