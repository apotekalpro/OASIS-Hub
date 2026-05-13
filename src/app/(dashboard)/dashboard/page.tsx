import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { CheckSquare, AlertTriangle, Bell, TrendingUp, Users, Shield } from 'lucide-react'
import { formatDueDate, formatRelativeTime } from '@/lib/utils'
import { ROLE_COLORS, ROLE_LABELS } from '@/lib/auth/permissions'
import Link from 'next/link'
import type { Task, AppNotification, Profile, UserRole } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [assignedRes, createdRes, notifRes, profileRes, teamsRes, orgMembersRes] = await Promise.all([
    // Tasks assigned to me
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, created_by, task_assignees!inner(user_id)')
      .eq('task_assignees.user_id', user.id)
      .not('status', 'in', '("done","cancelled")')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(20),
    // Tasks created by me (not necessarily assigned to me)
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, created_by, task_assignees(user_id)')
      .eq('created_by', user.id)
      .not('status', 'in', '("done","cancelled")')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(20),
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('profiles').select('full_name, role, dept_id, org_id, job_title').eq('id', user.id).single(),
    // My teams
    supabase.from('teams').select('id, name, color, team_members!inner(user_id)').eq('team_members.user_id', user.id),
    // Org members snapshot
    supabase.from('profiles').select('id, full_name, avatar_url, role, dept_id, departments(name)').eq('is_active', true).order('full_name').limit(8),
  ])

  // Merge assigned + created, deduplicate by id
  const seenIds = new Set<string>()
  const merged = [...(assignedRes.data ?? []), ...(createdRes.data ?? [])]
    .filter(t => { if (seenIds.has(t.id)) return false; seenIds.add(t.id); return true })
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })
    .slice(0, 8)

  const myTasks = merged as unknown as Task[]
  const totalTasks = seenIds.size + (createdRes.data?.filter(t => !assignedRes.data?.find(a => a.id === t.id)).length ?? 0)
  const completedTasks = 0 // not needed for display
  const myNotifications = notifRes.data as AppNotification[] | null
  const profile = profileRes.data as Pick<Profile, 'full_name' | 'role' | 'dept_id' | 'org_id' | 'job_title'> | null

  type TeamRow = { id: string; name: string; color: string; team_members?: Array<{ user_id: string }> }
  const myTeams = teamsRes.data as TeamRow[] | null

  type OrgMember = { id: string; full_name: string; avatar_url: string | null; role: UserRole; dept_id: string | null; departments?: { name: string } | null }
  const orgMembers = orgMembersRes.data as OrgMember[] | null

  const overdueTasks = myTasks?.filter(t => t.due_date && new Date(t.due_date) < new Date()) ?? []
  const completionRate = 0 // calculated in analytics dashboard

  const PRIORITY_COLORS = {
    urgent: 'destructive' as const,
    high: 'warning' as const,
    medium: 'default' as const,
    low: 'secondary' as const,
  }

  const STATUS_COLORS = {
    todo: 'secondary' as const,
    in_progress: 'default' as const,
    in_review: 'warning' as const,
    done: 'success' as const,
    cancelled: 'outline' as const,
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good day, {profile?.full_name?.split(' ')[0]} 👋
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {profile?.job_title ? `${profile.job_title} · ` : ''}
          {ROLE_LABELS[profile?.role as UserRole] ?? 'Member'}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-100 rounded-lg">
                <CheckSquare className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{myTasks?.length ?? 0}</p>
                <p className="text-sm text-gray-500">Active Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{overdueTasks.length}</p>
                <p className="text-sm text-gray-500">Overdue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{completionRate}%</p>
                <p className="text-sm text-gray-500">Completion</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 rounded-lg">
                <Bell className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{myNotifications?.length ?? 0}</p>
                <p className="text-sm text-gray-500">Unread Alerts</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* My Tasks */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">My Tasks</CardTitle>
                <Link href="/tasks" className="text-xs text-indigo-600 hover:underline">View all</Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!myTasks?.length ? (
                <div className="px-6 py-10 text-center text-gray-500 text-sm">
                  No active tasks. Great work!
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {myTasks.map(task => (
                    <li key={task.id} className="px-6 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                          {task.due_date && (
                            <p className={`text-xs mt-0.5 ${new Date(task.due_date) < new Date() ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                              {formatDueDate(task.due_date)}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS]}>
                            {task.priority}
                          </Badge>
                          <Badge variant={STATUS_COLORS[task.status as keyof typeof STATUS_COLORS]}>
                            {task.status.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* My Teams */}
          {(myTeams?.length ?? 0) > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4" /> My Teams
                  </CardTitle>
                  <Link href="/teams" className="text-xs text-indigo-600 hover:underline">View all</Link>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-2">
                  {myTeams?.map(team => (
                    <Link
                      key={team.id}
                      href={`/teams/${team.id}`}
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.name}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Recent Notifications */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Alerts</CardTitle>
                <Link href="/notifications" className="text-xs text-indigo-600 hover:underline">View all</Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!myNotifications?.length ? (
                <div className="px-6 py-8 text-center text-gray-500 text-sm">All caught up!</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {myNotifications.map(n => (
                    <li key={n.id} className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{n.title}</p>
                          {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                          <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(n.created_at)}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Org People snapshot */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4" /> People
                </CardTitle>
                <Link href="/directory" className="text-xs text-indigo-600 hover:underline">Directory</Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-gray-100">
                {orgMembers?.map(m => (
                  <li key={m.id} className="px-4 py-3 flex items-center gap-3">
                    <UserAvatar name={m.full_name} avatarUrl={m.avatar_url} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{m.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{m.departments?.name ?? ROLE_LABELS[m.role]}</p>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${ROLE_COLORS[m.role]}`}>
                      {ROLE_LABELS[m.role].split(' ').pop()}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
