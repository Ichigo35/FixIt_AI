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
import {
  resolveGoogleRedirect,
  signInWithGoogle as oauthSignInWithGoogle,
} from './oauth';
import { isDefinitiveAuthFailure } from './authError';
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
  /** Termine un rebond OAuth reçu en deep link (`fixitai://oauth?...`). */
  completeGoogleRedirect: (url: string) => Promise<void>;
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
      // `getItemAsync` peut lever (déchiffrement impossible après une MAJ / un
      // changement de verrou d'écran) : on ne doit jamais rester bloqué sur
      // 'loading', sinon l'app affiche un spinner infini au lieu de l'écran de login.
      const raw = await SecureStore.getItemAsync(KEY).catch(() => null);
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
      } catch (err) {
        // Ne déconnecter que si le refresh token est réellement invalide/expiré.
        // Une panne réseau ou serveur passagère ne doit pas effacer la session
        // locale : c'était la cause des déconnexions intermittentes.
        if (isDefinitiveAuthFailure(err)) await persist(null);
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

  const completeGoogleRedirect = useCallback(
    async (url: string) => {
      const next = await resolveGoogleRedirect(url);
      if (next) await persist(next);
    },
    [persist],
  );

  const signOut = useCallback(async () => {
    const current = sessionRef.current;
    if (current) await signOutStack(current.refreshToken);
    await persist(null);
  }, [persist]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      session,
      signIn,
      signUp,
      signInWithGoogle,
      completeGoogleRedirect,
      signOut,
    }),
    [status, session, signIn, signUp, signInWithGoogle, completeGoogleRedirect, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
