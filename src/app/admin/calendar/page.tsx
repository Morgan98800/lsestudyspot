import { Metadata } from 'next';
import { SpotsRepository } from '@/lib/db/repository';
import { AdminCalendarPanel } from '@/components/AdminCalendarPanel';
import { APP_CONFIG } from '@/lib/config/env';

export const metadata: Metadata = {
  title: 'Academic Calendar & Predictions — LSE Spots Admin',
  description: 'Manage academic terms, reading weeks, and prediction multipliers.',
};

export const dynamic = 'force-dynamic';

export default async function AdminCalendarPage() {
  const [periods, multipliers] = await Promise.all([
    SpotsRepository.getAcademicPeriods(),
    SpotsRepository.getBucketMultipliers(),
  ]);

  return (
    <AdminCalendarPanel
      initialPeriods={periods}
      initialMultipliers={multipliers}
      adminSecret={APP_CONFIG.adminSecret}
    />
  );
}
