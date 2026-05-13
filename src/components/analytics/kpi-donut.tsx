'use client'

import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { cn } from '@/lib/utils'

interface Props {
  value: number      // 0-100 percentage
  label: string
  sublabel?: string
  color?: string
  size?: 'sm' | 'md' | 'lg'
  trend?: 'up' | 'down' | 'neutral'
}

const SIZE = { sm: 120, md: 160, lg: 200 }
const THICKNESS = { sm: 14, md: 18, lg: 22 }

export function KpiDonut({ value, label, sublabel, color = '#6366f1', size = 'md', trend }: Props) {
  const dim = SIZE[size]
  const thickness = THICKNESS[size]
  const safeValue = Math.min(100, Math.max(0, value))
  const data = [
    { v: safeValue },
    { v: 100 - safeValue },
  ]

  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ width: dim, height: dim }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={dim / 2 - thickness - 4}
              outerRadius={dim / 2 - 4}
              startAngle={90}
              endAngle={-270}
              dataKey="v"
              strokeWidth={0}
            >
              <Cell fill={color} />
              <Cell fill="#f3f4f6" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'font-bold tabular-nums',
              size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-2xl' : 'text-lg',
            )}
            style={{ color }}
          >
            {safeValue.toFixed(1)}%
          </span>
          {trend && (
            <span className={cn('text-xs font-medium mt-0.5', trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400')}>
              {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'}
            </span>
          )}
        </div>
      </div>
      <p className="text-sm font-semibold text-gray-700 text-center leading-tight">{label}</p>
      {sublabel && <p className="text-xs text-indigo-600 font-medium cursor-pointer hover:underline">{sublabel}</p>}
    </div>
  )
}
