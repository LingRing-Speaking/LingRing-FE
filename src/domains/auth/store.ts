import { create } from "zustand";
import type { User } from "./types";

export interface Session {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setSession: (session: Session) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  setSession: ({ user, accessToken, refreshToken }) =>
    set({ user, accessToken, refreshToken, isAuthenticated: true }),
  clearSession: () =>
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false }),
}));
