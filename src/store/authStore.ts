import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  name: string;
  email: string;
  full_name: string;
  user_image?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  erpnextUrl: string | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setErpnextUrl: (url: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      erpnextUrl: null,
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setLoading: (isLoading) => set({ isLoading }),
      setErpnextUrl: (erpnextUrl) => set({ erpnextUrl }),
      logout: () => set({ user: null, isAuthenticated: false, erpnextUrl: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated,
        erpnextUrl: state.erpnextUrl 
      }),
    }
  )
);