'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer, LabelList,
} from 'recharts'

interface Props {
  data: { label: string; value: number; color?: string }[]
  color?: string
  height?: number
  valueLabel?: string
}

export function HorizontalBarChart({ data, color = '#6366f1', height = 220, valueLabel }: Props) {
  if (!data || data.length === 0) {
    return <div className="flex items-center justify-center text-gray-300 text-sm" style={{ height }}>No data</div>
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis
          dataKey="label"
          type="category"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          width={90}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
          formatter={(v) => [Number(v), valueLabel ?? 'Value']}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? color} />
          ))}
          <LabelList dataKey="value" position="right" style={{ fontSize: 11, fill: '#6b7280', fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
