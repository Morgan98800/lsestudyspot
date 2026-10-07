import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
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

export const metadata: Metadata = {
  title: 'LSE Spots',
  description: 'See where study seats are available right now at LSE.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/icon-192.svg',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'LSE Spots',
  },
};

export const viewport: Viewport = {
  themeColor: '#E4002B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
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
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--ink)]">
        <ServiceWorkerRegister />
        <HeaderBar />
        <OfflineBanner />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
