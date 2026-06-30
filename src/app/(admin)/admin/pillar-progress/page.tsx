import { getAuthUser, getCachedProfile, getCachedFeaturePermissions } from '@/lib/auth/get-user-profile'
import { canManagePillarTemplates } from '@/lib/auth/permissions'
import { PillarProgressExportClient } from '@/components/pillar/pillar-progress-export-client'
import type { UserRole } from '@/types/database'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PillarProgressPage() {
  const user = await getAuthUser()
  if (!user) return null

  const profile = await getCachedProfile(user.id)
  const orgId = (profile?.org_id ?? '') as string
  const role = (profile?.role ?? 'member') as UserRole
  const featurePermissions = await getCachedFeaturePermissions(orgId)

  if (!canManagePillarTemplates(role, featurePermissions)) redirect('/dashboard')

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pillar Progress Export / Import</h1>
        <p className="text-gray-500 text-sm mt-0.5">Export all outlets&apos; Pillar Key Result progress for a month, update offline, then re-import to bulk-update the system</p>
      </div>
      <PillarProgressExportClient />
    </div>
  )
}
