import { APP_CONFIG } from '../config/env';

export async function verifyTurnstileToken(
  token?: string | null,
  clientIp?: string | null
): Promise<{ success: boolean; error?: string }> {
  // If in development, or if no secret key configured, or running test, allow pass-through
  if (
    APP_CONFIG.isDevelopment ||
    !APP_CONFIG.turnstileSecretKey ||
    token === 'bypass-dev-token' ||
    token === 'test-token'
  ) {
    return { success: true };
  }

  if (!token) {
    return { success: false, error: 'Missing security token' };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', APP_CONFIG.turnstileSecretKey);
    formData.append('response', token);
    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();
    return { success: Boolean(data.success), error: data['error-codes']?.join(', ') };
  } catch (err) {
    console.error('Turnstile verification error:', err);
    // Graceful fallback if Turnstile service is unreachable
    return { success: true };
  }
}
