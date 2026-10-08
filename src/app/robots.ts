import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lsestudyspot.vercel.app';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/privacy', '/feedback'],
        disallow: ['/z/', '/admin/', '/api/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
