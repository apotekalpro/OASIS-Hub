import { createClient } from '@/lib/supabase/server'
import { Building2, ClipboardCheck, Clock, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default async function InspectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await supabase.from('profiles').select('org_id, role').eq('id', user.id).single()
  const { org_id: orgId, role } = (profileRes.data ?? {}) as { org_id: string; role: string }

  const isAdmin = ['super_admin', 'org_admin', 'dept_head'].includes(role)

  // Staff see only their assigned outlets; admins see all
  let outletsQuery = supabase
    .from('outlets')
    .select('id, name, code, city, state, status')
    .eq('org_id', orgId)
    .eq('status', 'active')
    .order('name')

  if (!isAdmin) {
    const { data: assigned } = await supabase
      .from('outlet_staff')
      .select('outlet_id')
      .eq('user_id', user.id)
    const assignedIds = (assigned ?? []).map(a => a.outlet_id)
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
      s.is_active && (
        s.outlet_scope === 'all' ||
        s.outlet_id === outletId
      )
    )
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
            const hasSessionsDue = stats.sessionsDue > stats.done
            const hasDue = hasSessionsDue || hasActiveSchedule(outlet.id)
            return (
              <Link key={outlet.id} href={`/inspections/${outlet.id}`}>
                <Card className={cn(
                  'hover:shadow-md transition-all cursor-pointer border-2',
                  hasDue ? 'border-indigo-200 bg-indigo-50/30' : 'border-gray-200'
                )}>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'h-11 w-11 rounded-xl flex items-center justify-center shrink-0',
                          hasDue ? 'bg-indigo-600' : 'bg-gray-100'
                        )}>
                          <Building2 className={cn('h-5 w-5', hasDue ? 'text-white' : 'text-gray-400')} />
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
                        {hasSessionsDue && (
                          <Badge variant="default" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            {stats.done}/{stats.sessionsDue} done
                          </Badge>
                        )}
                        {stats.issues > 0 && (
                          <Badge variant="warning" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {stats.issues} issue{stats.issues !== 1 ? 's' : ''}
                          </Badge>
                        )}
                        {!hasSessionsDue && stats.issues === 0 && hasActiveSchedule(outlet.id) && (
                          <Badge variant="secondary" className="text-xs">Scheduled</Badge>
                        )}
                        {!hasSessionsDue && stats.issues === 0 && !hasActiveSchedule(outlet.id) && (
                          <Badge variant="success" className="text-xs">All clear</Badge>
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
