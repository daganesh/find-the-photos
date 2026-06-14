import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from '@ftp/shared';
import { api } from '../services/apiClient.js';

interface AuthState {
  user: User | null;
  loading: boolean;
  /** Exchange a Google (or dev) credential for a session. */
  signIn: (credential: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const USER_KEY = 'ftp.user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [loading, setLoading] = useState(false);

  // Keep the stored token and user in sync.
  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  }, [user]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      async signIn(credential) {
        setLoading(true);
        try {
          const { token, user: signed } = await api.signInWithGoogle(credential);
          api.setToken(token);
          setUser(signed);
        } finally {
          setLoading(false);
        }
      },
      signOut() {
        api.setToken(null);
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
