'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useProfile, useUpdateProfile, useLogout, useChangePassword } from '@/features/auth/hooks';
import { updateProfileSchema, changePasswordSchema, type UpdateProfileFormData, type ChangePasswordFormData } from '@/lib/validations/auth';

export default function ProfilePage() {
  const router = useRouter();
  const { data: user, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const logout = useLogout();
  const changePassword = useChangePassword();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [successMsg, setSuccessMsg] = useState('');

  // 资料编辑表单
  const profileForm = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      nickname: user?.nickname || '',
    },
    values: user ? { nickname: user.nickname } : undefined,
  });

  // 修改密码表单
  const passwordForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const onProfileSubmit = async (data: UpdateProfileFormData) => {
    setSuccessMsg('');
    try {
      await updateProfile.mutateAsync({ nickname: data.nickname });
      setSuccessMsg('资料更新成功');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      // 错误由 mutation 处理
    }
  };

  const onPasswordSubmit = async (data: ChangePasswordFormData) => {
    setSuccessMsg('');
    try {
      await changePassword.mutateAsync({
        oldPassword: data.oldPassword,
        newPassword: data.newPassword,
      });
    } catch {
      // 错误由 mutation 处理
    }
  };

  const handleLogout = () => {
    logout.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 头部 */}
      <header className="border-b">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <button
            onClick={() => router.push('/chat')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            &larr; 返回聊天
          </button>
          <h1 className="text-lg font-semibold">个人设置</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* 用户卡片 */}
        <div className="p-6 rounded-xl border bg-card">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
              {(user?.nickname || user?.username || '?').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{user?.nickname || user?.username}</h2>
              <p className="text-sm text-muted-foreground">@{user?.username}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-1 p-1 rounded-lg bg-muted w-fit">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'profile'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            基本资料
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'security'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            安全设置
          </button>
        </div>

        {/* 成功提示 */}
        {successMsg && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-sm text-green-600 dark:text-green-400">{successMsg}</p>
          </div>
        )}

        {/* 基本资料 Tab */}
        {activeTab === 'profile' && (
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4 p-6 rounded-xl border bg-card">
            <h3 className="font-semibold">基本资料</h3>

            <div className="space-y-1.5">
              <label htmlFor="nickname" className="text-sm font-medium">昵称</label>
              <input
                id="nickname"
                type="text"
                placeholder="你的昵称"
                className="w-full px-3 py-2.5 border rounded-lg bg-background text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                {...profileForm.register('nickname')}
              />
              {profileForm.formState.errors.nickname && (
                <p className="text-xs text-destructive">
                  {profileForm.formState.errors.nickname.message}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">用户名</label>
              <input
                type="text"
                value={user?.username || ''}
                disabled
                className="w-full px-3 py-2.5 border rounded-lg bg-muted text-sm text-muted-foreground cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">用户名不可修改</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">邮箱</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-3 py-2.5 border rounded-lg bg-muted text-sm text-muted-foreground cursor-not-allowed"
              />
            </div>

            <button
              type="submit"
              disabled={updateProfile.isPending}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {updateProfile.isPending ? '保存中...' : '保存修改'}
            </button>
          </form>
        )}

        {/* 安全设置 Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* 修改密码 */}
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4 p-6 rounded-xl border bg-card">
              <h3 className="font-semibold">修改密码</h3>

              {(changePassword.error) && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-sm text-destructive">
                    {changePassword.error instanceof Error ? changePassword.error.message : '修改失败'}
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="oldPassword" className="text-sm font-medium">原密码</label>
                <input
                  id="oldPassword"
                  type="password"
                  className="w-full px-3 py-2.5 border rounded-lg bg-background text-sm
                    focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  {...passwordForm.register('oldPassword')}
                />
                {passwordForm.formState.errors.oldPassword && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.oldPassword.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="newPassword" className="text-sm font-medium">新密码</label>
                <input
                  id="newPassword"
                  type="password"
                  className="w-full px-3 py-2.5 border rounded-lg bg-background text-sm
                    focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  {...passwordForm.register('newPassword')}
                />
                {passwordForm.formState.errors.newPassword && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.newPassword.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirmNewPassword" className="text-sm font-medium">确认新密码</label>
                <input
                  id="confirmNewPassword"
                  type="password"
                  className="w-full px-3 py-2.5 border rounded-lg bg-background text-sm
                    focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  {...passwordForm.register('confirmNewPassword')}
                />
                {passwordForm.formState.errors.confirmNewPassword && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.confirmNewPassword.message}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={changePassword.isPending}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium
                  hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {changePassword.isPending ? '修改中...' : '修改密码'}
              </button>
            </form>

            {/* 登出 */}
            <div className="p-6 rounded-xl border bg-card">
              <h3 className="font-semibold mb-2">退出登录</h3>
              <p className="text-sm text-muted-foreground mb-4">
                退出后需要重新登录才能使用
              </p>
              <button
                onClick={handleLogout}
                disabled={logout.isPending}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium
                  hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                {logout.isPending ? '退出中...' : '退出登录'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
