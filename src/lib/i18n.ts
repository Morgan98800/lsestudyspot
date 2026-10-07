import enMessages from '@/messages/en.json';

type Messages = typeof enMessages;

/**
 * Access a nested string key in the copy deck with optional parameter interpolation.
 * Example: t('home.walkTime', { minutes: 4 }) -> "4 min walk"
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const parts = key.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = enMessages;

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return key; // Fallback to key itself if not found
    }
  }

  if (typeof current !== 'string') {
    return key;
  }

  if (params) {
    return Object.entries(params).reduce((str, [paramKey, paramVal]) => {
      return str.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
    }, current);
  }

  return current;
}

export function getMessages(): Messages {
  return enMessages;
}
