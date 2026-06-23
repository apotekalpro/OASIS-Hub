'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Store, Building2, Calendar, Plus, Trash2, Send, CheckSquare, Square } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/avatar'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { cn, formatDate } from '@/lib/utils'

type KeyResult = {
  id: string
  title: string
  description: string | null
  metric_type: string
  start_value: number
  target_value: number
  current_value: number
  unit: string | null
  status: string
  due_date: string | null
}

type Subtask = { id: string; title: string; is_done: boolean }

type Comment = {
  id: string
  content: string
  created_at: string
  user_id: string
  profiles: { full_name: string; avatar_url: string | null } | null
}

type Assignment = {
  id: string
  title: string
  description: string | null
  month: string
  status: string
  progress: number
  outlets: { name: string; code: string | null } | null
  profiles: { id: string; full_name: string; avatar_url: string | null } | null
  departments: { name: string } | null
  assigned_to: string | null
  assigned_by: string
}

interface Props {
  assignment: Assignment
  initialKeyResults: KeyResult[]
  initialSubtasks: Subtask[]
  initialComments: Comment[]
  currentUserId: string
  currentUserName: string
  currentUserAvatar: string | null
  currentUserRole: string
  canDelete?: boolean
}

const STATUS_LABEL: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  at_risk: 'At Risk',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function krProgressPct(kr: KeyResult) {
  if (kr.metric_type === 'boolean') return kr.current_value >= 1 ? 100 : 0
  const range = kr.target_value - kr.start_value
  if (range === 0) return 0
  return Math.min(100, Math.max(0, ((kr.current_value - kr.start_value) / range) * 100))
}

function getProgressColor(pct: number) {
  if (pct >= 100) return 'bg-green-500'
  if (pct >= 70) return 'bg-blue-500'
  if (pct >= 40) return 'bg-amber-500'
  return 'bg-red-400'
}

