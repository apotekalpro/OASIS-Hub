import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { normalizeOutletCode } from '@/lib/pillar/outlet-code'

// Sheet: "(AUTO)Num of Alproean (TOKO)"
// A=branch name, B=num of alproean, C=outlet code
const SHEET_ID = '18QxvJrdARXHuGOeLoqA11x0o4Vy_AIkwdqW0-cgqJMs'
const SHEET_GID = '504062888'

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else { current += ch }
  }
  result.push(current.trim())
  return result
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await supabase.from('profiles').select('org_id, role').eq('id', user.id).single()
  const orgId = profile.data?.org_id as string | null
  const role = profile.data?.role
  if (!['super_admin', 'org_admin', 'dept_head'].includes(role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!orgId) return NextResponse.json({ error: 'No org' }, { status: 400 })

  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`
  let csvText: string
  try {
    const res = await fetch(csvUrl, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`)
    csvText = await res.text()
  } catch (err) {
    return NextResponse.json({ error: `Failed to fetch Google Sheet: ${(err as Error).message}` }, { status: 502 })
  }

  const lines = csvText.split('\n').filter(l => l.trim())
  if (lines.length < 2) return NextResponse.json({ error: 'Sheet appears empty' }, { status: 422 })

  // Parse rows: skip header, collect code→pax
  const paxByCode = new Map<string, number>()
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line)
    const code = cols[2]?.trim()   // column C
    const paxRaw = cols[1]?.trim() // column B
    if (!code || !paxRaw) continue
    const pax = parseInt(paxRaw, 10)
    if (!isNaN(pax) && pax > 0) paxByCode.set(normalizeOutletCode(code), pax)
  }

  if (paxByCode.size === 0) return NextResponse.json({ error: 'No valid pax rows found' }, { status: 422 })

  // Load all outlets for this org
  const admin = createAdminClient()
  const { data: outlets } = await admin.from('outlets').select('id, code').eq('org_id', orgId)
  if (!outlets?.length) return NextResponse.json({ error: 'No outlets found' }, { status: 422 })

  let updated = 0
  let unmatched = 0

  await Promise.all(outlets.map(async o => {
    const pax = paxByCode.get(normalizeOutletCode(o.code))
    if (pax === undefined) { unmatched++; return }
    const { error } = await admin.from('outlets').update({ pax_count: pax }).eq('id', o.id)
    if (!error) updated++
  }))

  return NextResponse.json({ updated, unmatched, total: outlets.length })
}
