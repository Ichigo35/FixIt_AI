import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { listDiagnoses, type DiagnosisListItem } from '@/api/diagnoses';
import { Card, Screen, Text } from '@/components';
import { relativeTime, statusMeta } from '@/features/history/statusMeta';
import { useTheme } from '@/theme';

type State =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'done'; items: DiagnosisListItem[] };

export default function HistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: 'loading' });

  useFocusEffect(
    useCallback(() => {
      listDiagnoses()
        .then((items) => setState({ phase: 'done', items }))
        .catch(() => setState({ phase: 'error' }));
    }, []),
  );

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
        <Text variant="heading">Couldn&apos;t load your repairs</Text>
        <Text muted>Check your connection and try again.</Text>
      </Screen>
    );
  }

  if (state.items.length === 0) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.sm }}>
          <Text variant="heading">No repairs yet</Text>
          <Text muted>Your diagnoses will show up here once you run one.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text variant="title">My Repairs</Text>
      {state.items.map((item) => {
        const meta = statusMeta(item.status);
        const toneColor =
          meta.tone === 'success'
            ? theme.colors.success
            : meta.tone === 'caution'
              ? theme.colors.caution
              : meta.tone === 'danger'
                ? theme.colors.danger
                : theme.colors.textMuted;
        return (
          <Card key={item.id} onPress={() => router.push({ pathname: '/diagnosis/[id]', params: { id: item.id } })}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="bodyStrong" numberOfLines={2}>
                  {item.problem}
                </Text>
                <Text variant="caption" muted>
                  {relativeTime(item.createdAt)}
                  {item.category ? ` · ${item.category}` : ''}
                </Text>
              </View>
              <Text variant="caption" color={toneColor}>
                {meta.emoji} {meta.label}
              </Text>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}
