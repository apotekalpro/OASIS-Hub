'use client'

import { useEffect, useState } from 'react'
import { Award, TrendingUp, Pencil, Check, X, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { FOCUS_PRODUCT_THRESHOLD_PCT, type RewardBreakdown } from '@/lib/pillar/rewards'

interface Props {
  outletIds: string[]
  month: string
}

type OutletRewardData = {
  outletId: string
  outletName: string | null
  breakdown: RewardBreakdown | null
  revenue: number
  focusProductPct: number
}

function formatIDR(n: number) {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`
}

function sumBreakdowns(rows: OutletRewardData[]): RewardBreakdown {
  return rows.reduce<RewardBreakdown>((acc, r) => {
    const b = r.breakdown
    if (!b) return acc
    return {
      incentive1: { achieved: acc.incentive1.achieved + b.incentive1.achieved, potential: acc.incentive1.potential + b.incentive1.potential },
      incentive2: { achieved: acc.incentive2.achieved + b.incentive2.achieved, potential: acc.incentive2.potential + b.incentive2.potential, tierHit: acc.incentive2.tierHit },
      incentive3: { achieved: acc.incentive3.achieved + b.incentive3.achieved, potential: acc.incentive3.potential + b.incentive3.potential },
      total: { achieved: acc.total.achieved + b.total.achieved, potential: acc.total.potential + b.total.potential },
    }
  }, {
    incentive1: { achieved: 0, potential: 0 },
    incentive2: { achieved: 0, potential: 0, tierHit: 0 },
    incentive3: { achieved: 0, potential: 0 },
    total: { achieved: 0, potential: 0 },
  })
}

export function PillarGamificationBanner({ outletIds, month }: Props) {
  const [rows, setRows] = useState<OutletRewardData[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [draftRevenue, setDraftRevenue] = useState('0')
  const [draftFocus, setDraftFocus] = useState('0')
  const [saving, setSaving] = useState(false)

  const isSingleOutlet = outletIds.length === 1
  const outletId = outletIds[0]

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all(
      outletIds.map(id =>
        fetch(`/api/pillar/rewards?outletId=${id}&month=${month}`)
          .then(res => res.json())
          .then(data => ({
            outletId: id,
            outletName: data.outletName ?? null,
            breakdown: data.breakdown ?? null,
            revenue: data.monthlyInput?.revenue ?? 0,
            focusProductPct: data.monthlyInput?.focus_product_pct ?? 0,
          }))
          .catch(() => ({ outletId: id, outletName: null, breakdown: null, revenue: 0, focusProductPct: 0 }))
      )
    ).then(results => {
      if (!active) return
      setRows(results)
      if (results.length === 1) {
        setDraftRevenue(String(results[0].revenue))
        setDraftFocus(String(results[0].focusProductPct))
      }
    }).finally(() => active && setLoading(false))
    return () => { active = false }
  }, [outletIds.join(','), month])

  async function save() {
    if (!outletId) return
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
      setRows([{
        outletId,
        outletName: rows[0]?.outletName ?? null,
        breakdown: refreshed.breakdown ?? null,
        revenue: refreshed.monthlyInput?.revenue ?? 0,
        focusProductPct: refreshed.monthlyInput?.focus_product_pct ?? 0,
      }])
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Failed to save' }))
      toast.error(error ?? 'Failed to save')
    }
  }

  if (loading) {
    return <div className="rounded-xl bg-gray-100 animate-pulse h-28" />
  }

  const breakdown = sumBreakdowns(rows)
  const avgFocusProductPct = rows.length > 0 ? rows.reduce((s, r) => s + r.focusProductPct, 0) / rows.length : 0
  const achieved = breakdown.total.achieved
  const potential = breakdown.total.potential
  const gap = Math.max(0, potential - achieved)
  const focusGapPct = Math.max(0, FOCUS_PRODUCT_THRESHOLD_PCT - avgFocusProductPct)
  const pctOfPotentialLost = potential > 0 ? Math.round((gap / potential) * 100) : 0

  return (
    <div className="rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white p-5 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Award className="h-8 w-8 opacity-90 shrink-0" />
          <div>
            <p className="text-sm font-medium opacity-90">
              Monthly Accumulated Reward{!isSingleOutlet && rows.length > 0 ? ` · ${rows.length} outlets combined` : ''}
            </p>
            <p className="text-2xl font-bold">{formatIDR(achieved)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium opacity-90 flex items-center gap-1 justify-end"><TrendingUp className="h-3.5 w-3.5" /> You could be earning</p>
          <p className="text-xl font-bold">{formatIDR(potential)}</p>
        </div>
      </div>

      {gap > 0 && (
        <p className="text-xs bg-black/20 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Right now you&apos;re about to <span className="font-bold">lose {formatIDR(gap)}</span> ({pctOfPotentialLost}% of what&apos;s on the table) this month.
            Hit your Pillars and revenue targets before month-end to keep it instead of giving it away.
          </span>
        </p>
      )}
      {focusGapPct > 0 && (
        <p className="text-xs bg-black/15 rounded-lg px-3 py-2 inline-block">
          Just <span className="font-bold">{focusGapPct.toFixed(1)}% more</span> Focus Product (to {FOCUS_PRODUCT_THRESHOLD_PCT}%) unlocks an extra <span className="font-bold">30% bonus</span> on Incentive 1 &amp; 2 — don&apos;t leave it unclaimed.
        </p>
      )}

      <div className="flex items-center gap-4 text-xs flex-wrap pt-2 border-t border-white/20">
        <span className="opacity-90">Incentive 1: <span className="font-semibold">{formatIDR(breakdown.incentive1.achieved)}</span></span>
        <span className="opacity-90">Incentive 2: <span className="font-semibold">{formatIDR(breakdown.incentive2.achieved)}</span></span>
        <span className="opacity-90">Incentive 3: <span className="font-semibold">{formatIDR(breakdown.incentive3.achieved)}</span></span>

        {isSingleOutlet && (
          !editing ? (
            <button type="button" onClick={() => setEditing(true)} className="ml-auto flex items-center gap-1 bg-white/15 hover:bg-white/25 rounded-md px-2.5 py-1.5 transition-colors">
              <Pencil className="h-3 w-3" /> Revenue Up to Date Rp {(rows[0]?.revenue ?? 0).toLocaleString('id-ID')} · Focus Product % Up to Date {rows[0]?.focusProductPct ?? 0}%
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
          )
        )}
      </div>

      {!isSingleOutlet && rows.length > 0 && (
        <div className="pt-2 border-t border-white/20 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {rows.map(r => (
            <div key={r.outletId} className="text-xs bg-black/10 rounded-md px-2.5 py-1.5 flex items-center justify-between gap-2">
              <span className="opacity-90 truncate">{r.outletName ?? 'Outlet'}</span>
              <span className="font-semibold">{formatIDR(r.breakdown?.total.achieved ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
