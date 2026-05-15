import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { Calendar, MessageSquare, Clock, Paperclip, AlertCircle } from 'lucide-react'
import { formatDueDate, isOverdue, isDueSoon, cn } from '@/lib/utils'

export const PRIORITY_VARIANT = {
  urgent: 'destructive',
  high: 'warning',
  medium: 'default',
  low: 'secondary',
} as const

export const STATUS_VARIANT = {
  todo: 'secondary',
  in_progress: 'default',
  in_review: 'warning',
  done: 'success',
  cancelled: 'outline',
} as const

export const STATUS_LABEL = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
  cancelled: 'Cancelled',
}

export const PRIORITY_DOT = {
  urgent: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-gray-400',
}

export type TaskCardData = {
  id: string
  title: string
  description: string | null
  status: string
  priority: string
  due_date: string | null
  tags: string[]
  created_at: string
  created_by?: string
  assignees?: Array<{ id: string; full_name: string; avatar_url: string | null }>
  _commentCount?: number
  _timeLogged?: number
  _subtaskCount?: number
  _attachmentCount?: number
}

interface Props {
  task: TaskCardData
  compact?: boolean
}

export function TaskCard({ task, compact = false }: Props) {
  const overdue = isOverdue(task.due_date) && task.status !== 'done' && task.status !== 'cancelled'
  const dueSoon = isDueSoon(task.due_date) && !overdue

  return (
    <Link
      href={`/tasks/${task.id}`}
      className={cn(
        'block bg-white rounded-xl border border-gray-200 hover:shadow-md hover:border-indigo-200 transition-all group',
        compact ? 'p-3' : 'p-4'
      )}
    >
      {/* Priority dot + title */}
      <div className="flex items-start gap-2">
        <span className={cn('mt-1.5 h-2 w-2 rounded-full shrink-0', PRIORITY_DOT[task.priority as keyof typeof PRIORITY_DOT])} />
        <div className="flex-1 min-w-0">
          <p className={cn('font-medium text-gray-900 group-hover:text-indigo-600 transition-colors', compact ? 'text-sm' : 'text-sm')}>
            {task.title}
          </p>
          {!compact && task.description && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{task.description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}</p>
          )}
        </div>
      </div>

      {/* Tags */}
      {!compact && task.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.tags.slice(0, 3).map(tag => (
            <span key={tag} className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-xs font-medium">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {task.due_date && (
            <span className={cn('flex items-center gap-1', overdue && 'text-red-600 font-medium', dueSoon && 'text-amber-600 font-medium')}>
              {overdue && <AlertCircle className="h-3 w-3" />}
              <Calendar className="h-3 w-3" />
              {formatDueDate(task.due_date)}
            </span>
          )}
          {(task._commentCount ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {task._commentCount}
            </span>
          )}
          {(task._timeLogged ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {task._timeLogged}h
            </span>
          )}
          {(task._attachmentCount ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Paperclip className="h-3 w-3" />
              {task._attachmentCount}
            </span>
          )}
        </div>

        {/* Assignee avatars */}
        {task.assignees && task.assignees.length > 0 && (
          <div className="flex -space-x-1.5">
            {task.assignees.slice(0, 3).map(a => (
              <UserAvatar key={a.id} name={a.full_name} avatarUrl={a.avatar_url} size="sm" className="w-6 h-6 text-xs ring-2 ring-white" />
            ))}
            {task.assignees.length > 3 && (
              <div className="h-6 w-6 rounded-full bg-gray-100 ring-2 ring-white flex items-center justify-center text-xs font-medium text-gray-600">
                +{task.assignees.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </Link>
  )
}
