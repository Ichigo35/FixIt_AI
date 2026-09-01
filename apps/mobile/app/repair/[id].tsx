import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RepairGuide } from '@fixit/shared';
import { getRepairGuide } from '@/api/repairGuide';
import { ErrorState, LoadingState, Screen } from '@/components';
import { RepairGuideView } from '@/features/repair/RepairGuideView';
import { ApiError } from '@/api/client';
import { friendlyError, isRetryable } from '@/lib/errors';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string; canRetry: boolean }
  | { phase: 'done'; guide: RepairGuide };

export default function RepairGuideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<State>({ phase: 'loading' });
  const started = useRef(false);

  const run = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      setState({ phase: 'done', guide: await getRepairGuide(String(id)) });
    } catch (err) {
      const isStop = err instanceof ApiError && err.code === 'guide_unavailable';
      setState({
        phase: 'error',
        message: friendlyError(err, 'repairGuide'),
        canRetry: !isStop && isRetryable(err),
      });
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
        <LoadingState title="Building your repair guide…" />
      </Screen>
    );
  }

  if (state.phase === 'error') {
    return (
      <Screen>
        <ErrorState
          title="No guide"
          message={state.message}
          onRetry={state.canRetry ? run : undefined}
        />
      </Screen>
    );
  }

  return <RepairGuideView guide={state.guide} diagnosisId={String(id)} />;
}
