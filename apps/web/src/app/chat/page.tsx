'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth-store';
import { useChatStore } from '@/stores/chat-store';
import { useConversations, useMessages, useLoadMoreMessages } from '@/features/chat/hooks';
import { useGroupDetail } from '@/features/group/hooks';
import { useWebSocket } from '@/hooks/use-websocket';
import { CreateGroupDialog } from '@/components/create-group-dialog';
import type { Message } from '@lingxun/types';
import { MessageStatus, MessageType, ConversationType, CallType, CallStatus } from '@lingxun/types';
import { useCall } from '@/hooks/use-call';
import { IncomingCallModal } from '@/components/call/incoming-call-modal';
import { ActiveCallOverlay } from '@/components/call/active-call-overlay';
import { generateClientId, formatTime } from '@lingxun/utils';
import { uploadFileApi, getAttachmentUrl } from '@/features/media/api';
import { useSearchMessages } from '@/features/search/hooks';
import { useAIChat, useAITranslate, useAISummarize } from '@/features/ai/hooks';

// ==========================================
// 动画变体
// ==========================================
const fadeInUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const bubbleVariants = {
  initial: { opacity: 0, scale: 0.92, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 380, damping: 28 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } },
};

// ==========================================
// 主组件
// ==========================================
export default function ChatPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const {
    conversations,
    activeConversationId,
    messages,
    typingUsers,
    setActiveConversation,
    addMessage,
  } = useChatStore();

  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { sendMessage, markAsRead, joinConversation, leaveConversation, startTyping, stopTyping, isConnected } =
    useWebSocket();

  const {
    startCall, acceptCall, rejectCall, endCall,
    toggleAudio, toggleVideo, callStatus, callType: activeCallType,
    localStream, remoteStream, isAudioMuted, isVideoOff,
    remoteUserName: callRemoteUserName, remoteUserAvatar: callRemoteUserAvatar,
  } = useCall();

  const { sendAIMessage, isLoading: aiLoading } = useAIChat();
  const { summarize, isLoading: summarizing } = useAISummarize();
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiChatActive, setAiChatActive] = useState(false);

  const { isLoading: conversationsLoading } = useConversations();
  const { isLoading: messagesLoading } = useMessages(activeConversationId);
  const { loadMore, hasMore, isLoadingMore, reset: resetPagination } =
    useLoadMoreMessages(activeConversationId);

  const currentConversation = conversations.find((c) => c.id === activeConversationId);
  const isGroupChat = currentConversation?.type === ConversationType.GROUP;
  const { data: groupDetail } = useGroupDetail(
    isGroupChat ? (currentConversation?.group?.id || null) : null,
  );

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated, router]);

  useEffect(() => { resetPagination(); }, [activeConversationId, resetPagination]);

  useEffect(() => {
    if (!activeConversationId) return;
    joinConversation(activeConversationId);
    return () => { leaveConversation(activeConversationId); };
  }, [activeConversationId, joinConversation, leaveConversation]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || !hasMore || isLoadingMore) return;
    if (container.scrollTop <= 10) {
      const previousHeight = container.scrollHeight;
      loadMore().then(() => {
        requestAnimationFrame(() => {
          const newHeight = container.scrollHeight;
          container.scrollTop = newHeight - previousHeight;
        });
      });
    }
  }, [hasMore, isLoadingMore, loadMore]);

  const handleSend = useCallback(() => {
    if (!inputText.trim() || !activeConversationId || !user) return;
    const clientId = generateClientId();
    const now = new Date();
    const content = inputText.trim();
    const optimisticMessage: Message = {
      id: `temp-${clientId}`, clientId, conversationId: activeConversationId,
      senderId: user.id, type: MessageType.TEXT, content,
      metadata: null, seq: 0, status: MessageStatus.SENDING,
      replyToId: null, createdAt: now, updatedAt: now,
    };
    addMessage(activeConversationId, optimisticMessage);
    sendMessage({ clientId, conversationId: activeConversationId, type: MessageType.TEXT, content });
    setInputText('');
    stopTyping(activeConversationId);
    inputRef.current?.focus();
  }, [inputText, activeConversationId, user, addMessage, sendMessage, stopTyping]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !activeConversationId || !user) return;
      const clientId = generateClientId();
      setUploadingFile(file.name);
      setUploadProgress(0);
      try {
        const result = await uploadFileApi(file, (progress) => setUploadProgress(progress));
        const now = new Date();
        const optimisticMessage: Message = {
          id: `temp-${clientId}`, clientId, conversationId: activeConversationId,
          senderId: user.id, type: result.messageType as MessageType, content: result.url,
          metadata: { filename: result.filename, mimetype: result.mimetype, size: result.size },
          seq: 0, status: MessageStatus.SENDING, replyToId: null, createdAt: now, updatedAt: now,
        };
        addMessage(activeConversationId, optimisticMessage);
        sendMessage({
          clientId, conversationId: activeConversationId,
          type: result.messageType as MessageType, content: result.url,
          metadata: { filename: result.filename, mimetype: result.mimetype, size: result.size },
        });
      } catch {
        alert('文件上传失败，请重试');
      } finally {
        setUploadingFile(null); setUploadProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [activeConversationId, user, addMessage, sendMessage],
  );

  const handleAISummarize = useCallback(async () => {
    if (!activeConversationId || summarizing) return;
    const msgs = messages.get(activeConversationId) || [];
    const recent = msgs.slice(-20).filter((m) => m.type === MessageType.TEXT);
    if (recent.length === 0) return;
    const chatMessages = recent.map((m) => ({
      sender: m.senderId === user?.id ? '我' : '对方',
      content: m.content, time: formatTime(m.createdAt),
    }));
    try {
      const result = await summarize(chatMessages);
      setAiSummary(result);
    } catch { alert('AI 总结失败，请稍后再试'); }
  }, [activeConversationId, messages, user, summarize, summarizing]);

  const handleAIChat = useCallback(async () => {
    if (!activeConversationId || aiLoading) return;
    const msgs = messages.get(activeConversationId) || [];
    const recent = msgs.slice(-10).filter((m) => m.type === MessageType.TEXT);
    const chatMessages: { role: 'user' | 'assistant'; content: string }[] = recent.map((m) => ({
      role: m.senderId === user?.id ? 'user' as const : 'assistant' as const,
      content: m.content,
    }));
    if (chatMessages.length === 0) {
      chatMessages.push({ role: 'user' as const, content: '你好，请介绍一下你自己' });
    }
    setAiChatActive(true);
    const clientId = generateClientId();
    const now = new Date();
    const userMsg: Message = {
      id: `temp-${clientId}`, clientId, conversationId: activeConversationId,
      senderId: user!.id, type: MessageType.TEXT,
      content: '请根据以上对话内容给一些分析和建议',
      metadata: null, seq: 0, status: MessageStatus.SENT,
      replyToId: null, createdAt: now, updatedAt: now,
    };
    addMessage(activeConversationId, userMsg);
    try {
      const response = await sendAIMessage(chatMessages);
      const aiClientId = generateClientId();
      const aiMsg: Message = {
        id: `temp-ai-${aiClientId}`, clientId: aiClientId, conversationId: activeConversationId,
        senderId: 'ai-assistant', type: MessageType.AI, content: response,
        metadata: null, seq: 0, status: MessageStatus.SENT,
        replyToId: null, createdAt: new Date(), updatedAt: new Date(),
      };
      addMessage(activeConversationId, aiMsg);
    } catch { alert('AI 对话失败，请稍后再试'); }
    finally { setAiChatActive(false); }
  }, [activeConversationId, messages, user, sendAIMessage, addMessage, aiLoading]);

  const handleInputChange = useCallback(
    (value: string) => {
      setInputText(value);
      if (!activeConversationId) return;
      startTyping(activeConversationId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => stopTyping(activeConversationId), 3000);
    },
    [activeConversationId, startTyping, stopTyping],
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.get(activeConversationId || '')?.length]);

  const currentMessages = activeConversationId ? messages.get(activeConversationId) || [] : [];
  const activeTypingUsers = activeConversationId ? Array.from(typingUsers.get(activeConversationId) || []) : [];

  const filteredConversations = searchQuery.trim()
    ? conversations.filter((c) => (c.displayName || c.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

  const isSearchMode = searchQuery.trim().length >= 2;
  const { data: searchResults, isLoading: searchLoading } = useSearchMessages(isSearchMode ? searchQuery : '');

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50/50 via-blue-50/20 to-indigo-50/30">
      {/* ========== 左侧：会话列表 ========== */}
      <aside className="w-80 border-r border-border/40 bg-white/70 backdrop-blur-xl flex flex-col shadow-sm">
        {/* 顶部标题 + 操作 */}
        <div className="p-4 border-b border-border/30 bg-white/60 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-blue-500 bg-clip-text text-transparent flex items-center gap-2">
              灵讯
              <motion.span
                className="w-2 h-2 rounded-full bg-emerald-400 block shadow-sm shadow-emerald-300"
                animate={{ scale: [1, 1.4, 1], opacity: [1, 0.7, 1] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
              />
            </h2>
            <div className="flex items-center gap-1.5">
              <Link
                href="/friends"
                className="text-xs px-3 py-1.5 rounded-xl font-semibold bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:shadow-md transition-all duration-200"
              >
                联系人
              </Link>
              <button
                onClick={() => setShowCreateGroup(true)}
                className="text-xs px-3 py-1.5 rounded-xl font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 hover:shadow-md transition-all duration-200"
              >
                + 群组
              </button>
            </div>
          </div>
          <div className="relative">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索消息或会话..."
              className="w-full pl-10 pr-4 py-2.5 text-sm border-0 rounded-2xl bg-white/80 focus:ring-2 focus:ring-indigo-300/60 shadow-sm placeholder:text-muted-foreground/40 transition-all duration-200"
            />
          </div>
        </div>

        {/* 会话列表 */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isSearchMode ? (
            searchLoading ? (
              <div className="p-6 flex justify-center"><div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-500 rounded-full animate-spin" /></div>
            ) : !searchResults || searchResults.items.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">未找到包含「{searchQuery}」的消息</div>
            ) : (
              <>
                <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border/20 bg-muted/20">
                  找到 {searchResults.total} 条相关消息
                </div>
                {searchResults.items.map((result: any) => (
                  <motion.button
                    key={result.id}
                    whileHover={{ x: 2 }}
                    onClick={() => setActiveConversation(result.conversationId)}
                    className="w-full p-3.5 text-left hover:bg-indigo-50/50 transition-colors border-b border-border/10"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">
                        {(result.senderName || result.sender?.nickname || result.sender?.username || '?').slice(0, 2)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold truncate text-foreground/80">
                            {result.senderName || result.sender?.nickname || result.sender?.username || '未知'}
                          </p>
                          <span className="text-xs text-muted-foreground shrink-0">{formatTime(new Date(result.createdAt))}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2" dangerouslySetInnerHTML={{ __html: result.highlight || escapeHtml(result.content) }} />
                      </div>
                    </div>
                  </motion.button>
                ))}
              </>
            )
          ) : conversationsLoading ? (
            <div className="p-6 flex justify-center"><div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-500 rounded-full animate-spin" /></div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {searchQuery ? '未找到匹配的会话' : '暂无会话，开始聊天吧'}
            </div>
          ) : (
            filteredConversations.map((conv, idx) => (
              <motion.button
                key={conv.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03, duration: 0.25 }}
                onClick={() => setActiveConversation(conv.id)}
                className={`w-full p-4 text-left transition-all duration-200 border-b border-border/10 group
                  ${activeConversationId === conv.id
                    ? 'bg-indigo-50/80 border-l-[3px] border-l-indigo-500 shadow-sm'
                    : 'hover:bg-indigo-50/30 border-l-[3px] border-l-transparent'}
                `}
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold shadow-sm transition-shadow duration-200
                      ${conv.type === ConversationType.GROUP
                        ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-200'
                        : 'bg-gradient-to-br from-indigo-400 to-blue-500 text-white shadow-indigo-200'}
                    `}>
                      {conv.type === ConversationType.GROUP ? '群' : (conv.displayName || conv.name || '?').slice(0, 2)}
                    </div>
                    {/* 在线状态指示器 */}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white bg-emerald-400 shadow-sm" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold truncate text-sm text-foreground/90">
                        {conv.displayName || conv.name || '会话'}
                      </p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {conv.lastMessageAt ? formatTime(conv.lastMessageAt) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.lastMessageAt ? formatTime(conv.lastMessageAt) : '暂无消息'}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full shadow-sm shadow-red-200"
                    >
                      {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                    </motion.span>
                  )}
                </div>
              </motion.button>
            ))
          )}
        </div>

        {/* 底部用户信息 */}
        <div className="p-3.5 border-t border-border/30 bg-white/60 backdrop-blur-sm flex items-center justify-between">
          <Link href="/profile" className="flex items-center gap-2 text-sm font-semibold hover:text-indigo-600 transition-colors truncate flex-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
              {(user?.nickname || user?.username || '?').slice(0, 2)}
            </div>
            <span className="truncate">{user?.nickname || user?.username}</span>
          </Link>
          <Link href="/profile" className="text-muted-foreground/50 hover:text-foreground transition-colors text-lg leading-none" title="设置">⚙</Link>
        </div>
      </aside>

      {/* ========== 右侧：消息区 ========== */}
      <main className="flex-1 flex flex-col">
        {activeConversationId ? (
          <>
            {/* 消息头部 */}
            <header className="h-14 border-b border-border/30 flex items-center justify-between px-5 bg-white/60 backdrop-blur-sm">
              <div className="flex items-center gap-2.5">
                <h3 className="font-bold text-sm text-foreground/90">
                  {currentConversation?.displayName || currentConversation?.name || '会话'}
                </h3>
                {isGroupChat && groupDetail && (
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                    {groupDetail.members.length} 人
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {!isGroupChat && currentConversation && (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        const remoteId = currentConversation.participants?.find((p: any) => p.userId !== user?.id)?.userId;
                        if (remoteId) startCall(activeConversationId!, remoteId, currentConversation.displayName || currentConversation.name || '用户', currentConversation.displayAvatar || null, CallType.AUDIO);
                      }}
                      disabled={callStatus !== CallStatus.IDLE}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors disabled:opacity-30"
                      title="语音通话"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        const remoteId = currentConversation.participants?.find((p: any) => p.userId !== user?.id)?.userId;
                        if (remoteId) startCall(activeConversationId!, remoteId, currentConversation.displayName || currentConversation.name || '用户', currentConversation.displayAvatar || null, CallType.VIDEO);
                      }}
                      disabled={callStatus !== CallStatus.IDLE}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-accent transition-colors disabled:opacity-30"
                      title="视频通话"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                        <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                    </motion.button>
                  </>
                )}
                {isGroupChat && (
                  <button onClick={() => setShowMembers(!showMembers)} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-accent">
                    成员
                  </button>
                )}
                {isGroupChat && (
                  <button onClick={handleAISummarize} disabled={summarizing} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-accent disabled:opacity-30">
                    {summarizing ? '总结中...' : 'AI 总结'}
                  </button>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${isConnected() ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                  {isConnected() ? '已连接' : '未连接'}
                </span>
              </div>
            </header>

            <div className="flex-1 flex overflow-hidden">
              {/* 消息列表 */}
              <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-thin bg-gradient-to-b from-transparent via-white/20 to-white/40">
                {isLoadingMore && (
                  <div className="flex justify-center py-2"><div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-500 rounded-full animate-spin" /></div>
                )}

                {messagesLoading && currentMessages.length === 0 ? (
                  <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-indigo-300 border-t-indigo-500 rounded-full animate-spin" /></div>
                ) : (
                  <AnimatePresence initial={false}>
                    {currentMessages.map((msg) => (
                      <motion.div
                        key={msg.id || msg.clientId}
                        layout
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={bubbleVariants}
                      >
                        <MessageBubble message={msg} isMine={msg.senderId === user?.id} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}

                {/* AI 总结卡片 */}
                {aiSummary && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start">
                    <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-violet-50 border border-violet-200 rounded-bl-sm shadow-sm">
                      <div className="flex items-center gap-2 mb-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-violet-500">
                          <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" /><path d="M18 14a6 6 0 0 1-12 0" /><line x1="12" y1="20" x2="12" y2="22" />
                        </svg>
                        <span className="text-xs font-semibold text-violet-600">AI 群聊总结</span>
                        <button onClick={() => setAiSummary(null)} className="ml-auto text-muted-foreground hover:text-foreground text-xs">✕</button>
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words text-foreground/80">{aiSummary}</p>
                    </div>
                  </motion.div>
                )}

                {/* 输入状态指示器 */}
                {activeTypingUsers.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>对方正在输入</span>
                    <span className="flex gap-0.5">
                      {[0, 0.15, 0.3].map((delay, i) => (
                        <motion.span key={i} className="w-1 h-1 bg-indigo-400 rounded-full" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay }} />
                      ))}
                    </span>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* 群组成员面板 */}
              {showMembers && isGroupChat && groupDetail && (
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-60 border-l border-border/30 bg-white/70 backdrop-blur-sm overflow-y-auto">
                  <div className="p-3.5 border-b border-border/20 flex items-center justify-between">
                    <span className="text-sm font-semibold">成员 ({groupDetail.members.length})</span>
                    <button onClick={() => setShowMembers(false)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                  </div>
                  <div className="divide-y divide-border/10">
                    {groupDetail.members.map((member: any) => (
                      <div key={member.id} className="p-3.5 flex items-center gap-2.5 hover:bg-indigo-50/30 transition-colors">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                          {(member.user.nickname || member.user.username).slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{member.user.nickname || member.user.username}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.role === 'owner' ? '群主' : member.role === 'admin' ? '管理员' : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* 上传进度条 */}
            {uploadingFile && (
              <div className="px-5 py-3 border-t border-border/30 bg-white/60 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-500 rounded-full animate-spin" />
                  <span className="text-sm text-muted-foreground truncate flex-1">上传中: {uploadingFile}</span>
                  <span className="text-sm font-semibold text-indigo-600">{uploadProgress ?? 0}%</span>
                </div>
                <div className="mt-2 h-1.5 bg-border/30 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full" animate={{ width: `${uploadProgress ?? 0}%` }} transition={{ duration: 0.3 }} />
                </div>
              </div>
            )}

            {/* 输入区 */}
            <div className="p-4 border-t border-border/30 bg-white/70 backdrop-blur-sm">
              <div className="flex gap-2.5 items-end">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z"
                />
                <motion.button
                  whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!!uploadingFile}
                  className="w-10 h-10 flex items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-all duration-200 disabled:opacity-50 shadow-sm"
                  title="发送附件"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </motion.button>
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                    placeholder="输入消息..."
                    className="w-full px-5 py-3 bg-white/80 border border-border/40 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-300/60 focus:border-indigo-400 shadow-sm placeholder:text-muted-foreground/40 transition-all duration-200"
                  />
                </div>
                <motion.button
                  whileHover={{ scale: inputText.trim() ? 1.05 : 1 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  className="btn-hover-lift px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 text-white rounded-2xl font-semibold text-sm shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300/60 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  发送
                </motion.button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 bg-gradient-to-b from-transparent via-white/10 to-white/30">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-base font-medium">选择一个会话开始聊天</p>
            <p className="text-xs text-muted-foreground/60">或创建一个新会话</p>
          </div>
        )}
      </main>

      <CreateGroupDialog open={showCreateGroup} onClose={() => setShowCreateGroup(false)} />

      {callStatus === CallStatus.RINGING && (
        <IncomingCallModal
          callerName={callRemoteUserName || '用户'}
          callerAvatar={callRemoteUserAvatar}
          callType={activeCallType || CallType.AUDIO}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}
      {(callStatus === CallStatus.CALLING || callStatus === CallStatus.CONNECTING || callStatus === CallStatus.IN_CALL) && (
        <ActiveCallOverlay
          callStatus={callStatus}
          callType={activeCallType}
          remoteUserName={callRemoteUserName}
          remoteUserAvatar={callRemoteUserAvatar}
          localStream={localStream}
          remoteStream={remoteStream}
          isAudioMuted={isAudioMuted}
          isVideoOff={isVideoOff}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onEndCall={endCall}
        />
      )}
    </div>
  );
}

// ==========================================
// 消息气泡组件
// ==========================================
function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  const [translation, setTranslation] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const { translate } = useAITranslate();

  const handleTranslate = useCallback(async () => {
    if (translating) return;
    if (translation) { setTranslation(null); return; }
    setTranslating(true);
    try {
      const result = await translate({ text: message.content, targetLang: '中文' });
      setTranslation(result);
    } catch { alert('翻译失败'); }
    finally { setTranslating(false); }
  }, [message.content, translation, translating, translate]);

  const isAI = message.type === MessageType.AI;

  // 气泡颜色方案
  const bubbleClass = isAI
    ? 'bg-violet-50 border border-violet-200 text-foreground/80 rounded-bl-sm'
    : isMine
      ? 'bg-gradient-to-br from-indigo-500 to-blue-500 text-white rounded-br-sm shadow-md shadow-indigo-200/50'
      : 'bg-white border border-border/30 text-foreground/90 rounded-bl-sm shadow-sm';

  const renderContent = () => {
    switch (message.type) {
      case MessageType.AI:
        return (
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-violet-500">
                <path d="M12 2a4 4 0 0 1 4 4v2a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" /><path d="M18 14a6 6 0 0 1-12 0" /><line x1="12" y1="20" x2="12" y2="22" />
              </svg>
              <span className="text-xs font-semibold text-violet-600">AI 助手</span>
            </div>
            <p className="break-words text-sm whitespace-pre-wrap">{message.content}</p>
          </div>
        );
      case MessageType.IMAGE: {
        const imgUrl = getAttachmentUrl(message.content);
        return (
          <a href={imgUrl} target="_blank" rel="noopener noreferrer">
            <img src={imgUrl} alt={(message.metadata?.filename as string) || '图片'} className="rounded-xl max-w-full max-h-80 object-contain cursor-pointer hover:opacity-90 transition-opacity shadow-sm" loading="lazy" />
          </a>
        );
      }
      case MessageType.AUDIO: {
        const audioUrl = getAttachmentUrl(message.content);
        return <audio src={audioUrl} controls className="w-full h-8" />;
      }
      case MessageType.VIDEO: {
        const videoUrl = getAttachmentUrl(message.content);
        return <video src={videoUrl} controls className="rounded-xl max-w-full max-h-80" preload="metadata" />;
      }
      case MessageType.FILE: {
        const fileUrl = getAttachmentUrl(message.content);
        const filename = (message.metadata?.filename as string) || '文件';
        const size = message.metadata?.size as number | undefined;
        return (
          <a href={fileUrl} download={filename} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl hover:bg-black/5 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8 shrink-0 opacity-70">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{filename}</p>
              {size && <p className="text-xs opacity-70">{formatFileSize(size)}</p>}
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 opacity-50"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          </a>
        );
      }
      default:
        return <p className="break-words text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>;
    }
  };

  const canTranslate = message.type === MessageType.TEXT && !isMine;

  return (
    <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} group`}>
      <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl ${bubbleClass}`}>
        {renderContent()}
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`text-[11px] ${isAI ? 'text-violet-400' : isMine ? 'text-white/60' : 'text-muted-foreground/60'}`}>
            {formatTime(message.createdAt)}
          </span>
          {isMine && <MessageStatusIcon status={message.status} />}
          {canTranslate && (
            <button
              onClick={handleTranslate}
              disabled={translating}
              className={`text-[11px] transition-colors ${translation ? 'text-indigo-500 font-medium' : 'text-muted-foreground/50 hover:text-indigo-500'} disabled:opacity-50`}
            >
              {translating ? '翻译中...' : translation ? '收起' : '翻译'}
            </button>
          )}
        </div>
        {translation && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 pt-2 border-t border-border/20">
            <p className="text-sm break-words leading-relaxed">{translation}</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 辅助组件 & 函数
// ==========================================
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function MessageStatusIcon({ status }: { status: MessageStatus | string }) {
  const isRead = status === MessageStatus.READ || status === 'read';
  const isFailed = status === MessageStatus.FAILED || status === 'failed';
  let icon = '';
  switch (status) {
    case MessageStatus.SENDING: case 'sending': icon = '⏳'; break;
    case MessageStatus.SENT: case 'sent': icon = '✓'; break;
    case MessageStatus.DELIVERED: case 'delivered': icon = '✓✓'; break;
    case MessageStatus.READ: case 'read': icon = '✓✓'; break;
    case MessageStatus.FAILED: case 'failed': icon = '✕'; break;
  }
  return (
    <span className={`text-[11px] ${isRead ? 'text-blue-300' : isFailed ? 'text-red-300' : 'text-white/50'}`}>
      {icon}
    </span>
  );
}
