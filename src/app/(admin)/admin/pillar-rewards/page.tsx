import { getAuthUser, getCachedProfile, getCachedFeaturePermissions } from '@/lib/auth/get-user-profile'
import { canManagePillarTemplates } from '@/lib/auth/permissions'
import { PillarRewardsReportClient } from '@/components/pillar/pillar-rewards-report-client'
import type { UserRole } from '@/types/database'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PillarRewardsPage() {
  const user = await getAuthUser()
  if (!user) return null

  const profile = await getCachedProfile(user.id)
  const role = (profile?.role ?? 'member') as UserRole
  const featurePermissions = await getCachedFeaturePermissions(profile?.org_id ?? '')

  if (!canManagePillarTemplates(role, featurePermissions)) redirect('/dashboard')

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Incentives Reward Summary</h1>
        <p className="text-gray-500 text-sm mt-0.5">Monthly reward &amp; payroll breakdown by outlet — Incentive 1, 2 &amp; 3</p>
      </div>
      <PillarRewardsReportClient />
    </div>
  )
}
