import { createClient, createAdminClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { CheckSquare, AlertTriangle, Bell, TrendingUp, Users, Shield, Zap, Target } from 'lucide-react'
import { formatRelativeTime, getDueStatus } from '@/lib/utils'
import { ROLE_COLORS, ROLE_LABELS } from '@/lib/auth/permissions'
import Link from 'next/link'
import type { AppNotification, Profile, UserRole } from '@/types/database'
import { PwaInstallBanner } from '@/components/pwa-install-banner'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch profile first so we can conditionally build the teams query
  const profileRes = await supabase.from('profiles').select('full_name, role, dept_id, org_id, job_title').eq('id', user.id).single()
  const profile = profileRes.data as Pick<Profile, 'full_name' | 'role' | 'dept_id' | 'org_id' | 'job_title'> | null
  const orgId = profile?.org_id ?? ''
  const isAdminRole = ['super_admin', 'org_admin'].includes(profile?.role ?? '')

  const admin = createAdminClient()

  // Build teams query: admins see all org teams, members see only teams they joined
  let teamsQ = isAdminRole
    ? (() => {
        let q = admin.from('teams').select('id, name, color').order('name').limit(8)
        if (orgId) q = q.eq('org_id', orgId)
        return q
      })()
    : supabase.from('teams').select('id, name, color, team_members!inner(user_id)').eq('team_members.user_id', user.id)

  const watcherIdsRes = await supabase
    .from('task_watchers')
    .select('task_id')
    .eq('user_id', user.id)
  const watcherTaskIds = ((watcherIdsRes.data ?? []) as Array<{ task_id: string }>).map(r => r.task_id)

  const [assignedRes, createdRes, watchedRes, assignedDoneRes, createdDoneRes, watchedDoneRes, notifRes, teamsRes, orgMembersRes, myAtemRes, myOkrRes] = await Promise.all([
    // Tasks assigned to me (exclude subtasks and OKR subtasks)
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, created_by, task_assignees!inner(user_id)')
      .eq('task_assignees.user_id', user.id)
      .is('parent_id', null)
      .is('kr_id', null)
      .neq('is_okr_subtask', true)
      .not('status', 'in', '("done","cancelled")')
      .order('due_date', { ascending: true, nullsFirst: false }),
    // Tasks created by me, not necessarily assigned to me (exclude subtasks and OKR subtasks)
    supabase
      .from('tasks')
      .select('id, title, status, priority, due_date, created_by, task_assignees(user_id)')
      .eq('created_by', user.id)
      .is('parent_id', null)
      .is('kr_id', null)
      .neq('is_okr_subtask', true)
      .not('status', 'in', '("done","cancelled")')
      .order('due_date', { ascending: true, nullsFirst: false }),
    // Tasks where I'm a CC/watcher (exclude subtasks and OKR subtasks)
    watcherTaskIds.length > 0
      ? supabase
          .from('tasks')
          .select('id, title, status, priority, due_date, created_by, task_assignees(user_id)')
          .in('id', watcherTaskIds)
          .is('parent_id', null)
          .is('kr_id', null)
          .neq('is_okr_subtask', true)
          .not('status', 'in', '("done","cancelled")')
          .order('due_date', { ascending: true, nullsFirst: false })
      : Promise.resolve({ data: [] }),
    // Done tasks assigned to me
    supabase
      .from('tasks')
      .select('id, task_assignees!inner(user_id)')
      .eq('task_assignees.user_id', user.id)
      .is('parent_id', null)
      .is('kr_id', null)
      .neq('is_okr_subtask', true)
      .eq('status', 'done'),
    // Done tasks created by me
    supabase
      .from('tasks')
      .select('id')
      .eq('created_by', user.id)
      .is('parent_id', null)
      .is('kr_id', null)
      .neq('is_okr_subtask', true)
      .eq('status', 'done'),
    // Done tasks where I'm a watcher
    watcherTaskIds.length > 0
      ? supabase
          .from('tasks')
          .select('id')
          .in('id', watcherTaskIds)
          .is('parent_id', null)
          .is('kr_id', null)
          .neq('is_okr_subtask', true)
          .eq('status', 'done')
      : Promise.resolve({ data: [] }),
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5),
    teamsQ,
    // Org members snapshot
    supabase.from('profiles').select('id, full_name, avatar_url, role, dept_id, departments(name)').eq('is_active', true).order('full_name').limit(8),
    // My ATEM items (assigned to me, not completed)
    supabase.from('atem_assignees').select('atem_id').eq('user_id', user.id).limit(20),
    // My OKR objectives (assigned to me)
    supabase.from('okr_assignees').select('objective_id').eq('user_id', user.id).limit(20),
  ])

  // Merge assigned + created + watched, deduplicate by id
  const seenIds = new Set<string>()
  const merged = [...(assignedRes.data ?? []), ...(createdRes.data ?? []), ...(watchedRes.data ?? [])]
    .filter(t => { if (seenIds.has(t.id)) return false; seenIds.add(t.id); return true })
    .sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0
      if (!a.due_date) return 1
      if (!b.due_date) return -1
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    })

  // Fetch subtask counts for the displayed tasks
  type SubtaskCountRow = { parent_id: string; status: string }
  const mergedIds = merged.map(t => t.id)
  const subtaskRows = mergedIds.length > 0
    ? ((await supabase.from('tasks').select('parent_id, status').in('parent_id', mergedIds)).data ?? []) as SubtaskCountRow[]
    : [] as SubtaskCountRow[]

  const subtaskMap = new Map<string, { total: number; done: number }>()
  for (const sub of subtaskRows) {
    if (!subtaskMap.has(sub.parent_id)) subtaskMap.set(sub.parent_id, { total: 0, done: 0 })
    const s = subtaskMap.get(sub.parent_id)!
    s.total++
    if (sub.status === 'done') s.done++
  }

  type DashTask = { id: string; title: string; status: string; priority: string; due_date: string | null }
  const allMyTasks = merged as unknown as DashTask[]
  const myTasks = allMyTasks.slice(0, 15)

  const myNotifications = notifRes.data as AppNotification[] | null

  type TeamRow = { id: string; name: string; color: string; team_members?: Array<{ user_id: string }> }
  const myTeams = teamsRes.data as TeamRow[] | null

  type OrgMember = { id: string; full_name: string; avatar_url: string | null; role: UserRole; dept_id: string | null; departments?: { name: string } | null }
  const orgMembers = orgMembersRes.data as OrgMember[] | null

  const myAtemIds = (myAtemRes.data ?? []).map((a: { atem_id: string }) => a.atem_id)
  const myOkrIds = (myOkrRes.data ?? []).map((a: { objective_id: string }) => a.objective_id)

  const [atemItemsRes, okrObjRes] = await Promise.all([
    myAtemIds.length > 0
      ? supabase.from('atem_items').select('id, task, status, priority, deadline').in('id', myAtemIds).not('status', 'eq', 'completed').order('deadline', { ascending: true, nullsFirst: false }).limit(5)
      : Promise.resolve({ data: [] }),
    myOkrIds.length > 0
      ? supabase.from('okr_objectives').select('id, title, status, progress, end_date, okr_key_results(id, status)').in('id', myOkrIds).not('status', 'in', '("completed","cancelled")').order('end_date', { ascending: true, nullsFirst: false }).limit(5)
      : Promise.resolve({ data: [] }),
  ])

  function stripHtml(html: string) { return html.replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim() }
  type AtemItem = { id: string; task: string; status: string; priority: string; deadline: string | null }
  type OkrKr = { id: string; status: string }
  type OkrObj = { id: string; title: string; status: string; progress: number; end_date: string | null; okr_key_results: OkrKr[] }
  const myAtemItems = (atemItemsRes.data ?? []) as AtemItem[]
  const myOkrObjs = (okrObjRes.data ?? []) as OkrObj[]

  // Completion rate: done / (active + done), excluding cancelled
  const doneIds = new Set<string>()
  for (const t of [...(assignedDoneRes.data ?? []), ...(createdDoneRes.data ?? []), ...(watchedDoneRes.data ?? [])]) {
    doneIds.add((t as { id: string }).id)
  }
  const doneCount = doneIds.size
  const totalCount = allMyTasks.length + doneCount
  const completionRate = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0

  const overdueTasks = allMyTasks?.filter(t => t.due_date && new Date(t.due_date) < new Date()) ?? []

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
      {/* PWA Install Banner */}
      <PwaInstallBanner />

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
                <p className="text-2xl font-bold text-gray-900">{allMyTasks?.length ?? 0}</p>
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
                  {myTasks.map(task => {
                    const subs = subtaskMap.get(task.id)
                    return (
                      <li key={task.id}>
                        <Link href={`/tasks/${task.id}`} className="flex items-start gap-3 px-6 py-3 hover:bg-gray-50 transition-colors block">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                            <div className="flex items-center gap-3 flex-wrap mt-0.5">
                              {subs && (
                                <span className="text-xs text-gray-400">
                                  Subtasks {subs.done}/{subs.total}
                                </span>
                              )}
                              {task.due_date && (() => {
                                const due = getDueStatus(task.due_date)
                                return due ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-xs font-medium ${
                                      due.color === 'red' ? 'text-red-600' :
                                      due.color === 'orange' ? 'text-orange-600' :
                                      due.color === 'yellow' ? 'text-yellow-700' : 'text-gray-400'
                                    }`}>{due.label}</span>
                                    {due.badge && (
                                      <span className={`text-[10px] font-bold px-1 py-0.5 rounded border ${
                                        due.color === 'red' ? 'text-red-600 bg-red-50 border-red-200' :
                                        due.color === 'orange' ? 'text-orange-600 bg-orange-50 border-orange-200' :
                                        'text-yellow-700 bg-yellow-50 border-yellow-200'
                                      }`}>{due.badge}</span>
                                    )}
                                  </div>
                                ) : null
                              })()}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant={PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS]}>
                              {task.priority}
                            </Badge>
                            <Badge variant={STATUS_COLORS[task.status as keyof typeof STATUS_COLORS]}>
                              {task.status.replace('_', ' ')}
                            </Badge>
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* My ATEM Items */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" /> My ATEM Actions
                </CardTitle>
                <Link href="/atem" className="text-xs text-indigo-600 hover:underline">View all</Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!myAtemItems.length ? (
                <div className="px-6 py-8 text-center text-gray-500 text-sm">No active ATEM items.</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {myAtemItems.map(item => (
                    <li key={item.id}>
                      <Link href={`/atem/${item.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{stripHtml(item.task)}</p>
                          {item.deadline && (
                            <p className="text-xs text-gray-400 mt-0.5">{new Date(item.deadline).toLocaleDateString()}</p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                          item.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                          item.status === 'blocked' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{item.status.replace('_', ' ')}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* My OKR Objectives */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-indigo-500" /> My OKRs
                </CardTitle>
                <Link href="/okr" className="text-xs text-indigo-600 hover:underline">View all</Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {!myOkrObjs.length ? (
                <div className="px-6 py-8 text-center text-gray-500 text-sm">No active OKRs assigned.</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {myOkrObjs.map(obj => {
                    const krs = obj.okr_key_results ?? []
                    const krDone = krs.filter(k => k.status === 'completed').length
                    return (
                      <li key={obj.id}>
                        <Link href={`/okr/${obj.id}`} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{obj.title}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                                <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.round(obj.progress)}%` }} />
                              </div>
                              <span className="text-xs text-gray-500 shrink-0">{Math.round(obj.progress)}%</span>
                            </div>
                            {krs.length > 0 && (
                              <p className="text-xs text-gray-400 mt-0.5">{krDone}/{krs.length} KRs done</p>
                            )}
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                            obj.status === 'on_track' ? 'bg-green-100 text-green-700' :
                            obj.status === 'at_risk' ? 'bg-amber-100 text-amber-700' :
                            obj.status === 'behind' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>{obj.status.replace('_', ' ')}</span>
                        </Link>
                      </li>
                    )
                  })}
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
                    <Shield className="h-4 w-4" /> {isAdminRole ? 'Teams' : 'My Teams'}
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
