import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { RepairGuide } from '@fixit/shared';
import { ApiError } from '@/api/client';
import { getRepairGuide } from '@/api/repairGuide';
import { Button, Screen, Text } from '@/components';
import { RepairGuideView } from '@/features/repair/RepairGuideView';
import { useTheme } from '@/theme';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; guide: RepairGuide };

export default function RepairGuideScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [state, setState] = useState<State>({ phase: 'loading' });
  const started = useRef(false);

  const run = useCallback(async () => {
    setState({ phase: 'loading' });
    try {
      setState({ phase: 'done', guide: await getRepairGuide(String(id)) });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.code === 'guide_unavailable'
            ? 'This problem is not safe to attempt yourself — no guide is available.'
            : err.code === 'ai_request_failed'
              ? 'The AI service is unavailable right now. Please try again in a moment.'
              : `Something went wrong (${err.code}).`
          : 'Network error. Check your connection and that the API is running.';
      setState({ phase: 'error', message });
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text variant="heading">Building your repair guide…</Text>
        </View>
      </Screen>
    );
  }

  if (state.phase === 'error') {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
          <Text variant="heading">No guide</Text>
          <Text muted>{state.message}</Text>
          <Button label="Try again" onPress={run} />
        </View>
      </Screen>
    );
  }

  return <RepairGuideView guide={state.guide} />;
}
