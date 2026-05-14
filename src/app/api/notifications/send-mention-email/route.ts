import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? 'https://oasishub.netlify.app'

// POST /api/notifications/send-mention-email
// Body: { channelId, channelName, userIds, actorName, preview }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { channelId, channelName, userIds, actorName, preview } = body as {
    channelId: string
    channelName: string
    userIds: string[]
    actorName: string
    preview: string
  }

  if (!userIds?.length) return NextResponse.json({ ok: true })

  const { data: recipients } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds)

  const channelUrl = `${APP_URL}/messages`

  const results = await Promise.allSettled(
    (recipients ?? [])
      .filter(r => r.email && r.id !== user.id)
      .map(r =>
        sendEmail({
          to: r.email,
          subject: `[OASIS Hub] ${actorName} mentioned you in #${channelName}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
              <div style="background:#6366f1;padding:24px;border-radius:8px 8px 0 0">
                <h1 style="color:white;margin:0;font-size:20px">OASIS Hub</h1>
              </div>
              <div style="background:#f9fafb;padding:24px;border-radius:0 0 8px 8px;border:1px solid #e5e7eb">
                <p>Hi <strong>${r.full_name}</strong>,</p>
                <p><strong>${actorName}</strong> mentioned you in <strong>#${channelName}</strong>.</p>
                ${preview ? `
                <div style="background:white;border-left:4px solid #6366f1;padding:12px 16px;margin:16px 0;border-radius:0 8px 8px 0">
                  <p style="margin:0;color:#374151">${preview.slice(0, 300)}</p>
                </div>` : ''}
                <a href="${channelUrl}" style="display:inline-block;background:#6366f1;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
                  Open Messages
                </a>
                <p style="color:#9ca3af;font-size:12px;margin-top:24px">OASIS Hub — Internal Management System</p>
              </div>
            </div>
          `,
        })
      )
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  return NextResponse.json({ sent })
}
