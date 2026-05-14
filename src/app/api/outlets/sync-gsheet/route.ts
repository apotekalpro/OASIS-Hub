import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SHEET_ID = '1oKBl-ppv5qjsBq8IXj5Q9KPThlSepSG-ocLIdZeS3g0'
const SHEET_GID = '0'

// Column indices (0-based) from the Digital Master sheet
// B=1 code, C=2 name, D=3 area_manager, H=7 address, J=9 city, K=10 state, L=11 postcode, M=12 phone, N=13 email, AR=43 category
const COL = {
  code: 1,
  name: 2,
  area_manager: 3,
  address: 7,
  city: 9,
  state: 10,
  postcode: 11,
  phone: 12,
  email: 13,
  category: 43,
}

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
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profileRes = await supabase.from('profiles').select('org_id, role').eq('id', user.id).single()
  const orgId = profileRes.data?.org_id
  const role = profileRes.data?.role
  const allowedRoles = ['super_admin', 'org_admin', 'dept_head']
  if (!allowedRoles.includes(role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch sheet as CSV export
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`
  let csvText: string
  try {
    const res = await fetch(csvUrl, { next: { revalidate: 0 } })
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`)
    csvText = await res.text()
  } catch (err) {
    return NextResponse.json({ error: `Failed to fetch Google Sheet: ${(err as Error).message}` }, { status: 502 })
  }

  const lines = csvText.split('\n').filter(l => l.trim())
  if (lines.length < 2) {
    return NextResponse.json({ error: 'Sheet appears empty or inaccessible' }, { status: 422 })
  }

  // Skip header row
  const dataLines = lines.slice(1)

  type UpsertRow = {
    org_id: string
    code: string
    name: string
    area_manager_name: string | null
    address: string | null
    city: string | null
    state: string | null
    postcode: string | null
    phone: string | null
    email: string | null
    category: string | null
    status: string
  }

  const rows: UpsertRow[] = []
  const skipped: number[] = []

  for (let i = 0; i < dataLines.length; i++) {
    const cols = parseCsvLine(dataLines[i])
    const code = cols[COL.code]?.trim() ?? ''
    const name = cols[COL.name]?.trim() ?? ''
    if (!code && !name) { skipped.push(i + 2); continue }
    if (!name) { skipped.push(i + 2); continue }

    rows.push({
      org_id: orgId ?? '',
      code: code || name,
      name,
      area_manager_name: cols[COL.area_manager]?.trim() || null,
      address: cols[COL.address]?.trim() || null,
      city: cols[COL.city]?.trim() || null,
      state: cols[COL.state]?.trim() || null,
      postcode: cols[COL.postcode]?.trim() || null,
      phone: cols[COL.phone]?.trim() || null,
      email: cols[COL.email]?.trim() || null,
      category: cols[COL.category]?.trim() || null,
      status: 'active',
    })
  }

  if (!rows.length) {
    return NextResponse.json({ error: 'No valid rows found in sheet' }, { status: 422 })
  }

  // Upsert by (org_id, code) — need a unique constraint on (org_id, code)
  const { data, error } = await supabase
    .from('outlets')
    .upsert(rows, { onConflict: 'org_id,code', ignoreDuplicates: false })
    .select('id')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    synced: data?.length ?? rows.length,
    skipped: skipped.length,
    total: dataLines.length,
  })
}
