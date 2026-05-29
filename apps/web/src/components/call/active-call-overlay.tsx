'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { CallStatus, CallType } from '@lingxun/types';

interface ActiveCallOverlayProps {
  callStatus: CallStatus;
  callType: CallType | null;
  remoteUserName: string | null;
  remoteUserAvatar: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onEndCall: () => void;
}

export function ActiveCallOverlay({
  callStatus,
  callType,
  remoteUserName,
  remoteUserAvatar,
  localStream,
  remoteStream,
  isAudioMuted,
  isVideoOff,
  onToggleAudio,
  onToggleVideo,
  onEndCall,
}: ActiveCallOverlayProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 设置视频流
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // 通话计时
  useEffect(() => {
    if (callStatus === CallStatus.IN_CALL && !startTimeRef.current) {
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current!) / 1000));
      }, 1000);
    }
    if (callStatus === CallStatus.ENDED || callStatus === CallStatus.IDLE) {
      if (timerRef.current) clearInterval(timerRef.current);
      startTimeRef.current = null;
      setDuration(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  const formatDuration = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, []);

  // Calling 状态：等待对方接听
  if (callStatus === CallStatus.CALLING) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="flex flex-col items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-3xl font-medium">
            {remoteUserAvatar ? (
              <img src={remoteUserAvatar} alt="" className="w-24 h-24 rounded-full object-cover" />
            ) : (
              (remoteUserName || '?').slice(0, 2)
            )}
          </div>
          <div className="text-center text-white">
            <p className="text-xl font-semibold">{remoteUserName}</p>
            <p className="text-sm opacity-70 mt-1">
              正在呼叫...
            </p>
          </div>
          <button
            onClick={onEndCall}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center mt-4 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
              <line x1="23" y1="1" x2="1" y2="23" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Connecting / In_call 状态
  if (callStatus === CallStatus.CONNECTING || callStatus === CallStatus.IN_CALL) {
    const isVideo = callType === CallType.VIDEO;

    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
        {/* 主画面 */}
        <div className="flex-1 relative flex items-center justify-center">
          {isVideo ? (
            <>
              {/* 远程视频 */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
              {/* 本地视频 PiP */}
              <div className="absolute top-4 right-4 w-32 h-24 rounded-lg overflow-hidden shadow-lg border border-white/20">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
                />
                {isVideoOff && (
                  <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                    <span className="text-white text-xs">摄像头关闭</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* 音频通话：头像 + 脉冲动画 */
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className={`w-28 h-28 rounded-full bg-primary/10 flex items-center justify-center text-4xl font-medium ${callStatus === CallStatus.IN_CALL ? 'animate-pulse' : ''}`}>
                  {remoteUserAvatar ? (
                    <img src={remoteUserAvatar} alt="" className="w-28 h-28 rounded-full object-cover" />
                  ) : (
                    (remoteUserName || '?').slice(0, 2)
                  )}
                </div>
                {callStatus === CallStatus.IN_CALL && (
                  <div className="absolute inset-0 rounded-full border-4 border-green-500/50 animate-ping" />
                )}
              </div>
              <p className="text-white text-xl font-semibold">{remoteUserName}</p>
            </div>
          )}

          {/* 连接中提示 */}
          {callStatus === CallStatus.CONNECTING && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <p className="text-white text-lg">连接中...</p>
            </div>
          )}
        </div>

        {/* 通话时长 */}
        <div className="text-center text-white py-2">
          {callStatus === CallStatus.IN_CALL && (
            <span className="text-sm opacity-80">{formatDuration(duration)}</span>
          )}
          {callStatus === CallStatus.CONNECTING && (
            <span className="text-sm opacity-60">正在建立连接...</span>
          )}
        </div>

        {/* 控制栏 */}
        <div className="flex items-center justify-center gap-6 py-6">
          {/* 静音 */}
          <button
            onClick={onToggleAudio}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isAudioMuted ? 'bg-red-500/80' : 'bg-white/20 hover:bg-white/30'
            }`}
            title={isAudioMuted ? '取消静音' : '静音'}
          >
            {isAudioMuted ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            )}
          </button>

          {/* 挂断 */}
          <button
            onClick={onEndCall}
            className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors"
            title="挂断"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91" />
              <line x1="23" y1="1" x2="1" y2="23" />
            </svg>
          </button>

          {/* 关闭摄像头（仅视频通话） */}
          {isVideo && (
            <button
              onClick={onToggleVideo}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                isVideoOff ? 'bg-red-500/80' : 'bg-white/20 hover:bg-white/30'
              }`}
              title={isVideoOff ? '开启摄像头' : '关闭摄像头'}
            >
              {isVideoOff ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
