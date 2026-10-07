import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { SpotsRepository } from '@/lib/db/repository';
import { QRReportFlow } from '@/components/QRReportFlow';
import { checkZoneOpen } from '@/lib/algo/estimate';

interface ZonePageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
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
  const { t: token } = await searchParams;

  const zone = await SpotsRepository.getZoneBySlug(slug);

  if (!zone) {
    notFound();
  }

  const isTokenValid = Boolean(token && token === zone.qr_token);
  const openCheck = checkZoneOpen(zone.opening_hours, new Date());

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
