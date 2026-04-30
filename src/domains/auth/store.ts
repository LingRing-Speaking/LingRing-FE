import { create } from "zustand";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setSession: (user: User) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  setSession: (user) => set({ user, isAuthenticated: true }),
  clearSession: () => set({ user: null, isAuthenticated: false }),
}));
