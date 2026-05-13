'use client'

interface BarData {
  label: string
  value: number
  color: string
}

export function BarChart({ data }: { data: BarData[] }) {
  const max = Math.max(...data.map(d => d.value), 1)

  if (data.every(d => d.value === 0)) {
    return <p className="text-sm text-gray-400 text-center py-6">No open tasks</p>
  }

  return (
    <div className="space-y-3">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-14 shrink-0 capitalize">{d.label}</span>
          <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
            <div
              className="h-5 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
              style={{ width: `${Math.max((d.value / max) * 100, d.value > 0 ? 8 : 0)}%`, backgroundColor: d.color }}
            >
              {d.value > 0 && <span className="text-white text-xs font-bold">{d.value}</span>}
            </div>
          </div>
          {d.value === 0 && <span className="text-xs text-gray-300">0</span>}
        </div>
      ))}
    </div>
  )
}
