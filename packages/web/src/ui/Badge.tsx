import type { ReactNode } from 'react';

type Tone = 'neutral' | 'coral' | 'accent' | 'success' | 'danger';

const TONE_CLASS: Record<Tone, string> = {
  neutral: '',
  coral: 'badge--coral',
  accent: 'badge--accent',
  success: 'badge--success',
  danger: 'badge--danger',
};

interface BadgeProps {
  tone?: Tone;
  /** Optional leading emoji or icon. */
  icon?: ReactNode;
  children: ReactNode;
}

/** A small rounded chip for status labels, counts, or categories. */
export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  const cls = ['badge', TONE_CLASS[tone]].filter(Boolean).join(' ');
  return (
    <span className={cls}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}
