'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Bell, CheckCheck, CheckSquare, MessageSquare, ClipboardList, Calendar, AtSign, AlertCircle } from 'lucide-react'
import { formatRelativeTime, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useNotificationStore } from '@/store/notifications'
import type { AppNotification } from '@/types/database'

const TYPE_ICON: Record<string, React.ReactNode> = {
  task_assigned:   <CheckSquare className="h-4 w-4 text-indigo-500" />,
  task_completed:  <CheckSquare className="h-4 w-4 text-green-500" />,
  task_commented:  <MessageSquare className="h-4 w-4 text-blue-500" />,
  task_due_soon:   <AlertCircle className="h-4 w-4 text-amber-500" />,
  task_overdue:    <AlertCircle className="h-4 w-4 text-red-500" />,
  mention:         <AtSign className="h-4 w-4 text-purple-500" />,
  form_assigned:   <ClipboardList className="h-4 w-4 text-orange-500" />,
  form_submitted:  <ClipboardList className="h-4 w-4 text-blue-500" />,
  event_invite:    <Calendar className="h-4 w-4 text-pink-500" />,
  reminder:        <Bell className="h-4 w-4 text-gray-500" />,
}

function getLink(n: AppNotification): string | null {
  const d = n.data as Record<string, unknown>
  if (d?.task_id) return `/tasks/${d.task_id}`
  if (d?.form_id && d?.submission_id) return `/forms/${d.form_id}/submissions/${d.submission_id}`
  if (d?.form_id) return `/forms/${d.form_id}`
  if (d?.channel_id) return `/messages`
  if (d?.event_id) return `/calendar`
  return null
}

// Props kept for backwards compat but ignored — store is the source of truth
export function NotificationsClient({ notifications: _initial }: { notifications: AppNotification[] }) {
  const supabase = createClient()
  const { notifications, unreadCount, markRead: storeMarkRead, markAllRead: storeMarkAllRead } = useNotificationStore()
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const shown = filter === 'unread' ? notifications.filter(n => !n.is_read) : notifications

  async function markRead(ids: string[]) {
    await supabase.from('notifications').update({ is_read: true } as never).in('id', ids)
    ids.forEach(id => storeMarkRead(id))
  }

  async function markAllRead() {
    const ids = notifications.filter(n => !n.is_read).map(n => n.id)
    if (ids.length === 0) return
    await supabase.from('notifications').update({ is_read: true } as never).in('id', ids)
    storeMarkAllRead()
    toast.success('All marked as read')
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && <p className="text-sm text-gray-500 mt-0.5">{unreadCount} unread</p>}
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {(['all', 'unread'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn('px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize', filter === f ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700')}
          >
            {f}
            {f === 'unread' && unreadCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{unreadCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {shown.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">{filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}</p>
          </div>
        )}

        {shown.map(n => {
          const link = getLink(n)
          const content = (
            <div
              className={cn(
                'flex items-start gap-4 p-4 rounded-xl border transition-all',
                n.is_read ? 'bg-white border-gray-100 hover:border-gray-200' : 'bg-indigo-50/60 border-indigo-100 hover:border-indigo-200'
              )}
            >
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5', n.is_read ? 'bg-gray-100' : 'bg-white shadow-sm')}>
                {TYPE_ICON[n.type] ?? <Bell className="h-4 w-4 text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm', n.is_read ? 'text-gray-700' : 'text-gray-900 font-medium')}>{n.title}</p>
                {n.body && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>}
                <p className="text-xs text-gray-400 mt-1">{formatRelativeTime(n.created_at)}</p>
              </div>
              {!n.is_read && (
                <button
                  onClick={e => { e.preventDefault(); e.stopPropagation(); markRead([n.id]) }}
                  className="shrink-0 w-2 h-2 rounded-full bg-indigo-500 mt-2 hover:bg-indigo-700 transition-colors"
                  title="Mark as read"
                />
              )}
            </div>
          )

          return link ? (
            <Link key={n.id} href={link} onClick={() => { if (!n.is_read) markRead([n.id]) }}>
              {content}
            </Link>
          ) : (
            <div key={n.id} onClick={() => { if (!n.is_read) markRead([n.id]) }} className="cursor-pointer">
              {content}
            </div>
          )
        })}
      </div>
    </div>
  )
}
