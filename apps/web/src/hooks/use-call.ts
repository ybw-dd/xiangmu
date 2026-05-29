'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { useCallStore } from '@/stores/call-store';
import { socketManager } from '@/lib/socket';
import { SOCKET_EVENTS } from '@lingxun/socket';
import { CallStatus, CallType } from '@lingxun/types';
import type {
  CallInvitePayload,
  CallAcceptPayload,
  CallRejectPayload,
  CallOfferPayload,
  CallAnswerPayload,
  CallIceCandidatePayload,
  CallEndPayload,
} from '@lingxun/types';

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function useCall() {
  const { user, isAuthenticated } = useAuthStore();
  const {
    callStatus,
    callType,
    conversationId,
    remoteUserId,
    remoteUserName,
    remoteUserAvatar,
    isCaller,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoOff,
    startCall: storeStartCall,
    receiveCall,
    setConnecting,
    setInCall,
    setLocalStream,
    setRemoteStream,
    toggleAudio: storeToggleAudio,
    toggleVideo: storeToggleVideo,
    endCall: storeEndCall,
    reset,
  } = useCallStore();

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  const currentCallTypeRef = useRef<CallType | null>(null);

  // 清理 PeerConnection
  const cleanupPeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.ontrack = null;
      pcRef.current.onicecandidate = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    iceCandidatesQueue.current = [];
  }, []);

  // 创建 PeerConnection
  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (event) => {
      if (event.candidate && remoteUserId) {
        socketManager.emit(SOCKET_EVENTS.CALL_ICE_CANDIDATE, {
          conversationId: useCallStore.getState().conversationId,
          targetUserId: remoteUserId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        setRemoteStream(stream);
        setInCall();
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        handleEndCall();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [remoteUserId, setRemoteStream, setInCall]);

  // 添加本地轨道到 PC
  const addLocalTracks = useCallback((pc: RTCPeerConnection, stream: MediaStream) => {
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
    });
  }, []);

  // 发起通话
  const startCall = useCallback(
    async (targetConversationId: string, targetUserId: string, targetUserName: string, targetUserAvatar: string | null, type: CallType) => {
      if (callStatus !== CallStatus.IDLE) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: type === CallType.VIDEO,
        });

        currentCallTypeRef.current = type;
        setLocalStream(stream);

        storeStartCall({
          conversationId: targetConversationId,
          remoteUserId: targetUserId,
          remoteUserName: targetUserName,
          remoteUserAvatar: targetUserAvatar,
          callType: type,
          isCaller: true,
        });

        socketManager.emit(SOCKET_EVENTS.CALL_INVITE, {
          conversationId: targetConversationId,
          callerId: user!.id,
          callerName: user!.nickname || user!.username,
          callerAvatar: user!.avatar,
          calleeId: targetUserId,
          callType: type,
        });
      } catch {
        alert('无法访问摄像头/麦克风，请检查权限');
        reset();
      }
    },
    [callStatus, user, storeStartCall, setLocalStream, reset],
  );

  // 接听来电
  const acceptCall = useCallback(async () => {
    const state = useCallStore.getState();
    if (state.callStatus !== CallStatus.RINGING) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: state.callType === CallType.VIDEO,
      });

      setLocalStream(stream);

      socketManager.emit(SOCKET_EVENTS.CALL_ACCEPT, {
        conversationId: state.conversationId,
        calleeId: user!.id,
        callerId: state.remoteUserId,
      });

      setConnecting();
    } catch {
      alert('无法访问摄像头/麦克风，请检查权限');
      handleEndCall();
    }
  }, [user, setLocalStream, setConnecting]);

  // 拒绝来电
  const rejectCall = useCallback(() => {
    const state = useCallStore.getState();
    if (state.callStatus !== CallStatus.RINGING) return;

    socketManager.emit(SOCKET_EVENTS.CALL_REJECT, {
      conversationId: state.conversationId,
      calleeId: user!.id,
      callerId: state.remoteUserId,
    });

    cleanupPeerConnection();
    reset();
  }, [user, cleanupPeerConnection, reset]);

  // 挂断通话
  const handleEndCall = useCallback(() => {
    const state = useCallStore.getState();
    if (state.callStatus === CallStatus.IDLE) return;

    if (state.remoteUserId) {
      socketManager.emit(SOCKET_EVENTS.CALL_END, {
        conversationId: state.conversationId,
        targetUserId: state.remoteUserId,
      });
    }

    cleanupPeerConnection();
    storeEndCall();

    // 短暂显示 ENDED 后重置
    setTimeout(() => {
      reset();
    }, 500);
  }, [cleanupPeerConnection, storeEndCall, reset]);

  // 处理收到 call:accept（caller 侧）
  const handleCallAccept = useCallback(
    async (data: CallAcceptPayload) => {
      const state = useCallStore.getState();
      if (state.callStatus !== CallStatus.CALLING) return;
      if (data.callerId !== user?.id) return;

      setConnecting();

      const stream = state.localStream;
      if (!stream) return;

      const pc = createPeerConnection();
      addLocalTracks(pc, stream);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socketManager.emit(SOCKET_EVENTS.CALL_OFFER, {
        conversationId: data.conversationId,
        targetUserId: data.calleeId,
        offer,
      });
    },
    [user, setConnecting, createPeerConnection, addLocalTracks],
  );

  // 处理收到 call:offer（callee 侧）
  const handleCallOffer = useCallback(
    async (data: CallOfferPayload) => {
      const state = useCallStore.getState();
      if (state.callStatus !== CallStatus.CONNECTING) return;

      const stream = state.localStream;
      if (!stream) return;

      const pc = createPeerConnection();
      addLocalTracks(pc, stream);

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));

      // 处理排队的 ICE candidates
      for (const candidate of iceCandidatesQueue.current) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      iceCandidatesQueue.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketManager.emit(SOCKET_EVENTS.CALL_ANSWER, {
        conversationId: data.conversationId,
        targetUserId: state.remoteUserId!,
        answer,
      });
    },
    [createPeerConnection, addLocalTracks],
  );

  // 处理收到 call:answer（caller 侧）
  const handleCallAnswer = useCallback(async (data: CallAnswerPayload) => {
    const pc = pcRef.current;
    if (!pc) return;

    await pc.setRemoteDescription(new RTCSessionDescription(data.answer));

    // 处理排队的 ICE candidates
    for (const candidate of iceCandidatesQueue.current) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    iceCandidatesQueue.current = [];
  }, []);

  // 处理收到 call:ice-candidate
  const handleIceCandidate = useCallback(async (data: CallIceCandidatePayload) => {
    const pc = pcRef.current;
    const candidate = new RTCIceCandidate(data.candidate);

    if (pc && pc.remoteDescription) {
      await pc.addIceCandidate(candidate);
    } else {
      // remoteDescription 还没设置，排队
      iceCandidatesQueue.current.push(data.candidate);
    }
  }, []);

  // 处理收到 call:reject
  const handleCallReject = useCallback(
    (_data: CallRejectPayload) => {
      const state = useCallStore.getState();
      if (state.callStatus === CallStatus.IDLE) return;

      cleanupPeerConnection();
      storeEndCall();

      setTimeout(() => {
        reset();
      }, 500);
    },
    [cleanupPeerConnection, storeEndCall, reset],
  );

  // 处理收到 call:end
  const handleCallEnd = useCallback(
    (_data: CallEndPayload) => {
      const state = useCallStore.getState();
      if (state.callStatus === CallStatus.IDLE) return;

      cleanupPeerConnection();
      storeEndCall();

      setTimeout(() => {
        reset();
      }, 500);
    },
    [cleanupPeerConnection, storeEndCall, reset],
  );

  // 处理收到 call:invite（callee 侧）
  const handleCallInvite = useCallback(
    (data: CallInvitePayload) => {
      const state = useCallStore.getState();
      // 如果已经在通话中，自动拒绝
      if (state.callStatus !== CallStatus.IDLE) {
        socketManager.emit(SOCKET_EVENTS.CALL_REJECT, {
          conversationId: data.conversationId,
          calleeId: user!.id,
          callerId: data.callerId,
        });
        return;
      }

      receiveCall({
        conversationId: data.conversationId,
        callerId: data.callerId,
        callerName: data.callerName,
        callerAvatar: data.callerAvatar,
        callType: data.callType,
      });
    },
    [user, receiveCall],
  );

  // 订阅 socket 事件
  useEffect(() => {
    if (!isAuthenticated) return;

    socketManager.on(SOCKET_EVENTS.CALL_INVITE, handleCallInvite);
    socketManager.on(SOCKET_EVENTS.CALL_ACCEPT, handleCallAccept);
    socketManager.on(SOCKET_EVENTS.CALL_REJECT, handleCallReject);
    socketManager.on(SOCKET_EVENTS.CALL_OFFER, handleCallOffer);
    socketManager.on(SOCKET_EVENTS.CALL_ANSWER, handleCallAnswer);
    socketManager.on(SOCKET_EVENTS.CALL_ICE_CANDIDATE, handleIceCandidate);
    socketManager.on(SOCKET_EVENTS.CALL_END, handleCallEnd);

    return () => {
      socketManager.off(SOCKET_EVENTS.CALL_INVITE, handleCallInvite);
      socketManager.off(SOCKET_EVENTS.CALL_ACCEPT, handleCallAccept);
      socketManager.off(SOCKET_EVENTS.CALL_REJECT, handleCallReject);
      socketManager.off(SOCKET_EVENTS.CALL_OFFER, handleCallOffer);
      socketManager.off(SOCKET_EVENTS.CALL_ANSWER, handleCallAnswer);
      socketManager.off(SOCKET_EVENTS.CALL_ICE_CANDIDATE, handleIceCandidate);
      socketManager.off(SOCKET_EVENTS.CALL_END, handleCallEnd);
    };
  }, [
    isAuthenticated,
    handleCallInvite,
    handleCallAccept,
    handleCallReject,
    handleCallOffer,
    handleCallAnswer,
    handleIceCandidate,
    handleCallEnd,
  ]);

  return {
    startCall,
    acceptCall,
    rejectCall,
    endCall: handleEndCall,
    toggleAudio: storeToggleAudio,
    toggleVideo: storeToggleVideo,
    callStatus,
    callType,
    conversationId,
    localStream,
    remoteStream,
    isAudioMuted,
    isVideoOff,
    remoteUserName,
    remoteUserAvatar,
    isCaller,
  };
}
