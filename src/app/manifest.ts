import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LSE Spots',
    short_name: 'LSE Spots',
    description: 'See where there are free study seats at LSE right now. Unofficial, student-built.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    background_color: '#E4002B',
    theme_color: '#E4002B',
    orientation: 'portrait',
    lang: 'en-GB',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
