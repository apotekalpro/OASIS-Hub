'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { OrgUser } from './messages-layout'
import { UserAvatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as Dialog from '@radix-ui/react-dialog'
import { Users, X, Search, Plus, Trash2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', org_admin: 'Org Admin', dept_head: 'Dept Head',
  lead: 'Lead', team_leader: 'Team Leader', member: 'Member', auditor: 'Auditor', viewer: 'Viewer',
}

interface Props {
  channelId: string
  channelName: string
  orgUsers: OrgUser[]
  departments: Array<{ id: string; name: string }>
  currentUserId: string
}

type Tab = 'members' | 'add'
type AddMode = 'individual' | 'department' | 'role' | 'all'

export function ChannelMembersDialog({ channelId, channelName, orgUsers, departments, currentUserId }: Props) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('members')
  const [addMode, setAddMode] = useState<AddMode>('individual')
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedDept, setSelectedDept] = useState('')
  const [selectedRole, setSelectedRole] = useState('')

  useEffect(() => {
    if (!open) return
    setLoading(true)
    supabase.from('channel_members').select('user_id').eq('channel_id', channelId)
      .then(({ data }) => {
        setMemberIds(new Set((data ?? []).map(r => r.user_id)))
        setLoading(false)
      })
  }, [open, channelId]) // eslint-disable-line react-hooks/exhaustive-deps

  const members = orgUsers.filter(u => memberIds.has(u.id))
  const nonMembers = orgUsers.filter(u => !memberIds.has(u.id))

  function getCandidates(): OrgUser[] {
    if (addMode === 'all') return nonMembers
    if (addMode === 'department') return nonMembers.filter(u => u.dept_id === selectedDept)
    if (addMode === 'role') return nonMembers.filter(u => u.role === selectedRole)
    // individual — filter by search
    return nonMembers.filter(u =>
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    )
  }

  async function addUsers(users: OrgUser[]) {
    if (users.length === 0) { toast.error('No users to add'); return }
    setSaving(true)
    const rows = users.map(u => ({ channel_id: channelId, user_id: u.id }))
    const { error } = await supabase.from('channel_members').insert(rows)
    if (error) toast.error(error.message)
    else {
      setMemberIds(prev => new Set([...prev, ...users.map(u => u.id)]))
      toast.success(`Added ${users.length} member${users.length > 1 ? 's' : ''}`)
      setSearch('')
    }
    setSaving(false)
  }

  async function removeMember(userId: string) {
    const { error } = await supabase.from('channel_members')
      .delete().eq('channel_id', channelId).eq('user_id', userId)
    if (error) toast.error(error.message)
    else setMemberIds(prev => { const s = new Set(prev); s.delete(userId); return s })
  }

  const candidates = getCandidates()
  const roles = [...new Set(orgUsers.map(u => u.role))].sort()

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors ml-auto shrink-0">
          <Users className="h-4 w-4" />
          <span className="text-xs">{memberIds.size || ''}</span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-white rounded-xl shadow-xl flex flex-col max-h-[80vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            <Dialog.Title className="text-base font-semibold text-gray-900">
              #{channelName} — Members
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </Dialog.Close>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 shrink-0">
            {(['members', 'add'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-2.5 text-sm font-medium capitalize transition-colors',
                  tab === t ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'
                )}
              >
                {t === 'members' ? `Members (${memberIds.size})` : 'Add Members'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === 'members' && (
              <div className="p-4 space-y-1">
                {loading && (
                  <div className="flex justify-center py-8">
                    <div className="h-5 w-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
                  </div>
                )}
                {!loading && members.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">No members yet</p>
                )}
                {members.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 group">
                    <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-8 h-8 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">{ROLE_LABELS[u.role] ?? u.role}</span>
                    {u.id !== currentUserId && (
                      <button
                        onClick={() => removeMember(u.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                        title="Remove from channel"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === 'add' && (
              <div className="p-4 space-y-4">
                {/* Mode selector */}
                <div className="flex gap-1 flex-wrap">
                  {(['individual', 'department', 'role', 'all'] as AddMode[]).map(m => (
                    <button
                      key={m}
                      onClick={() => { setAddMode(m); setSearch(''); setSelectedDept(''); setSelectedRole('') }}
                      className={cn(
                        'px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize',
                        addMode === m ? 'bg-indigo-600 text-white border-indigo-600' : 'text-gray-600 border-gray-200 hover:border-indigo-300'
                      )}
                    >
                      {m === 'all' ? 'All Users' : m === 'individual' ? 'Individual' : m === 'department' ? 'By Department' : 'By Role'}
                    </button>
                  ))}
                </div>

                {addMode === 'individual' && (
                  <>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" autoFocus />
                    </div>
                    <div className="space-y-1 max-h-56 overflow-y-auto">
                      {candidates.map(u => (
                        <div key={u.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50">
                          <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-7 h-7 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{u.full_name}</p>
                            <p className="text-xs text-gray-400 truncate">{u.email}</p>
                          </div>
                          <button
                            onClick={() => addUsers([u])}
                            disabled={saving}
                            className="text-indigo-600 hover:text-indigo-700 shrink-0"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      {candidates.length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-4">
                          {search ? 'No users found' : 'All users are already members'}
                        </p>
                      )}
                    </div>
                  </>
                )}

                {addMode === 'department' && (
                  <>
                    <select
                      value={selectedDept}
                      onChange={e => setSelectedDept(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select a department...</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    {selectedDept && (
                      <>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {candidates.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">All members of this department are already in the channel</p>
                          ) : candidates.map(u => (
                            <div key={u.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                              <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-7 h-7 shrink-0" />
                              <p className="text-sm text-gray-900 flex-1 truncate">{u.full_name}</p>
                            </div>
                          ))}
                        </div>
                        {candidates.length > 0 && (
                          <Button onClick={() => addUsers(candidates)} loading={saving} className="w-full">
                            Add {candidates.length} Member{candidates.length > 1 ? 's' : ''} from Department
                          </Button>
                        )}
                      </>
                    )}
                  </>
                )}

                {addMode === 'role' && (
                  <>
                    <select
                      value={selectedRole}
                      onChange={e => setSelectedRole(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select a role...</option>
                      {roles.map(r => <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>)}
                    </select>
                    {selectedRole && (
                      <>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {candidates.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-4">All users with this role are already in the channel</p>
                          ) : candidates.map(u => (
                            <div key={u.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-gray-50">
                              <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-7 h-7 shrink-0" />
                              <p className="text-sm text-gray-900 flex-1 truncate">{u.full_name}</p>
                            </div>
                          ))}
                        </div>
                        {candidates.length > 0 && (
                          <Button onClick={() => addUsers(candidates)} loading={saving} className="w-full">
                            Add {candidates.length} {ROLE_LABELS[selectedRole] ?? selectedRole}{candidates.length > 1 ? 's' : ''}
                          </Button>
                        )}
                      </>
                    )}
                  </>
                )}

                {addMode === 'all' && (
                  <>
                    {candidates.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">All org members are already in this channel</p>
                    ) : (
                      <>
                        <p className="text-sm text-gray-600">{candidates.length} user{candidates.length > 1 ? 's' : ''} will be added to #{channelName}.</p>
                        <Button onClick={() => addUsers(candidates)} loading={saving} className="w-full">
                          Add All {candidates.length} Users
                        </Button>
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
