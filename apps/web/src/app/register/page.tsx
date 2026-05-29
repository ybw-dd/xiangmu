'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth-store';
import { registerApi } from '@/features/auth/api';
import { socketManager } from '@/lib/socket';
import { registerSchema, type RegisterFormData } from '@/lib/validations/auth';

/** 密码强度检测 */
function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
  bgColor: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: '弱', color: 'text-red-600', bgColor: 'bg-red-500' };
  if (score <= 4) return { score, label: '中', color: 'text-yellow-600', bgColor: 'bg-yellow-500' };
  return { score, label: '强', color: 'text-emerald-600', bgColor: 'bg-emerald-500' };
}

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [serverError, setServerError] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      email: '',
      nickname: '',
      password: '',
      confirmPassword: '',
    },
  });

  const passwordValue = watch('password');
  const strength = passwordValue ? getPasswordStrength(passwordValue) : null;

  const registerMutation = useMutation({
    mutationFn: registerApi,
    onSuccess: (data) => {
      login(data.user, data.tokens);
      socketManager.connect(data.tokens.accessToken);
      router.push('/chat');
    },
    onError: (error: Error) => {
      setServerError(error.message || '注册失败，请重试');
    },
  });

  const onSubmit = (data: RegisterFormData) => {
    setServerError('');
    registerMutation.mutate({
      username: data.username,
      email: data.email,
      password: data.password,
      nickname: data.nickname || data.username,
    });
  };

  const inputClass = (fieldName: keyof RegisterFormData) =>
    `w-full pl-10 pr-4 py-3 bg-white/80 border rounded-2xl text-sm transition-all duration-200 placeholder:text-muted-foreground/40 ${
      errors[fieldName]
        ? 'border-red-300 focus:ring-2 focus:ring-red-300/40'
        : 'border-border/50 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-300/30'
    }`;

  return (
    <main className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* 背景装饰 */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <motion.div
          className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-indigo-400/10 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ repeat: Infinity, duration: 8, ease: 'easeInOut' }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.5l3 3m0 0l3-3m-3 3v-6m-2.25 9l3 3m0 0l3-3m-3 3V9m-2.25 4.5l3 3m0 0l3-3m-3 3V9" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
              注册灵讯
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              创建账号，开启即时通讯
            </p>
          </motion.div>

          {/* 表单 */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* 用户名 */}
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <label htmlFor="username" className="block text-sm font-medium text-foreground/80 mb-1.5">
                用户名 <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                <input id="username" type="text" autoComplete="username" placeholder="3-20位字母、数字、下划线" className={inputClass('username')} {...register('username')} />
              </div>
              {errors.username && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-destructive mt-1.5 ml-1">{errors.username.message}</motion.p>}
            </motion.div>

            {/* 邮箱 */}
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }}>
              <label htmlFor="email" className="block text-sm font-medium text-foreground/80 mb-1.5">
                邮箱 <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <input id="email" type="email" autoComplete="email" placeholder="your@email.com" className={inputClass('email')} {...register('email')} />
              </div>
              {errors.email && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-destructive mt-1.5 ml-1">{errors.email.message}</motion.p>}
            </motion.div>

            {/* 昵称 */}
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
              <label htmlFor="nickname" className="block text-sm font-medium text-foreground/80 mb-1.5">
                昵称 <span className="text-muted-foreground/50 text-xs">（选填）</span>
              </label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
                <input id="nickname" type="text" placeholder="你的昵称" className={inputClass('nickname')} {...register('nickname')} />
              </div>
              {errors.nickname && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-destructive mt-1.5 ml-1">{errors.nickname.message}</motion.p>}
            </motion.div>

            {/* 密码 */}
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 }}>
              <label htmlFor="password" className="block text-sm font-medium text-foreground/80 mb-1.5">
                密码 <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <input id="password" type="password" autoComplete="new-password" placeholder="至少8位，含大小写字母和数字" className={inputClass('password')} {...register('password')} />
              </div>
              {/* 密码强度指示器 */}
              {strength && passwordValue && (
                <motion.div initial={{ opacity: 0, scaleX: 0 }} animate={{ opacity: 1, scaleX: 1 }} className="mt-2 flex items-center gap-2.5">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full transition-all duration-300 rounded-full ${strength.bgColor}`} style={{ width: `${Math.min((strength.score / 6) * 100, 100)}%` }} />
                  </div>
                  <span className={`text-xs font-medium ${strength.color}`}>强度：{strength.label}</span>
                </motion.div>
              )}
              {errors.password && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-destructive mt-1.5 ml-1">{errors.password.message}</motion.p>}
            </motion.div>

            {/* 确认密码 */}
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground/80 mb-1.5">
                确认密码 <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
                <input id="confirmPassword" type="password" autoComplete="new-password" placeholder="再次输入密码" className={inputClass('confirmPassword')} {...register('confirmPassword')} />
              </div>
              {errors.confirmPassword && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-destructive mt-1.5 ml-1">{errors.confirmPassword.message}</motion.p>}
            </motion.div>

            {/* 服务端错误 */}
            {serverError && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
                {serverError}
              </motion.div>
            )}

            {/* 提交按钮 */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
              <button
                type="submit"
                disabled={registerMutation.isPending || isSubmitting}
                className="btn-hover-lift w-full py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-2xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300/60 transition-all duration-200"
              >
                {registerMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    注册中...
                  </span>
                ) : (
                  '注  册'
                )}
              </button>
            </motion.div>
          </form>

          {/* 登录链接 */}
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="text-center text-sm text-muted-foreground mt-6">
            已有账号？{' '}
            <Link href="/login" className="text-indigo-600 hover:text-indigo-700 font-semibold transition-colors">
              立即登录
            </Link>
          </motion.p>
        </div>
      </motion.div>
    </main>
  );
}
