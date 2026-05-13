import { createClient } from '@/lib/supabase/server'
import { AlertCircle, Building2, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { IssuesBoardClient } from '@/components/inspections/issues-board-client'
import { cn } from '@/lib/utils'

const SEVERITY_COLORS: Record<string, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
}

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-indigo-100 text-indigo-700',
  escalated: 'bg-red-100 text-red-700',
  resolved: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-700',
}

export default async function IssuesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const profileRes = await supabase.from('profiles').select('org_id, role').eq('id', user.id).single()
  const { org_id: orgId, role } = (profileRes.data ?? {}) as { org_id: string; role: string }
  const isAdmin = ['super_admin', 'org_admin', 'dept_head'].includes(role)

  let issuesQuery = supabase
    .from('inspection_issues')
    .select(`
      id, title, description, severity, status, created_at, due_at,
      outlets(id, name, code),
      profiles!inspection_issues_raised_by_fkey(full_name),
      assignee:profiles!inspection_issues_assigned_to_fkey(id, full_name)
    `)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    issuesQuery = issuesQuery.or(`raised_by.eq.${user.id},assigned_to.eq.${user.id}`)
  }

  const { data: issuesData } = await issuesQuery

  const [usersRes] = await Promise.all([
    supabase.from('profiles').select('id, full_name, email, avatar_url').eq('org_id', orgId).eq('is_active', true).order('full_name'),
  ])

  type IssueRow = {
    id: string; title: string; description: string | null; severity: string; status: string
    created_at: string; due_at: string | null
    outlets?: { id: string; name: string; code: string | null } | null
    profiles?: { full_name: string } | null
    assignee?: { id: string; full_name: string } | null
  }

  const issues = (issuesData ?? []) as unknown as IssueRow[]
  const orgUsers = usersRes.data ?? []

  const stats = {
    open: issues.filter(i => i.status === 'open').length,
    in_progress: issues.filter(i => i.status === 'in_progress').length,
    escalated: issues.filter(i => i.status === 'escalated').length,
    resolved: issues.filter(i => i.status === 'resolved').length,
  }

  const now = new Date()

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inspection Issues</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Track, assign, and resolve issues raised during outlet inspections.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Open', value: stats.open, color: 'text-blue-600' },
          { label: 'In Progress', value: stats.in_progress, color: 'text-indigo-600' },
          { label: 'Escalated', value: stats.escalated, color: 'text-red-600' },
          { label: 'Resolved', value: stats.resolved, color: 'text-green-600' },
        ].map(s => (
          <Card key={s.label}><CardContent className="p-4">
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </CardContent></Card>
        ))}
      </div>

      {/* Issues list */}
      {issues.length === 0 ? (
        <Card><CardContent className="p-12 text-center">
          <AlertCircle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-500">No issues found</p>
          <p className="text-sm text-gray-400 mt-1">Issues are auto-raised when inspection questions are flagged.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {issues.map(issue => {
            const isOverdue = issue.due_at && new Date(issue.due_at) < now && !['resolved','closed'].includes(issue.status)
            return (
              <Card key={issue.id} className={cn('hover:shadow-sm transition-shadow', isOverdue && 'border-red-200')}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 flex-wrap">
                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', SEVERITY_COLORS[issue.severity])}>
                          {issue.severity}
                        </span>
                        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', STATUS_COLORS[issue.status])}>
                          {issue.status.replace('_', ' ')}
                        </span>
                        {isOverdue && (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                            <Clock className="h-3 w-3" /> Overdue
                          </span>
                        )}
                      </div>
                      <p className="font-semibold text-gray-900 mt-1.5 text-sm">{issue.title}</p>
                      {issue.description && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{issue.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        {issue.outlets && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {issue.outlets.name}
                          </span>
                        )}
                        <span>{formatDate(issue.created_at)}</span>
                        {issue.profiles && <span>by {issue.profiles.full_name}</span>}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-start gap-2">
                      {issue.assignee && (
                        <div className="text-xs text-gray-500 text-right">
                          <p className="font-medium text-gray-700">{issue.assignee.full_name}</p>
                          <p className="text-gray-400">Assigned</p>
                        </div>
                      )}
                      <IssuesBoardClient
                        issue={issue}
                        orgUsers={orgUsers}
                        currentUserId={user.id}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
