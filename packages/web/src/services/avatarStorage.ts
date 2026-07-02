/** Per-user avatar choice, persisted client-side so it survives sign-out/in. */

const EMOJI_KEY = (userId: string) => `ftp.avatar.${userId}`;
const COLOR_KEY = (userId: string) => `ftp.avatar.color.${userId}`;
const CARTOON_KEY = (userId: string) => `ftp.avatar.cartoon.${userId}`;

export function getStoredAvatarEmoji(userId: string): string {
  return localStorage.getItem(EMOJI_KEY(userId)) ?? '';
}

export function getStoredAvatarColor(userId: string): string {
  return localStorage.getItem(COLOR_KEY(userId)) ?? '';
}

/** The cartoon avatar data URL, if the user generated and applied one. */
export function getStoredAvatarImage(userId: string): string {
  return localStorage.getItem(CARTOON_KEY(userId)) ?? '';
}

export function saveAvatarEmoji(userId: string, emoji: string): void {
  localStorage.setItem(EMOJI_KEY(userId), emoji);
}

export function saveAvatarColor(userId: string, color: string): void {
  if (color) localStorage.setItem(COLOR_KEY(userId), color);
  else localStorage.removeItem(COLOR_KEY(userId));
}

export function saveAvatarImage(userId: string, dataUrl: string): void {
  if (dataUrl) localStorage.setItem(CARTOON_KEY(userId), dataUrl);
  else localStorage.removeItem(CARTOON_KEY(userId));
}
