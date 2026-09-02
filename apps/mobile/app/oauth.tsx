import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { LoadingState, Screen } from '@/components';
import { t } from '@/i18n';

/**
 * Cible du rebond OAuth (`fixitai://oauth?code=...&state=...`). Sur Android, le
 * navigateur système ouvre ce deep link plutôt que de rendre la main à
 * `openAuthSessionAsync` ; cette route termine alors l'échange du code et
 * persiste la session (y compris quand l'app a été recréée entre-temps).
 */
export default function OAuthRedirect() {
  const params = useLocalSearchParams<{
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }>();
  const router = useRouter();
  const { completeGoogleRedirect } = useAuth();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const qs = new URLSearchParams();
    for (const key of ['code', 'state', 'error', 'error_description'] as const) {
      const v = params[key];
      if (typeof v === 'string' && v) qs.set(key, v);
    }

    completeGoogleRedirect(`fixitai://oauth?${qs.toString()}`)
      .catch(() => undefined)
      .finally(() => {
        // Le garde de navigation (`app/_layout.tsx`) redirige vers `/` ou `/auth`
        // selon l'état d'authentification résultant.
        router.replace('/');
      });
  }, [params, router, completeGoogleRedirect]);

  return (
    <Screen>
      <LoadingState title={t('auth.signingIn')} />
    </Screen>
  );
}
