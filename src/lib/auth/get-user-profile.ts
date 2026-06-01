import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'
import type { FeaturePermissions } from '@/lib/auth/permissions'

// Deduplicated per-request: avoids re-verifying JWT when layout + page both call this
export const getAuthUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

// Deduplicated per-request AND cached cross-request for 90s.
// Layout fetches this; pages reuse it from the React cache for free within the same render.
// Subsequent navigations within 90s skip the DB entirely.
export const getCachedProfile = cache(async (userId: string): Promise<Profile | null> => {
  return unstable_cache(
    async () => {
      const admin = createAdminClient()
      const { data } = await admin.from('profiles').select('*').eq('id', userId).single()
      return data as Profile | null
    },
    [`profile-${userId}`],
    { revalidate: 90, tags: [`profile-${userId}`] }
  )()
})

// Feature permissions change even less often — cache for 5 minutes
export const getCachedFeaturePermissions = cache(async (orgId: string): Promise<FeaturePermissions> => {
  return unstable_cache(
    async () => {
      const admin = createAdminClient()
      const { data } = await admin.from('feature_permissions').select('feature, min_role').eq('org_id', orgId)
      const fp: FeaturePermissions = {}
      for (const row of (data ?? []) as { feature: string; min_role: string }[]) {
        (fp as Record<string, string>)[row.feature] = row.min_role
      }
      return fp
    },
    [`feature-permissions-${orgId}`],
    { revalidate: 300, tags: [`feature-permissions-${orgId}`] }
  )()
})
