import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { listDiagnoses, type DiagnosisListItem } from '@/api/diagnoses';
import { Card, EmptyState, ErrorState, LoadingState, Screen, Text } from '@/components';
import { relativeTime, statusMeta } from '@/features/history/statusMeta';
import { friendlyError } from '@/lib/errors';
import { useTheme, type Theme } from '@/theme';

type State =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'done'; items: DiagnosisListItem[] };

const HistoryRow = memo(function HistoryRow({
  item,
  theme,
  onPress,
}: {
  item: DiagnosisListItem;
  theme: Theme;
  onPress: (id: string) => void;
}) {
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
    <Card
      onPress={() => onPress(item.id)}
      accessibilityLabel={`${item.problem}. ${meta.label}. ${relativeTime(item.createdAt)}.`}
      accessibilityHint="Opens this repair"
    >
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
});

export default function HistoryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: 'loading' });

  const load = useCallback(() => {
    setState({ phase: 'loading' });
    void listDiagnoses()
      .then((items) => setState({ phase: 'done', items }))
      .catch((err) => setState({ phase: 'error', message: friendlyError(err, 'list') }));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openItem = useCallback(
    (id: string) => router.push({ pathname: '/diagnosis/[id]', params: { id } }),
    [router],
  );

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
        <ErrorState title="Couldn't load your repairs" message={state.message} onRetry={load} />
      </Screen>
    );
  }

  if (state.items.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="🧰"
          title="No repairs yet"
          message="Your diagnoses will show up here once you run one."
          action={{ label: 'Start a diagnosis', onPress: () => router.replace('/') }}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <FlatList
        data={state.items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}
        ListHeaderComponent={
          <Text variant="title" style={{ marginBottom: theme.spacing.xs }}>
            My Repairs
          </Text>
        }
        renderItem={({ item }) => <HistoryRow item={item} theme={theme} onPress={openItem} />}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}
