'use client';

import { create } from 'zustand';
import { CallStatus, CallType } from '@lingxun/types';

interface CallState {
  // 通话状态
  callStatus: CallStatus;
  callType: CallType | null;
  conversationId: string | null;
  remoteUserId: string | null;
  remoteUserName: string | null;
  remoteUserAvatar: string | null;
  isCaller: boolean;

  // 媒体流
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoOff: boolean;

  // 操作
  startCall: (params: {
    conversationId: string;
    remoteUserId: string;
    remoteUserName: string;
    remoteUserAvatar: string | null;
    callType: CallType;
    isCaller: boolean;
  }) => void;
  receiveCall: (params: {
    conversationId: string;
    callerId: string;
    callerName: string;
    callerAvatar: string | null;
    callType: CallType;
  }) => void;
  setConnecting: () => void;
  setInCall: () => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  toggleAudio: () => void;
  toggleVideo: () => void;
  endCall: () => void;
  reset: () => void;
}

function stopStream(stream: MediaStream | null) {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
}

export const useCallStore = create<CallState>((set, get) => ({
  callStatus: CallStatus.IDLE,
  callType: null,
  conversationId: null,
  remoteUserId: null,
  remoteUserName: null,
  remoteUserAvatar: null,
  isCaller: false,
  localStream: null,
  remoteStream: null,
  isAudioMuted: false,
  isVideoOff: false,

  startCall: (params) =>
    set({
      callStatus: CallStatus.CALLING,
      callType: params.callType,
      conversationId: params.conversationId,
      remoteUserId: params.remoteUserId,
      remoteUserName: params.remoteUserName,
      remoteUserAvatar: params.remoteUserAvatar,
      isCaller: params.isCaller,
    }),

  receiveCall: (params) =>
    set({
      callStatus: CallStatus.RINGING,
      callType: params.callType,
      conversationId: params.conversationId,
      remoteUserId: params.callerId,
      remoteUserName: params.callerName,
      remoteUserAvatar: params.callerAvatar,
      isCaller: false,
    }),

  setConnecting: () => set({ callStatus: CallStatus.CONNECTING }),

  setInCall: () => set({ callStatus: CallStatus.IN_CALL }),

  setLocalStream: (stream) => set({ localStream: stream }),

  setRemoteStream: (stream) => set({ remoteStream: stream }),

  toggleAudio: () =>
    set((state) => {
      const muted = !state.isAudioMuted;
      state.localStream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
      return { isAudioMuted: muted };
    }),

  toggleVideo: () =>
    set((state) => {
      const off = !state.isVideoOff;
      state.localStream?.getVideoTracks().forEach((t) => (t.enabled = !off));
      return { isVideoOff: off };
    }),

  endCall: () => {
    const state = get();
    stopStream(state.localStream);
    stopStream(state.remoteStream);
    set({
      callStatus: CallStatus.ENDED,
      localStream: null,
      remoteStream: null,
      isAudioMuted: false,
      isVideoOff: false,
    });
  },

  reset: () => {
    const state = get();
    stopStream(state.localStream);
    stopStream(state.remoteStream);
    set({
      callStatus: CallStatus.IDLE,
      callType: null,
      conversationId: null,
      remoteUserId: null,
      remoteUserName: null,
      remoteUserAvatar: null,
      isCaller: false,
      localStream: null,
      remoteStream: null,
      isAudioMuted: false,
      isVideoOff: false,
    });
  },
}));
