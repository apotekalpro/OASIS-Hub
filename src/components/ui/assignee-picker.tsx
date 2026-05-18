'use client'

import { useState } from 'react'
import { Users, User, Shield, Building2, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/avatar'

export type PickerUser = {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  dept_id?: string | null
  role?: string | null
}

type Team = {
  id: string
  name: string
  team_members?: Array<{ user_id: string; profiles?: PickerUser | null }>
}

type Dept = { id: string; name: string }

type Mode = 'person' | 'role' | 'team' | 'dept'

const MODES: { key: Mode; label: string; icon: React.ReactNode }[] = [
  { key: 'person', label: 'Person', icon: <User className="h-3.5 w-3.5" /> },
  { key: 'role', label: 'Role', icon: <Shield className="h-3.5 w-3.5" /> },
  { key: 'team', label: 'Team', icon: <Users className="h-3.5 w-3.5" /> },
  { key: 'dept', label: 'Dept', icon: <Building2 className="h-3.5 w-3.5" /> },
]

interface Props {
  users: PickerUser[]
  teams?: Team[]
  departments?: Dept[]
  selected: PickerUser[]
  excluded?: PickerUser[]
  onChange: (users: PickerUser[]) => void
  placeholder?: string
  pillColor?: 'indigo' | 'amber'
}

export function AssigneePicker({
  users,
  teams = [],
  departments = [],
  selected,
  excluded = [],
  onChange,
  placeholder = 'Search and add assignees...',
  pillColor = 'indigo',
}: Props) {
  const [mode, setMode] = useState<Mode>('person')
  const [search, setSearch] = useState('')

  const pill = pillColor === 'amber'
    ? { bg: 'bg-amber-50', text: 'text-amber-700', x: 'text-amber-300' }
    : { bg: 'bg-indigo-50', text: 'text-indigo-700', x: 'text-indigo-300' }

  const excludedIds = new Set([...selected.map(u => u.id), ...excluded.map(u => u.id)])

  function addUsers(toAdd: PickerUser[]) {
    const newOnes = toAdd.filter(u => !excludedIds.has(u.id))
    if (newOnes.length > 0) onChange([...selected, ...newOnes])
    setSearch('')
  }

  function remove(id: string) {
    onChange(selected.filter(u => u.id !== id))
  }

  // ── Person mode ─────────────────────────────────────────────────────────────
  const filteredUsers = users.filter(
    u => !excludedIds.has(u.id) &&
      (u.full_name.toLowerCase().includes(search.toLowerCase()) ||
       u.email.toLowerCase().includes(search.toLowerCase()))
  )

  // ── Role mode ───────────────────────────────────────────────────────────────
  const uniqueRoles = Array.from(
    new Map(users.filter(u => u.role).map(u => [u.role, u.role!])).values()
  ).sort()

  const filteredRoles = uniqueRoles.filter(r =>
    r.toLowerCase().replace(/_/g, ' ').includes(search.toLowerCase())
  )

  function addByRole(role: string) {
    addUsers(users.filter(u => u.role === role))
  }

  // ── Team mode ───────────────────────────────────────────────────────────────
  const filteredTeams = teams.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  function addTeam(team: Team) {
    const members = (team.team_members ?? [])
      .map(m => m.profiles)
      .filter((p): p is PickerUser => !!p)
    addUsers(members)
  }

  // ── Dept mode ───────────────────────────────────────────────────────────────
  const filteredDepts = departments.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  function addDept(dept: Dept) {
    addUsers(users.filter(u => u.dept_id === dept.id))
  }

  const showDropdown = search.length > 0 || mode !== 'person'

  return (
    <div>
      {/* Selected pills */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map(u => (
            <div key={u.id} className={`flex items-center gap-1.5 ${pill.bg} rounded-full pl-1 pr-2 py-0.5`}>
              <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-5 h-5 text-xs" />
              <span className={`text-xs font-medium ${pill.text}`}>{u.full_name.split(' ')[0]}</span>
              <button type="button" onClick={() => remove(u.id)} className={`${pill.x} hover:text-red-500 text-xs`}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Mode tabs + search */}
      <div className="flex gap-1 mb-1">
        {MODES.map(m => (
          <button
            key={m.key}
            type="button"
            onClick={() => { setMode(m.key); setSearch('') }}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              mode === m.key
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <Input
          placeholder={
            mode === 'person' ? placeholder
            : mode === 'role' ? 'Search roles...'
            : mode === 'team' ? 'Search teams...'
            : 'Search departments...'
          }
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {showDropdown && (
          <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto z-10 relative">
            {mode === 'person' && (
              <>
                {filteredUsers.slice(0, 8).map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => addUsers([u])}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                  >
                    <UserAvatar name={u.full_name} avatarUrl={u.avatar_url} size="sm" className="w-6 h-6 text-xs" />
                    <span>{u.full_name}</span>
                    <span className="text-gray-400 text-xs ml-auto">{u.email}</span>
                  </button>
                ))}
                {filteredUsers.length === 0 && (
                  <p className="px-3 py-2 text-sm text-gray-400">No users found</p>
                )}
              </>
            )}

            {mode === 'role' && (
              <>
                {filteredRoles.map(role => {
                  const count = users.filter(u => u.role === role && !excludedIds.has(u.id)).length
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => addByRole(role)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                    >
                      <Shield className="h-4 w-4 text-indigo-400 shrink-0" />
                      <span className="capitalize">{role.replace(/_/g, ' ')}</span>
                      <span className="text-gray-400 text-xs ml-auto">{count} user{count !== 1 ? 's' : ''}</span>
                      <ChevronDown className="h-3 w-3 text-gray-300 rotate-[-90deg]" />
                    </button>
                  )
                })}
                {filteredRoles.length === 0 && (
                  <p className="px-3 py-2 text-sm text-gray-400">No roles found</p>
                )}
              </>
            )}

            {mode === 'team' && (
              <>
                {filteredTeams.map(team => {
                  const members = (team.team_members ?? [])
                    .map(m => m.profiles).filter((p): p is PickerUser => !!p)
                    .filter(p => !excludedIds.has(p.id))
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => addTeam(team)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                    >
                      <Users className="h-4 w-4 text-indigo-400 shrink-0" />
                      <span>{team.name}</span>
                      <span className="text-gray-400 text-xs ml-auto">{members.length} member{members.length !== 1 ? 's' : ''}</span>
                      <ChevronDown className="h-3 w-3 text-gray-300 rotate-[-90deg]" />
                    </button>
                  )
                })}
                {filteredTeams.length === 0 && (
                  <p className="px-3 py-2 text-sm text-gray-400">No teams found</p>
                )}
              </>
            )}

            {mode === 'dept' && (
              <>
                {filteredDepts.map(dept => {
                  const count = users.filter(u => u.dept_id === dept.id && !excludedIds.has(u.id)).length
                  return (
                    <button
                      key={dept.id}
                      type="button"
                      onClick={() => addDept(dept)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                    >
                      <Building2 className="h-4 w-4 text-indigo-400 shrink-0" />
                      <span>{dept.name}</span>
                      <span className="text-gray-400 text-xs ml-auto">{count} member{count !== 1 ? 's' : ''}</span>
                      <ChevronDown className="h-3 w-3 text-gray-300 rotate-[-90deg]" />
                    </button>
                  )
                })}
                {filteredDepts.length === 0 && (
                  <p className="px-3 py-2 text-sm text-gray-400">No departments found</p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
