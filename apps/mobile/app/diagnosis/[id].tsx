import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getDiagnosis, type DiagnosisDetail, type HistoryEntry } from '@/api/diagnoses';
import { ApiError } from '@/api/client';
import { Button, Screen, Text } from '@/components';
import { DiagnosisResultView } from '@/features/diagnosis/DiagnosisResultView';
import { StopView } from '@/features/diagnosis/StopView';
import { OutcomeSection } from '@/features/history/OutcomeSection';
import { useTheme } from '@/theme';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; detail: DiagnosisDetail };

export default function DiagnosisDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<State>({ phase: 'loading' });

  const load = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      setState({ phase: 'done', detail: await getDiagnosis(String(id)) });
    } catch (err) {
      setState({
        phase: 'error',
        message:
          err instanceof ApiError && err.code === 'not_found'
            ? 'This diagnosis no longer exists.'
            : 'Could not load this diagnosis.',
      });
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onHistoryUpdated = (history: HistoryEntry[]) => {
    setState((s) =>
      s.phase === 'done'
        ? { phase: 'done', detail: { ...s.detail, history, status: history[0]?.outcome === 'fixed' ? 'fixed' : s.detail.status } }
        : s,
    );
  };

  if (state.phase === 'loading') {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </Screen>
    );
  }

  if (state.phase === 'error') {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
          <Text variant="heading">Not available</Text>
          <Text muted>{state.message}</Text>
          <Button label="Retry" onPress={load} />
        </View>
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
