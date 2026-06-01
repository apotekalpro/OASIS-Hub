import { cache } from 'react'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'
import type { FeaturePermissions } from '@/lib/auth/permissions'

// Deduplicated per-request: avoids re-verifying JWT when layout + page both call this
export const getAuthUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

// Deduplicated per-request: layout fetches this, pages reuse it for free
export const getCachedProfile = cache(async (userId: string): Promise<Profile | null> => {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('*').eq('id', userId).single()
  return data as Profile | null
})

// Deduplicated per-request: fetched once in layout, free for any page that also needs it
export const getCachedFeaturePermissions = cache(async (orgId: string): Promise<FeaturePermissions> => {
  const admin = createAdminClient()
  const { data } = await admin.from('feature_permissions').select('feature, min_role').eq('org_id', orgId)
  const fp: FeaturePermissions = {}
  for (const row of (data ?? []) as { feature: string; min_role: string }[]) {
    (fp as Record<string, string>)[row.feature] = row.min_role
  }
  return fp
})
