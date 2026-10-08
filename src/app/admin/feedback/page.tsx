import { Metadata } from 'next';
import { SpotsRepository } from '@/lib/db/repository';
import { AdminFeedbackPanel } from '@/components/AdminFeedbackPanel';
import { APP_CONFIG } from '@/lib/config/env';

export const metadata: Metadata = {
  title: 'User Feedback — LSE Spots Admin',
  description: 'Manage and review student feedback, ideas, and bug reports.',
};

export const dynamic = 'force-dynamic';

export default async function AdminFeedbackPage() {
  const feedbacks = await SpotsRepository.getFeedbackList();

  return (
    <AdminFeedbackPanel
      initialFeedbacks={feedbacks}
      adminSecret={APP_CONFIG.adminSecret}
    />
  );
}
