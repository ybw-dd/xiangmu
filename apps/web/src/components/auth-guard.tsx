'use client';

import { useEffect, useState, useRef, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { socketManager } from '@/lib/socket';
import { refreshTokenApi } from '@/features/auth/api';

/** 不需要认证的公开路由 */
const PUBLIC_ROUTES = ['/', '/login', '/register'];

/** 防循环：30 秒内最多允许 5 次跳转，超过则强制清除认证状态 */
const MAX_REDIRECTS = 5;
const REDIRECT_WINDOW_MS = 30_000;

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * 路由守卫组件
 * - 公开路由直接渲染
 * - 受保护路由：检查登录状态，尝试自动续签 Token
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, accessToken, refreshToken, logout, updateTokens } =
    useAuthStore();

  // React 18: 将路由跳转标记为非紧急更新，减少 rAF 压力
  const [, startTransition] = useTransition();

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  // 公开路由无需检查，立刻渲染；受保护路由先展示 spinner 再检查
  const [isChecking, setIsChecking] = useState(!isPublicRoute);

  const checkedRef = useRef(false);
  const redirectCountRef = useRef(0);
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 防循环：记录跳转次数，超过阈值强制 logout
  const trackRedirect = () => {
    if (!redirectTimerRef.current) {
      redirectTimerRef.current = setTimeout(() => {
        redirectCountRef.current = 0;
        redirectTimerRef.current = null;
      }, REDIRECT_WINDOW_MS);
    }
    redirectCountRef.current += 1;
    if (redirectCountRef.current > MAX_REDIRECTS) {
      console.warn('[AuthGuard] 检测到无限循环跳转，强制清除认证状态');
      logout();
      redirectCountRef.current = 0;
      return true;
    }
    return false;
  };

  // 清理防循环定时器
  useEffect(() => {
    return () => {
      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  // 统一的认证检查 effect（合并原先的两个 effect，避免级联触发 Zustand batch）
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      // 分支 A：已登录用户访问登录/注册页 → 跳转聊天页
      if (isAuthenticated && (pathname === '/login' || pathname === '/register')) {
        if (!trackRedirect()) {
          startTransition(() => {
            router.replace('/chat');
          });
        }
        return;
      }

      // 分支 B：公开路由不需要检查，直接通过
      if (isPublicRoute) {
        if (!cancelled) setIsChecking(false);
        return;
      }

      // 分支 C：已登录且有有效 accessToken → 直接通过
      if (isAuthenticated && accessToken) {
        if (!socketManager.isConnected()) {
          socketManager.connect(accessToken);
        }
        if (!cancelled) setIsChecking(false);
        checkedRef.current = true;
        return;
      }

      // 分支 D：有 refreshToken，尝试自动续签
      if (refreshToken) {
        try {
          const tokens = await refreshTokenApi(refreshToken);
          updateTokens(tokens);
          socketManager.connect(tokens.accessToken);
          if (!cancelled) setIsChecking(false);
          checkedRef.current = true;
          return;
        } catch {
          socketManager.disconnect();
          logout();
        }
      }

      // 分支 E：未认证（含僵尸状态 isAuthenticated=true 但 token 无效）
      if (isAuthenticated) {
        logout();
      }

      if (!trackRedirect()) {
        startTransition(() => {
          router.replace('/login');
        });
      }
      if (!cancelled) setIsChecking(false);
    }

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [pathname, isAuthenticated, accessToken, refreshToken]);

  // 始终用稳定的容器节点包裹，避免 Fragment 与 spinner div 切换导致 DevTools 锚点丢失
  return (
    <div className="auth-guard-root">
      {isChecking && !isPublicRoute ? (
        <div className="flex items-center justify-center min-h-screen">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin h-8 w-8 text-primary" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="text-sm text-muted-foreground">加载中...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}
