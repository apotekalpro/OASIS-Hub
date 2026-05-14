'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { TaskForm } from './task-form'
import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { STATUS_VARIANT, STATUS_LABEL, PRIORITY_DOT } from './task-card'
import {
  ArrowLeft, Calendar, Clock, Tag, Users, Edit2, Plus, Send,
  Trash2, CheckCircle2, Circle, CornerDownRight, Smile, AtSign, X
} from 'lucide-react'
import { formatDate, formatRelativeTime, cn } from '@/lib/utils'
import { toast } from 'sonner'

type Reaction = { emoji: string; count: number; reacted: boolean }
type Comment = {
  id: string
  content: string
  created_at: string
  parent_comment_id: string | null
  user: { id: string; full_name: string; avatar_url: string | null }
  reactions: Reaction[]
  replies?: Comment[]
}
type TimeLog = { id: string; hours: number; description: string | null; logged_at: string; user: { id: string; full_name: string; avatar_url: string | null } }
type Subtask = { id: string; title: string; status: string; priority: string }
type Assignee = { id: string; full_name: string; avatar_url: string | null; email: string }
type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }

interface Task {
  id: string; title: string; description: string | null; status: string; priority: string
  due_date: string | null; start_date: string | null; estimated_hours: number | null
  tags: string[]; created_at: string; created_by: string; team_id: string | null; dept_id: string | null; org_id: string
  teams?: { name: string } | null; departments?: { name: string } | null
}

interface Props {
  task: Task
  comments: Comment[]
  timeLogs: TimeLog[]
  subtasks: Subtask[]
  assignees: Assignee[]
  orgId: string
  currentUserId: string
  currentUserName: string
  currentUserAvatar: string | null
  users: OrgUser[]
  teams: Array<{ id: string; name: string }>
  departments: Array<{ id: string; name: string }>
}

const TABS = ['Comments', 'Time Log', 'Subtasks'] as const
type Tab = typeof TABS[number]

const QUICK_EMOJIS = ['👍', '👎', '❤️', '😄', '😮', '😢', '🎉', '🔥']

