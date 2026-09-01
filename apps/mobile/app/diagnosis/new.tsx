import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { Category } from '@fixit/shared';
import { ApiError } from '@/api/client';
import { createDiagnosis, type DiagnosisResponse } from '@/api/diagnoses';
import { Button, Screen, Text } from '@/components';
import { DiagnosisResultView } from '@/features/diagnosis/DiagnosisResultView';
import { StopView } from '@/features/diagnosis/StopView';
import { useTheme } from '@/theme';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
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
  const theme = useTheme();
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
      setState({ phase: 'done', result });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.code === 'ai_request_failed'
            ? 'The AI service is unavailable right now. Please try again in a moment.'
            : err.code === 'quota_exceeded'
              ? "You've used all your free diagnoses this month. Upgrade to Premium for unlimited."
              : err.code === 'need_photo_or_description'
                ? 'Add a photo or a description first.'
                : `Something went wrong (${err.code}).`
          : 'Network error. Check your connection and that the API is running.';
      setState({ phase: 'error', message });
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.lg }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text variant="heading">Analyzing…</Text>
          <Text muted center>
            FixIt AI is looking at the problem and checking for safety risks. This can take up to a
            minute.
          </Text>
        </View>
      </Screen>
    );
  }

  if (state.phase === 'error') {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
          <Text variant="heading">Couldn&apos;t analyze this</Text>
          <Text muted>{state.message}</Text>
          <Button label="Try again" onPress={run} />
        </View>
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
