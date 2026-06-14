import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface PageProps {
  title?: string;
  /** Show a back chevron in the bar. */
  onBack?: boolean | (() => void);
  right?: ReactNode;
  children: ReactNode;
}

/** App layout shell: a sticky friendly top bar plus a centered body. */
export function Page({ title, onBack, right, children }: PageProps) {
  const navigate = useNavigate();
  const back = onBack === true ? () => navigate(-1) : typeof onBack === 'function' ? onBack : undefined;

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
