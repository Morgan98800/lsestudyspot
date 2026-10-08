import { Metadata } from 'next';
import { FeedbackForm } from '@/components/FeedbackForm';

export const metadata: Metadata = {
  title: 'Send Feedback',
  description: 'Tell us what is wrong or missing. We read every message.',
  alternates: {
    canonical: '/feedback',
  },
};

interface FeedbackPageProps {
  searchParams?: Promise<{ from?: string }>;
}

export default async function FeedbackPage({ searchParams }: FeedbackPageProps) {
  const sp = searchParams ? await searchParams : {};
  const fromParam = sp.from || null;

  return <FeedbackForm fromParam={fromParam} />;
}
