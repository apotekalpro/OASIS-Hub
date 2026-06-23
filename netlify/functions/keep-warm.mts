import type { Config } from '@netlify/functions'

// Pings the most-visited dynamic routes every 5 minutes so their Netlify
// serverless functions stay warm — avoids the >10s cold-start delay users
// hit when navigating after the app has been idle.
const PATHS = ['/', '/pillar', '/tasks', '/analytics']

export default async () => {
  const base = process.env.URL ?? process.env.DEPLOY_PRIME_URL
  if (!base) return new Response('No base URL configured', { status: 200 })

  await Promise.all(
    PATHS.map(path =>
      fetch(`${base}${path}`, { headers: { 'x-keep-warm': '1' } }).catch(() => null)
    )
  )

  return new Response('ok', { status: 200 })
}

export const config: Config = {
  schedule: '*/5 * * * *',
}
