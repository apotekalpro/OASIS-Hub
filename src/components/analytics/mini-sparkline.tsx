'use client'

interface Dataset {
  values: number[]
  color: string
  label: string
}

interface Props {
  datasets: Dataset[]
  labels?: string[]
  height?: number
}

export function MiniSparkline({ datasets, labels = [], height = 100 }: Props) {
  const allValues = datasets.flatMap(d => d.values)
  const max = Math.max(...allValues, 1)
  const min = 0
  const points = datasets[0]?.values.length ?? 0
  const w = 800
  const h = height
  const padX = 4
  const padY = 8

  if (points === 0) {
    return <div className="flex items-center justify-center text-gray-300 text-sm" style={{ height }}> No data </div>
  }

  function toPath(values: number[]): string {
    return values.map((v, i) => {
      const x = padX + (i / (values.length - 1)) * (w - padX * 2)
      const y = padY + (1 - (v - min) / (max - min)) * (h - padY * 2)
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')
  }

  // X-axis labels — show every ~7th
  const labelStep = Math.ceil(points / 7)
  const shownLabels = labels.filter((_, i) => i % labelStep === 0 || i === points - 1)

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = padY + pct * (h - padY * 2)
          return <line key={pct} x1={padX} y1={y} x2={w - padX} y2={y} stroke="#f3f4f6" strokeWidth="1" />
        })}

        {datasets.map(ds => (
          <g key={ds.label}>
            {/* Area fill */}
            <path
              d={`${toPath(ds.values)} L ${padX + (w - padX * 2)} ${h - padY} L ${padX} ${h - padY} Z`}
              fill={ds.color}
              fillOpacity="0.08"
            />
            {/* Line */}
            <path
              d={toPath(ds.values)}
              fill="none"
              stroke={ds.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Dots for non-zero values */}
            {ds.values.map((v, i) => v > 0 ? (
              <circle
                key={i}
                cx={padX + (i / (ds.values.length - 1)) * (w - padX * 2)}
                cy={padY + (1 - (v - min) / (max - min)) * (h - padY * 2)}
                r="3"
                fill={ds.color}
              />
            ) : null)}
          </g>
        ))}
      </svg>

      {/* X labels */}
      {shownLabels.length > 0 && (
        <div className="flex justify-between mt-1 px-1">
          {shownLabels.map((l, i) => (
            <span key={i} className="text-xs text-gray-300">{l}</span>
          ))}
        </div>
      )}
    </div>
  )
}
