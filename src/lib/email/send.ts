import { Resend } from 'resend'
import nodemailer from 'nodemailer'
import { google } from 'googleapis'

const FROM_RESEND = process.env.EMAIL_FROM || 'OASIS Hub <noreply@oasishub.app>'
const FROM_GMAIL = process.env.EMAIL_FROM || process.env.GMAIL_USER || 'noreply@example.com'

async function sendViaResend(params: { to: string | string[]; subject: string; html: string }) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: FROM_RESEND,
    to: Array.isArray(params.to) ? params.to : [params.to],
    subject: params.subject,
    html: params.html,
  })
  if (error) throw new Error(error.message)
}

async function sendViaGmail(params: { to: string | string[]; subject: string; html: string }) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  )
  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  const { token: accessToken } = await oauth2Client.getAccessToken()
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      type: 'OAuth2',
      user: process.env.GMAIL_USER,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
      accessToken: accessToken ?? undefined,
    },
  })
  await transport.sendMail({
    from: FROM_GMAIL,
    to: Array.isArray(params.to) ? params.to.join(', ') : params.to,
    subject: params.subject,
    html: params.html,
  })
}

export async function sendEmail(params: {
  to: string | string[]
  subject: string
  html: string
}): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  const hasResend = !!process.env.RESEND_API_KEY
  const hasGmail = !!(process.env.GMAIL_USER && process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN)

  if (!hasResend && !hasGmail) {
    console.log('[Email] Skipped (no email provider configured):', params.subject, '->', params.to)
    return { success: true, skipped: true }
  }

  // Try Resend first (more reliable), fall back to Gmail
  if (hasResend) {
    try {
      await sendViaResend(params)
      return { success: true }
    } catch (err) {
      console.error('[Email] Resend failed, trying Gmail fallback:', err)
      if (!hasGmail) return { success: false, error: (err as Error).message }
    }
  }

  if (hasGmail) {
    try {
      await sendViaGmail(params)
      return { success: true }
    } catch (err) {
      console.error('[Email] Gmail failed:', err)
      return { success: false, error: (err as Error).message }
    }
  }

  return { success: false, error: 'No email provider available' }
}
