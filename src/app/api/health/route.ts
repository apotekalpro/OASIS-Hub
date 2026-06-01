import { NextResponse } from 'next/server'

// Lightweight keep-alive endpoint. Ping every 5 minutes to prevent serverless cold starts.
// Example: curl https://your-domain.com/api/health
export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() })
}
