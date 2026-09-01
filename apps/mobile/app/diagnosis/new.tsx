import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Category } from '@fixit/shared';
import { createDiagnosis, type DiagnosisResponse } from '@/api/diagnoses';
import { ErrorState, LoadingState, Screen } from '@/components';
import { DiagnosisResultView } from '@/features/diagnosis/DiagnosisResultView';
import { StopView } from '@/features/diagnosis/StopView';
import { friendlyError, isRetryable } from '@/lib/errors';
import { haptics } from '@/lib/haptics';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string; canRetry: boolean }
  | { phase: 'done'; result: DiagnosisResponse };

function parseIds(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export default function NewDiagnosisScreen() {
  const params = useLocalSearchParams<{
    description?: string;
    category?: string;
    imageIds?: string;
  }>();
  const [state, setState] = useState<State>({ phase: 'loading' });
  const started = useRef(false);

  const run = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      const result = await createDiagnosis({
        description: params.description,
        category: (params.category as Category | undefined) ?? null,
        imageIds: parseIds(params.imageIds),
      });
      // Le retour haptique du STOP est géré par StopView.
      if (!result.safety.forcedStop) haptics.success();
      setState({ phase: 'done', result });
    } catch (err) {
      haptics.error();
      setState({
        phase: 'error',
        message: friendlyError(err, 'diagnosis'),
        canRetry: isRetryable(err),
      });
    }
  }, [params.description, params.category, params.imageIds]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void run();
  }, [run]);

  if (state.phase === 'loading') {
    return (
      <Screen>
        <LoadingState
          title="Analyzing…"
          detail="FixIt AI is looking at the problem and checking for safety risks. This can take up to a minute."
        />
      </Screen>
    );
  }

  if (state.phase === 'error') {
    return (
      <Screen>
        <ErrorState
          title="Couldn't analyze this"
          message={state.message}
          onRetry={state.canRetry ? run : undefined}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {state.result.safety.forcedStop ? (
        <StopView result={state.result} />
      ) : (
        <DiagnosisResultView result={state.result} />
      )}
    </Screen>
  );
}
