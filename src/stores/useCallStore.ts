import { create } from 'zustand';

export interface CallSession {
  id: string;
  room_id: string;
  lk_room_name: string;
  type: 'audio' | 'video' | 'huddle' | 'screen_share';
  started_by: string;
  started_at: string;
  status: 'active' | 'ended';
  participants: CallParticipant[];
}

export interface CallParticipant {
  id: string;
  call_id: string;
  user_id: string;
  user_name?: string;
  joined_at: string;
  role: 'host' | 'participant';
  had_audio: boolean;
  had_video: boolean;
}

interface CallState {
  activeCall: CallSession | null;
  livekitToken: string | null;
  livekitURL: string;
  isCallMinimized: boolean;

  setActiveCall: (call: CallSession | null) => void;
  setLivekitToken: (token: string | null) => void;
  setCallMinimized: (minimized: boolean) => void;
  addParticipant: (participant: CallParticipant) => void;
  removeParticipant: (userId: string) => void;
  endCall: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  activeCall: null,
  livekitToken: null,
  livekitURL: import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880',
  isCallMinimized: false,

  setActiveCall: (call) => set({ activeCall: call }),

  setLivekitToken: (token) => set({ livekitToken: token }),

  setCallMinimized: (minimized) => set({ isCallMinimized: minimized }),

  addParticipant: (participant) =>
    set((state) => {
      if (!state.activeCall) return state;
      const exists = state.activeCall.participants.some(
        (p) => p.user_id === participant.user_id
      );
      if (exists) return state;
      return {
        activeCall: {
          ...state.activeCall,
          participants: [...state.activeCall.participants, participant],
        },
      };
    }),

  removeParticipant: (userId) =>
    set((state) => {
      if (!state.activeCall) return state;
      return {
        activeCall: {
          ...state.activeCall,
          participants: state.activeCall.participants.filter(
            (p) => p.user_id !== userId
          ),
        },
      };
    }),

  endCall: () =>
    set({
      activeCall: null,
      livekitToken: null,
      isCallMinimized: false,
    }),
}));
