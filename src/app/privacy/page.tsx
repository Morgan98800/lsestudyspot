import { Metadata } from 'next';
import { PrivacyView } from '@/components/PrivacyView';

export const metadata: Metadata = {
  title: 'Privacy & Your Data',
  description:
    'Plain English privacy notice explaining how LSE Spots protects student privacy under UK GDPR, and how to delete your reports.',
  alternates: {
    canonical: '/privacy',
  },
};

export default function PrivacyPage() {
  return <PrivacyView />;
}
