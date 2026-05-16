'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AtemForm, type ExistingAtemItem } from './atem-form'
import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowLeft, Calendar, Clock, Tag, Users, Edit2, Send,
  Trash2, CornerDownRight, Smile, X, Eye, UserPlus, Search,
  FileText, Download, Paperclip,
} from 'lucide-react'
import { cn, formatDate, formatRelativeTime } from '@/lib/utils'
import { toast } from 'sonner'
import { createPortal } from 'react-dom'

type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }
type Department = { id: string; name: string }
type Team = { id: string; name: string }

type Attachment = { name: string; url: string; type: 'image' | 'file' }
type Reaction = { emoji: string; count: number; reacted: boolean }

type RawComment = {
  id: string
  content: string
  created_at: string
  updated_at: string
  parent_comment_id: string | null
  attachments: Attachment[]
  atem_id: string
  user_id: string
  profiles: { id: string; full_name: string; avatar_url: string | null } | null
  atem_comment_reactions?: { id: string; emoji: string; user_id: string }[]
}

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

type AtemItem = {
  id: string
  task: string
  deadline: string | null
  deadline_text: string | null
  action_plan: string | null
  impact: string | null
  dependencies: string | null
  strategic_alignment: string | null
  consequences_of_delay: string | null
  estimated_time: number | null
  status: string
  priority: string
  tags: string[]
  created_at: string
  updated_at: string
  created_by: string
  org_id: string
  dept_id: string | null
  team_id: string | null
  departments?: { name: string } | null
  teams?: { name: string } | null
}

interface Props {
  item: AtemItem
  comments: RawComment[]
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

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline'> = {
  pending: 'secondary',
  in_progress: 'default',
  completed: 'success',
  blocked: 'destructive',
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  blocked: 'Blocked',
}

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-blue-400',
  low: 'bg-gray-300',
}

const QUICK_EMOJIS = ['👍', '👎', '❤️', '😄', '😮', '😢', '🎉', '🔥']

function rawToComment(raw: RawComment, currentUserId: string): Comment {
  const reactions: Reaction[] = []
  for (const r of raw.atem_comment_reactions ?? []) {
    const existing = reactions.find(x => x.emoji === r.emoji)
    if (existing) {
      existing.count++
      if (r.user_id === currentUserId) existing.reacted = true
    } else {
      reactions.push({ emoji: r.emoji, count: 1, reacted: r.user_id === currentUserId })
    }
  }
  return {
    id: raw.id,
    content: raw.content,
    created_at: raw.created_at,
    parent_comment_id: raw.parent_comment_id,
    attachments: raw.attachments ?? [],
    user: raw.profiles
      ? { id: raw.profiles.id, full_name: raw.profiles.full_name, avatar_url: raw.profiles.avatar_url }
      : { id: raw.user_id, full_name: 'Unknown', avatar_url: null },
    reactions,
  }
}

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

// ─── Comment content ───────────────────────────────────────────────────────────
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

