'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Edit2, Trash2, Plus, Send, Smile, CornerDownRight,
  X, Users, Eye, Target, Calendar, Building2, Search, CheckCircle2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/avatar'
import { OkrForm, OKR_STATUS_VARIANT, OKR_STATUS_LABEL, krProgressPct, formatKrValue, getProgressColor } from './okr-form'
import { formatDate, formatRelativeTime, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { createPortal } from 'react-dom'

type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }
type Department = { id: string; name: string }
type Team = { id: string; name: string }

type KeyResult = {
  id: string
  title: string
  description: string | null
  metric_type: string
  start_value: number
  target_value: number
  current_value: number
  unit: string | null
  due_date: string | null
  status: string
  created_at: string
}

type Reaction = { emoji: string; count: number; reacted: boolean }
type Comment = {
  id: string
  content: string
  created_at: string
  parent_comment_id: string | null
  attachments: Array<{ name: string; url: string; type: 'image' | 'file' }>
  user: { id: string; full_name: string; avatar_url: string | null }
  reactions: Reaction[]
  _rawReactions?: Array<{ id: string; emoji: string; user_id: string }>
  replies?: Comment[]
}

type Objective = {
  id: string
  title: string
  description: string | null
  period_type: string
  period_label: string | null
  start_date: string | null
  end_date: string | null
  status: string
  progress: number
  created_by: string
  created_at: string
  dept_id: string | null
  team_id: string | null
  departments: { name: string } | null
  teams: { name: string } | null
}

interface Props {
  objective: Objective
  keyResults: KeyResult[]
  comments: Comment[]
  assignees: OrgUser[]
  watchers: OrgUser[]
  orgId: string
  currentUserId: string
  currentUserName: string
  currentUserAvatar: string | null
  currentUserRole: string
  users: OrgUser[]
  departments: Department[]
  teams: Team[]
}

const QUICK_EMOJIS = ['👍', '👎', '❤️', '😄', '😮', '😢', '🎉', '🔥']

// ── Emoji picker portal ────────────────────────────────────────────────────────
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

