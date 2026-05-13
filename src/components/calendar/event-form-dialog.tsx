'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/avatar'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, Search } from 'lucide-react'
import { toast } from 'sonner'

type CalEvent = {
  id: string; title: string; description: string | null; location: string | null
  start_at: string; end_at: string; is_all_day: boolean
  team_id: string | null; dept_id: string | null; created_by: string
  teams?: { name: string; color: string } | null
  event_attendees?: Array<{ user_id: string; rsvp: string }>
}
type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }

interface Props {
  orgId: string; currentUserId: string
  users: OrgUser[]
  teams: Array<{ id: string; name: string; color: string }>
  departments: Array<{ id: string; name: string }>
  event?: CalEvent
  onCreated: (e: CalEvent) => void
  trigger?: React.ReactNode
}

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function nextHour() {
  const d = new Date(); d.setMinutes(0,0,0); d.setHours(d.getHours()+1)
  return toLocalInput(d.toISOString())
}
function nextTwoHours() {
  const d = new Date(); d.setMinutes(0,0,0); d.setHours(d.getHours()+2)
  return toLocalInput(d.toISOString())
}

export function EventFormDialog({ orgId, currentUserId, users, teams, departments, event, onCreated, trigger }: Props) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(event?.title ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [startAt, setStartAt] = useState(event ? toLocalInput(event.start_at) : nextHour())
  const [endAt, setEndAt] = useState(event ? toLocalInput(event.end_at) : nextTwoHours())
  const [isAllDay, setIsAllDay] = useState(event?.is_all_day ?? false)
  const [teamId, setTeamId] = useState(event?.team_id ?? '')
  const [deptId, setDeptId] = useState(event?.dept_id ?? '')
  const [attendees, setAttendees] = useState<OrgUser[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [saving, setSaving] = useState(false)

  const filteredUsers = users.filter(u =>
    !attendees.find(a => a.id === u.id) && u.id !== currentUserId &&
    (u.full_name.toLowerCase().includes(userSearch.toLowerCase()) || u.email.toLowerCase().includes(userSearch.toLowerCase()))
  )

  function resetForm() {
    if (!event) {
      setTitle(''); setDescription(''); setLocation(''); setAttendees([])
      setStartAt(nextHour()); setEndAt(nextTwoHours()); setIsAllDay(false)
      setTeamId(''); setDeptId('')
    }
  }

  async function save() {
    if (!title.trim()) { toast.error('Title is required'); return }
    if (!isAllDay && new Date(endAt) <= new Date(startAt)) { toast.error('End time must be after start time'); return }
    setSaving(true)

    const payload = {
      org_id: orgId,
      title: title.trim(),
      description: description.trim() || null,
      location: location.trim() || null,
      start_at: new Date(startAt).toISOString(),
      end_at: isAllDay ? new Date(startAt.split('T')[0] + 'T23:59:59').toISOString() : new Date(endAt).toISOString(),
      is_all_day: isAllDay,
      team_id: teamId || null,
      dept_id: deptId || null,
      created_by: currentUserId,
    }

    let eventId = event?.id
    if (event) {
      const { error } = await supabase.from('events').update(payload).eq('id', event.id)
      if (error) { toast.error(error.message); setSaving(false); return }
    } else {
      const { data, error } = await supabase.from('events').insert(payload).select('id').single()
      if (error) { toast.error(error.message); setSaving(false); return }
      eventId = (data as { id: string }).id

      // Add creator + selected attendees
      const invites = [
        { event_id: eventId, user_id: currentUserId, rsvp: 'accepted' },
        ...attendees.map(a => ({ event_id: eventId, user_id: a.id, rsvp: 'pending' })),
      ]
      const { error: attendeeError } = await supabase.from('event_attendees').insert(invites)
      if (attendeeError) { toast.error(attendeeError.message); setSaving(false); return }
    }

    const teamData = teams.find(t => t.id === teamId)
    const newEvent: CalEvent = {
      ...payload,
      id: eventId!,
      teams: teamData ? { name: teamData.name, color: teamData.color } : null,
      event_attendees: [
        { user_id: currentUserId, rsvp: 'accepted' },
        ...attendees.map(a => ({ user_id: a.id, rsvp: 'pending' })),
      ],
    }

    onCreated(newEvent)
    toast.success(event ? 'Event updated' : 'Event created')
    setOpen(false)
    resetForm()
    setSaving(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm() }}>
      <Dialog.Trigger asChild>{trigger ?? <Button size="sm"><Plus className="h-4 w-4" /> New Event</Button>}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <Dialog.Title className="text-lg font-semibold">{event ? 'Edit Event' : 'New Event'}</Dialog.Title>
            <Dialog.Close asChild><button className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button></Dialog.Close>
          </div>

          <div className="overflow-y-auto flex-1 p-6 space-y-4">
            <Input placeholder="Event title *" value={title} onChange={e => setTitle(e.target.value)} autoFocus />

            <textarea
              rows={2}
              placeholder="Description (optional)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="flex w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />

            <Input placeholder="Location (optional)" value={location} onChange={e => setLocation(e.target.value)} />

            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
              <input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} className="rounded" />
              All day event
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Start</label>
                <Input type={isAllDay ? 'date' : 'datetime-local'} value={isAllDay ? startAt.split('T')[0] : startAt} onChange={e => setStartAt(e.target.value)} />
              </div>
              {!isAllDay && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">End</label>
                  <Input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Team (optional)</label>
                <select value={teamId} onChange={e => setTeamId(e.target.value)} className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">— None —</option>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Department</label>
                <select value={deptId} onChange={e => setDeptId(e.target.value)} className="flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">— None —</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            {!event && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Invite People</label>
                {attendees.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {attendees.map(u => (
                      <div key={u.id} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 rounded-full pl-1 pr-2 py-0.5 text-xs">
                        <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-4 h-4" />
                        {u.full_name.split(' ')[0]}
                        <button onClick={() => setAttendees(prev => prev.filter(a => a.id !== u.id))} className="ml-1 hover:text-red-500">×</button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Search people..." value={userSearch} onChange={e => setUserSearch(e.target.value)} className="pl-9" />
                </div>
                {userSearch && (
                  <div className="mt-1 border border-gray-200 rounded-lg shadow-sm max-h-32 overflow-y-auto bg-white">
                    {filteredUsers.slice(0, 6).map(u => (
                      <button key={u.id} type="button" onClick={() => { setAttendees(prev => [...prev, u]); setUserSearch('') }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left">
                        <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-6 h-6" />
                        <span>{u.full_name}</span>
                        <span className="text-gray-400 text-xs ml-auto">{u.email}</span>
                      </button>
                    ))}
                    {filteredUsers.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">No users found</p>}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
            <Dialog.Close asChild><Button variant="outline">Cancel</Button></Dialog.Close>
            <Button onClick={save} loading={saving} disabled={!title.trim()}>{event ? 'Save Changes' : 'Create Event'}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
