import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Building2, ArrowLeft, Plus, Clock, CheckCircle2, AlertCircle, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { StartSessionClient } from '@/components/inspections/start-session-client'
import { cn } from '@/lib/utils'

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: 'text-gray-500', bg: 'bg-gray-100', icon: ClipboardList },
  in_progress: { label: 'In Progress', color: 'text-blue-600', bg: 'bg-blue-100', icon: Clock },
  submitted: { label: 'Submitted', color: 'text-green-600', bg: 'bg-green-100', icon: CheckCircle2 },
  approved: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'text-red-600', bg: 'bg-red-100', icon: AlertCircle },
}

export default async function OutletDetailPage({ params }: { params: Promise<{ outletId: string }> }) {
  const { outletId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [outletRes, sessionsRes, schedulesRes, issuesRes] = await Promise.all([
    supabase
      .from('outlets')
      .select('*, profiles!outlets_manager_id_fkey(full_name), departments(name)')
      .eq('id', outletId)
      .single(),
    supabase
      .from('inspection_sessions')
      .select('*, inspection_templates(title, category), profiles!inspection_sessions_conducted_by_fkey(full_name)')
      .eq('outlet_id', outletId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('inspection_schedules')
      .select('*, inspection_templates(id, title, category, passing_score)')
      .eq('outlet_id', outletId)
      .eq('is_active', true),
    supabase
      .from('inspection_issues')
      .select('id, title, severity, status, created_at')
      .eq('outlet_id', outletId)
      .in('status', ['open', 'in_progress', 'escalated'])
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (!outletRes.data) return notFound()

  const outlet = outletRes.data as {
    id: string; name: string; code: string | null; address: string | null; city: string | null
    state: string | null; phone: string | null; status: string
    profiles?: { full_name: string } | null
    departments?: { name: string } | null
  }

  type SessionRow = {
    id: string; status: string; score: number | null; pass_fail: boolean | null
    started_at: string | null; submitted_at: string | null; created_at: string
    scheduled_for: string | null
    inspection_templates?: { title: string; category: string | null } | null
    profiles?: { full_name: string } | null
  }

  type ScheduleRow = {
    id: string; frequency: string; scheduled_time: string | null
    inspection_templates?: { id: string; title: string; category: string | null; passing_score: number | null } | null
  }

  type IssueRow = { id: string; title: string; severity: string; status: string; created_at: string }

  const sessions = (sessionsRes.data ?? []) as SessionRow[]
  const schedules = (schedulesRes.data ?? []) as ScheduleRow[]
  const issues = (issuesRes.data ?? []) as IssueRow[]

  const SEVERITY_COLORS: Record<string, string> = {
    low: 'bg-gray-100 text-gray-700',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Back + header */}
      <div>
        <Link href="/inspections" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ArrowLeft className="h-4 w-4" /> All Outlets
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{outlet.name}</h1>
              <div className="flex items-center gap-3 mt-0.5 text-sm text-gray-500">
                {outlet.code && <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{outlet.code}</span>}
                {outlet.city && <span>{[outlet.city, outlet.state].filter(Boolean).join(', ')}</span>}
                {outlet.profiles && <span>Manager: {outlet.profiles.full_name}</span>}
              </div>
            </div>
          </div>
          <Badge variant={outlet.status === 'active' ? 'success' : 'secondary'} className="capitalize">
            {outlet.status}
          </Badge>
        </div>
      </div>

      {/* Open issues banner */}
      {issues.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-800">{issues.length} open issue{issues.length !== 1 ? 's' : ''} requiring attention</p>
              <div className="mt-2 space-y-1">
                {issues.map(issue => (
                  <div key={issue.id} className="flex items-center gap-2">
                    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize', SEVERITY_COLORS[issue.severity])}>
                      {issue.severity}
                    </span>
                    <span className="text-sm text-amber-700 truncate">{issue.title}</span>
                  </div>
                ))}
              </div>
            </div>
            <Link href="/inspections/issues" className="text-xs font-medium text-amber-700 hover:text-amber-900 shrink-0">
              View all →
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scheduled checklists */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="font-semibold text-gray-900">Scheduled Checklists</h2>
          {schedules.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-gray-400">
                No checklists scheduled for this outlet.
              </CardContent>
            </Card>
          ) : (
            schedules.map(schedule => (
              <Card key={schedule.id} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <p className="font-medium text-gray-900 text-sm">{schedule.inspection_templates?.title}</p>
                  {schedule.inspection_templates?.category && (
                    <p className="text-xs text-gray-400 mt-0.5">{schedule.inspection_templates.category}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-500 capitalize">{schedule.frequency}
                      {schedule.scheduled_time && ` · ${schedule.scheduled_time.slice(0, 5)}`}
                    </span>
                    {schedule.inspection_templates && (
                      <StartSessionClient
                        outletId={outletId}
                        scheduleId={schedule.id}
                        templateId={schedule.inspection_templates.id}
                        templateTitle={schedule.inspection_templates.title}
                        conductedBy={user.id}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Recent sessions */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="font-semibold text-gray-900">Recent Sessions</h2>
          {sessions.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-gray-400">
                No inspection sessions yet for this outlet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {sessions.map(session => {
                const cfg = STATUS_CONFIG[session.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.not_started
                const StatusIcon = cfg.icon
                const isActionable = session.status === 'not_started' || session.status === 'in_progress'
                return (
                  <Card key={session.id} className={cn('transition-shadow', isActionable && 'hover:shadow-sm')}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', cfg.bg)}>
                            <StatusIcon className={cn('h-4 w-4', cfg.color)} />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">
                              {session.inspection_templates?.title ?? 'Unknown Template'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                              <span>{session.profiles?.full_name}</span>
                              <span>·</span>
                              <span>{formatDate(session.created_at)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {session.score !== null && (
                            <span className={cn(
                              'text-xs font-bold px-2 py-0.5 rounded-full',
                              session.pass_fail ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            )}>
                              {session.score}%
                            </span>
                          )}
                          <span className={cn('text-xs font-medium', cfg.color)}>{cfg.label}</span>
                          {isActionable && (
                            <Link
                              href={`/inspections/${outletId}/sessions/${session.id}`}
                              className="rounded-lg bg-indigo-600 text-white text-xs font-medium px-3 py-1.5 hover:bg-indigo-700 transition-colors"
                            >
                              {session.status === 'in_progress' ? 'Continue' : 'Start'}
                            </Link>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
