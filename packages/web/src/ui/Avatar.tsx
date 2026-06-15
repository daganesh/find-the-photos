const PALETTE = [
  'var(--avatar-1)', 'var(--avatar-2)', 'var(--avatar-3)',
  'var(--avatar-4)', 'var(--avatar-5)', 'var(--avatar-6)',
];

const SIZES: Record<string, number> = { sm: 36, md: 48, lg: 72, xl: 104 };

function hashIndex(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % PALETTE.length;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '🙂';
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

interface AvatarProps {
  /** Display name — drives initials and deterministic colour. */
  name?: string;
  /** Override with a single emoji (e.g. 🦊). */
  emoji?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  /** Override the background colour. */
  color?: string;
  /** Adds a sunny halo ring. */
  ring?: boolean;
}

/** A cheerful round family avatar — emoji or auto-initials on a happy colour. */
export function Avatar({ name = '', emoji, size = 'md', color, ring = false }: AvatarProps) {
  const px = typeof size === 'number' ? size : (SIZES[size] ?? 48);
  const bg = color ?? PALETTE[hashIndex(name)] ?? 'var(--avatar-1)';
  const cls = ['avatar', ring ? 'avatar--ring' : ''].filter(Boolean).join(' ');

  return (
    <span
      className={cls}
      title={name || undefined}
      aria-label={name || 'avatar'}
      style={{ width: px, height: px, background: bg, fontSize: emoji ? px * 0.52 : px * 0.4 }}
    >
      {emoji ?? initials(name)}
    </span>
  );
}

export interface AvatarPerson {
  name: string;
  emoji?: string;
  color?: string;
}

interface AvatarStackProps {
  people: AvatarPerson[];
  size?: 'sm' | 'md' | 'lg' | 'xl' | number;
  max?: number;
}

/** Overlapping cluster of avatars — e.g. everyone playing the same hunt. */
export function AvatarStack({ people, size = 'md', max = 4 }: AvatarStackProps) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  const px = typeof size === 'number' ? size : (SIZES[size] ?? 48);

  return (
    <span className="avatar-stack">
      {shown.map((p, i) => (
        <Avatar key={i} name={p.name} emoji={p.emoji} color={p.color} size={size} />
      ))}
      {extra > 0 && (
        <span
          className="avatar"
          style={{
            width: px,
            height: px,
            background: 'var(--color-muted)',
            color: 'var(--color-ink)',
            fontSize: px * 0.34,
          }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}
