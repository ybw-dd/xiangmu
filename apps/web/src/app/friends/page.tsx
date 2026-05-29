'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth-store';
import {
  sendFriendRequestApi,
  acceptFriendRequestApi,
  rejectFriendRequestApi,
  getFriendsApi,
  getPendingRequestsApi,
  removeFriendApi,
  searchUsersApi,
} from '@/features/friend/api';
import type { FriendRequest } from '@/features/friend/api';
import type { User } from '@lingxun/types';

type Tab = 'friends' | 'requests' | 'search';

export default function FriendsPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('friends');
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    loadData();
  }, [isAuthenticated, router]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'friends') {
        const list = await getFriendsApi();
        setFriends(list);
      } else if (activeTab === 'requests') {
        const list = await getPendingRequestsApi();
        setRequests(list);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setError(null);
    try {
      const result = await searchUsersApi(searchQuery.trim());
      const filtered = result.items.filter((u) => u.id !== user?.id);
      const friendIds = new Set(friends.map((f) => f.id));
      const requestSentIds = new Set(
        requests
          .filter((r) => r.user?.id)
          .map((r) => r.user!.id),
      );
      setSearchResults(
        filtered.map((u) => ({
          ...u,
          _isFriend: friendIds.has(u.id),
          _requestSent: requestSentIds.has(u.id),
        })) as (User & { _isFriend?: boolean; _requestSent?: boolean })[] as unknown as User[],
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, friends, requests, user]);

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSendRequest = async (friendId: string) => {
    try {
      await sendFriendRequestApi(friendId);
      showSuccess('好友请求已发送');
      setSearchResults((prev) =>
        prev.map((u) =>
          (u as User & { _requestSent?: boolean }).id === friendId
            ? { ...u, _requestSent: true }
            : u,
        ),
      );
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleAccept = async (requestId: string) => {
    try {
      await acceptFriendRequestApi(requestId);
      showSuccess('已添加为好友');
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await rejectFriendRequestApi(requestId);
      showSuccess('已拒绝好友请求');
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRemove = async (friendId: string) => {
    try {
      await removeFriendApi(friendId);
      showSuccess('已删除好友');
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!isAuthenticated) return null;

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'friends', label: '好友', count: friends.length },
    { key: 'requests', label: '申请', count: requests.length },
    { key: 'search', label: '搜索' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* 头部 */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent">
                联系人
              </h1>
              <p className="text-muted-foreground mt-1">管理你的好友和联系人</p>
            </div>
            <Link
              href="/chat"
              className="px-4 py-2 text-sm font-medium rounded-xl border border-border bg-white/80 backdrop-blur-sm hover:bg-accent hover:shadow-md transition-all duration-200"
            >
              返回聊天
            </Link>
          </div>
        </motion.div>

        {/* 成功提示 */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium shadow-sm"
            >
              {successMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 错误提示 */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-center justify-between shadow-sm"
            >
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-3 text-red-400 hover:text-red-600 transition-colors text-lg leading-none"
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tab 导航 */}
        <div className="flex gap-1 p-1.5 bg-white/60 backdrop-blur-sm rounded-2xl border border-border/50 shadow-sm mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                setSearchQuery('');
                setSearchResults([]);
              }}
              className={`flex-1 relative px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                activeTab === tab.key
                  ? 'text-white'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {activeTab === tab.key && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl shadow-md"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center justify-center gap-1.5">
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold rounded-full ${
                      activeTab === tab.key
                        ? 'bg-white/20 text-white'
                        : 'bg-indigo-100 text-indigo-600'
                    }`}
                  >
                    {tab.count > 99 ? '99+' : tab.count}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {/* 内容区域 */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'friends' && (
            <FriendsList
              friends={friends}
              loading={loading}
              onRemove={handleRemove}
              onChat={(friendId) => router.push(`/chat?friend=${friendId}`)}
            />
          )}
          {activeTab === 'requests' && (
            <RequestsList
              requests={requests}
              loading={loading}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          )}
          {activeTab === 'search' && (
            <SearchPanel
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSearch={handleSearch}
              searching={searching}
              results={searchResults}
              onSendRequest={handleSendRequest}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}

// ==========================================
// 好友列表
// ==========================================
function FriendsList({
  friends,
  loading,
  onRemove,
  onChat,
}: {
  friends: User[];
  loading: boolean;
  onRemove: (id: string) => void;
  onChat: (id: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-indigo-50 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-indigo-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
            />
          </svg>
        </div>
        <p className="text-muted-foreground text-sm">还没有好友</p>
        <p className="text-muted-foreground/60 text-xs mt-1">
          去「搜索」页面添加好友吧
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {friends.map((friend, index) => (
        <motion.div
          key={friend.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, duration: 0.3 }}
          className="group flex items-center gap-4 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-border/50 shadow-sm hover:shadow-md hover:border-indigo-200/50 transition-all duration-200"
        >
          {/* 头像 */}
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              {(friend.nickname || friend.username).slice(0, 2).toUpperCase()}
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${
                friend.status === 'online' ? 'bg-emerald-400' : 'bg-gray-300'
              }`}
            />
          </div>

          {/* 信息 */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">
              {friend.nickname || friend.username}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              @{friend.username}
            </p>
          </div>

          {/* 状态 */}
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              friend.status === 'online'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {friend.status === 'online' ? '在线' : '离线'}
          </span>

          {/* 操作 */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={() => onChat(friend.id)}
              className="p-2 rounded-xl text-indigo-500 hover:bg-indigo-50 transition-colors"
              title="发消息"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
            {confirmDelete === friend.id ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    onRemove(friend.id);
                    setConfirmDelete(null);
                  }}
                  className="px-2 py-1 text-xs font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                >
                  确认
                </button>
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(friend.id)}
                className="p-2 rounded-xl text-red-400 hover:bg-red-50 transition-colors"
                title="删除好友"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ==========================================
// 好友申请列表
// ==========================================
function RequestsList({
  requests,
  loading,
  onAccept,
  onReject,
}: {
  requests: FriendRequest[];
  loading: boolean;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-amber-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
            />
          </svg>
        </div>
        <p className="text-muted-foreground text-sm">暂无待处理的好友申请</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {requests.map((req, index) => (
        <motion.div
          key={req.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05, duration: 0.3 }}
          className="flex items-center gap-4 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-border/50 shadow-sm"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            {(req.user?.nickname || req.user?.username || '?')
              .slice(0, 2)
              .toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">
              {req.user?.nickname || req.user?.username || '未知用户'}
            </p>
            <p className="text-xs text-muted-foreground">
              请求添加你为好友
              {req.remark && ` — "${req.remark}"`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAccept(req.id)}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl hover:shadow-md hover:shadow-indigo-200 transition-all duration-200"
            >
              接受
            </button>
            <button
              onClick={() => onReject(req.id)}
              className="px-4 py-2 text-sm font-medium text-muted-foreground bg-gray-100 hover:bg-gray-200 rounded-xl transition-all duration-200"
            >
              拒绝
            </button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ==========================================
// 搜索用户面板
// ==========================================
function SearchPanel({
  searchQuery,
  setSearchQuery,
  onSearch,
  searching,
  results,
  onSendRequest,
}: {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSearch: () => void;
  searching: boolean;
  results: User[];
  onSendRequest: (friendId: string) => void;
}) {
  return (
    <div>
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            placeholder="搜索用户名或昵称..."
            className="w-full pl-11 pr-4 py-3 bg-white/80 backdrop-blur-sm border border-border/50 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 outline-none transition-all duration-200 shadow-sm"
          />
        </div>
        <button
          onClick={onSearch}
          disabled={searching || !searchQuery.trim()}
          className="px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-blue-500 rounded-2xl hover:shadow-lg hover:shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
        >
          {searching ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              搜索中
            </span>
          ) : (
            '搜索'
          )}
        </button>
      </div>

      {/* 搜索结果 */}
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground px-1 mb-2">
            找到 {results.length} 个用户
          </p>
          {results.map((result, index) => {
            const ext = result as User & { _isFriend?: boolean; _requestSent?: boolean };
            return (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                className="flex items-center gap-4 p-4 bg-white/80 backdrop-blur-sm rounded-2xl border border-border/50 shadow-sm"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  {(result.nickname || result.username)
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {result.nickname || result.username}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    @{result.username}
                  </p>
                </div>
                {ext._isFriend ? (
                  <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">
                    已是好友
                  </span>
                ) : ext._requestSent ? (
                  <span className="text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 font-medium">
                    已发送申请
                  </span>
                ) : (
                  <button
                    onClick={() => onSendRequest(result.id)}
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-indigo-500 to-blue-500 rounded-xl hover:shadow-md hover:shadow-indigo-200 transition-all duration-200"
                  >
                    添加好友
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {searchQuery && !searching && results.length === 0 && results !== undefined && (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-50 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </div>
          <p className="text-muted-foreground text-sm">未找到匹配的用户</p>
          <p className="text-muted-foreground/60 text-xs mt-1">
            试试其他搜索词
          </p>
        </div>
      )}

      {!searchQuery && (
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-indigo-50 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-indigo-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z"
              />
            </svg>
          </div>
          <p className="text-muted-foreground text-sm">输入用户名或昵称搜索用户</p>
        </div>
      )}
    </div>
  );
}
