import { Resend } from 'resend'

const FROM = process.env.EMAIL_FROM || 'noreply@oasishub.internal'

export async function sendEmail(params: {
  to: string | string[]
  subject: string
  html: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.log('[Email] Skipped (no API key):', params.subject, '->', params.to)
    return { success: true, skipped: true }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: params.to,
    subject: params.subject,
    html: params.html,
  })

  if (error) {
    console.error('[Email] Failed to send:', error)
    return { success: false, error }
  }

  return { success: true, id: data?.id }
}
