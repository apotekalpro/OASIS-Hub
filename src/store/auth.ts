import { create } from 'zustand'
import type { Profile } from '@/types/database'

interface AuthState {
  profile: Profile | null
  setProfile: (profile: Profile | null) => void
  clearProfile: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
  clearProfile: () => set({ profile: null }),
}))
