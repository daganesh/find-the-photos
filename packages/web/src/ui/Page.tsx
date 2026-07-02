import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface PageProps {
  title?: ReactNode;
  /** Show a back chevron in the bar. */
  onBack?: boolean | (() => void);
  right?: ReactNode;
  children: ReactNode;
}

/** App layout shell: a sticky friendly top bar plus a centered body. */
export function Page({ title, onBack, right, children }: PageProps) {
  const navigate = useNavigate();
  // If the caller passes `true`, go back in history if possible, otherwise home.
  const back =
    onBack === true
      ? () => (window.history.length > 1 ? navigate(-1) : navigate('/'))
      : typeof onBack === 'function'
        ? onBack
        : undefined;

  return (
    <div className="page">
      {(title || back || right) && (
        <div className="page__bar">
          {back && (
            <button className="btn btn--ghost" onClick={back} aria-label="Go back" style={{ minWidth: 48, padding: 0, width: 48 }}>
              ‹
            </button>
          )}
          {title && <span className="page__bar-title">{title}</span>}
          <span className="page__bar-spacer" />
          {right}
        </div>
      )}
      <main className="page__body">{children}</main>
    </div>
  );
}
