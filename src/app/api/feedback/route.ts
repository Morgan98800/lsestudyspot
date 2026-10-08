import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SpotsRepository } from '@/lib/db/repository';
import { generateDeviceHash } from '@/lib/anti-spam/device-hash';
import { checkDeviceRateLimit, checkIpRateLimit, hashIp } from '@/lib/anti-spam/ip-rate-limit';
import { verifyTurnstileToken } from '@/lib/anti-spam/turnstile';

const APP_VERSION = '0.1.0';

export function sanitizePagePath(fromRaw?: string | null): string | null {
  if (!fromRaw || typeof fromRaw !== 'string') return null;
  const trimmed = fromRaw.trim();
  // Accept ?from= only as a relative path on this site (starts with "/", no "//"), max 200 characters; otherwise store null. Never redirect to it.
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.length > 200) {
    return null;
  }
  return trimmed;
}

export function stripHtml(str: string): string {
  return str.replace(/<[^>]*>?/gm, '').trim();
}

const feedbackSchema = z.object({
  kind: z.enum(['wrong', 'idea', 'other']),
  message: z.string().trim().min(10, 'Please write at least 10 characters').max(500, 'Please keep under 500 characters'),
  email: z
    .string()
    .trim()
    .email('Please enter a valid email address')
    .optional()
    .nullable()
    .or(z.literal('')),
  from: z.string().optional().nullable(),
  zone: z.string().optional().nullable(),
  zone_slug: z.string().optional().nullable(),
  deviceId: z.string().optional().nullable(),
  client_random_id: z.string().optional().nullable(),
  turnstile_token: z.string().optional().nullable(),
  honeypot: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Honeypot check: reject bots
    if (body.honeypot && String(body.honeypot).trim().length > 0) {
      return NextResponse.json({ error: 'Spam submission detected' }, { status: 400 });
    }

    // 2. Zod validation
    const parsed = feedbackSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: issue?.message || 'Invalid input data' },
        { status: 400 }
      );
    }

    const { kind, message, email, from, zone, zone_slug, client_random_id, deviceId, turnstile_token } = parsed.data;

    // Sanitize message: strip HTML and trim whitespace
    const cleanMessage = stripHtml(message);
    if (cleanMessage.length < 10) {
      return NextResponse.json(
        { error: 'Please write at least 10 characters' },
        { status: 400 }
      );
    }

    // Sanitize page path
    const pagePath = sanitizePagePath(from);

    // Extract or validate zone_slug if coming from a zone
    let finalZoneSlug: string | null = null;
    const rawZone = zone_slug || zone;
    if (rawZone && typeof rawZone === 'string' && rawZone.length <= 100) {
      finalZoneSlug = rawZone.trim();
    } else if (pagePath && pagePath.startsWith('/z/')) {
      const parts = pagePath.replace('/z/', '').split('?')[0].split('/');
      finalZoneSlug = parts[0] || null;
    }

    // Client IP & Turnstile
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
    const turnstileResult = await verifyTurnstileToken(turnstile_token, clientIp);
    if (!turnstileResult.success) {
      return NextResponse.json({ error: 'Security verification failed' }, { status: 400 });
    }

    // 3. Rate limiting:
    // Primary: per device ID (3 per hour per device)
    // Safety ceiling: per IP hash (60 per hour per IP hash)
    const resolvedDeviceId = client_random_id || deviceId || 'anonymous_feedback';
    const deviceHash = generateDeviceHash(resolvedDeviceId, clientIp);
    const ipHash = hashIp(clientIp);

    const deviceLimit = checkDeviceRateLimit(deviceHash, 3, 60 * 60 * 1000);
    if (!deviceLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many feedback submissions from this device. Please try again later.' },
        { status: 429 }
      );
    }

    const ipLimit = checkIpRateLimit(clientIp, 60, 60 * 60 * 1000);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many submissions from this network. Please try again later.' },
        { status: 429 }
      );
    }

    // 4. Save feedback: NEVER store raw IP or user agent
    const newFeedback = await SpotsRepository.createFeedback({
      kind,
      message: cleanMessage,
      email: email && email.trim().length > 0 ? email.trim() : null,
      page_path: pagePath,
      zone_slug: finalZoneSlug,
      app_version: APP_VERSION,
      device_hash: deviceHash,
      ip_hash: ipHash,
    });

    // 5. Optional webhook notification
    // Sends ONLY "New feedback: <kind>" and a link to /admin/feedback.
    // NEVER send message text or email to the webhook.
    const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;
    if (webhookUrl && webhookUrl.trim().length > 0) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://lsestudyspot.vercel.app';
      const notificationText = `New feedback: ${kind} - ${siteUrl}/admin/feedback`;

      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: notificationText }),
      }).catch((err) => {
        console.warn('Feedback webhook notification failed (ignored):', err?.message);
      });
    }

    return NextResponse.json({
      success: true,
      feedbackId: newFeedback.id,
      feedback: newFeedback,
    });
  } catch (error) {
    console.error('Error handling feedback submission:', error);
    return NextResponse.json({ error: 'Failed to process feedback' }, { status: 500 });
  }
}
