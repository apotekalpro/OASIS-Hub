'use client'

interface Slice {
  label: string
  value: number
  color: string
}

interface Props {
  data: Slice[]
  total: number
  centerLabel?: string
}

export function DonutChart({ data, total, centerLabel }: Props) {
  const r = 50
  const cx = 60
  const cy = 60
  const strokeW = 18

  if (total === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: 120 }}>
        <p className="text-sm text-gray-300">No data</p>
      </div>
    )
  }

  const circumference = 2 * Math.PI * r
  let offset = 0

  const slices = data.map(d => {
    const pct = d.value / total
    const dash = pct * circumference
    const gap = circumference - dash
    const currentOffset = offset
    offset += dash
    return { ...d, dash, gap, offset: currentOffset }
  })

  return (
    <div className="flex items-center justify-center">
      <svg width={120} height={120} viewBox="0 0 120 120">
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth={strokeW} />

        {slices.map((s, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeW}
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={-(s.offset - circumference / 4)}
            strokeLinecap="butt"
          />
        ))}

        {/* Center text */}
        <text x={cx} y={cy - 6} textAnchor="middle" className="text-gray-900" fontSize="18" fontWeight="700" fill="#111827">
          {total}
        </text>
        {centerLabel && (
          <text x={cx} y={cy + 10} textAnchor="middle" fontSize="9" fill="#9ca3af">
            {centerLabel}
          </text>
        )}
      </svg>
    </div>
  )
}
