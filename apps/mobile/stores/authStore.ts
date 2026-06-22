import { create } from 'zustand'
import type { Session, User } from '@supabase/supabase-js'
import type { UserRole } from '@workstation/types'

interface AuthState {
  session: Session | null
  user: User | null
  role: UserRole | null
  isOnboardingComplete: boolean
  isLoading: boolean
  setSession: (session: Session | null) => void
  setRole: (role: UserRole | null) => void
  setOnboardingComplete: (complete: boolean) => void
  setLoading: (loading: boolean) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  user: null,
  role: null,
  isOnboardingComplete: false,
  isLoading: true,

  setSession: (session) =>
    set({ session, user: session?.user ?? null }),

  setRole: (role) => set({ role }),

  setOnboardingComplete: (isOnboardingComplete) => set({ isOnboardingComplete }),

  setLoading: (isLoading) => set({ isLoading }),

  reset: () =>
    set({ session: null, user: null, role: null, isOnboardingComplete: false, isLoading: false }),
}))
