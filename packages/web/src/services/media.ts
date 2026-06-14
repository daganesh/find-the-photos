import { env } from './env.js';

/**
 * Resolve a stored media url (e.g. "/uploads/abc.jpg") to a full URL the
 * browser can load. Absolute URLs pass through unchanged.
 */
export function mediaUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${env.apiBaseUrl}${url}`;
}
