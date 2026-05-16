import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow, isToday, isTomorrow, isPast } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, fmt = 'MMM d, yyyy') {
  return format(new Date(date), fmt)
}

export function formatRelativeTime(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatDueDate(date: string | null) {
  if (!date) return null
  const d = new Date(date)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  if (isPast(d)) return `Overdue · ${format(d, 'MMM d')}`
  return format(d, 'MMM d, yyyy')
}

export function isDueSoon(date: string | null, hoursThreshold = 72) {
  if (!date) return false
  const diff = new Date(date).getTime() - Date.now()
  return diff > 0 && diff <= hoursThreshold * 60 * 60 * 1000
}

export function isOverdue(date: string | null) {
  if (!date) return false
  return isPast(new Date(date))
}

export type DueStatus = {
  label: string
  badge: string | null
  color: 'red' | 'orange' | 'yellow' | 'gray'
  urgent: boolean
}

export function getDueStatus(due_date: string | null): DueStatus | null {
  if (!due_date) return null
  const now = new Date()
  const due = new Date(due_date)
  const diffMs = due.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / 86400000)

  if (diffMs < 0) {
    const days = Math.abs(Math.floor(diffMs / 86400000))
    return { label: days === 0 ? 'Due today' : `${days}d overdue`, badge: 'OVERDUE', color: 'red', urgent: true }
  }
  if (diffDays === 0) return { label: 'Due today', badge: 'DUE TODAY', color: 'orange', urgent: true }
  if (diffDays === 1) return { label: '1 day left', badge: 'DUE SOON', color: 'orange', urgent: true }
  if (diffDays <= 3) return { label: `${diffDays} days left`, badge: 'DUE SOON', color: 'orange', urgent: true }
  if (diffDays <= 7) return { label: `${diffDays} days left`, badge: 'DUE SOON', color: 'yellow', urgent: false }
  return { label: `${diffDays} days left`, badge: null, color: 'gray', urgent: false }
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function parseCSV(text: string): Record<string, string>[] {
  // Proper RFC-4180 parser — handles commas inside quoted fields
  function parseLine(line: string): string[] {
    const fields: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        fields.push(cur.trim())
        cur = ''
      } else {
        cur += ch
      }
    }
    fields.push(cur.trim())
    return fields
  }

  const lines = text.trim().split('\n').filter(l => l.trim())
  const headers = parseLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

export function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}
