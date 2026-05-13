'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import type { Profile } from '@/types/database'
import type { FeaturePermissions } from '@/lib/auth/permissions'

export function ProfileProvider({
  profile,
  featurePermissions,
  children,
}: {
  profile: Profile
  featurePermissions: FeaturePermissions
  children: React.ReactNode
}) {
  const setProfile = useAuthStore(s => s.setProfile)
  const setFeaturePermissions = useAuthStore(s => s.setFeaturePermissions)

  useEffect(() => {
    setProfile(profile)
    setFeaturePermissions(featurePermissions)
  }, [profile, featurePermissions, setProfile, setFeaturePermissions])

  return <>{children}</>
}
