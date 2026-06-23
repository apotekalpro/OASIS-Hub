'use client'

import { useState } from 'react'
import { Store, Globe2, MapPin, Building2, Shield, User, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/avatar'

export type PickerOutlet = {
  id: string
  name: string
  code: string | null
  dept_id?: string | null
  area_manager_id?: string | null
}

export type PickerPerson = {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  dept_id?: string | null
  role?: string | null
}

export type ScopeType = 'outlet' | 'all_outlets' | 'area_manager' | 'dept' | 'role' | 'person'

export type PillarTarget =
  | { scopeType: 'outlet' | 'all_outlets' | 'area_manager' | 'dept'; outlet: PickerOutlet }
  | { scopeType: 'role' | 'person'; user: PickerPerson }

type Dept = { id: string; name: string }

type Mode = 'outlet' | 'all_outlets' | 'area_manager' | 'dept' | 'role' | 'person'

const MODES: { key: Mode; label: string; icon: React.ReactNode }[] = [
  { key: 'outlet', label: 'Outlet', icon: <Store className="h-3.5 w-3.5" /> },
  { key: 'all_outlets', label: 'All Outlets', icon: <Globe2 className="h-3.5 w-3.5" /> },
  { key: 'area_manager', label: 'Area Manager', icon: <MapPin className="h-3.5 w-3.5" /> },
  { key: 'dept', label: 'Dept', icon: <Building2 className="h-3.5 w-3.5" /> },
  { key: 'role', label: 'Role', icon: <Shield className="h-3.5 w-3.5" /> },
  { key: 'person', label: 'Person', icon: <User className="h-3.5 w-3.5" /> },
]

function targetKey(t: PillarTarget): string {
  return 'outlet' in t ? `outlet:${t.outlet.id}` : `user:${t.user.id}`
}

interface Props {
  outlets: PickerOutlet[]
  users: PickerPerson[]
  areaManagers: PickerPerson[]
  departments?: Dept[]
  selected: PillarTarget[]
  onChange: (targets: PillarTarget[]) => void
  placeholder?: string
}

export function PillarTargetPicker({
  outlets,
  users,
  areaManagers,
  departments = [],
  selected,
  onChange,
  placeholder = 'Search outlets...',
}: Props) {
  const [mode, setMode] = useState<Mode>('outlet')
  const [search, setSearch] = useState('')

  const selectedKeys = new Set(selected.map(targetKey))

  function addTargets(toAdd: PillarTarget[]) {
    const newOnes = toAdd.filter(t => !selectedKeys.has(targetKey(t)))
    if (newOnes.length > 0) onChange([...selected, ...newOnes])
    setSearch('')
  }

  function remove(key: string) {
    onChange(selected.filter(t => targetKey(t) !== key))
  }

  // ── Outlet mode ──────────────────────────────────────────────────────────
  const filteredOutlets = outlets.filter(o =>
    !selectedKeys.has(`outlet:${o.id}`) &&
    (o.name.toLowerCase().includes(search.toLowerCase()) ||
     (o.code ?? '').toLowerCase().includes(search.toLowerCase()))
  )

  // ── Area Manager mode ───────────────────────────────────────────────────
  const filteredAMs = areaManagers.filter(am =>
    am.full_name.toLowerCase().includes(search.toLowerCase())
  )

  function addByAreaManager(am: PickerPerson) {
    const amOutlets = outlets.filter(o => o.area_manager_id === am.id)
    addTargets(amOutlets.map(o => ({ scopeType: 'area_manager' as const, outlet: o })))
  }

  // ── Dept mode ────────────────────────────────────────────────────────────
  const filteredDepts = departments.filter(d =>
    d.name.toLowerCase().includes(search.toLowerCase())
  )

  function addByDept(dept: Dept) {
    const deptOutlets = outlets.filter(o => o.dept_id === dept.id)
    addTargets(deptOutlets.map(o => ({ scopeType: 'dept' as const, outlet: o })))
  }

  // ── Role mode ────────────────────────────────────────────────────────────
  const uniqueRoles = Array.from(
    new Map(users.filter(u => u.role).map(u => [u.role, u.role!])).values()
  ).sort()

  const filteredRoles = uniqueRoles.filter(r =>
    r.toLowerCase().replace(/_/g, ' ').includes(search.toLowerCase())
  )

  function addByRole(role: string) {
    addTargets(users.filter(u => u.role === role).map(u => ({ scopeType: 'role' as const, user: u })))
  }

  // ── Person mode ──────────────────────────────────────────────────────────
  const filteredUsers = users.filter(
    u => !selectedKeys.has(`user:${u.id}`) &&
      (u.full_name.toLowerCase().includes(search.toLowerCase()) ||
       u.email.toLowerCase().includes(search.toLowerCase()))
  )

  function addAllOutlets() {
    addTargets(outlets.map(o => ({ scopeType: 'all_outlets' as const, outlet: o })))
  }

  const showDropdown = mode === 'all_outlets' || search.length > 0 || mode !== 'outlet'

  return (
    <div>
      {/* Selected pills */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map(t => {
            const key = targetKey(t)
            const label = 'outlet' in t ? t.outlet.name : t.user.full_name
            return (
              <div key={key} className="flex items-center gap-1.5 bg-orange-50 rounded-full pl-2 pr-2 py-0.5">
                {'outlet' in t ? <Store className="h-3 w-3 text-orange-500" /> : <UserAvatar name={t.user.full_name} avatarUrl={t.user.avatar_url} size="sm" className="w-5 h-5 text-xs" />}
                <span className="text-xs font-medium text-orange-700">{label}</span>
                <button type="button" onClick={() => remove(key)} className="text-orange-300 hover:text-red-500 text-xs">×</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Mode tabs + search */}
      <div className="flex flex-wrap gap-1 mb-1">
        {MODES.map(m => (
          <button
            key={m.key}
            type="button"
            onClick={() => { setMode(m.key); setSearch('') }}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              mode === m.key
                ? 'bg-orange-100 text-orange-700'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'all_outlets' ? (
        <button
          type="button"
          onClick={addAllOutlets}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium border border-dashed border-orange-300 rounded-lg text-orange-600 hover:bg-orange-50"
        >
          <Globe2 className="h-4 w-4" />
          Add all {outlets.length} outlets
        </button>
      ) : (
        <div className="relative">
          <Input
            placeholder={
              mode === 'outlet' ? placeholder
              : mode === 'area_manager' ? 'Search area managers...'
              : mode === 'dept' ? 'Search departments...'
              : mode === 'role' ? 'Search roles...'
              : 'Search people...'
            }
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          {showDropdown && (
            <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto z-10 relative">
              {mode === 'outlet' && (
                <>
                  {filteredOutlets.slice(0, 8).map(o => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => addTargets([{ scopeType: 'outlet', outlet: o }])}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                    >
                      <Store className="h-4 w-4 text-orange-400 shrink-0" />
                      <span>{o.name}</span>
                      {o.code && <span className="text-gray-400 text-xs ml-auto">{o.code}</span>}
                    </button>
                  ))}
                  {filteredOutlets.length === 0 && (
                    <p className="px-3 py-2 text-sm text-gray-400">No outlets found</p>
                  )}
                </>
              )}

              {mode === 'area_manager' && (
                <>
                  {filteredAMs.map(am => {
                    const count = outlets.filter(o => o.area_manager_id === am.id).length
                    return (
                      <button
                        key={am.id}
                        type="button"
                        onClick={() => addByAreaManager(am)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                      >
                        <MapPin className="h-4 w-4 text-orange-400 shrink-0" />
                        <span>{am.full_name}</span>
                        <span className="text-gray-400 text-xs ml-auto">{count} outlet{count !== 1 ? 's' : ''}</span>
                        <ChevronDown className="h-3 w-3 text-gray-300 rotate-[-90deg]" />
                      </button>
                    )
                  })}
                  {filteredAMs.length === 0 && (
                    <p className="px-3 py-2 text-sm text-gray-400">No area managers found</p>
                  )}
                </>
              )}

              {mode === 'dept' && (
                <>
                  {filteredDepts.map(dept => {
                    const count = outlets.filter(o => o.dept_id === dept.id).length
                    return (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => addByDept(dept)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                      >
                        <Building2 className="h-4 w-4 text-orange-400 shrink-0" />
                        <span>{dept.name}</span>
                        <span className="text-gray-400 text-xs ml-auto">{count} outlet{count !== 1 ? 's' : ''}</span>
                        <ChevronDown className="h-3 w-3 text-gray-300 rotate-[-90deg]" />
                      </button>
                    )
                  })}
                  {filteredDepts.length === 0 && (
                    <p className="px-3 py-2 text-sm text-gray-400">No departments found</p>
                  )}
                </>
              )}

              {mode === 'role' && (
                <>
                  {filteredRoles.map(role => {
                    const count = users.filter(u => u.role === role).length
                    return (
                      <button
                        key={role}
                        type="button"
                        onClick={() => addByRole(role)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50 text-left"
                      >
                        <Shield className="h-4 w-4 text-orange-400 shrink-0" />
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

              {mode === 'person' && (
                <>
                  {filteredUsers.slice(0, 8).map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => addTargets([{ scopeType: 'person', user: u }])}
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}
