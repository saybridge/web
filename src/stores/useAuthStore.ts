import { create } from 'zustand';

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  is_active: boolean;
  presence_status: string;
  custom_status?: string;
  system_role?: string;
}

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  tempToken: string | null; // For 2FA required state
  
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setTempToken: (token: string | null) => void;
  setSession: (user: UserProfile) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  tempToken: null,

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  setTempToken: (token) => set({ tempToken: token }),
  setSession: (user) => set({ user, isAuthenticated: true, error: null, tempToken: null }),
  clearSession: () => set({ user: null, isAuthenticated: false, error: null, tempToken: null }),
}));
