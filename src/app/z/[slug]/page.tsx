import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SpotsRepository } from '@/lib/db/repository';
import { QRReportFlow } from '@/components/QRReportFlow';
import { checkZoneOpen } from '@/lib/algo/estimate';

interface ZonePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string; now?: string }>;
}

export async function generateMetadata({ params }: ZonePageProps): Promise<Metadata> {
  const { slug } = await params;
  const zone = await SpotsRepository.getZoneBySlug(slug);

  if (!zone) {
    return { title: 'Space Not Found — LSE Spots' };
  }

  return {
    title: `Report: ${zone.name} — LSE Spots`,
    description: `Report study seat availability at ${zone.name} in 3 seconds.`,
  };
}

export default async function ZonePage({ params, searchParams }: ZonePageProps) {
  const { slug } = await params;
  const { t: token, now: nowParam } = await searchParams;
  const cookieStore = await cookies();
  const cookieNow = cookieStore.get('mock_now')?.value;

  const [zone, exceptions] = await Promise.all([
    SpotsRepository.getZoneBySlug(slug),
    SpotsRepository.getOpeningExceptions(),
  ]);

  if (!zone) {
    notFound();
  }

  const now = nowParam
    ? new Date(nowParam)
    : cookieNow
    ? new Date(cookieNow)
    : process.env.PLAYWRIGHT_TEST_TIME
    ? new Date(process.env.PLAYWRIGHT_TEST_TIME)
    : new Date();

  const isTokenValid = Boolean(token && token === zone.qr_token);
  const openCheck = checkZoneOpen(zone.opening_hours, now, exceptions);

  return (
    <QRReportFlow
      zone={zone}
      token={token || ''}
      isTokenValid={isTokenValid}
      isZoneClosed={!openCheck.isOpen}
      opensAt={openCheck.opensAt}
    />
  );
}
