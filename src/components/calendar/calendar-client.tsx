'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { EventFormDialog } from './event-form-dialog'
import { ChevronLeft, ChevronRight, Plus, MapPin, Clock, Users, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { UserAvatar } from '@/components/ui/avatar'

type CalEvent = {
  id: string; title: string; description: string | null; location: string | null
  start_at: string; end_at: string; is_all_day: boolean
  team_id: string | null; dept_id: string | null; created_by: string
  teams?: { name: string; color: string } | null
  event_attendees?: Array<{ user_id: string; rsvp: string }>
}
type OrgUser = { id: string; full_name: string; email: string; avatar_url: string | null }

interface Props {
  initialEvents: CalEvent[]
  orgId: string
  currentUserId: string
  users: OrgUser[]
  teams: Array<{ id: string; name: string; color: string }>
  departments: Array<{ id: string; name: string }>
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const EVENT_COLORS = ['#6366f1','#22c55e','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#14b8a6']

export function CalendarClient({ initialEvents, orgId, currentUserId, users, teams, departments }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [events, setEvents] = useState<CalEvent[]>(initialEvents)
  const [today] = useState(() => new Date())
  const [viewing, setViewing] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [selected, setSelected] = useState<CalEvent | null>(null)
  const [view, setView] = useState<'month' | 'week'>('month')

  const year = viewing.getFullYear()
  const month = viewing.getMonth()

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete last week
  while (cells.length % 7 !== 0) cells.push(null)

  function eventsForDay(day: number) {
    return events.filter(e => {
      const d = new Date(e.start_at)
      return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day
    })
  }

  function isToday(day: number) {
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
  }

  async function handleRsvp(eventId: string, rsvp: 'accepted' | 'declined' | 'tentative') {
    const { error } = await supabase.from('event_attendees').upsert({
      event_id: eventId, user_id: currentUserId, rsvp,
    })
    if (error) toast.error(error.message)
    else {
      setEvents(prev => prev.map(e => {
        if (e.id !== eventId) return e
        const attendees = e.event_attendees?.filter(a => a.user_id !== currentUserId) ?? []
        return { ...e, event_attendees: [...attendees, { user_id: currentUserId, rsvp }] }
      }))
      setSelected(prev => prev?.id === eventId ? {
        ...prev,
        event_attendees: [
          ...(prev.event_attendees?.filter(a => a.user_id !== currentUserId) ?? []),
          { user_id: currentUserId, rsvp },
        ],
      } : prev)
      toast.success(`RSVP: ${rsvp}`)
    }
  }

  async function deleteEvent(id: string) {
    if (!confirm('Delete this event?')) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) toast.error(error.message)
    else {
      setEvents(prev => prev.filter(e => e.id !== id))
      setSelected(null)
      toast.success('Event deleted')
    }
  }

  const myRsvp = (e: CalEvent) => e.event_attendees?.find(a => a.user_id === currentUserId)?.rsvp

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  }
  function formatEventDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  }

  return (
    <div className="flex flex-col h-[calc(100vh-0px)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => { const d = new Date(viewing); d.setMonth(d.getMonth() - 1); setViewing(d) }} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900 w-48 text-center">{MONTHS[month]} {year}</h2>
          <button onClick={() => { const d = new Date(viewing); d.setMonth(d.getMonth() + 1); setViewing(d) }} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
          <Button variant="outline" size="sm" onClick={() => { const d = new Date(); d.setDate(1); setViewing(d) }}>
            Today
          </Button>
        </div>
        <EventFormDialog
          orgId={orgId}
          currentUserId={currentUserId}
          users={users}
          teams={teams}
          departments={departments}
          onCreated={(e) => { setEvents(prev => [...prev, e]); router.refresh() }}
          trigger={<Button size="sm"><Plus className="h-4 w-4" /> New Event</Button>}
        />
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto bg-white">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-100 sticky top-0 bg-white z-10">
          {DAYS.map(d => (
            <div key={d} className="py-2 text-xs font-semibold text-gray-400 text-center uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        <div className="grid grid-cols-7 flex-1">
          {cells.map((day, i) => {
            const dayEvents = day ? eventsForDay(day) : []
            const isTod = day ? isToday(day) : false
            return (
              <div
                key={i}
                className={cn(
                  'min-h-[110px] border-b border-r border-gray-100 p-1.5',
                  !day && 'bg-gray-50/50',
                  isTod && 'bg-indigo-50/30'
                )}
              >
                {day && (
                  <>
                    <span className={cn(
                      'inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium mb-1',
                      isTod ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100 cursor-pointer'
                    )}>
                      {day}
                    </span>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map(e => (
                        <button
                          key={e.id}
                          onClick={() => setSelected(e)}
                          className="w-full text-left rounded px-1.5 py-0.5 text-xs font-medium truncate transition-opacity hover:opacity-80"
                          style={{ backgroundColor: (e.teams?.color ?? EVENT_COLORS[0]) + '20', color: e.teams?.color ?? EVENT_COLORS[0] }}
                        >
                          {e.is_all_day ? '' : formatTime(e.start_at) + ' '}
                          {e.title}
                        </button>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-xs text-gray-400 px-1">+{dayEvents.length - 3} more</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Event detail dialog */}
      <Dialog.Root open={!!selected} onOpenChange={v => { if (!v) setSelected(null) }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/30 z-40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4">
            {selected && (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <Dialog.Title className="text-lg font-bold text-gray-900">{selected.title}</Dialog.Title>
                    {selected.teams?.name && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium mt-1 px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: selected.teams.color }}>
                        {selected.teams.name}
                      </span>
                    )}
                  </div>
                  <Dialog.Close asChild>
                    <button className="text-gray-400 hover:text-gray-600 shrink-0"><X className="h-5 w-5" /></button>
                  </Dialog.Close>
                </div>

                <div className="space-y-2.5 text-sm text-gray-600">
                  <div className="flex items-start gap-2.5">
                    <Clock className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                    <div>
                      <p>{formatEventDate(selected.start_at)}</p>
                      {!selected.is_all_day && (
                        <p className="text-gray-400">{formatTime(selected.start_at)} – {formatTime(selected.end_at)}</p>
                      )}
                      {selected.is_all_day && <p className="text-gray-400">All day</p>}
                    </div>
                  </div>
                  {selected.location && (
                    <div className="flex items-center gap-2.5">
                      <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                      <span>{selected.location}</span>
                    </div>
                  )}
                  {selected.description && (
                    <p className="text-gray-600 text-sm pl-6">{selected.description}</p>
                  )}
                  {(selected.event_attendees?.length ?? 0) > 0 && (
                    <div className="flex items-start gap-2.5">
                      <Users className="h-4 w-4 text-gray-400 shrink-0 mt-0.5" />
                      <div className="flex flex-wrap gap-1">
                        {selected.event_attendees?.map(a => {
                          const u = users.find(u => u.id === a.user_id)
                          return u ? (
                            <div key={a.user_id} className="flex items-center gap-1 bg-gray-100 rounded-full pl-0.5 pr-2 py-0.5">
                              <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-4 h-4 text-xs" />
                              <span className="text-xs text-gray-600">{u.full_name.split(' ')[0]}</span>
                              <span className={cn('text-xs', a.rsvp === 'accepted' ? 'text-green-500' : a.rsvp === 'declined' ? 'text-red-400' : 'text-gray-400')}>
                                {a.rsvp === 'accepted' ? '✓' : a.rsvp === 'declined' ? '✗' : '?'}
                              </span>
                            </div>
                          ) : null
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* RSVP */}
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-2">Your RSVP</p>
                  <div className="flex gap-2">
                    {(['accepted', 'tentative', 'declined'] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => handleRsvp(selected.id, r)}
                        className={cn(
                          'flex-1 py-1.5 rounded-lg text-xs font-medium border capitalize transition-all',
                          myRsvp(selected) === r
                            ? r === 'accepted' ? 'bg-green-600 border-green-600 text-white'
                              : r === 'declined' ? 'bg-red-500 border-red-500 text-white'
                              : 'bg-amber-500 border-amber-500 text-white'
                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {selected.created_by === currentUserId && (
                  <div className="flex justify-between items-center pt-1">
                    <EventFormDialog
                      orgId={orgId}
                      currentUserId={currentUserId}
                      users={users}
                      teams={teams}
                      departments={departments}
                      event={selected}
                      onCreated={(updated) => {
                        setEvents(prev => prev.map(e => e.id === updated.id ? updated : e))
                        setSelected(null)
                      }}
                      trigger={<Button variant="outline" size="sm">Edit</Button>}
                    />
                    <Button variant="destructive" size="sm" onClick={() => deleteEvent(selected.id)}>Delete</Button>
                  </div>
                )}
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