// ─── Field content renderer ───────────────────────────────────────────────────
function FieldRow({ label, badge, badgeColor, value }: {
  label: string
  badge: string
  badgeColor: string
  value: string | null | undefined
}) {
  if (!value || value === '<p></p>') return null
  const isHtml = value.trimStart().startsWith('<')
  const hasHeader = badge || label
  return (
    <div className="space-y-1">
      {hasHeader && (
        <dt className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase">
          {badge && <span className={cn('rounded px-1.5 py-0.5 text-xs font-bold', badgeColor)}>{badge}</span>}
          {label}
        </dt>
      )}
      {isHtml
        ? <dd className="prose prose-sm max-w-none text-gray-800" dangerouslySetInnerHTML={{ __html: value }} />
        : <dd className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{value}</dd>
      }
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AtemDetailClient({
  item: initialItem,
  comments: initialRawComments,
  assignees: initialAssignees,
  watchers: initialWatchers,
  orgId,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  currentUserRole,
  users,
  departments,
  teams,
}: Props) {
  const router = useRouter()
  const [item, setItem] = useState<AtemItem>(initialItem)
  const [comments, setComments] = useState<Comment[]>(
    initialRawComments.map(r => rawToComment(r, currentUserId))
  )
  const [assigneesList, setAssigneesList] = useState<OrgUser[]>(initialAssignees)
  const [watchersList, setWatchersList] = useState<OrgUser[]>(initialWatchers)

  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [replyTo, setReplyTo] = useState<Comment | null>(null)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [editingStatus, setEditingStatus] = useState(false)
  const [editingPriority, setEditingPriority] = useState(false)
  const [showAddAssignee, setShowAddAssignee] = useState(false)
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [showAddWatcher, setShowAddWatcher] = useState(false)
  const [watcherSearch, setWatcherSearch] = useState('')

  const commentEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const threadedComments = comments
    .filter(c => !c.parent_comment_id)
    .map(c => ({
      ...c,
      replies: comments.filter(r => r.parent_comment_id === c.id),
    }))

  const isOwner = item.created_by === currentUserId
  const isDeptHeadPlus = ['super_admin', 'org_admin', 'dept_head', 'chief', 'lead', 'area_manager', 'team_leader'].includes(currentUserRole)
  const canDelete = isOwner || isDeptHeadPlus
  const canEdit = isOwner || isDeptHeadPlus || assigneesList.some(a => a.id === currentUserId)

  async function updateField(patch: Partial<AtemItem>) {
    const res = await fetch(`/api/atem/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) {
      toast.error('Failed to update')
    } else {
      setItem(prev => ({ ...prev, ...patch }))
    }
  }

  async function handleStatusChange(newStatus: string) {
    await updateField({ status: newStatus })
    setEditingStatus(false)
  }

  async function handlePriorityChange(newPriority: string) {
    await updateField({ priority: newPriority })
    setEditingPriority(false)
  }

  async function handleDeleteItem() {
    if (!confirm('Delete this ATEM item? This cannot be undone.')) return
    const res = await fetch(`/api/atem/${item.id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete'); return }
    toast.success('ATEM item deleted')
    router.push('/atem')
  }

  // ─── Assignees ───────────────────────────────────────────────────────────
  async function addAssignee(u: OrgUser) {
    if (assigneesList.some(a => a.id === u.id)) {
      toast.info(`${u.full_name} is already an assignee`)
      setShowAddAssignee(false)
      return
    }
    const newIds = [...assigneesList.map(a => a.id), u.id]
    const res = await fetch(`/api/atem/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigneeIds: newIds }),
    })
    if (!res.ok) { toast.error((await res.json()).error); return }
    setAssigneesList(prev => [...prev, u])
    toast.success(`${u.full_name} added as assignee`)
    setShowAddAssignee(false)
    setAssigneeSearch('')
  }

  async function removeAssignee(id: string) {
    const newIds = assigneesList.filter(a => a.id !== id).map(a => a.id)
    const res = await fetch(`/api/atem/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assigneeIds: newIds }),
    })
    if (!res.ok) { toast.error((await res.json()).error); return }
    setAssigneesList(prev => prev.filter(a => a.id !== id))
  }

  // ─── Watchers ────────────────────────────────────────────────────────────
  async function addWatcher(u: OrgUser) {
    if (watchersList.some(w => w.id === u.id)) {
      toast.info(`${u.full_name} is already watching`)
      setShowAddWatcher(false)
      return
    }
    const newIds = [...watchersList.map(w => w.id), u.id]
    const res = await fetch(`/api/atem/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watcherIds: newIds }),
    })
    if (!res.ok) { toast.error((await res.json()).error); return }
    setWatchersList(prev => [...prev, u])
    toast.success(`${u.full_name} added as watcher`)
    setShowAddWatcher(false)
    setWatcherSearch('')
  }

  async function removeWatcher(id: string) {
    const newIds = watchersList.filter(w => w.id !== id).map(w => w.id)
    const res = await fetch(`/api/atem/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watcherIds: newIds }),
    })
    if (!res.ok) { toast.error((await res.json()).error); return }
    setWatchersList(prev => prev.filter(w => w.id !== id))
  }

  // ─── Comments ─────────────────────────────────────────────────────────────
  async function uploadFiles(files: File[], itemId: string): Promise<Attachment[]> {
    // For now return empty — storage bucket for ATEM can be configured later
    // Files are shown in pending state but not uploaded without a storage bucket
    const results: Attachment[] = []
    for (const file of files) {
      // Basic data-url fallback isn't suitable for production, just skip
      void file; void itemId
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

    const attachments = pendingFiles.length > 0 ? await uploadFiles(pendingFiles, item.id) : []

    const res = await fetch(`/api/atem/${item.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: commentText.trim(),
        parent_comment_id: replyTo?.id ?? null,
        attachments,
      }),
    })

    if (!res.ok) {
      toast.error((await res.json()).error ?? 'Failed to post comment')
    } else {
      const { comment: raw } = await res.json()
      const newComment: Comment = {
        id: raw.id,
        content: raw.content,
        created_at: raw.created_at,
        parent_comment_id: raw.parent_comment_id,
        attachments: raw.attachments ?? [],
        reactions: [],
        user: raw.profiles
          ? { id: raw.profiles.id, full_name: raw.profiles.full_name, avatar_url: raw.profiles.avatar_url }
          : { id: currentUserId, full_name: currentUserName, avatar_url: currentUserAvatar },
      }
      setComments(prev => {
        if (prev.find(c => c.id === newComment.id)) return prev
        return [...prev, newComment]
      })
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

  async function deleteComment(id: string) {
    const res = await fetch(`/api/atem/${item.id}/comments`, {
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

    // Optimistic update
    setComments(prev => prev.map(c => {
      if (c.id !== commentId) return c
      if (existing?.reacted) {
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

    const res = await fetch(`/api/atem/${item.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'react', commentId, emoji }),
    })
    if (!res.ok) {
      // Revert on failure
      toast.error('Could not react')
      setComments(prev => prev.map(c => {
        if (c.id !== commentId) return c
        // Revert the optimistic update
        if (existing?.reacted) {
          return {
            ...c,
            reactions: existing
              ? c.reactions.map(r => r.emoji !== emoji ? r : { ...r, count: r.count + 1, reacted: true })
              : c.reactions,
          }
        } else {
          return {
            ...c,
            reactions: existing
              ? c.reactions.map(r => r.emoji !== emoji ? r : { ...r, count: r.count - 1, reacted: false }).filter(r => r.count > 0)
              : c.reactions.filter(r => r.emoji !== emoji),
          }
        }
      }))
    }
  }

  const itemAsExisting: ExistingAtemItem = {
    id: item.id,
    task: item.task,
    priority: item.priority,
    status: item.status,
    deadline: item.deadline,
    deadline_text: item.deadline_text,
    action_plan: item.action_plan,
    impact: item.impact,
    dependencies: item.dependencies,
    strategic_alignment: item.strategic_alignment,
    consequences_of_delay: item.consequences_of_delay,
    estimated_time: item.estimated_time,
    dept_id: item.dept_id,
    team_id: item.team_id,
    tags: item.tags,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        {/* Back + actions */}
        <div className="flex items-center justify-between">
          <Link href="/atem" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to ATEM
          </Link>
          <div className="flex items-center gap-2">
            {canDelete && (
              <Button variant="outline" size="sm" onClick={handleDeleteItem} className="text-red-600 hover:bg-red-50 hover:border-red-300">
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            {canEdit && (
              <AtemForm
                orgId={orgId}
                currentUserId={currentUserId}
                users={users}
                departments={departments}
                teams={teams}
                item={itemAsExisting}
                trigger={
                  <Button variant="outline" size="sm">
                    <Edit2 className="h-4 w-4" />
                    Edit
                  </Button>
                }
                onCreated={() => router.refresh()}
              />
            )}
          </div>
        </div>

        {/* ── T: Task ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-indigo-100 text-indigo-700 rounded px-1.5 py-0.5 text-xs font-bold">T</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Task</span>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[item.status] ?? 'secondary'}>{STATUS_LABEL[item.status] ?? item.status}</Badge>
              <span className={cn('inline-flex items-center gap-1 text-xs font-medium capitalize', {
                'text-red-600': item.priority === 'urgent',
                'text-orange-500': item.priority === 'high',
                'text-blue-600': item.priority === 'medium',
                'text-gray-400': item.priority === 'low',
              })}>
                <span className={cn('h-2 w-2 rounded-full', PRIORITY_DOT[item.priority])} />
                {item.priority}
              </span>
            </div>
          </div>
          <div className="prose prose-sm max-w-none text-gray-900 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1" dangerouslySetInnerHTML={{ __html: item.task }} />
          {item.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-gray-100">
              {item.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 px-2.5 py-0.5 text-xs font-medium">
                  <Tag className="h-3 w-3" />{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── D: Deadline ── */}
        {item.deadline_text && item.deadline_text !== '<p></p>' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-orange-100 text-orange-700 rounded px-1.5 py-0.5 text-xs font-bold">D</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Deadline</span>
            </div>
            <FieldRow label="" badge="" badgeColor="" value={item.deadline_text} />
          </div>
        )}

        {/* ── I: Impact ── */}
        {item.impact && item.impact !== '<p></p>' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-green-100 text-green-700 rounded px-1.5 py-0.5 text-xs font-bold">I</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Impact</span>
            </div>
            <FieldRow label="" badge="" badgeColor="" value={item.impact} />
          </div>
        )}

        {/* ── D: Dependencies ── */}
        {item.dependencies && item.dependencies !== '<p></p>' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-yellow-100 text-yellow-700 rounded px-1.5 py-0.5 text-xs font-bold">D</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dependencies</span>
            </div>
            <FieldRow label="" badge="" badgeColor="" value={item.dependencies} />
          </div>
        )}

        {/* ── S: Strategic Alignment ── */}
        {item.strategic_alignment && item.strategic_alignment !== '<p></p>' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-blue-100 text-blue-700 rounded px-1.5 py-0.5 text-xs font-bold">S</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Strategic Alignment</span>
            </div>
            <FieldRow label="" badge="" badgeColor="" value={item.strategic_alignment} />
          </div>
        )}

        {/* ── C: Consequences of Delay ── */}
        {item.consequences_of_delay && item.consequences_of_delay !== '<p></p>' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="bg-red-100 text-red-700 rounded px-1.5 py-0.5 text-xs font-bold">C</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Consequences of Delay</span>
            </div>
            <FieldRow label="" badge="" badgeColor="" value={item.consequences_of_delay} />
          </div>
        )}

        {/* ── E: Estimated Time ── */}
        {item.estimated_time != null && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-purple-100 text-purple-700 rounded px-1.5 py-0.5 text-xs font-bold">E</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Estimated Time</span>
            </div>
            <p className="text-sm text-gray-800 font-medium">{item.estimated_time} day{item.estimated_time !== 1 ? 's' : ''}</p>
          </div>
        )}

        {/* ── Nearest Deadline ── */}
        {item.deadline && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-base">⏰</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nearest Deadline</span>
              <span className="ml-auto text-xs text-gray-400">(for reminder &amp; countdown)</span>
            </div>
            <p className="text-sm text-gray-800 font-medium flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-gray-400" />
              {formatDate(item.deadline)}
            </p>
          </div>
        )}

        {/* ── Action Plan ── */}
        {item.action_plan && item.action_plan !== '<p></p>' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">📋</span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Action Plan</span>
            </div>
            <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: item.action_plan }} />
          </div>
        )}

        {/* ── Details ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Details</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 mb-1">Status</p>
              {editingStatus ? (
                <select
                  autoFocus
                  defaultValue={item.status}
                  onBlur={() => setEditingStatus(false)}
                  onChange={e => handleStatusChange(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="blocked">Blocked</option>
                </select>
              ) : (
                <button onClick={() => setEditingStatus(true)} title="Click to change">
                  <Badge variant={STATUS_VARIANT[item.status] ?? 'secondary'}>{STATUS_LABEL[item.status] ?? item.status}</Badge>
                </button>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Priority</p>
              {editingPriority ? (
                <select
                  autoFocus
                  defaultValue={item.priority}
                  onBlur={() => setEditingPriority(false)}
                  onChange={e => handlePriorityChange(e.target.value)}
                  className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              ) : (
                <button
                  onClick={() => setEditingPriority(true)}
                  className={cn('inline-flex items-center gap-1 capitalize font-medium text-sm', {
                    'text-red-600': item.priority === 'urgent',
                    'text-orange-500': item.priority === 'high',
                    'text-blue-600': item.priority === 'medium',
                    'text-gray-500': item.priority === 'low',
                  })}
                >
                  <span className={cn('h-2 w-2 rounded-full', PRIORITY_DOT[item.priority])} />
                  {item.priority}
                </button>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Created</p>
              <p className="text-sm text-gray-700">{formatDate(item.created_at)}</p>
            </div>
            {item.departments?.name && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Department</p>
                <p className="text-sm text-gray-700 font-medium">{item.departments.name}</p>
              </div>
            )}
            {item.teams?.name && (
              <div>
                <p className="text-xs text-gray-400 mb-1">Team</p>
                <p className="text-sm text-gray-700 font-medium">{item.teams.name}</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Assignees ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <Users className="h-4 w-4" />
              Assignees ({assigneesList.length})
            </h3>
            {canEdit && (
              <button
                onClick={() => { setShowAddAssignee(v => !v); setAssigneeSearch('') }}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add
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
                {users.filter(u => !assigneesList.some(a => a.id === u.id) && u.full_name.toLowerCase().includes(assigneeSearch.toLowerCase())).slice(0, 8).map(u => (
                  <button key={u.id} onClick={() => addAssignee(u)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-indigo-50 transition-colors text-left">
                    <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-6 h-6 shrink-0" />
                    <span className="truncate">{u.full_name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {assigneesList.map(a => (
              <div key={a.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 group">
                <UserAvatar name={a.full_name} avatarUrl={a.avatar_url} size="sm" className="w-8 h-8 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{a.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{a.email}</p>
                </div>
                {canEdit && assigneesList.length > 1 && (
                  <button onClick={() => removeAssignee(a.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 shrink-0" title="Remove">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {assigneesList.length === 0 && <p className="text-sm text-gray-400">No assignees</p>}
          </div>
        </div>

        {/* ── CC / Watchers ── */}
        <div className="bg-amber-50 rounded-xl border border-amber-100 p-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-2">
              <Eye className="h-4 w-4" />
              CC / Watchers ({watchersList.length})
            </h3>
            {canEdit && (
              <button
                onClick={() => { setShowAddWatcher(v => !v); setWatcherSearch('') }}
                className="flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 font-medium"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add
              </button>
            )}
          </div>
          {showAddWatcher && (
            <div className="border border-amber-200 rounded-lg overflow-hidden bg-white">
              <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-amber-100">
                <Search className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search people…"
                  value={watcherSearch}
                  onChange={e => setWatcherSearch(e.target.value)}
                  className="flex-1 text-xs outline-none bg-transparent placeholder-gray-400"
                />
              </div>
              <div className="max-h-40 overflow-y-auto">
                {users.filter(u => !watchersList.some(w => w.id === u.id) && u.full_name.toLowerCase().includes(watcherSearch.toLowerCase())).slice(0, 8).map(u => (
                  <button key={u.id} onClick={() => addWatcher(u)} className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-amber-50 transition-colors text-left">
                    <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-6 h-6 shrink-0" />
                    <span className="truncate">{u.full_name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {watchersList.map(w => (
              <div key={w.id} className="flex items-center gap-2 p-2 rounded-lg bg-amber-50/50 group">
                <UserAvatar name={w.full_name} avatarUrl={w.avatar_url} size="sm" className="w-8 h-8" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">{w.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{w.email}</p>
                </div>
                {canEdit && (
                  <button onClick={() => removeWatcher(w.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-300 hover:text-red-500 shrink-0" title="Remove">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            {watchersList.length === 0 && <p className="text-sm text-amber-600/60">No watchers</p>}
          </div>
        </div>

        {/* ── Comments ── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Comments
              {comments.length > 0 && (
                <span className="ml-2 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5 normal-case font-normal">{comments.length}</span>
              )}
            </h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="space-y-4 max-h-[28rem] overflow-y-auto pr-1">
              {threadedComments.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">No comments yet. Start the conversation!</p>
              )}
              {threadedComments.map(c => (
                <CommentItem key={c.id} comment={c} currentUserId={currentUserId} users={users} onDelete={deleteComment} onReact={handleReact} onReply={setReplyTo} />
              ))}
              <div ref={commentEndRef} />
            </div>
            {replyTo && (
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 text-xs text-indigo-700">
                <CornerDownRight className="h-3 w-3 shrink-0" />
                <span className="flex-1">Replying to <strong>{replyTo.user.full_name}</strong></span>
                <button onClick={() => setReplyTo(null)}><X className="h-3 w-3" /></button>
              </div>
            )}
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="relative group">
                    {f.type.startsWith('image/') ? (
                      <img src={URL.createObjectURL(f)} alt={f.name} className="h-16 w-16 object-cover rounded-lg border border-gray-200" />
                    ) : (
                      <div className="h-16 w-32 flex items-center gap-2 px-2 bg-white rounded-lg border border-gray-200 text-xs text-gray-600 truncate">
                        <FileText className="h-4 w-4 shrink-0 text-gray-400" />{f.name}
                      </div>
                    )}
                    <button onClick={() => removePendingFile(i)} className="absolute -top-1.5 -right-1.5 h-4 w-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <div className="flex gap-2 items-end">
                <UserAvatar name={currentUserName} avatarUrl={currentUserAvatar} size="sm" className="w-8 h-8 shrink-0" />
                <MentionTextarea
                  value={commentText}
                  onChange={setCommentText}
                  onKeyDown={handleCommentKeyDown}
                  onPaste={handlePaste}
                  placeholder={replyTo ? `Reply to ${replyTo.user.full_name}… (@ to mention)` : 'Write a comment… (@ to mention)'}
                  users={users}
                  textareaRef={textareaRef}
                />
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} title="Attach file" className="px-2">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={postComment} loading={submittingComment} disabled={!commentText.trim() && pendingFiles.length === 0}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-gray-400 ml-10">Enter to send · Shift+Enter for new line · @ to mention</p>
            </div>
            <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" onChange={handleFileSelect} />
          </div>
        </div>
      </div>
    </div>
  )
}
