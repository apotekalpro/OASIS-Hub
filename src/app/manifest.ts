import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OASIS Hub',
    short_name: 'OASIS Hub',
    description: 'Internal Team & Task Management System',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#1e1b4b',
    theme_color: '#1e1b4b',
    icons: [
      {
        src: '/oasis-hub-logo.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/oasis-hub-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
