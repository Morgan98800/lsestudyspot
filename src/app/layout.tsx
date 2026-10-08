import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import 'leaflet/dist/leaflet.css';
import './globals.css';
import { HeaderBar } from '@/components/HeaderBar';
import { OfflineBanner } from '@/components/OfflineBanner';
import { ServiceWorkerRegister } from '@/components/ServiceWorkerRegister';

const bricolage = Bricolage_Grotesque({
  variable: '--font-heading',
  subsets: ['latin'],
  weight: ['600', '800'],
  display: 'swap',
});

const instrument = Instrument_Sans({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lsestudyspot.vercel.app';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'LSE Spots',
    template: '%s — LSE Spots',
  },
  description: 'See where there are free study seats at LSE right now. Unofficial, student-built.',
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    siteName: 'LSE Spots',
    title: 'LSE Spots',
    description: 'See where there are free study seats at LSE right now. Unofficial, student-built.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LSE Spots',
    description: 'See where there are free study seats at LSE right now. Unofficial, student-built.',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LSE Spots',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#E4002B' },
    { media: '(prefers-color-scheme: dark)', color: '#E4002B' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${instrument.variable} h-full antialiased`}
    >
      <body className="min-h-[100dvh] flex flex-col bg-[var(--bg)] text-[var(--ink)]">
        <ServiceWorkerRegister />
        <HeaderBar />
        <OfflineBanner />
        <main className="flex-1 pb-[calc(96px+env(safe-area-inset-bottom))] has-[[data-page='qr']]:pb-0">{children}</main>
      </body>
    </html>
  );
}
