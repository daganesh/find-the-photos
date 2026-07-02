import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

type GuardFn = () => void;

const Ctx = createContext<{ guardRef: { current: GuardFn | null } } | null>(null);

/** Wraps the app so any screen can register/consult a "confirm before leaving" guard. */
export function ExitGuardProvider({ children }: { children: ReactNode }) {
  const guardRef = useRef<GuardFn | null>(null);
  return <Ctx.Provider value={{ guardRef }}>{children}</Ctx.Provider>;
}

/**
 * Register `onBlock` as the active exit guard while `active` is true — e.g. a
 * hunt screen registers this while a hunt is in progress. Any navigation UI
 * (AppBar, BottomBar, ...) can then call useTryExitGuard() before navigating
 * so an in-app "Home" tap is caught the same way the browser back button is.
 */
export function useExitGuard(active: boolean, onBlock: GuardFn): void {
  const ctx = useContext(Ctx);
  useEffect(() => {
    if (!ctx || !active) return;
    ctx.guardRef.current = onBlock;
    return () => {
      if (ctx.guardRef.current === onBlock) ctx.guardRef.current = null;
    };
  }, [ctx, active, onBlock]);
}

/**
 * Returns a function to call before programmatic navigation: if a guard is
 * currently registered, it runs the guard (e.g. shows a confirm screen) and
 * returns true — the caller should abort the navigation it was about to do.
 */
export function useTryExitGuard(): () => boolean {
  const ctx = useContext(Ctx);
  return () => {
    if (ctx?.guardRef.current) {
      ctx.guardRef.current();
      return true;
    }
    return false;
  };
}
