'use client'

import { useState, useMemo } from 'react'
import { Search, Building2, MapPin, Phone, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { OutletManagementClient } from './outlet-management-client'

type OutletRow = {
  id: string
  name: string
  code: string | null
  address: string | null
  city: string | null
  state: string | null
  phone: string | null
  status: string
  created_at: string
  area_manager_id: string | null
  profiles?: { id: string; full_name: string; avatar_url: string | null } | null
  departments?: { name: string } | null
}

type AreaManager = {
  id: string
  full_name: string
  avatar_url: string | null
  email: string
}

interface Props {
  outlets: OutletRow[]
  departments: { id: string; name: string }[]
  users: AreaManager[]
  orgId: string
}

const SELECT_CLS = 'border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white h-10 appearance-none pr-8'

export function OutletFilterClient({ outlets, departments, users, orgId }: Props) {
  const [search, setSearch] = useState('')
  const [amFilter, setAmFilter] = useState('')

  const amOptions = useMemo(() => {
    const seen = new Set<string>()
    const opts: { id: string; name: string }[] = []
    for (const o of outlets) {
      if (o.profiles?.id && !seen.has(o.profiles.id)) {
        seen.add(o.profiles.id)
        opts.push({ id: o.profiles.id, name: o.profiles.full_name })
      }
    }
    return opts.sort((a, b) => a.name.localeCompare(b.name))
  }, [outlets])

  const filtered = useMemo(() => {
    return outlets.filter(o => {
      if (amFilter && o.profiles?.id !== amFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const matches =
          o.name.toLowerCase().includes(q) ||
          (o.code ?? '').toLowerCase().includes(q) ||
          (o.city ?? '').toLowerCase().includes(q) ||
          (o.state ?? '').toLowerCase().includes(q) ||
          (o.address ?? '').toLowerCase().includes(q) ||
          (o.profiles?.full_name ?? '').toLowerCase().includes(q)
        if (!matches) return false
      }
      return true
    })
  }, [outlets, search, amFilter])

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input placeholder="Search by name, code, city, address…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        {amOptions.length > 0 && (
          <div className="relative">
            <select value={amFilter} onChange={e => setAmFilter(e.target.value)} className={cn(SELECT_CLS, amFilter && 'border-orange-400 text-orange-700 bg-orange-50')}>
              <option value="">All Area Managers</option>
              {amOptions.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          </div>
        )}
        {(search || amFilter) && (
          <button onClick={() => { setSearch(''); setAmFilter('') }} className="text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 whitespace-nowrap">
            Clear
          </button>
        )}
      </div>
      <div className="text-xs text-gray-400">{filtered.length} of {outlets.length} outlets</div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Building2 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No outlets match your search</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(outlet => (
            <div key={outlet.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                    <Building2 className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{outlet.name}</p>
                    {outlet.code && <p className="text-xs text-gray-400 font-mono">{outlet.code}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={outlet.status === 'active' ? 'success' : 'secondary'}>{outlet.status}</Badge>
                  <OutletManagementClient orgId={orgId} departments={departments} users={users} outlet={outlet} mode="actions" />
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-gray-500">
                {(outlet.city || outlet.state) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{[outlet.city, outlet.state].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {outlet.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{outlet.phone}</span>
                  </div>
                )}
                {outlet.departments && (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    <span>{outlet.departments.name}</span>
                  </div>
                )}
              </div>

              {outlet.profiles && (
                <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-2">
                  <UserAvatar name={outlet.profiles.full_name} avatarUrl={outlet.profiles.avatar_url} size="sm" />
                  <span className="text-xs text-gray-500">Area Manager: <span className="font-medium text-gray-700">{outlet.profiles.full_name}</span></span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