export function PillarDetailClient({
  assignment, initialKeyResults, initialSubtasks, initialComments, currentUserName, currentUserAvatar, canDelete = false,
}: Props) {
  const router = useRouter()
  const [keyResults, setKeyResults] = useState(initialKeyResults)
  const [subtasks, setSubtasks] = useState(initialSubtasks)
  const [comments, setComments] = useState(initialComments)
  const [newSubtask, setNewSubtask] = useState('')
  const [newComment, setNewComment] = useState('')
  const [posting, setPosting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function deleteAssignment() {
    if (!confirm('Delete this assigned Pillar? This cannot be undone.')) return
    setDeleting(true)
    const res = await fetch(`/api/pillar/assignments/${assignment.id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      toast.success('Pillar deleted')
      router.push('/pillar')
      router.refresh()
    } else {
      toast.error('Failed to delete Pillar')
    }
  }

  async function updateKrValue(krId: string, value: number) {
    setKeyResults(prev => prev.map(kr => kr.id === krId ? { ...kr, current_value: value } : kr))
    const supabase = createClient()
    const { error } = await supabase.from('pillar_assignment_krs').update({ current_value: value }).eq('id', krId)
    if (error) {
      toast.error('Failed to update key result')
    } else {
      router.refresh()
    }
  }

  async function addSubtask() {
    if (!newSubtask.trim()) return
    const res = await fetch(`/api/pillar/assignments/${assignment.id}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newSubtask.trim() }),
    })
    if (res.ok) {
      const { subtask } = await res.json()
      setSubtasks(prev => [...prev, subtask])
      setNewSubtask('')
      router.refresh()
    } else {
      toast.error('Failed to add subtask')
    }
  }

  async function toggleSubtask(s: Subtask) {
    setSubtasks(prev => prev.map(t => t.id === s.id ? { ...t, is_done: !t.is_done } : t))
    const res = await fetch(`/api/pillar/subtasks/${s.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_done: !s.is_done }),
    })
    if (res.ok) router.refresh()
  }

  async function removeSubtask(id: string) {
    setSubtasks(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/pillar/subtasks/${id}`, { method: 'DELETE' })
    router.refresh()
  }

  async function postComment() {
    if (!newComment.trim()) return
    setPosting(true)
    const res = await fetch(`/api/pillar/assignments/${assignment.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newComment.trim(), actorName: currentUserName }),
    })
    setPosting(false)
    if (res.ok) {
      const { comment } = await res.json()
      setComments(prev => [...prev, comment])
      setNewComment('')
    } else {
      toast.error('Failed to post comment')
    }
  }

  const progress = Math.round(Number(assignment.progress))
  const doneSubtasks = subtasks.filter(s => s.is_done).length

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/pillar" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="h-4 w-4" /> Back to Pillars
        </Link>
        {canDelete && (
          <Button type="button" variant="outline" onClick={deleteAssignment} disabled={deleting} className="text-red-500 hover:text-red-600 border-red-200 hover:bg-red-50">
            <Trash2 className="h-4 w-4" /> Delete Pillar
          </Button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <Badge className="mb-2">{STATUS_LABEL[assignment.status] ?? assignment.status}</Badge>
            <h1 className="text-xl font-bold text-gray-900">{assignment.title}</h1>
            {assignment.description && <p className="text-sm text-gray-500 mt-1">{assignment.description}</p>}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-500 flex-wrap">
          {assignment.outlets?.name && (
            <span className="flex items-center gap-1"><Store className="h-4 w-4" />{assignment.outlets.name}</span>
          )}
          {assignment.departments?.name && (
            <span className="flex items-center gap-1"><Building2 className="h-4 w-4" />{assignment.departments.name}</span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            {new Date(assignment.month + 'T00:00:00').toLocaleDateString('en-MY', { month: 'long', year: 'numeric' })}
          </span>
          {assignment.profiles?.full_name && (
            <span className="flex items-center gap-1.5">
              <UserAvatar name={assignment.profiles.full_name} avatarUrl={assignment.profiles.avatar_url} size="sm" className="w-5 h-5 text-xs" />
              {assignment.profiles.full_name}
            </span>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-lg font-bold text-gray-900">{progress}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5">
            <div className={cn('h-2.5 rounded-full transition-all', getProgressColor(progress))} style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Key Results */}
      {keyResults.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Key Results</h2>
          {keyResults.map(kr => {
            const pct = Math.round(krProgressPct(kr))
            return (
              <div key={kr.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{kr.title}</p>
                    {kr.due_date && <p className="text-xs text-gray-400">Due {formatDate(kr.due_date)}</p>}
                  </div>
                  <span className="text-sm font-semibold text-gray-700 shrink-0">{pct}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={cn('h-2 rounded-full', getProgressColor(pct))} style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={kr.start_value}
                    max={kr.target_value}
                    value={kr.current_value}
                    onChange={e => updateKrValue(kr.id, Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-xs text-gray-500 w-24 text-right">
                    {kr.current_value}{kr.unit ? ` ${kr.unit}` : ''} / {kr.target_value}{kr.unit ? ` ${kr.unit}` : ''}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Subtasks */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">Subtasks {subtasks.length > 0 && <span className="text-gray-400 font-normal">({doneSubtasks}/{subtasks.length})</span>}</h2>
        <div className="space-y-1.5">
          {subtasks.map(s => (
            <div key={s.id} className="flex items-center gap-2 group">
              <button type="button" onClick={() => toggleSubtask(s)} className="text-gray-400 hover:text-orange-600">
                {s.is_done ? <CheckSquare className="h-4 w-4 text-orange-600" /> : <Square className="h-4 w-4" />}
              </button>
              <span className={cn('text-sm flex-1', s.is_done && 'line-through text-gray-400')}>{s.title}</span>
              <button type="button" onClick={() => removeSubtask(s.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Add a subtask..."
            value={newSubtask}
            onChange={e => setNewSubtask(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addSubtask() }}
          />
          <Button type="button" variant="outline" onClick={addSubtask}><Plus className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Comments */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">Comments</h2>
        <div className="space-y-3">
          {comments.map(c => (
            <div key={c.id} className="flex gap-2.5">
              <UserAvatar name={c.profiles?.full_name ?? 'Unknown'} avatarUrl={c.profiles?.avatar_url ?? null} size="sm" className="w-7 h-7 text-xs shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-gray-800">{c.profiles?.full_name ?? 'Unknown'}</span>
                  <span className="text-xs text-gray-400">{formatDate(c.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.content}</p>
              </div>
            </div>
          ))}
          {comments.length === 0 && <p className="text-sm text-gray-400">No comments yet.</p>}
        </div>
        <div className="flex gap-2 items-start pt-2 border-t border-gray-100">
          <UserAvatar name={currentUserName} avatarUrl={currentUserAvatar} size="sm" className="w-7 h-7 text-xs shrink-0" />
          <div className="flex-1 flex gap-2">
            <Input
              placeholder="Write a comment..."
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !posting) postComment() }}
            />
            <Button type="button" onClick={postComment} disabled={posting || !newComment.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
