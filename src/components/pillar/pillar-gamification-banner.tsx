'use client'

import { useEffect, useState } from 'react'
import { Award, TrendingUp, Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { FOCUS_PRODUCT_THRESHOLD_PCT, type RewardBreakdown } from '@/lib/pillar/rewards'

interface Props {
  outletId: string
  month: string
}

function formatIDR(n: number) {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`
}

export function PillarGamificationBanner({ outletId, month }: Props) {
  const [breakdown, setBreakdown] = useState<RewardBreakdown | null>(null)
  const [focusProductPct, setFocusProductPct] = useState(0)
  const [revenue, setRevenue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draftRevenue, setDraftRevenue] = useState('0')
  const [draftFocus, setDraftFocus] = useState('0')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch(`/api/pillar/rewards?outletId=${outletId}&month=${month}`)
      .then(res => res.json())
      .then(data => {
        if (!active) return
        setBreakdown(data.breakdown ?? null)
        setRevenue(data.monthlyInput?.revenue ?? 0)
        setFocusProductPct(data.monthlyInput?.focus_product_pct ?? 0)
        setDraftRevenue(String(data.monthlyInput?.revenue ?? 0))
        setDraftFocus(String(data.monthlyInput?.focus_product_pct ?? 0))
      })
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [outletId, month])

  async function save() {
    setSaving(true)
    const res = await fetch('/api/pillar/monthly-inputs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outletId, month, revenue: Number(draftRevenue) || 0, focusProductPct: Number(draftFocus) || 0 }),
    })
    setSaving(false)
    if (res.ok) {
      toast.success('Monthly figures saved')
      setEditing(false)
      const refreshed = await fetch(`/api/pillar/rewards?outletId=${outletId}&month=${month}`).then(r => r.json())
      setBreakdown(refreshed.breakdown ?? null)
      setRevenue(refreshed.monthlyInput?.revenue ?? 0)
      setFocusProductPct(refreshed.monthlyInput?.focus_product_pct ?? 0)
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Failed to save' }))
      toast.error(error ?? 'Failed to save')
    }
  }

  if (loading) {
    return <div className="rounded-xl bg-gray-100 animate-pulse h-28" />
  }

  const achieved = breakdown?.total.achieved ?? 0
  const potential = breakdown?.total.potential ?? 0
  const gap = Math.max(0, potential - achieved)
  const focusGapPct = Math.max(0, FOCUS_PRODUCT_THRESHOLD_PCT - focusProductPct)

  return (
    <div className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Award className="h-8 w-8 opacity-90 shrink-0" />
          <div>
            <p className="text-sm font-medium opacity-90">Monthly Accumulated Reward</p>
            <p className="text-2xl font-bold">{formatIDR(achieved)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium opacity-90 flex items-center gap-1 justify-end"><TrendingUp className="h-3.5 w-3.5" /> Potential if fully achieved</p>
          <p className="text-xl font-bold">{formatIDR(potential)}</p>
        </div>
      </div>

      {gap > 0 && (
        <p className="text-xs bg-black/15 rounded-lg px-3 py-2 inline-block">
          You&apos;re leaving <span className="font-bold">{formatIDR(gap)}</span> on the table this month — complete your Pillars and hit revenue targets to claim it.
        </p>
      )}
      {focusGapPct > 0 && (
        <p className="text-xs bg-black/15 rounded-lg px-3 py-2 inline-block ml-2">
          Push Focus Product to <span className="font-bold">{FOCUS_PRODUCT_THRESHOLD_PCT}%</span> ({focusGapPct.toFixed(1)}% to go) to unlock an extra <span className="font-bold">30% bonus</span> on Incentive 1 &amp; 2.
        </p>
      )}

      <div className="flex items-center gap-4 text-xs flex-wrap pt-2 border-t border-white/20">
        <span className="opacity-90">Incentive 1: <span className="font-semibold">{formatIDR(breakdown?.incentive1.achieved ?? 0)}</span></span>
        <span className="opacity-90">Incentive 2: <span className="font-semibold">{formatIDR(breakdown?.incentive2.achieved ?? 0)}</span></span>
        <span className="opacity-90">Incentive 3: <span className="font-semibold">{formatIDR(breakdown?.incentive3.achieved ?? 0)}</span></span>

        {!editing ? (
          <button type="button" onClick={() => setEditing(true)} className="ml-auto flex items-center gap-1 bg-white/15 hover:bg-white/25 rounded-md px-2.5 py-1.5 transition-colors">
            <Pencil className="h-3 w-3" /> Revenue Up to Date Rp {revenue.toLocaleString('id-ID')} · Focus Product % Up to Date {focusProductPct}%
          </button>
        ) : (
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5">
              Revenue Up to Date (Rp)
              <input type="number" value={draftRevenue} onChange={e => setDraftRevenue(e.target.value)} className="w-32 rounded-md px-2 py-1 text-gray-900 text-xs" />
            </label>
            <label className="flex items-center gap-1.5">
              Focus Product % Up to Date
              <input type="number" value={draftFocus} onChange={e => setDraftFocus(e.target.value)} className="w-20 rounded-md px-2 py-1 text-gray-900 text-xs" />
            </label>
            <button type="button" onClick={save} disabled={saving} className="flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-md px-2 py-1.5"><Check className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => setEditing(false)} className="flex items-center gap-1 bg-white/10 hover:bg-white/20 rounded-md px-2 py-1.5"><X className="h-3.5 w-3.5" /></button>
          </div>
        )}
      </div>
    </div>
  )
}
