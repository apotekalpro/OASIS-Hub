import { create } from 'zustand'
import type { Profile } from '@/types/database'
import type { FeaturePermissions } from '@/lib/auth/permissions'

interface AuthState {
  profile: Profile | null
  featurePermissions: FeaturePermissions
  setProfile: (profile: Profile | null) => void
  setFeaturePermissions: (p: FeaturePermissions) => void
  clearProfile: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  profile: null,
  featurePermissions: {},
  setProfile: (profile) => set({ profile }),
  setFeaturePermissions: (featurePermissions) => set({ featurePermissions }),
  clearProfile: () => set({ profile: null, featurePermissions: {} }),
}))
