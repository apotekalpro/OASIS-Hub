import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'OASIS Hub',
    short_name: 'OASIS Hub',
    description: 'Internal Team & Task Management System',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#1e1b4b',
    theme_color: '#1e1b4b',
    categories: ['productivity', 'business'],
    icons: [
      // The actual file is 2048x2048 — declare its real size so Chrome validates correctly
      { src: '/oasis-hub-logo.png', sizes: '2048x2048', type: 'image/png', purpose: 'any' },
      { src: '/oasis-hub-logo.png', sizes: '2048x2048', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
