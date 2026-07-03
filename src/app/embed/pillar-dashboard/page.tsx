import { verifyEmbedToken } from '@/lib/embed-token'
import { createAdminClient } from '@/lib/supabase/server'
import { PillarDashboardClient } from '@/components/pillar/pillar-dashboard-client'

export const dynamic = 'force-dynamic'

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default async function EmbedPillarDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; month?: string }>
}) {
  const { token, month: monthParam } = await searchParams

  const orgId = token ? verifyEmbedToken(token) : null
  if (!orgId) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
        Invalid or missing embed token.
      </div>
    )
  }

  const month = monthParam ?? currentMonth()
  const admin = createAdminClient()

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

  return (
    <div className="p-4 bg-white min-h-screen">
      <PillarDashboardClient
        initialAssignments={safeAssignments}
        initialMonth={month}
        monthlyInputs={safeMonthlyInputs}
        embedToken={token}
      />
    </div>
  )
}