// ─── Mention textarea ─────────────────────────────────────────────────────────
function MentionTextarea({
  value, onChange, placeholder, users, rows = 2,
}: {
  value: string
  onChange: (v: string) => void
  placeholder: string
  users: OrgUser[]
  rows?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(-1)

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 6)

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value
    onChange(text)
    const cursor = e.target.selectionStart ?? 0
    const before = text.slice(0, cursor)
    const atIdx = before.lastIndexOf('@')
    if (atIdx !== -1 && !before.slice(atIdx + 1).includes(' ')) {
      setMentionOpen(true)
      setMentionStart(atIdx)
      setMentionQuery(before.slice(atIdx + 1))
    } else {
      setMentionOpen(false)
    }
  }

  function pickUser(user: OrgUser) {
    const before = value.slice(0, mentionStart)
    const after = value.slice(ref.current?.selectionStart ?? value.length)
    onChange(`${before}@${user.full_name} ${after}`)
    setMentionOpen(false)
    setTimeout(() => ref.current?.focus(), 0)
  }

  return (
    <div className="relative flex-1">
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        onChange={handleInput}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
      {mentionOpen && filtered.length > 0 && (
        <div className="absolute z-20 bottom-full mb-1 left-0 w-56 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {filtered.map(u => (
            <button
              key={u.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); pickUser(u) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-indigo-50 text-left"
            >
              <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-6 h-6 shrink-0" />
              <span className="truncate">{u.full_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Single comment ───────────────────────────────────────────────────────────
function CommentItem({
  comment, currentUserId, users,
  onDelete, onReact, onReply,
  depth = 0,
}: {
  comment: Comment
  currentUserId: string
  users: OrgUser[]
  onDelete: (id: string) => void
  onReact: (commentId: string, emoji: string) => void
  onReply: (comment: Comment) => void
  depth?: number
}) {
  const [showEmojis, setShowEmojis] = useState(false)

  return (
    <div className={cn('flex gap-3 group', depth > 0 && 'ml-8 mt-2')}>
      {depth > 0 && <CornerDownRight className="h-3.5 w-3.5 text-gray-300 shrink-0 mt-1" />}
      <UserAvatar name={comment.user.full_name} avatarUrl={comment.user.avatar_url} size="sm" className="w-7 h-7 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">{comment.user.full_name}</span>
          <span className="text-xs text-gray-400">{formatRelativeTime(comment.created_at)}</span>

          {/* Actions: show on hover */}
          <div className="ml-auto hidden group-hover:flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setShowEmojis(v => !v)}
                className="p-0.5 text-gray-300 hover:text-gray-600 transition-colors"
                title="React"
              >
                <Smile className="h-3.5 w-3.5" />
              </button>
              {showEmojis && (
                <div className="absolute right-0 bottom-full mb-1 flex gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1.5 shadow-lg z-10">
                  {QUICK_EMOJIS.map(em => (
                    <button
                      key={em}
                      onClick={() => { onReact(comment.id, em); setShowEmojis(false) }}
                      className="text-base hover:scale-125 transition-transform"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {depth === 0 && (
              <button
                onClick={() => onReply(comment)}
                className="p-0.5 text-gray-300 hover:text-indigo-500 transition-colors"
                title="Reply"
              >
                <CornerDownRight className="h-3.5 w-3.5" />
              </button>
            )}
            {comment.user.id === currentUserId && (
              <button
                onClick={() => onDelete(comment.id)}
                className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Content with @mention highlights */}
        <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap leading-relaxed">
          {comment.content.split(/(@\w[^@\s]*(?:\s\w+)?)/g).map((part, i) =>
            part.startsWith('@')
              ? <span key={i} className="text-indigo-600 font-medium">{part}</span>
              : part
          )}
        </p>

        {/* Reactions */}
        {comment.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {comment.reactions.map(r => (
              <button
                key={r.emoji}
                onClick={() => onReact(comment.id, r.emoji)}
                className={cn(
                  'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors',
                  r.reacted
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                <span>{r.emoji}</span>
                <span className="font-medium">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Replies */}
        {(comment.replies ?? []).map(reply => (
          <CommentItem
            key={reply.id}
            comment={reply}
            currentUserId={currentUserId}
            users={users}
            onDelete={onDelete}
            onReact={onReact}
            onReply={onReply}
            depth={1}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function TaskDetailClient({
  task, comments: initialComments, timeLogs: initialLogs, subtasks: initialSubtasks,
  assignees, orgId, currentUserId, currentUserName, currentUserAvatar, users, teams, departments
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('Comments')
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [timeLogs, setTimeLogs] = useState<TimeLog[]>(initialLogs)
  const [subtasks, setSubtasks] = useState<Subtask[]>(initialSubtasks)
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [logHours, setLogHours] = useState('')
  const [logDesc, setLogDesc] = useState('')
  const [submittingLog, setSubmittingLog] = useState(false)
  const [newSubtask, setNewSubtask] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)
  const commentEndRef = useRef<HTMLDivElement>(null)

  const totalLogged = timeLogs.reduce((sum, l) => sum + l.hours, 0)

  // Build threaded comment tree
  const threadedComments = comments
    .filter(c => !c.parent_comment_id)
    .map(c => ({
      ...c,
      replies: comments.filter(r => r.parent_comment_id === c.id),
    }))

  const fetchReactions = useCallback(async (commentIds: string[]): Promise<Record<string, Reaction[]>> => {
    if (!commentIds.length) return {}
    const { data } = await supabase
      .from('task_comment_reactions')
      .select('comment_id, user_id, emoji')
      .in('comment_id', commentIds)
    const rows = (data ?? []) as { comment_id: string; user_id: string; emoji: string }[]
    const map: Record<string, Reaction[]> = {}
    for (const row of rows) {
      if (!map[row.comment_id]) map[row.comment_id] = []
      const existing = map[row.comment_id].find(r => r.emoji === row.emoji)
      if (existing) {
        existing.count++
        if (row.user_id === currentUserId) existing.reacted = true
      } else {
        map[row.comment_id].push({ emoji: row.emoji, count: 1, reacted: row.user_id === currentUserId })
      }
    }
    return map
  }, [supabase, currentUserId])

  useEffect(() => {
    // Load reactions for all existing comments
    const ids = comments.map(c => c.id)
    fetchReactions(ids).then(map => {
      setComments(prev => prev.map(c => ({ ...c, reactions: map[c.id] ?? [] })))
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const channel = supabase
      .channel(`task-comments-${task.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'task_comments',
        filter: `task_id=eq.${task.id}`,
      }, async (payload) => {
        const newRow = payload.new as { id: string; content: string; created_at: string; user_id: string; parent_comment_id: string | null }
        const { data: profile } = await supabase.from('profiles').select('id, full_name, avatar_url').eq('id', newRow.user_id).single()
        const p = profile as { id: string; full_name: string; avatar_url: string | null } | null
        setComments(prev => {
          if (prev.find(c => c.id === newRow.id)) return prev
          return [...prev, {
            id: newRow.id,
            content: newRow.content,
            created_at: newRow.created_at,
            parent_comment_id: newRow.parent_comment_id,
            user: p ? { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url } : { id: newRow.user_id, full_name: 'Someone', avatar_url: null },
            reactions: [],
          }]
        })
        setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [task.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function postComment() {
    if (!commentText.trim()) return
    setSubmittingComment(true)
    const { data, error } = await supabase.from('task_comments').insert({
      task_id: task.id,
      user_id: currentUserId,
      content: commentText.trim(),
      parent_comment_id: replyTo?.id ?? null,
    }).select('id, content, created_at, parent_comment_id').single()
    if (error) {
      toast.error(error.message)
    } else if (data) {
      const row = data as { id: string; content: string; created_at: string; parent_comment_id: string | null }
      // Add optimistically so it appears immediately without waiting for realtime
      setComments(prev => {
        if (prev.find(c => c.id === row.id)) return prev
        return [...prev, {
          id: row.id,
          content: row.content,
          created_at: row.created_at,
          parent_comment_id: row.parent_comment_id,
          reactions: [],
          user: { id: currentUserId, full_name: currentUserName, avatar_url: currentUserAvatar },
        }]
      })
      setCommentText('')
      setReplyTo(null)
      setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
    setSubmittingComment(false)
  }

  async function deleteComment(id: string) {
    const { error } = await supabase.from('task_comments').delete().eq('id', id)
    if (error) toast.error(error.message)
    else setComments(prev => prev.filter(c => c.id !== id && c.parent_comment_id !== id))
  }

  async function handleReact(commentId: string, emoji: string) {
    const comment = comments.find(c => c.id === commentId)
    const existing = comment?.reactions.find(r => r.emoji === emoji)
    if (existing?.reacted) {
      // Remove reaction
      await supabase.from('task_comment_reactions').delete()
        .eq('comment_id', commentId).eq('user_id', currentUserId).eq('emoji', emoji)
      setComments(prev => prev.map(c => c.id !== commentId ? c : {
        ...c,
        reactions: c.reactions
          .map(r => r.emoji !== emoji ? r : { ...r, count: r.count - 1, reacted: false })
          .filter(r => r.count > 0),
      }))
    } else {
      // Add reaction
      const { error } = await supabase.from('task_comment_reactions').insert({
        comment_id: commentId, user_id: currentUserId, emoji,
      })
      if (error) { toast.error('Could not react'); return }
      setComments(prev => prev.map(c => c.id !== commentId ? c : {
        ...c,
        reactions: existing
          ? c.reactions.map(r => r.emoji !== emoji ? r : { ...r, count: r.count + 1, reacted: true })
          : [...c.reactions, { emoji, count: 1, reacted: true }],
      }))
    }
  }

  async function logTime() {
    if (!logHours || parseFloat(logHours) <= 0) { toast.error('Enter valid hours'); return }
    setSubmittingLog(true)
    const { data, error } = await supabase.from('task_time_logs').insert({
      task_id: task.id,
      user_id: currentUserId,
      hours: parseFloat(logHours),
      description: logDesc.trim() || null,
      logged_at: new Date().toISOString(),
    }).select('id, hours, description, logged_at').single()
    if (error) { toast.error(error.message); setSubmittingLog(false); return }
    const row = data as { id: string; hours: number; description: string | null; logged_at: string }
    setTimeLogs(prev => [{
      ...row,
      user: { id: currentUserId, full_name: currentUserName, avatar_url: currentUserAvatar },
    }, ...prev])
    setLogHours('')
    setLogDesc('')
    toast.success(`Logged ${row.hours}h`)
    setSubmittingLog(false)
  }

  async function deleteTimeLog(id: string) {
    const { error } = await supabase.from('task_time_logs').delete().eq('id', id)
    if (error) toast.error(error.message)
    else setTimeLogs(prev => prev.filter(l => l.id !== id))
  }

  async function addSubtask() {
    if (!newSubtask.trim()) return
    setAddingSubtask(true)
    const { data, error } = await supabase.from('tasks').insert({
      org_id: orgId,
      parent_id: task.id,
      title: newSubtask.trim(),
      status: 'todo',
      priority: 'medium',
      created_by: currentUserId,
      tags: [],
    }).select('id, title, status, priority').single()
    if (error) { toast.error(error.message); setAddingSubtask(false); return }
    setSubtasks(prev => [...prev, data as Subtask])
    setNewSubtask('')
    setAddingSubtask(false)
  }

  async function toggleSubtask(sub: Subtask) {
    const next = sub.status === 'done' ? 'todo' : 'done'
    const { error } = await supabase.from('tasks').update({ status: next }).eq('id', sub.id)
    if (error) toast.error(error.message)
    else setSubtasks(prev => prev.map(s => s.id === sub.id ? { ...s, status: next } : s))
  }

  async function deleteSubtask(id: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) toast.error(error.message)
    else setSubtasks(prev => prev.filter(s => s.id !== id))
  }

  const doneSubs = subtasks.filter(s => s.status === 'done').length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Back + Edit */}
        <div className="flex items-center justify-between">
          <Link href="/tasks" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Tasks
          </Link>
          <TaskForm
            orgId={orgId}
            currentUserId={currentUserId}
            users={users}
            teams={teams}
            departments={departments}
            task={{
              id: task.id,
              title: task.title,
              description: task.description,
              priority: task.priority,
              status: task.status,
              due_date: task.due_date,
              start_date: task.start_date,
              estimated_hours: task.estimated_hours,
              team_id: task.team_id,
              dept_id: task.dept_id,
              tags: task.tags,
            }}
            trigger={
              <Button variant="outline" size="sm">
                <Edit2 className="h-4 w-4" />
                Edit Task
              </Button>
            }
            onCreated={() => router.refresh()}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-4">
            {/* Title + status */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start gap-3">
                <span className={cn('mt-2 h-2.5 w-2.5 rounded-full shrink-0', PRIORITY_DOT[task.priority as keyof typeof PRIORITY_DOT])} />
                <div className="flex-1">
                  <h1 className="text-xl font-bold text-gray-900">{task.title}</h1>
                  {task.description && (
                    <p className="mt-2 text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">{task.description}</p>
                  )}
                </div>
              </div>

              {task.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {task.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 px-2.5 py-0.5 text-xs font-medium">
                      <Tag className="h-3 w-3" />{tag}
                    </span>
                  ))}
                </div>
              )}

              {subtasks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-500">Subtasks</span>
                    <span className="text-xs font-medium text-gray-700">{doneSubs}/{subtasks.length}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-indigo-500 h-1.5 rounded-full transition-all"
                      style={{ width: subtasks.length ? `${(doneSubs / subtasks.length) * 100}%` : '0%' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex border-b border-gray-100">
                {TABS.map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      'px-5 py-3 text-sm font-medium border-b-2 transition-colors',
                      tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                    )}
                  >
                    {t}
                    {t === 'Comments' && comments.length > 0 && (
                      <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">{comments.length}</span>
                    )}
                    {t === 'Time Log' && totalLogged > 0 && (
                      <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">{totalLogged}h</span>
                    )}
                    {t === 'Subtasks' && subtasks.length > 0 && (
                      <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">{doneSubs}/{subtasks.length}</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {/* Comments Tab */}
                {tab === 'Comments' && (
                  <div className="space-y-4">
                    <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-1">
                      {threadedComments.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-6">No comments yet. Start the conversation!</p>
                      )}
                      {threadedComments.map(c => (
                        <CommentItem
                          key={c.id}
                          comment={c}
                          currentUserId={currentUserId}
                          users={users}
                          onDelete={deleteComment}
                          onReact={handleReact}
                          onReply={setReplyTo}
                        />
                      ))}
                      <div ref={commentEndRef} />
                    </div>

                    {/* Reply-to banner */}
                    {replyTo && (
                      <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-indigo-700">
                        <CornerDownRight className="h-3 w-3 shrink-0" />
                        <span className="flex-1">Replying to <strong>{replyTo.user.full_name}</strong></span>
                        <button onClick={() => setReplyTo(null)}>
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}

                    <div className="flex gap-2 pt-3 border-t border-gray-100 items-end">
                      <UserAvatar name={currentUserName} avatarUrl={currentUserAvatar} size="sm" className="w-8 h-8 shrink-0" />
                      <MentionTextarea
                        value={commentText}
                        onChange={setCommentText}
                        placeholder={replyTo ? `Reply to ${replyTo.user.full_name}… (@ to mention)` : 'Write a comment… (@ to mention, Enter to send)'}
                        users={users}
                      />
                      <Button size="sm" onClick={postComment} loading={submittingComment} disabled={!commentText.trim()}>
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-gray-400">Enter to send · Shift+Enter for new line · @ to mention</p>
                  </div>
                )}

                {/* Time Log Tab */}
                {tab === 'Time Log' && (
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.5"
                        min="0.5"
                        placeholder="Hours"
                        value={logHours}
                        onChange={e => setLogHours(e.target.value)}
                        className="w-24"
                      />
                      <Input
                        placeholder="Description (optional)"
                        value={logDesc}
                        onChange={e => setLogDesc(e.target.value)}
                        className="flex-1"
                      />
                      <Button size="sm" onClick={logTime} loading={submittingLog}>
                        Log Time
                      </Button>
                    </div>

                    {task.estimated_hours && (
                      <div className="text-xs text-gray-500">
                        {totalLogged}h logged of {task.estimated_hours}h estimated
                        <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className={cn('h-1.5 rounded-full transition-all', totalLogged > task.estimated_hours ? 'bg-red-500' : 'bg-indigo-500')}
                            style={{ width: `${Math.min((totalLogged / task.estimated_hours) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {timeLogs.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">No time logged yet</p>
                      )}
                      {timeLogs.map(l => (
                        <div key={l.id} className="flex items-center gap-3 text-sm group py-2 border-b border-gray-50 last:border-0">
                          <UserAvatar name={l.user.full_name} avatarUrl={l.user.avatar_url} size="sm" className="w-6 h-6" />
                          <span className="font-medium text-gray-900">{l.hours}h</span>
                          {l.description && <span className="text-gray-500 flex-1 truncate">{l.description}</span>}
                          <span className="text-xs text-gray-400 ml-auto">{formatDate(l.logged_at)}</span>
                          {l.user.id === currentUserId && (
                            <button onClick={() => deleteTimeLog(l.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subtasks Tab */}
                {tab === 'Subtasks' && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="New subtask..."
                        value={newSubtask}
                        onChange={e => setNewSubtask(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addSubtask() }}
                        className="flex-1"
                      />
                      <Button size="sm" onClick={addSubtask} loading={addingSubtask}>
                        <Plus className="h-4 w-4" />
                        Add
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      {subtasks.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">No subtasks yet</p>
                      )}
                      {subtasks.map(sub => (
                        <div key={sub.id} className="flex items-center gap-2 group py-1.5 px-2 rounded-lg hover:bg-gray-50">
                          <button onClick={() => toggleSubtask(sub)} className="shrink-0 text-gray-400 hover:text-indigo-600 transition-colors">
                            {sub.status === 'done'
                              ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                              : <Circle className="h-4 w-4" />}
                          </button>
                          <Link href={`/tasks/${sub.id}`} className={cn('flex-1 text-sm', sub.status === 'done' && 'line-through text-gray-400')}>
                            {sub.title}
                          </Link>
                          <span className={cn('h-2 w-2 rounded-full shrink-0', PRIORITY_DOT[sub.priority as keyof typeof PRIORITY_DOT])} />
                          <button
                            onClick={() => deleteSubtask(sub.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Details card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Details</h3>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Status</span>
                  <Badge variant={STATUS_VARIANT[task.status as keyof typeof STATUS_VARIANT] ?? 'secondary'}>
                    {STATUS_LABEL[task.status as keyof typeof STATUS_LABEL] ?? task.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Priority</span>
                  <span className={cn('inline-flex items-center gap-1 capitalize font-medium', {
                    'text-red-600': task.priority === 'urgent',
                    'text-orange-500': task.priority === 'high',
                    'text-blue-600': task.priority === 'medium',
                    'text-gray-500': task.priority === 'low',
                  })}>
                    <span className={cn('h-2 w-2 rounded-full', PRIORITY_DOT[task.priority as keyof typeof PRIORITY_DOT])} />
                    {task.priority}
                  </span>
                </div>
                {task.teams?.name && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Team</span>
                    <span className="font-medium text-gray-700">{task.teams.name}</span>
                  </div>
                )}
                {task.departments?.name && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Department</span>
                    <span className="font-medium text-gray-700">{task.departments.name}</span>
                  </div>
                )}
                {task.start_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Start Date</span>
                    <span className="flex items-center gap-1 text-gray-700">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(task.start_date)}
                    </span>
                  </div>
                )}
                {task.due_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Due Date</span>
                    <span className="flex items-center gap-1 text-gray-700">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(task.due_date)}
                    </span>
                  </div>
                )}
                {task.estimated_hours && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Estimated</span>
                    <span className="flex items-center gap-1 text-gray-700">
                      <Clock className="h-3.5 w-3.5" />
                      {task.estimated_hours}h
                    </span>
                  </div>
                )}
                {totalLogged > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Time Logged</span>
                    <span className="flex items-center gap-1 text-gray-700">
                      <Clock className="h-3.5 w-3.5" />
                      {totalLogged}h
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="text-gray-700">{formatDate(task.created_at)}</span>
                </div>
              </div>
            </div>

            {/* Assignees card */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Assignees ({assignees.length})
              </h3>
              <div className="space-y-2">
                {assignees.map(a => (
                  <div key={a.id} className="flex items-center gap-2">
                    <UserAvatar name={a.full_name} avatarUrl={a.avatar_url} size="sm" className="w-7 h-7" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{a.email}</p>
                    </div>
                  </div>
                ))}
                {assignees.length === 0 && (
                  <p className="text-sm text-gray-400">No assignees</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
