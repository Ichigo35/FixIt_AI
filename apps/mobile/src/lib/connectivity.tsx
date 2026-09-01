import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { netBridge } from '@/api/client';

interface ConnectivityState {
  /** `true` dès qu'un appel réseau échoue ; repasse à `false` au premier succès. */
  offline: boolean;
}

const ConnectivityContext = createContext<ConnectivityState>({ offline: false });

export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [offline, setOffline] = useState(false);
  // Anti-oscillation : il faut 2 échecs consécutifs pour afficher le bandeau.
  const fails = useRef(0);

  useEffect(() => {
    netBridge.report = (online: boolean) => {
      if (online) {
        fails.current = 0;
        setOffline((o) => (o ? false : o));
      } else {
        fails.current += 1;
        if (fails.current >= 2) setOffline((o) => (o ? o : true));
      }
    };
    return () => {
      netBridge.report = () => undefined;
    };
  }, []);

  const value = useMemo(() => ({ offline }), [offline]);
  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}

export function useConnectivity(): ConnectivityState {
  return useContext(ConnectivityContext);
}
