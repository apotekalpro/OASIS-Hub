import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/server'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? process.env.URL ?? 'https://oasishub.netlify.app'

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL ?? 'admin@oasishub.app'}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  process.env.VAPID_PRIVATE_KEY ?? ''
)

// Called by Supabase Database Webhook on notifications INSERT
// Body: { type: 'INSERT', record: { id, user_id, title, body, type, data } }
export async function POST(req: NextRequest) {
  // Verify webhook secret to prevent abuse
  const secret = req.headers.get('x-webhook-secret')
  if (process.env.WEBHOOK_SECRET && secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const record = body.record ?? body

  if (!record?.user_id || !record?.title) {
    return NextResponse.json({ ok: true })
  }

  const admin = createAdminClient()
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', record.user_id)

  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 })

  // Build notification URL from data payload
  const d = (record.data ?? {}) as Record<string, unknown>
  let url = '/'
  if (d.task_id) url = `${APP_URL}/tasks/${d.task_id}`
  else if (d.objective_id) url = `${APP_URL}/okr/${d.objective_id}`
  else if (d.form_id && d.submission_id) url = `${APP_URL}/forms/${d.form_id}/submissions/${d.submission_id}`
  else if (d.form_id) url = `${APP_URL}/forms/${d.form_id}`
  else if (d.assignment_id) url = `${APP_URL}/pillar/${d.assignment_id}`
  else url = `${APP_URL}/notifications`

  const payload = JSON.stringify({
    title: record.title,
    body: record.body ?? '',
    url,
    tag: record.id,
    icon: `${APP_URL}/icon-192.png`,
  })

  const results = await Promise.allSettled(
    subs.map(sub =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      ).catch(async (err: { statusCode?: number }) => {
        // 410 Gone = subscription expired, clean it up
        if (err?.statusCode === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
        throw err
      })
    )
  )

  const sent = results.filter(r => r.status === 'fulfilled').length
  return NextResponse.json({ ok: true, sent, total: subs.length })
}
