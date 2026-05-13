import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckSquare, AlertTriangle, Bell, TrendingUp } from 'lucide-react'
import { formatDueDate, formatRelativeTime } from '@/lib/utils'
import type { Task, AppNotification, Profile } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  // Parallel data fetches
  const [tasksRes, notifRes, profileRes, totalRes, completedRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('*, task_assignees!inner(user_id)')
      .eq('task_assignees.user_id', user.id)
      .not('status', 'in', '("done","cancelled")')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase.from('profiles').select('full_name, role, dept_id').eq('id', user.id).single(),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('task_assignees.user_id', user.id),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('task_assignees.user_id', user.id).eq('status', 'done'),
  ])

  const myTasks = tasksRes.data as Task[] | null
  const myNotifications = notifRes.data as AppNotification[] | null
  const profile = profileRes.data as Pick<Profile, 'full_name' | 'role' | 'dept_id'> | null
  const totalTasks = totalRes.count
  const completedTasks = completedRes.count

  const overdueTasks = myTasks?.filter(t => t.due_date && new Date(t.due_date) < new Date()) ?? []
  const completionRate = totalTasks ? Math.round(((completedTasks ?? 0) / totalTasks) * 100) : 0

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
          Here's what's happening across your workspace today.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                <p className="text-sm text-gray-500">Completion Rate</p>
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
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">My Tasks</CardTitle>
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
                            <p className={`text-xs mt-0.5 ${
                              new Date(task.due_date) < new Date() ? 'text-red-600 font-medium' : 'text-gray-400'
                            }`}>
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
        </div>

        {/* Recent Notifications */}
        <div>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Alerts</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!myNotifications?.length ? (
                <div className="px-6 py-10 text-center text-gray-500 text-sm">
                  All caught up!
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {myNotifications.map(notification => (
                    <li key={notification.id} className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                          {notification.body && (
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notification.body}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-1">
                            {formatRelativeTime(notification.created_at)}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
