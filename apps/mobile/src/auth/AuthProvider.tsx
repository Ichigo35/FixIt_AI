import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { authBridge } from '@/api/client';
import { signInWithGoogle as oauthSignInWithGoogle } from './oauth';
import {
  refreshAccessToken,
  signIn as stackSignIn,
  signOutStack,
  signUp as stackSignUp,
  type StackSession,
} from './stackClient';

const KEY = 'fixit.session.v1';

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  session: StackSession | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StackSession | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const sessionRef = useRef<StackSession | null>(null);

  const persist = useCallback(async (next: StackSession | null) => {
    sessionRef.current = next;
    setSession(next);
    setStatus(next ? 'signedIn' : 'signedOut');
    if (next) await SecureStore.setItemAsync(KEY, JSON.stringify(next));
    else await SecureStore.deleteItemAsync(KEY);
  }, []);

  // Restauration au démarrage.
  useEffect(() => {
    (async () => {
      const raw = await SecureStore.getItemAsync(KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as StackSession;
          sessionRef.current = parsed;
          setSession(parsed);
          setStatus('signedIn');
          return;
        } catch {
          /* ignore */
        }
      }
      setStatus('signedOut');
    })();
  }, []);

  // Pont vers le client API.
  useEffect(() => {
    authBridge.getAccessToken = () => sessionRef.current?.accessToken ?? null;
    authBridge.refresh = async () => {
      const current = sessionRef.current;
      if (!current) return null;
      try {
        const accessToken = await refreshAccessToken(current.refreshToken);
        const next = { ...current, accessToken };
        await persist(next);
        return accessToken;
      } catch {
        await persist(null);
        return null;
      }
    };
    authBridge.onSignedOut = () => {
      void persist(null);
    };
  }, [persist]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await persist(await stackSignIn(email, password));
    },
    [persist],
  );

  const signUp = useCallback(
    async (email: string, password: string) => {
      await persist(await stackSignUp(email, password));
    },
    [persist],
  );

  const signInWithGoogle = useCallback(async () => {
    await persist(await oauthSignInWithGoogle());
  }, [persist]);

  const signOut = useCallback(async () => {
    const current = sessionRef.current;
    if (current) await signOutStack(current.refreshToken);
    await persist(null);
  }, [persist]);

  const value = useMemo<AuthState>(
    () => ({ status, session, signIn, signUp, signInWithGoogle, signOut }),
    [status, session, signIn, signUp, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
