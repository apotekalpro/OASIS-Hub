import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Building2, ClipboardCheck, Clock, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default async function InspectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient()
  const profileRes = await admin.from('profiles').select('org_id, role, outlet_id').eq('id', user.id).single()
  const { org_id: orgId, role, outlet_id: profileOutletId } = (profileRes.data ?? {}) as { org_id: string; role: string; outlet_id: string | null }

  // Admins see all outlets; area_manager sees their outlets; outlet user sees only their one
  const isAdmin = ['super_admin', 'org_admin', 'chief', 'dept_head'].includes(role)
  const isAreaManager = role === 'area_manager'
  const isOutletUser = role === 'outlet'

  let outletsQuery = admin
    .from('outlets')
    .select('id, name, code, city, state, status')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .ilike('name', '%Apotek Alpro%')
    .order('name')

  if (isOutletUser) {
    // Outlet user sees only their assigned outlet
    if (!profileOutletId) {
      return (
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Inspections</h1>
          <Card><CardContent className="p-12 text-center">
            <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-500">No outlet assigned to this account</p>
            <p className="text-sm text-gray-400 mt-1">Contact your administrator.</p>
          </CardContent></Card>
        </div>
      )
    }
    outletsQuery = outletsQuery.eq('id', profileOutletId)
  } else if (isAreaManager) {
    // Area manager sees outlets where area_manager_id = their profile
    outletsQuery = outletsQuery.eq('area_manager_id', user.id)
  } else if (!isAdmin) {
    // Other staff: collect outlet IDs from outlet_staff assignments AND from inspection schedules
    const [staffRes, scheduleRes] = await Promise.all([
      admin.from('outlet_staff').select('outlet_id').eq('user_id', user.id),
      admin.from('inspection_schedules').select('outlet_id').eq('assigned_to', user.id).eq('is_active', true),
    ])
    const staffIds = (staffRes.data ?? []).map(a => a.outlet_id).filter(Boolean) as string[]
    const scheduleIds = (scheduleRes.data ?? []).map(s => s.outlet_id).filter(Boolean) as string[]
    const assignedIds = [...new Set([...staffIds, ...scheduleIds])]

    if (assignedIds.length === 0) {
      return (
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Inspections</h1>
          <Card><CardContent className="p-12 text-center">
            <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-500">No outlets assigned</p>
            <p className="text-sm text-gray-400 mt-1">Contact your manager to be assigned to an outlet.</p>
          </CardContent></Card>
        </div>
      )
    }
    outletsQuery = outletsQuery.in('id', assignedIds)
  }

  const { data: outlets } = await outletsQuery

  // Get today's session counts per outlet
  const today = new Date().toISOString().split('T')[0]
  const { data: todaySessions } = await supabase
    .from('inspection_sessions')
    .select('outlet_id, status')
    .eq('org_id', orgId)
    .gte('scheduled_for', today)
    .lt('scheduled_for', today + 'T23:59:59')

  // Get open issue counts per outlet
  const { data: openIssues } = await supabase
    .from('inspection_issues')
    .select('outlet_id')
    .eq('org_id', orgId)
    .in('status', ['open', 'in_progress', 'escalated'])

  // Get active schedules
  const { data: activeSchedules } = await supabase
    .from('inspection_schedules')
    .select('outlet_id, outlet_scope, starts_at, frequency, is_active')
    .eq('org_id', orgId)
    .eq('is_active', true)

  type OutletRow = { id: string; name: string; code: string | null; city: string | null; state: string | null; status: string }
  const outletList = (outlets ?? []) as OutletRow[]

  function getOutletStats(outletId: string) {
    const sessions = (todaySessions ?? []).filter(s => s.outlet_id === outletId)
    const issues = (openIssues ?? []).filter(i => i.outlet_id === outletId).length
    const done = sessions.filter(s => s.status === 'submitted' || s.status === 'approved').length
    return { sessionsDue: sessions.length, done, issues }
  }

  function hasActiveSchedule(outletId: string): boolean {
    return (activeSchedules ?? []).some(s =>
      s.is_active && (s.outlet_scope === 'all' || s.outlet_id === outletId)
    )
  }

  function getOutletBadgeStatus(outletId: string) {
    const stats = getOutletStats(outletId)
    const hasSchedule = hasActiveSchedule(outletId)
    if (stats.sessionsDue > 0 && stats.done === stats.sessionsDue) return 'completed'
    if (stats.sessionsDue > stats.done) return 'in_progress'
    if (hasSchedule) return 'scheduled_pending'
    return 'all_clear'
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Inspections</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Select an outlet to view and complete today&apos;s checklists.
        </p>
      </div>

      {/* Today's summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Today's Sessions", value: (todaySessions ?? []).length, icon: ClipboardCheck, color: 'text-indigo-600' },
          { label: 'Completed', value: (todaySessions ?? []).filter(s => ['submitted','approved'].includes(s.status)).length, icon: ClipboardCheck, color: 'text-green-600' },
          { label: 'Open Issues', value: (openIssues ?? []).length, icon: AlertCircle, color: 'text-amber-600' },
        ].map(stat => (
          <Card key={stat.label}><CardContent className="p-4 flex items-center gap-3">
            <stat.icon className={cn('h-6 w-6', stat.color)} />
            <div>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </CardContent></Card>
        ))}
      </div>

      {/* Outlet cards */}
      {outletList.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-500">No active outlets</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {outletList.map(outlet => {
            const stats = getOutletStats(outlet.id)
            const badgeStatus = getOutletBadgeStatus(outlet.id)
            const isActive = badgeStatus === 'in_progress' || badgeStatus === 'scheduled_pending'
            return (
              <Link key={outlet.id} href={`/inspections/${outlet.id}`}>
                <Card className={cn(
                  'hover:shadow-md transition-all cursor-pointer border-2',
                  isActive ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200'
                )}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'h-11 w-11 rounded-xl flex items-center justify-center shrink-0',
                          isActive ? 'bg-indigo-600' : badgeStatus === 'completed' ? 'bg-green-500' : 'bg-gray-100'
                        )}>
                          <Building2 className={cn('h-5 w-5', isActive || badgeStatus === 'completed' ? 'text-white' : 'text-gray-400')} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{outlet.name}</p>
                          {outlet.code && <p className="text-xs text-gray-400 font-mono">{outlet.code}</p>}
                          {(outlet.city || outlet.state) && (
                            <p className="text-xs text-gray-500 mt-0.5">{[outlet.city, outlet.state].filter(Boolean).join(', ')}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {badgeStatus === 'in_progress' && (
                          <Badge variant="default" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {stats.done}/{stats.sessionsDue} done
                          </Badge>
                        )}
                        {badgeStatus === 'completed' && (
                          <Badge variant="success" className="text-xs">
                            ✓ Completed
                          </Badge>
                        )}
                        {badgeStatus === 'scheduled_pending' && (
                          <Badge variant="secondary" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Scheduled
                          </Badge>
                        )}
                        {badgeStatus === 'all_clear' && (
                          <Badge variant="success" className="text-xs">All clear</Badge>
                        )}
                        {stats.issues > 0 && (
                          <Badge variant="warning" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {stats.issues} issue{stats.issues !== 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
