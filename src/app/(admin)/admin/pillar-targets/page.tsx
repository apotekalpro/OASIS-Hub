import { getAuthUser, getCachedProfile } from '@/lib/auth/get-user-profile'
import { canManagePillarTemplates } from '@/lib/auth/permissions'
import { PillarTargetsClient } from '@/components/pillar/pillar-targets-client'
import type { UserRole } from '@/types/database'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PillarTargetsPage() {
  const user = await getAuthUser()
  if (!user) return null

  const profile = await getCachedProfile(user.id)
  const role = (profile?.role ?? 'member') as UserRole

  if (!canManagePillarTemplates(role)) redirect('/dashboard')

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pillar Reward Targets</h1>
        <p className="text-gray-500 text-sm mt-0.5">Upload monthly outlet revenue targets and manage the reward tier matrix used for Incentive 2 &amp; 3</p>
      </div>
      <PillarTargetsClient />
    </div>
  )
}
