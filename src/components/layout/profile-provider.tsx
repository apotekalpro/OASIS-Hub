'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import type { Profile } from '@/types/database'

export function ProfileProvider({
  profile,
  children,
}: {
  profile: Profile
  children: React.ReactNode
}) {
  const setProfile = useAuthStore(s => s.setProfile)

  useEffect(() => {
    setProfile(profile)
  }, [profile, setProfile])

  return <>{children}</>
}
