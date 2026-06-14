/** A simple loading spinner. */
export function Spinner({ label }: { label?: string }) {
  return (
    <div className="row center" style={{ justifyContent: 'center', padding: 'var(--space-4)' }}>
      <span className="spinner" role="status" aria-label={label ?? 'Loading'} />
      {label && <span className="muted">{label}</span>}
    </div>
  );
}