// ── Comment item ───────────────────────────────────────────────────────────────
function CommentItem({
  comment, currentUserId, users, onDelete, onReact, onReply, depth = 0,
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
              className="p-0.5 text-gray-300 hover:text-gray-600"
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
                className="p-0.5 text-gray-300 hover:text-indigo-500"
                title="Reply"
              >
                <CornerDownRight className="h-3.5 w-3.5" />
              </button>
            )}
            {comment.user.id === currentUserId && (
              <button
                onClick={() => onDelete(comment.id)}
                className="p-0.5 text-gray-300 hover:text-red-500"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap leading-relaxed">
          {comment.content.split(/(@\w[^@\s]*(?:\s\w+)?)/g).map((part, i) =>
            part.startsWith('@')
              ? <span key={i} className="text-indigo-600 font-medium">{part}</span>
              : part
          )}
        </p>

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

// ── Mention textarea ───────────────────────────────────────────────────────────
function MentionTextarea({
  value, onChange, onKeyDown, placeholder, users,
}: {
  value: string
  onChange: (v: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder: string
  users: OrgUser[]
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  const [mentionOpen, setMentionOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(-1)

  const filtered = users.filter(u => u.full_name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6)

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
        rows={2}
        value={value}
        onChange={handleInput}
        onKeyDown={onKeyDown}
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

// ── Main component ─────────────────────────────────────────────────────────────
export function OkrDetailClient({
  objective, keyResults: initialKrs, comments: initialComments,
  assignees: initialAssignees, watchers,
  orgId, currentUserId, currentUserName, currentUserAvatar, currentUserRole,
  users, departments, teams,
}: Props) {
  const router = useRouter()

  const [krs, setKrs] = useState<KeyResult[]>(initialKrs)
  const [comments, setComments] = useState<Comment[]>(() =>
    initialComments.map(c => ({
      ...c,
      reactions: buildReactions(c._rawReactions ?? [], currentUserId),
    }))
  )
  const [assignees, setAssignees] = useState<OrgUser[]>(initialAssignees)
  const [objectiveStatus, setObjectiveStatus] = useState(objective.status)
  const [objectiveProgress, setObjectiveProgress] = useState(Number(objective.progress))

  // Comments
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const commentEndRef = useRef<HTMLDivElement>(null)

  // KR inline update
  const [krEditing, setKrEditing] = useState<Record<string, string>>({})
  const [krUpdating, setKrUpdating] = useState<string | null>(null)

  // Add KR
  const [showAddKr, setShowAddKr] = useState(false)
  const [newKrTitle, setNewKrTitle] = useState('')
  const [newKrTarget, setNewKrTarget] = useState('100')
  const [newKrMetric, setNewKrMetric] = useState<'percentage' | 'number' | 'boolean' | 'currency'>('percentage')
  const [newKrUnit, setNewKrUnit] = useState('')
  const [addingKr, setAddingKr] = useState(false)

  // Assignee management
  const [showAddAssignee, setShowAddAssignee] = useState(false)
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [addingAssignee, setAddingAssignee] = useState(false)

  function buildReactions(raw: Array<{ id: string; emoji: string; user_id: string }>, uid: string): Reaction[] {
    const map: Record<string, { count: number; reacted: boolean }> = {}
    for (const r of raw) {
      if (!map[r.emoji]) map[r.emoji] = { count: 0, reacted: false }
      map[r.emoji].count++
      if (r.user_id === uid) map[r.emoji].reacted = true
    }
    return Object.entries(map).map(([emoji, v]) => ({ emoji, ...v }))
  }

  const threadedComments = comments
    .filter(c => !c.parent_comment_id)
    .map(c => ({
      ...c,
      replies: comments.filter(r => r.parent_comment_id === c.id),
    }))

  // ── Key Results CRUD ─────────────────────────────────────────────────────────
  async function updateKrValue(kr: KeyResult) {
    const raw = krEditing[kr.id]
    if (raw === undefined) return
    const val = parseFloat(raw)
    if (isNaN(val)) { toast.error('Enter a valid number'); return }
    setKrUpdating(kr.id)
    try {
      const res = await fetch(`/api/okr/${objective.id}/key-results`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: kr.id, current_value: val }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const updated = json.keyResult as KeyResult
      setKrs(prev => prev.map(k => k.id === kr.id ? updated : k))
      // Recalculate local progress
      const updatedKrs = krs.map(k => k.id === kr.id ? { ...k, current_value: val } : k)
      const avg = updatedKrs.reduce((s, k) => s + krProgressPct(k), 0) / updatedKrs.length
      setObjectiveProgress(Math.round(avg))
      setKrEditing(prev => { const n = { ...prev }; delete n[kr.id]; return n })
      toast.success('Key result updated')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setKrUpdating(null)
    }
  }

  async function toggleKrComplete(kr: KeyResult) {
    const newVal = kr.metric_type === 'boolean'
      ? (kr.current_value >= 1 ? 0 : 1)
      : (krProgressPct(kr) >= 100 ? kr.start_value : kr.target_value)
    setKrUpdating(kr.id)
    try {
      const res = await fetch(`/api/okr/${objective.id}/key-results`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: kr.id, current_value: newVal }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const updated = json.keyResult as KeyResult
      setKrs(prev => prev.map(k => k.id === kr.id ? updated : k))
      const updatedKrs = krs.map(k => k.id === kr.id ? updated : k)
      const avg = updatedKrs.reduce((s, k) => s + krProgressPct(k), 0) / updatedKrs.length
      setObjectiveProgress(Math.round(avg))
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setKrUpdating(null)
    }
  }

  async function deleteKr(krId: string) {
    if (!confirm('Delete this key result?')) return
    const res = await fetch(`/api/okr/${objective.id}/key-results?id=${krId}`, { method: 'DELETE' })
    if (!res.ok) { toast.error((await res.json()).error); return }
    const remaining = krs.filter(k => k.id !== krId)
    setKrs(remaining)
    if (remaining.length > 0) {
      const avg = remaining.reduce((s, k) => s + krProgressPct(k), 0) / remaining.length
      setObjectiveProgress(Math.round(avg))
    } else {
      setObjectiveProgress(0)
    }
    toast.success('Key result deleted')
  }

  async function addKr() {
    if (!newKrTitle.trim()) { toast.error('Title required'); return }
    setAddingKr(true)
    try {
      const res = await fetch(`/api/okr/${objective.id}/key-results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newKrTitle.trim(),
          metric_type: newKrMetric,
          start_value: 0,
          target_value: parseFloat(newKrTarget) || 100,
          unit: newKrUnit.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setKrs(prev => [...prev, json.keyResult])
      setNewKrTitle('')
      setNewKrTarget('100')
      setNewKrMetric('percentage')
      setNewKrUnit('')
      setShowAddKr(false)
      toast.success('Key result added')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setAddingKr(false)
    }
  }

  // ── Status inline update ─────────────────────────────────────────────────────
  async function updateStatus(newStatus: string) {
    const res = await fetch(`/api/okr/${objective.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) { toast.error((await res.json()).error); return }
    setObjectiveStatus(newStatus)
    toast.success('Status updated')
  }

  // ── Comments ─────────────────────────────────────────────────────────────────
  async function postComment() {
    if (!commentText.trim()) return
    setSubmittingComment(true)
    try {
      const res = await fetch(`/api/okr/${objective.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: commentText.trim(),
          parent_comment_id: replyTo?.id ?? null,
          attachments: [],
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      const raw = json.comment
      setComments(prev => {
        if (prev.find(c => c.id === raw.id)) return prev
        return [...prev, {
          id: raw.id,
          content: raw.content,
          created_at: raw.created_at,
          parent_comment_id: raw.parent_comment_id,
          attachments: raw.attachments ?? [],
          reactions: [],
          user: raw.profiles ?? { id: currentUserId, full_name: currentUserName, avatar_url: currentUserAvatar },
        }]
      })
      setCommentText('')
      setReplyTo(null)
      setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSubmittingComment(false)
    }
  }

  async function deleteComment(id: string) {
    const res = await fetch(`/api/okr/${objective.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', commentId: id }),
    })
    if (!res.ok) { toast.error('Failed to delete comment'); return }
    setComments(prev => prev.filter(c => c.id !== id && c.parent_comment_id !== id))
  }

  async function handleReact(commentId: string, emoji: string) {
    const comment = comments.find(c => c.id === commentId)
    const existing = comment?.reactions.find(r => r.emoji === emoji)
    const toggled = existing?.reacted

    await fetch(`/api/okr/${objective.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'react', commentId, emoji }),
    })

    setComments(prev => prev.map(c => {
      if (c.id !== commentId) return c
      if (toggled) {
        return {
          ...c,
          reactions: c.reactions
            .map(r => r.emoji !== emoji ? r : { ...r, count: r.count - 1, reacted: false })
            .filter(r => r.count > 0),
        }
      } else {
        return {
          ...c,
          reactions: existing
            ? c.reactions.map(r => r.emoji !== emoji ? r : { ...r, count: r.count + 1, reacted: true })
            : [...c.reactions, { emoji, count: 1, reacted: true }],
        }
      }
    }))
  }

  // ── Assignees ────────────────────────────────────────────────────────────────
  async function addAssignee(u: OrgUser) {
    if (assignees.some(a => a.id === u.id)) {
      toast.info(`${u.full_name} is already an assignee`)
      setShowAddAssignee(false)
      return
    }
    setAddingAssignee(true)
    const existing = assignees.map(a => a.id)
    const res = await fetch(`/api/okr/${objective.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigneeIds: [...existing, u.id] }),
    })
    if (!res.ok) { toast.error((await res.json()).error); setAddingAssignee(false); return }
    setAssignees(prev => [...prev, u])
    toast.success(`${u.full_name} added`)
    setShowAddAssignee(false)
    setAssigneeSearch('')
    setAddingAssignee(false)
  }

  async function removeAssignee(userId: string) {
    const remaining = assignees.filter(a => a.id !== userId).map(a => a.id)
    const res = await fetch(`/api/okr/${objective.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigneeIds: remaining }),
    })
    if (!res.ok) { toast.error((await res.json()).error); return }
    setAssignees(prev => prev.filter(a => a.id !== userId))
  }

  // ── Delete objective ─────────────────────────────────────────────────────────
  async function deleteObjective() {
    if (!confirm('Delete this objective and all its key results? This cannot be undone.')) return
    const res = await fetch(`/api/okr/${objective.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error((await res.json()).error); return }
    toast.success('Objective deleted')
    router.push('/okr')
  }

  const isOwner = objective.created_by === currentUserId
  const isDeptHeadPlus = ['super_admin', 'org_admin', 'dept_head', 'chief'].includes(currentUserRole)
  const canDelete = isOwner || isDeptHeadPlus
  const isAssignee = assignees.some(a => a.id === currentUserId)
  const canManage = isOwner || isAssignee || isDeptHeadPlus

  const progress = objectiveProgress
  const progressColor = progress >= 70 ? '#22c55e' : progress >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Back + Actions */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link href="/okr" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to OKRs
          </Link>
          <div className="flex items-center gap-2">
            {canDelete && (
              <Button variant="outline" size="sm" onClick={deleteObjective} className="text-red-600 hover:bg-red-50 hover:border-red-300">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            {canManage && (
              <OkrForm
                orgId={orgId}
                currentUserId={currentUserId}
                users={users}
                departments={departments}
                teams={teams}
                objective={{
                  id: objective.id,
                  title: objective.title,
                  description: objective.description,
                  period_type: objective.period_type,
                  period_label: objective.period_label,
                  start_date: objective.start_date,
                  end_date: objective.end_date,
                  status: objectiveStatus,
                  dept_id: objective.dept_id,
                  team_id: objective.team_id,
                }}
                trigger={
                  <Button variant="outline" size="sm">
                    <Edit2 className="h-4 w-4" />
                    Edit Objective
                  </Button>
                }
                onCreated={() => router.refresh()}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Objective header card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start gap-4">
                {/* Big progress circle */}
                <div className="shrink-0">
                  <svg width="72" height="72" viewBox="0 0 72 72">
                    <circle cx="36" cy="36" r="30" fill="none" stroke="#e5e7eb" strokeWidth="7" />
                    <circle
                      cx="36" cy="36" r="30"
                      fill="none"
                      stroke={progressColor}
                      strokeWidth="7"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 30}`}
                      strokeDashoffset={`${2 * Math.PI * 30 * (1 - progress / 100)}`}
                      transform="rotate(-90 36 36)"
                      style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                    />
                    <text x="36" y="36" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="700" fill={progressColor}>
                      {progress}%
                    </text>
                  </svg>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <Badge variant={OKR_STATUS_VARIANT[objectiveStatus] ?? 'secondary'}>
                      {OKR_STATUS_LABEL[objectiveStatus] ?? objectiveStatus}
                    </Badge>
                    {objective.period_label && (
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full capitalize">
                        {objective.period_label}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 capitalize">{objective.period_type}</span>
                  </div>
                  <h1 className="text-xl font-bold text-gray-900">{objective.title}</h1>
                  {objective.description && (
                    <div className="mt-2 prose prose-sm max-w-none text-gray-600" dangerouslySetInnerHTML={{ __html: objective.description }} />
                  )}

                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
                    {objective.departments?.name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {objective.departments.name}
                      </span>
                    )}
                    {objective.teams?.name && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" />
                        {objective.teams.name}
                      </span>
                    )}
                    {objective.start_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(objective.start_date)}
                        {objective.end_date && ` → ${formatDate(objective.end_date)}`}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status quick-change */}
              {canManage && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-500 font-medium">Change status:</span>
                  {Object.entries(OKR_STATUS_LABEL).map(([s, l]) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(s)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-medium border transition-colors',
                        objectiveStatus === s
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Key Results */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Target className="h-4 w-4 text-indigo-500" />
                  Key Results
                  <span className="text-sm font-normal text-gray-400">({krs.length})</span>
                </h2>
                {canManage && (
                  <button
                    onClick={() => setShowAddKr(v => !v)}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add KR
                  </button>
                )}
              </div>

              {/* Add KR form */}
              {showAddKr && (
                <div className="px-5 py-4 bg-indigo-50 border-b border-indigo-100 space-y-3">
                  <Input
                    placeholder="Key result title..."
                    value={newKrTitle}
                    onChange={e => setNewKrTitle(e.target.value)}
                    autoFocus
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Metric Type</label>
                      <select
                        value={newKrMetric}
                        onChange={e => setNewKrMetric(e.target.value as typeof newKrMetric)}
                        className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="percentage">% Percentage</option>
                        <option value="number"># Number</option>
                        <option value="boolean">✓ Boolean</option>
                        <option value="currency">$ Currency</option>
                      </select>
                    </div>
                    {newKrMetric !== 'boolean' && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Target</label>
                        <input
                          type="number"
                          value={newKrTarget}
                          onChange={e => setNewKrTarget(e.target.value)}
                          className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Unit</label>
                      <input
                        type="text"
                        value={newKrUnit}
                        onChange={e => setNewKrUnit(e.target.value)}
                        placeholder="%  MYR  units"
                        className="flex h-8 w-full rounded-md border border-gray-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addKr} loading={addingKr}>Add Key Result</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAddKr(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              <div className="divide-y divide-gray-100">
                {krs.length === 0 && (
                  <div className="px-5 py-8 text-center text-sm text-gray-400">
                    No key results yet. Add one to start tracking progress.
                  </div>
                )}
                {krs.map(kr => {
                  const pct = Math.round(krProgressPct(kr))
                  const isDone = pct >= 100
                  const isEditing = kr.id in krEditing

                  return (
                    <div key={kr.id} className="px-5 py-4 group">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleKrComplete(kr)}
                          disabled={krUpdating === kr.id}
                          className="shrink-0 mt-0.5"
                        >
                          {isDone
                            ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                            : <div className="h-5 w-5 rounded-full border-2 border-gray-300 hover:border-indigo-400 transition-colors" />
                          }
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <span className={cn('text-sm font-medium text-gray-900', isDone && 'line-through text-gray-400')}>
                              {kr.title}
                            </span>
                            {canManage && (
                              <button
                                onClick={() => deleteKr(kr.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 shrink-0"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Progress bar */}
                          <div className="flex items-center gap-3 mt-1.5">
                            <div className="flex-1 bg-gray-100 rounded-full h-2">
                              <div
                                className={cn('h-2 rounded-full transition-all', getProgressColor(pct))}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500 w-8 text-right shrink-0">{pct}%</span>
                          </div>

                          {/* Metric display + inline edit */}
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-gray-500">{formatKrValue(kr)}</span>
                            {kr.due_date && (
                              <span className="text-xs text-gray-400 flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                Due {formatDate(kr.due_date)}
                              </span>
                            )}
                          </div>

                          {/* Inline current value update */}
                          {canManage && kr.metric_type !== 'boolean' && (
                            <div className="mt-2">
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    value={krEditing[kr.id]}
                                    onChange={e => setKrEditing(prev => ({ ...prev, [kr.id]: e.target.value }))}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') updateKrValue(kr)
                                      if (e.key === 'Escape') setKrEditing(prev => { const n = { ...prev }; delete n[kr.id]; return n })
                                    }}
                                    className="w-28 h-7 px-2 text-xs rounded border border-indigo-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    autoFocus
                                  />
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs px-2"
                                    onClick={() => updateKrValue(kr)}
                                    loading={krUpdating === kr.id}
                                  >
                                    Update
                                  </Button>
                                  <button
                                    onClick={() => setKrEditing(prev => { const n = { ...prev }; delete n[kr.id]; return n })}
                                    className="text-gray-400 hover:text-gray-600"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setKrEditing(prev => ({ ...prev, [kr.id]: String(kr.current_value) }))}
                                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  Update progress
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Comments */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">
                  Comments
                  {comments.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-gray-400">({comments.length})</span>
                  )}
                </h2>
              </div>
              <div className="p-5 space-y-4">
                {/* Comment list */}
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

                {/* Reply banner */}
                {replyTo && (
                  <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-indigo-700">
                    <CornerDownRight className="h-3 w-3 shrink-0" />
                    <span className="flex-1">Replying to <strong>{replyTo.user.full_name}</strong></span>
                    <button onClick={() => setReplyTo(null)}><X className="h-3 w-3" /></button>
                  </div>
                )}

                {/* Comment input */}
                <div className="pt-3 border-t border-gray-100">
                  <div className="flex gap-2 items-end">
                    <UserAvatar name={currentUserName} avatarUrl={currentUserAvatar} size="sm" className="w-8 h-8 shrink-0" />
                    <MentionTextarea
                      value={commentText}
                      onChange={setCommentText}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment() }
                      }}
                      placeholder={replyTo ? `Reply to ${replyTo.user.full_name}…` : 'Write a comment… (@ to mention)'}
                      users={users}
                    />
                    <Button size="sm" onClick={postComment} loading={submittingComment} disabled={!commentText.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-400 ml-10 mt-1">Enter to send · Shift+Enter for new line · @ to mention</p>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Details */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Status</span>
                  <Badge variant={OKR_STATUS_VARIANT[objectiveStatus] ?? 'secondary'}>
                    {OKR_STATUS_LABEL[objectiveStatus] ?? objectiveStatus}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Period</span>
                  <span className="font-medium text-gray-700 capitalize">{objective.period_type}</span>
                </div>
                {objective.period_label && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Label</span>
                    <span className="font-medium text-gray-700">{objective.period_label}</span>
                  </div>
                )}
                {objective.departments?.name && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Department</span>
                    <span className="font-medium text-gray-700">{objective.departments.name}</span>
                  </div>
                )}
                {objective.teams?.name && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Team</span>
                    <span className="font-medium text-gray-700">{objective.teams.name}</span>
                  </div>
                )}
                {objective.start_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Start</span>
                    <span className="text-gray-700 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(objective.start_date)}
                    </span>
                  </div>
                )}
                {objective.end_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">End</span>
                    <span className="text-gray-700 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatDate(objective.end_date)}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="text-gray-700">{formatDate(objective.created_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Key Results</span>
                  <span className="font-medium text-gray-700">{krs.length}</span>
                </div>
              </div>
            </div>

            {/* Assignees */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Assignees ({assignees.length})
                </h3>
                {canManage && (
                  <button
                    onClick={() => { setShowAddAssignee(v => !v); setAssigneeSearch('') }}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    + Add
                  </button>
                )}
              </div>

              {showAddAssignee && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-100">
                    <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search people…"
                      value={assigneeSearch}
                      onChange={e => setAssigneeSearch(e.target.value)}
                      className="flex-1 text-xs outline-none bg-transparent placeholder-gray-400"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {users
                      .filter(u => !assignees.some(a => a.id === u.id) && u.full_name.toLowerCase().includes(assigneeSearch.toLowerCase()))
                      .slice(0, 8)
                      .map(u => (
                        <button
                          key={u.id}
                          disabled={addingAssignee}
                          onClick={() => addAssignee(u)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-indigo-50 transition-colors text-left"
                        >
                          <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-6 h-6 shrink-0" />
                          <span className="truncate">{u.full_name}</span>
                        </button>
                      ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {assignees.map(a => (
                  <div key={a.id} className="flex items-center gap-2 group">
                    <UserAvatar name={a.full_name} avatarUrl={a.avatar_url} size="sm" className="w-7 h-7 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{a.email}</p>
                    </div>
                    {canManage && assignees.length > 1 && (
                      <button
                        onClick={() => removeAssignee(a.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 shrink-0"
                        title="Remove"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {assignees.length === 0 && <p className="text-sm text-gray-400">No assignees</p>}
              </div>
            </div>

            {/* Watchers */}
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
