import { createHmac } from 'crypto'

const secret = () => process.env.CRON_SECRET ?? 'dev-embed-secret'

// Token format: base64url(orgId).<32-char HMAC hex>
export function generateEmbedToken(orgId: string): string {
  const payload = Buffer.from(orgId).toString('base64url')
  const sig = createHmac('sha256', secret()).update(orgId).digest('hex').slice(0, 32)
  return `${payload}.${sig}`
}

export function verifyEmbedToken(token: string): string | null {
  const dot = token.lastIndexOf('.')
  if (dot === -1) return null
  try {
    const orgId = Buffer.from(token.slice(0, dot), 'base64url').toString('utf8')
    const expected = createHmac('sha256', secret()).update(orgId).digest('hex').slice(0, 32)
    if (token.slice(dot + 1) !== expected) return null
    return orgId
  } catch { return null }
}
