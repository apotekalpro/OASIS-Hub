import nodemailer from 'nodemailer'
import { google } from 'googleapis'

const FROM = process.env.EMAIL_FROM || process.env.GMAIL_USER || 'noreply@example.com'

async function createGmailTransport() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  )

  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })

  const { token: accessToken } = await oauth2Client.getAccessToken()

  return nodemailer.createTransport({
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
}

export async function sendEmail(params: {
  to: string | string[]
  subject: string
  html: string
}) {
  const hasGmail = process.env.GMAIL_USER && process.env.GMAIL_CLIENT_ID &&
    process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN

  if (!hasGmail) {
    console.log('[Email] Skipped (Gmail API not configured):', params.subject, '->', params.to)
    return { success: true, skipped: true }
  }

  try {
    const transporter = await createGmailTransport()
    await transporter.sendMail({
      from: FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
    })
    return { success: true }
  } catch (error) {
    console.error('[Email] Failed to send:', error)
    return { success: false, error }
  }
}
