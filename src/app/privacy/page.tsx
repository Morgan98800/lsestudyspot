import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy — LSE Spots',
  description: 'Plain-English privacy policy for LSE Spots under UK GDPR.',
};

export default function PrivacyPage() {
  return (
    <main className="max-w-xl mx-auto px-4 pt-20 pb-12 text-[var(--ink)]">
      <h1 className="text-2xl sm:text-3xl font-extrabold font-heading mb-4">
        Privacy Policy
      </h1>

      <p className="text-sm text-[var(--ink-2)] mb-6 leading-relaxed">
        LSE Spots is designed with privacy by default. We do not track who you are, what device you use, or your location.
      </p>

      <div className="space-y-6 text-sm text-[var(--ink)]">
        <section>
          <h2 className="text-base font-bold font-heading mb-1.5">No accounts or names</h2>
          <p className="text-[var(--ink-2)] leading-relaxed">
            There are no logins, passwords, emails, or names. You never need an account to view or submit occupancy reports.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold font-heading mb-1.5">What we store</h2>
          <p className="text-[var(--ink-2)] leading-relaxed">
            When you report the busyness of a study space, we store only:
          </p>
          <ul className="list-disc pl-5 mt-1.5 text-[var(--ink-2)] space-y-1">
            <li>The study space ID</li>
            <li>The reported level (Plenty of seats, Filling up, or Full)</li>
            <li>The timestamp</li>
            <li>A pseudonymous device hash (used only to prevent rapid duplicate reports)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold font-heading mb-1.5">How rate limiting works</h2>
          <p className="text-[var(--ink-2)] leading-relaxed">
            To prevent spam (maximum 1 report per space per 10 minutes), we compute a one-way salted hash combining a random browser ID and a coarse IP prefix. We never store or log your raw IP address.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold font-heading mb-1.5">Data retention (12 months)</h2>
          <p className="text-[var(--ink-2)] leading-relaxed">
            Raw report logs are automatically purged after 12 months. Only anonymous hourly statistical averages are kept to power predictions.
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold font-heading mb-1.5">No third-party trackers</h2>
          <p className="text-[var(--ink-2)] leading-relaxed">
            We do not use advertising cookies, Meta pixels, or Google Analytics.
          </p>
        </section>
      </div>

      <div className="mt-8 pt-6 border-t border-[var(--line)]">
        <Link
          href="/"
          className="text-xs font-semibold text-[var(--brand)] hover:underline"
        >
          &larr; Back to free spaces
        </Link>
      </div>
    </main>
  );
}
