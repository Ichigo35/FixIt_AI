import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RepairGuide } from '@fixit/shared';
import { getDiagnosis } from '@/api/diagnoses';
import { getRepairGuide } from '@/api/repairGuide';
import { ErrorState, LoadingState, Screen } from '@/components';
import { RepairGuideView } from '@/features/repair/RepairGuideView';
import { ApiError } from '@/api/client';
import { t } from '@/i18n';
import { friendlyError, isRetryable } from '@/lib/errors';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string; canRetry: boolean }
  | { phase: 'done'; guide: RepairGuide; imageIds: string[] };

export default function RepairGuideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<State>({ phase: 'loading' });
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildError, setRebuildError] = useState<string | null>(null);
  const started = useRef(false);

  const run = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      // Le guide et le diagnostic partent ensemble : les photos servent de
      // support aux repères visuels des étapes.
      const [guide, diagnosis] = await Promise.all([
        getRepairGuide(String(id)),
        getDiagnosis(String(id)).catch(() => null),
      ]);
      setState({ phase: 'done', guide, imageIds: diagnosis?.input.imageIds ?? [] });
    } catch (err) {
      const isStop = err instanceof ApiError && err.code === 'guide_unavailable';
      setState({
        phase: 'error',
        message: friendlyError(err, 'repairGuide'),
        canRetry: !isStop && isRetryable(err),
      });
    }
  }, [id]);

  /** Régénère un guide écrit avant les illustrations (consomme un appel IA). */
  const rebuild = useCallback(async () => {
    setRebuilding(true);
    setRebuildError(null);
    try {
      const guide = await getRepairGuide(String(id), { refresh: true });
      setState((prev) => (prev.phase === 'done' ? { ...prev, guide } : prev));
    } catch {
      setRebuildError(t('repair.rebuildFailed'));
    } finally {
      setRebuilding(false);
    }
  }, [id]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  if (state.phase === 'loading') {
    return (
      <Screen>
        <LoadingState title={t('repair.loading')} />
      </Screen>
    );
  }

  if (state.phase === 'error') {
    return (
      <Screen>
        <ErrorState
          title={t('repair.noGuideTitle')}
          message={state.message}
          onRetry={state.canRetry ? run : undefined}
        />
      </Screen>
    );
  }

  return (
    <RepairGuideView
      guide={state.guide}
      diagnosisId={String(id)}
      imageIds={state.imageIds}
      onRebuild={rebuild}
      rebuilding={rebuilding}
      rebuildError={rebuildError}
    />
  );
}
