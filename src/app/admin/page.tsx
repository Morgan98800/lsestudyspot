import { Metadata } from 'next';
import { SpotsRepository } from '@/lib/db/repository';
import { AdminPanel } from '@/components/AdminPanel';
import { APP_CONFIG } from '@/lib/config/env';

export const metadata: Metadata = {
  title: 'Admin Control Room — LSE Spots',
  description: 'Manage study zones, rotate QR tokens, and inspect usability metrics.',
};

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const zones = await SpotsRepository.getZones(false);

  return <AdminPanel initialZones={zones} adminSecret={APP_CONFIG.adminSecret} />;
}
