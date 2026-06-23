import type { Config } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const SHEET_ID = '1oKBl-ppv5qjsBq8IXj5Q9KPThlSepSG-ocLIdZeS3g0'
const SHEET_GID = '0'

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

export default async function handler() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('[sync-outlets] Missing Supabase env vars')
    return
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  // Get all orgs
  const { data: orgs } = await supabase.from('organizations').select('id')
  if (!orgs?.length) { console.log('[sync-outlets] No organisations found'); return }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`
  let csvText: string
  try {
    const res = await fetch(csvUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    csvText = await res.text()
  } catch (err) {
    console.error('[sync-outlets] Failed to fetch sheet:', err)
    return
  }

  const lines = csvText.split('\n').filter(l => l.trim())
  if (lines.length < 2) { console.warn('[sync-outlets] Sheet appears empty'); return }

  const dataLines = lines.slice(1)
  let totalSynced = 0

  for (const org of orgs) {
    const rows = []
    for (const line of dataLines) {
      const cols = parseCsvLine(line)
      const code = cols[COL.code]?.trim() ?? ''
      const name = cols[COL.name]?.trim() ?? ''
      if (!name || !name.toLowerCase().includes('apotek alpro')) continue
      rows.push({
        org_id: org.id,
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

    if (!rows.length) continue

    const { data, error } = await supabase
      .from('outlets')
      .upsert(rows, { onConflict: 'org_id,code', ignoreDuplicates: false })
      .select('id')

    if (error) {
      console.error(`[sync-outlets] Upsert error for org ${org.id}:`, error.message)
    } else {
      totalSynced += data?.length ?? 0
    }
  }

  console.log(`[sync-outlets] Done — ${totalSynced} outlets synced across ${orgs.length} org(s)`)
}

// 5am WIB = UTC+7 → 22:00 UTC
export const config: Config = {
  schedule: '0 22 * * *',
}
