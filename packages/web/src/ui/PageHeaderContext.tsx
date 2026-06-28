import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type PageHeaderState = { title: string; onBack: (() => void) | null } | null;

const Ctx = createContext<{
  header: PageHeaderState;
  setHeader: (h: PageHeaderState) => void;
}>({ header: null, setHeader: () => {} });

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeader] = useState<PageHeaderState>(null);
  return <Ctx.Provider value={{ header, setHeader }}>{children}</Ctx.Provider>;
}

export function usePageHeader() {
  return useContext(Ctx).header;
}

export function useSetPageHeader(title: string, onBack?: () => void) {
  const { setHeader } = useContext(Ctx);
  useEffect(() => {
    setHeader({ title, onBack: onBack ?? null });
    return () => setHeader(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title]);
}
