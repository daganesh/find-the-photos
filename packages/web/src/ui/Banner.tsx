import type { ReactNode } from 'react';

type Tone = 'ok' | 'no' | 'info';

/** A friendly inline message banner (success / try-again / info). */
export function Banner({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <div className={`banner banner--${tone} pop-in`}>{children}</div>;
}
