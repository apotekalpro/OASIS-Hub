'use client'

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#6b7280',
}

interface Props {
  data: { severity: string; total: number }[]
  height?: number
}

export function SeverityDonut({ data, height = 220 }: Props) {
  const chartData = data.map(d => ({
    name: d.severity.charAt(0).toUpperCase() + d.severity.slice(1),
    value: Number(d.total),
    color: SEVERITY_COLORS[d.severity] ?? '#9ca3af',
  })).filter(d => d.value > 0)

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center text-gray-300 text-sm" style={{ height }}>No issues</div>
  }

  const total = chartData.reduce((s, d) => s + d.value, 0)

  return (
    <div style={{ height }} className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={85}
            dataKey="value"
            strokeWidth={2}
            stroke="#fff"
          >
            {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
            formatter={(v, name) => [`${Number(v)} (${((Number(v) / total) * 100).toFixed(0)}%)`, String(name)]}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      {/* Center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-bold text-gray-900">{total}</span>
        <span className="text-xs text-gray-400">Total</span>
      </div>
    </div>
  )
}
