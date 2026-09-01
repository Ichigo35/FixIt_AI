import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const KEY = 'fixit.onboarding.v1';

export interface OnboardingSlide {
  icon: string;
  title: string;
  body: string;
}

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    icon: '🔍',
    title: 'Figure out what’s wrong',
    body: 'Snap a photo or describe the problem. FixIt AI gives you the most likely causes — not certainties.',
  },
  {
    icon: '🛠️',
    title: 'Follow a step-by-step guide',
    body: 'When a repair is safe to try yourself, you get a clear guide with tools, parts and a safety note on every step.',
  },
  {
    icon: '🛑',
    title: 'Safety comes first',
    body: 'Anything involving mains power, gas, pressure or vehicle safety systems: FixIt AI stops and tells you to call a professional.',
  },
];

type Status = 'loading' | 'pending' | 'done';

interface OnboardingState {
  status: Status;
  complete: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingState | null>(null);

/** État partagé du parcours d'introduction (une seule source pour toute l'app). */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync(KEY)
      .then((v) => alive && setStatus(v === 'done' ? 'done' : 'pending'))
      .catch(() => alive && setStatus('pending'));
    return () => {
      alive = false;
    };
  }, []);

  const complete = useCallback(async () => {
    setStatus('done');
    try {
      await SecureStore.setItemAsync(KEY, 'done');
    } catch {
      /* non bloquant : au pire l'intro se réaffiche au prochain lancement */
    }
  }, []);

  const value = useMemo<OnboardingState>(() => ({ status, complete }), [status, complete]);
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingState {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within <OnboardingProvider>');
  return ctx;
}
