import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthContext.js';
import { hasGoogleSignIn } from '../services/env.js';
import { makeDevCredential, renderGoogleButton } from '../services/googleIdentity.js';
import { Button, Card } from '../ui/index.js';

/**
 * Sign-in gate. Renders the real Google button when configured; otherwise a
 * simple dev form so the app is fully playable without credentials.
 */
export function SignIn() {
  const { signIn, loading } = useAuth();
  const googleSlot = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasGoogleSignIn() || !googleSlot.current) return;
    renderGoogleButton(googleSlot.current, (credential) => {
      signIn(credential).catch(() => setError('Sign-in failed, please try again.'));
    }).catch(() => setError('Could not load Google sign-in.'));
  }, [signIn]);

  async function devSignIn() {
    const display = name.trim() || 'Explorer';
    const email = `${display.toLowerCase().replace(/\s+/g, '.')}@example.com`;
    try {
      await signIn(makeDevCredential(display, email));
    } catch {
      setError('Sign-in failed, please try again.');
    }
  }

  return (
    <div className="page__body" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <Card>
        <div className="stack center">
          <div style={{ fontSize: '3.5rem' }}>📸</div>
          <h1>Find the Photos</h1>
          <p className="muted">A photo treasure hunt for the whole family.</p>

          {hasGoogleSignIn() ? (
            <div ref={googleSlot} style={{ display: 'flex', justifyContent: 'center' }} />
          ) : (
            <div className="stack">
              <label className="field-label" htmlFor="name">
                Your name
              </label>
              <input id="name" value={name} placeholder="e.g. Maya" onChange={(e) => setName(e.target.value)} />
              <Button size="lg" block onClick={devSignIn} disabled={loading}>
                {loading ? 'Starting…' : "Let's play!"}
              </Button>
              <p className="muted" style={{ fontSize: '0.85rem' }}>
                Google sign-in isn't set up here, so we'll use a quick local profile.
              </p>
            </div>
          )}

          {error && <p style={{ color: 'var(--color-danger)' }}>{error}</p>}
        </div>
      </Card>
    </div>
  );
}
