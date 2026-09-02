import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getMe, type Me } from '@/api/me';
import { useAuth } from '@/auth/AuthProvider';

interface MeState {
  me: Me | null;
  loading: boolean;
  /** Recharge le profil (`/me`) depuis l'API. */
  refresh: () => void;
  /** Rôle administrateur (`ADMIN_EMAILS` côté Worker) : accès illimité + override des STOP. */
  isAdmin: boolean;
  /** Diagnostics illimités (admin, premium, ou quota infini). */
  unlimited: boolean;
}

const MeContext = createContext<MeState | null>(null);

export function MeProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (status !== 'signedIn') {
      setMe(null);
      return;
    }
    let alive = true;
    setLoading(true);
    getMe()
      .then((v) => alive && setMe(v))
      .catch(() => alive && setMe(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo<MeState>(() => {
    const isAdmin = me?.role === 'admin';
    const unlimited =
      !!me && (isAdmin || me.plan === 'premium' || !Number.isFinite(me.quota.limit));
    return { me, loading, refresh, isAdmin, unlimited };
  }, [me, loading, refresh]);

  return <MeContext.Provider value={value}>{children}</MeContext.Provider>;
}

export function useMe(): MeState {
  const ctx = useContext(MeContext);
  if (!ctx) throw new Error('useMe must be used within <MeProvider>');
  return ctx;
}
