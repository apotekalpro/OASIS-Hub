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
  Trash2, CheckCircle2, Circle, CornerDownRight, Smile, X,
  Paperclip, FileText, Download, Eye,
} from 'lucide-react'
import { formatDate, formatRelativeTime, getDueStatus, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createPortal } from 'react-dom'
import { RichTextContent } from '@/components/ui/rich-text-editor'

type Attachment = { name: string; url: string; type: 'image' | 'file' }
type Reaction = { emoji: string; count: number; reacted: boolean }
type Comment = {
  id: string
  content: string
  created_at: string
  parent_comment_id: string | null
  attachments: Attachment[]
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
  watchers: Assignee[]
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

// ─── Emoji picker portal ───────────────────────────────────────────────────────
function EmojiPicker({ anchor, onPick, onClose }: {
  anchor: DOMRect
  onPick: (emoji: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchor.top - 48,
    left: anchor.left,
    zIndex: 9999,
  }

  return createPortal(
    <div ref={ref} style={style} className="flex gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1.5 shadow-lg">
      {QUICK_EMOJIS.map(em => (
        <button
          key={em}
          onMouseDown={e => { e.preventDefault(); onPick(em); onClose() }}
          className="text-lg hover:scale-125 transition-transform leading-none"
        >
          {em}
        </button>
      ))}
    </div>,
    document.body
  )
}

// ─── Mention textarea ─────────────────────────────────────────────────────────
function MentionTextarea({
  value, onChange, onKeyDown, onPaste, placeholder, users, rows = 2, textareaRef,
}: {
  value: string
  onChange: (v: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onPaste?: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
  placeholder: string
  users: OrgUser[]
  rows?: number
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
}) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null)
  const ref = textareaRef ?? innerRef
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
        onKeyDown={onKeyDown}
        onPaste={onPaste}
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

// ─── Render comment content (mentions + images) ────────────────────────────
function CommentContent({ content, attachments }: { content: string; attachments: Attachment[] }) {
  const parts = content.split(/(@\w[^@\s]*(?:\s\w+)?)/g)
  return (
    <div>
      <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap leading-relaxed">
        {parts.map((part, i) =>
          part.startsWith('@')
            ? <span key={i} className="text-indigo-600 font-medium">{part}</span>
            : part
        )}
      </p>
      {attachments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {attachments.map((att, i) =>
            att.type === 'image' ? (
              <a key={i} href={att.url} target="_blank" rel="noreferrer">
                <img src={att.url} alt={att.name} className="max-h-48 max-w-xs rounded-lg border border-gray-200 object-cover hover:opacity-90 transition-opacity" />
              </a>
            ) : (
              <a
                key={i}
                href={att.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                <span className="truncate max-w-[180px]">{att.name}</span>
                <Download className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              </a>
            )
          )}
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
  const [emojiAnchor, setEmojiAnchor] = useState<DOMRect | null>(null)
  const smileRef = useRef<HTMLButtonElement>(null)

  return (
    <div className={cn('flex gap-3 group', depth > 0 && 'ml-8 mt-2')}>
      {depth > 0 && <CornerDownRight className="h-3.5 w-3.5 text-gray-300 shrink-0 mt-1" />}
      <UserAvatar name={comment.user.full_name} avatarUrl={comment.user.avatar_url} size="sm" className="w-7 h-7 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900">{comment.user.full_name}</span>
          <span className="text-xs text-gray-400">{formatRelativeTime(comment.created_at)}</span>

          <div className="ml-auto hidden group-hover:flex items-center gap-1">
            <button
              ref={smileRef}
              onClick={() => setEmojiAnchor(smileRef.current?.getBoundingClientRect() ?? null)}
              className="p-0.5 text-gray-300 hover:text-gray-600 transition-colors"
              title="React"
            >
              <Smile className="h-3.5 w-3.5" />
            </button>
            {emojiAnchor && (
              <EmojiPicker
                anchor={emojiAnchor}
                onPick={em => onReact(comment.id, em)}
                onClose={() => setEmojiAnchor(null)}
              />
            )}
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

        <CommentContent content={comment.content} attachments={comment.attachments} />

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
  assignees, watchers, orgId, currentUserId, currentUserName, currentUserAvatar, users, teams, departments
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
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [taskStatus, setTaskStatus] = useState(task.status)
  const [logHours, setLogHours] = useState('')
  const [logDesc, setLogDesc] = useState('')
  const [submittingLog, setSubmittingLog] = useState(false)
  const [newSubtask, setNewSubtask] = useState('')
  const [addingSubtask, setAddingSubtask] = useState(false)
  const commentEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const totalLogged = timeLogs.reduce((sum, l) => sum + l.hours, 0)

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
            attachments: [],
            user: p ? { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url } : { id: newRow.user_id, full_name: 'Someone', avatar_url: null },
            reactions: [],
          }]
        })
        setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [task.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function uploadFiles(files: File[]): Promise<Attachment[]> {
    const results: Attachment[] = []
    for (const file of files) {
      const ext = file.name.split('.').pop() ?? 'bin'
      const path = `${task.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('task-attachments').upload(path, file)
      if (error) { toast.error(`Upload failed: ${file.name}`); continue }
      const { data: urlData } = supabase.storage.from('task-attachments').getPublicUrl(path)
      results.push({
        name: file.name,
        url: urlData.publicUrl,
        type: file.type.startsWith('image/') ? 'image' : 'file',
      })
    }
    return results
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData.items)
    const imageItems = items.filter(item => item.type.startsWith('image/'))
    if (imageItems.length === 0) return
    e.preventDefault()
    const files = imageItems.map(item => item.getAsFile()).filter(Boolean) as File[]
    const named = files.map((f, i) => new File([f], `pasted-image-${Date.now()}-${i}.png`, { type: f.type }))
    setPendingFiles(prev => [...prev, ...named])
    toast.success(`${named.length} image(s) ready to attach`)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setPendingFiles(prev => [...prev, ...files])
    e.target.value = ''
  }

  function removePendingFile(index: number) {
    setPendingFiles(prev => prev.filter((_, i) => i !== index))
  }

  async function postComment() {
    if (!commentText.trim() && pendingFiles.length === 0) return
    setSubmittingComment(true)

    const attachments = pendingFiles.length > 0 ? await uploadFiles(pendingFiles) : []

    const { data, error } = await supabase.from('task_comments').insert({
      task_id: task.id,
      user_id: currentUserId,
      content: commentText.trim(),
      parent_comment_id: replyTo?.id ?? null,
      attachments: attachments.length > 0 ? attachments : null,
    }).select('id, content, created_at, parent_comment_id, attachments').single()

    if (error) {
      toast.error(error.message)
    } else if (data) {
      const row = data as { id: string; content: string; created_at: string; parent_comment_id: string | null; attachments: Attachment[] | null }
      setComments(prev => {
        if (prev.find(c => c.id === row.id)) return prev
        return [...prev, {
          id: row.id,
          content: row.content,
          created_at: row.created_at,
          parent_comment_id: row.parent_comment_id,
          attachments: row.attachments ?? [],
          reactions: [],
          user: { id: currentUserId, full_name: currentUserName, avatar_url: currentUserAvatar },
        }]
      })

      // Email @mentioned users in the comment
      const mentionPattern = /@([^@\n,]+?)(?=\s|$|[,.])/g
      const mentionedIds: string[] = []
      let m
      while ((m = mentionPattern.exec(commentText)) !== null) {
        const name = m[1].trim()
        const found = users.find(u => u.full_name.toLowerCase() === name.toLowerCase())
        if (found && found.id !== currentUserId && !mentionedIds.includes(found.id)) {
          mentionedIds.push(found.id)
        }
      }
      if (mentionedIds.length > 0) {
        fetch('/api/notifications/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'task_mention', taskId: task.id, userIds: mentionedIds, actorName: currentUserName }),
        }).catch(() => {})
      }

      setCommentText('')
      setReplyTo(null)
      setPendingFiles([])
      setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
    setSubmittingComment(false)
  }

  function handleCommentKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      postComment()
    }
  }

  async function handleComplete() {
    setCompleting(true)
    const { error } = await supabase.from('tasks').update({ status: 'done' }).eq('id', task.id)
    if (error) { toast.error(error.message); setCompleting(false); return }
    setTaskStatus('done')
    setConfirmComplete(false)
    setCompleting(false)
    toast.success('Task marked as complete!')
    router.refresh()
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
      await supabase.from('task_comment_reactions').delete()
        .eq('comment_id', commentId).eq('user_id', currentUserId).eq('emoji', emoji)
      setComments(prev => prev.map(c => c.id !== commentId ? c : {
        ...c,
        reactions: c.reactions
          .map(r => r.emoji !== emoji ? r : { ...r, count: r.count - 1, reacted: false })
          .filter(r => r.count > 0),
      }))
    } else {
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
                    <RichTextContent html={task.description} className="mt-2" />
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
                        <button onClick={() => setReplyTo(null)}><X className="h-3 w-3" /></button>
                      </div>
                    )}

                    {/* Pending file previews */}
                    {pendingFiles.length > 0 && (
                      <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        {pendingFiles.map((f, i) => (
                          <div key={i} className="relative group">
                            {f.type.startsWith('image/') ? (
                              <img
                                src={URL.createObjectURL(f)}
                                alt={f.name}
                                className="h-16 w-16 object-cover rounded-lg border border-gray-200"
                              />
                            ) : (
                              <div className="h-16 w-32 flex items-center gap-2 px-2 bg-white rounded-lg border border-gray-200 text-xs text-gray-600 truncate">
                                <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                                {f.name}
                              </div>
                            )}
                            <button
                              onClick={() => removePendingFile(i)}
                              className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Comment input */}
                    <div className="pt-3 border-t border-gray-100 space-y-2">
                      <div className="flex gap-2 items-end">
                        <UserAvatar name={currentUserName} avatarUrl={currentUserAvatar} size="sm" className="w-8 h-8 shrink-0" />
                        <MentionTextarea
                          value={commentText}
                          onChange={setCommentText}
                          onKeyDown={handleCommentKeyDown}
                          onPaste={handlePaste}
                          placeholder={replyTo ? `Reply to ${replyTo.user.full_name}… (@ to mention)` : 'Write a comment… (@ to mention, Ctrl+V to paste image)'}
                          users={users}
                          textareaRef={textareaRef}
                        />
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            title="Attach file"
                            className="px-2"
                          >
                            <Paperclip className="h-4 w-4" />
                          </Button>
                          <Button size="sm" onClick={postComment} loading={submittingComment} disabled={!commentText.trim() && pendingFiles.length === 0}>
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 ml-10">Enter to send · Shift+Enter for new line · @ to mention · Ctrl+V to paste image</p>
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
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
                      <Button size="sm" onClick={logTime} loading={submittingLog}>Log Time</Button>
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
                        <Plus className="h-4 w-4" />Add
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
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Details</h3>

              {/* Complete button */}
              {taskStatus !== 'done' && taskStatus !== 'cancelled' && (
                <div>
                  {confirmComplete ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleComplete}
                        disabled={completing}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium py-2 px-3 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {completing ? 'Saving…' : 'Confirm Complete'}
                      </button>
                      <button onClick={() => setConfirmComplete(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg border border-gray-200">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmComplete(true)}
                      className="w-full flex items-center justify-center gap-1.5 border-2 border-green-500 text-green-600 hover:bg-green-50 text-sm font-medium py-2 px-3 rounded-lg transition-colors"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Mark as Complete
                    </button>
                  )}
                </div>
              )}
              {taskStatus === 'done' && (
                <div className="flex items-center justify-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm font-medium py-2 px-3 rounded-lg">
                  <CheckCircle2 className="h-4 w-4" />
                  Completed
                </div>
              )}

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Status</span>
                  <Badge variant={STATUS_VARIANT[taskStatus as keyof typeof STATUS_VARIANT] ?? 'secondary'}>
                    {STATUS_LABEL[taskStatus as keyof typeof STATUS_LABEL] ?? taskStatus}
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
                    <span className="flex items-center gap-1 text-gray-700"><Calendar className="h-3.5 w-3.5" />{formatDate(task.start_date)}</span>
                  </div>
                )}
                {task.due_date && (() => {
                  const due = getDueStatus(task.due_date)
                  const isDone = taskStatus === 'done' || taskStatus === 'cancelled'
                  return (
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-gray-500 shrink-0">Due Date</span>
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="flex items-center gap-1 text-gray-700 text-xs">
                          <Calendar className="h-3.5 w-3.5" />{formatDate(task.due_date)}
                        </span>
                        {due && !isDone && (
                          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded border', {
                            'text-red-600 bg-red-50 border-red-200': due.color === 'red',
                            'text-orange-600 bg-orange-50 border-orange-200': due.color === 'orange',
                            'text-yellow-700 bg-yellow-50 border-yellow-200': due.color === 'yellow',
                            'text-gray-500 bg-gray-50 border-gray-200': due.color === 'gray',
                          })}>
                            {due.badge ?? due.label}
                          </span>
                        )}
                        {due && !isDone && (
                          <span className={cn('text-xs', {
                            'text-red-600 font-medium': due.color === 'red',
                            'text-orange-600 font-medium': due.color === 'orange',
                            'text-yellow-700': due.color === 'yellow',
                            'text-gray-400': due.color === 'gray',
                          })}>{due.label}</span>
                        )}
                      </div>
                    </div>
                  )
                })()}
                {task.estimated_hours && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Estimated</span>
                    <span className="flex items-center gap-1 text-gray-700"><Clock className="h-3.5 w-3.5" />{task.estimated_hours}h</span>
                  </div>
                )}
                {totalLogged > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Time Logged</span>
                    <span className="flex items-center gap-1 text-gray-700"><Clock className="h-3.5 w-3.5" />{totalLogged}h</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="text-gray-700">{formatDate(task.created_at)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Assignees / PIC ({assignees.length})
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
                {assignees.length === 0 && <p className="text-sm text-gray-400">No assignees</p>}
              </div>
            </div>

            {watchers.length > 0 && (
              <div className="bg-amber-50 rounded-xl border border-amber-100 p-5 space-y-3">
                <h3 className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  CC / Watchers ({watchers.length})
                </h3>
                <div className="space-y-2">
                  {watchers.map(w => (
                    <div key={w.id} className="flex items-center gap-2">
                      <UserAvatar name={w.full_name} avatarUrl={w.avatar_url} size="sm" className="w-7 h-7" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{w.full_name}</p>
                        <p className="text-xs text-gray-400 truncate">{w.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
