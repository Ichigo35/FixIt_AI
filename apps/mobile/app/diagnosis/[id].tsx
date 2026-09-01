import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { getDiagnosis, type DiagnosisDetail, type HistoryEntry } from '@/api/diagnoses';
import { ErrorState, LoadingState, Screen } from '@/components';
import { DiagnosisResultView } from '@/features/diagnosis/DiagnosisResultView';
import { StopView } from '@/features/diagnosis/StopView';
import { OutcomeSection } from '@/features/history/OutcomeSection';
import { friendlyError, isRetryable } from '@/lib/errors';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string; canRetry: boolean }
  | { phase: 'done'; detail: DiagnosisDetail };

export default function DiagnosisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<State>({ phase: 'loading' });

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      setState({ phase: 'done', detail: await getDiagnosis(String(id)) });
    } catch (err) {
      setState({
        phase: 'error',
        message: friendlyError(err, 'diagnosis'),
        canRetry: isRetryable(err),
      });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onHistoryUpdated = (history: HistoryEntry[]) => {
    setState((s) =>
      s.phase === 'done'
        ? {
            phase: 'done',
            detail: {
              ...s.detail,
              history,
              status: history[0]?.outcome === 'fixed' ? 'fixed' : s.detail.status,
            },
          }
        : s,
    );
  };

  if (state.phase === 'loading') {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (state.phase === 'error') {
    return (
      <Screen>
        <ErrorState
          title="Not available"
          message={state.message}
          onRetry={state.canRetry ? load : undefined}
          retryLabel="Retry"
        />
      </Screen>
    );
  }

  const { detail } = state;
  return (
    <Screen scroll>
      {detail.safety.forcedStop ? (
        <StopView result={detail} />
      ) : (
        <>
          <DiagnosisResultView result={detail} />
          <OutcomeSection detail={detail} onUpdated={onHistoryUpdated} />
        </>
      )}
    </Screen>
  );
}
