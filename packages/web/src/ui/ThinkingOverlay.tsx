interface ThinkingOverlayProps {
  visible: boolean;
}

/** Full-screen overlay shown while an API guess/response is in flight. */
export function ThinkingOverlay({ visible }: ThinkingOverlayProps) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="Thinking"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'rgba(240, 232, 208, 0.82)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <img
        src="/thinking-fox.png"
        alt=""
        aria-hidden="true"
        style={{
          width: 160,
          height: 'auto',
          filter: 'drop-shadow(0 6px 18px rgba(78,50,110,0.22))',
        }}
      />
      <div style={{
        background: 'rgba(255,255,255,0.95)',
        borderRadius: 20,
        padding: '10px 28px',
        fontWeight: 800,
        fontSize: '1.2rem',
        color: '#2b2440',
        boxShadow: '0 4px 16px rgba(78,50,110,0.15)',
      }}>
        Thinking…
      </div>
    </div>
  );
}
