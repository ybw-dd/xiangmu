'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth-store';
import { loginApi } from '@/features/auth/api';
import { socketManager } from '@/lib/socket';
import { loginSchema, type LoginFormData } from '@/lib/validations/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const loginMutation = useMutation({
    mutationFn: loginApi,
    onSuccess: (data) => {
      login(data.user, data.tokens);
      socketManager.connect(data.tokens.accessToken);
      router.push('/chat');
    },
    onError: (error: Error) => {
      setServerError(error.message || '登录失败，请重试');
    },
  });

  const onSubmit = (data: LoginFormData) => {
    setServerError('');
    loginMutation.mutate(data);
  };

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* 背景装饰 */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <motion.div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-indigo-400/10 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-blue-400/10 blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.5, 0.3, 0.5] }}
          transition={{ repeat: Infinity, duration: 10, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        {/* 卡片 */}
        <div className="glass-card rounded-3xl p-8 sm:p-10">
          {/* 标题 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-200">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
              登录灵讯
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              欢迎回来，继续你的即时通讯
            </p>
          </motion.div>

          {/* 表单 */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {/* 用户名 */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label htmlFor="username" className="block text-sm font-medium text-foreground/80 mb-1.5">
                用户名 // 邮箱
              </label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="输入用户名或邮箱"
                  className={`w-full pl-10 pr-4 py-3 bg-white/80 border rounded-2xl text-sm transition-all duration-200 placeholder:text-muted-foreground/40
                    ${errors.username ? 'border-red-300 focus:ring-red-300/40' : 'border-border/50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-300/30'}`}
                  {...register('username')}
                />
              </div>
              {errors.username && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-destructive mt-1.5 ml-1">
                  {errors.username.message}
                </motion.p>
              )}
            </motion.div>

            {/* 密码 */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <label htmlFor="password" className="block text-sm font-medium text-foreground/80 mb-1.5">
                密码
              </label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="输入密码"
                  className={`w-full pl-10 pr-4 py-3 bg-white/80 border rounded-2xl text-sm transition-all duration-200 placeholder:text-muted-foreground/40
                    ${errors.password ? 'border-red-300 focus:ring-red-300/40' : 'border-border/50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-300/30'}`}
                  {...register('password')}
                />
              </div>
              {errors.password && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-destructive mt-1.5 ml-1">
                  {errors.password.message}
                </motion.p>
              )}
            </motion.div>

            {/* 服务端错误 */}
            {serverError && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600"
              >
                {serverError}
              </motion.div>
            )}

            {/* 提交按钮 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <button
                type="submit"
                disabled={loginMutation.isPending || isSubmitting}
                className="btn-hover-lift w-full py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-2xl font-semibold text-sm
                  disabled:opacity-50 disabled:cursor-not-allowed
                  shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300/60
                  transition-all duration-200"
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    登录中...
                  </span>
                ) : (
                  '登  录'
                )}
              </button>
            </motion.div>
          </form>

          {/* 注册链接 */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-center text-sm text-muted-foreground mt-6"
          >
            还没有账号？{' '}
            <Link href="/register" className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors">
              立即注册
            </Link>
          </motion.p>
        </div>

        {/* 测试账号提示 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-4 p-4 rounded-2xl bg-white/50 backdrop-blur-sm border border-border/30 text-xs text-muted-foreground text-center shadow-sm"
        >
          <span className="font-semibold text-foreground/60 mr-1">测试账号：</span>
          admin / testuser · 密码：Test123456
        </motion.div>
      </motion.div>
    </main>
  );
}
