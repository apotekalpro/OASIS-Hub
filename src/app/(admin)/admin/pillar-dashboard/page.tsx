import { getAuthUser, getCachedProfile, getCachedFeaturePermissions } from '@/lib/auth/get-user-profile'
import { canManagePillarTemplates } from '@/lib/auth/permissions'
import { createAdminClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/database'
import { redirect } from 'next/navigation'
import { PillarDashboardClient } from '@/components/pillar/pillar-dashboard-client'
import { generateEmbedToken } from '@/lib/embed-token'
import { EmbedCodeButton } from '@/components/pillar/embed-code-button'

export const dynamic = 'force-dynamic'

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default async function PillarDashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await getAuthUser()
  if (!user) return null

  const profile = await getCachedProfile(user.id)
  const orgId = (profile?.org_id ?? '') as string
  const role = (profile?.role ?? 'member') as UserRole
  const featurePermissions = await getCachedFeaturePermissions(orgId)

  if (!canManagePillarTemplates(role, featurePermissions)) redirect('/dashboard')

  const { month: monthParam } = await searchParams
  const month = monthParam ?? currentMonth()

  const admin = createAdminClient()

  // Fetch all assignments for the month with KR data, outlet, and area manager
  const [{ data: assignments }, { data: monthlyInputs }] = await Promise.all([
    admin
      .from('pillar_assignments')
      .select('id, title, progress, status, outlet_id, outlets(id, name, code, area_manager:area_manager_id(id, full_name)), pillar_assignment_krs(id, current_value, target_value, start_value, metric_type)')
      .eq('org_id', orgId)
      .eq('month', month)
      .order('created_at', { ascending: false }),
    admin
      .from('pillar_monthly_inputs')
      .select('outlet_id, as_of_date')
      .eq('org_id', orgId)
      .eq('month', month),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safeAssignments = (assignments ?? []) as any[]
  const safeMonthlyInputs = (monthlyInputs ?? []) as { outlet_id: string; as_of_date: string | null }[]

  const embedToken = generateEmbedToken(orgId)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nationwide Pillar Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Overview of pillar progress across all outlets and area managers</p>
        </div>
        <EmbedCodeButton token={embedToken} />
      </div>
      <PillarDashboardClient initialAssignments={safeAssignments} initialMonth={month} monthlyInputs={safeMonthlyInputs} />
    </div>
  )
}
