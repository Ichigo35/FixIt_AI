import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import type { DiagnosisDetail, HistoryEntry } from '@/api/diagnoses';
import { submitHistory } from '@/api/diagnoses';
import { ApiError } from '@/api/ApiError';
import { imageSourceFromKey, uploadImage } from '@/api/uploads';
import { Button, Card, Text } from '@/components';
import { haptics } from '@/lib/haptics';
import { useOutbox } from '@/lib/outbox';
import { useTheme } from '@/theme';

type HistoryInput = Parameters<typeof submitHistory>[1];

/** Entrée d'historique locale, en attendant que la file hors-ligne la rejoue. */
function optimisticEntry(input: HistoryInput): HistoryEntry {
  return {
    id: `local-${Date.now()}`,
    outcome: input.outcome,
    feedbackWorked: input.feedbackWorked ?? null,
    feedbackNote: input.feedbackNote ?? null,
    summary: null,
    beforeR2Key: null,
    afterR2Key: null,
    createdAt: new Date().toISOString(),
  };
}

export function OutcomeSection({
  detail,
  onUpdated,
}: {
  detail: DiagnosisDetail;
  onUpdated: (history: HistoryEntry[]) => void;
}) {
  const theme = useTheme();
  const { enqueue } = useOutbox();
  const [mode, setMode] = useState<'buttons' | 'note'>('buttons');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  const latest = detail.history[0];
  const solved = latest?.outcome === 'fixed';

  const send = async (input: HistoryInput) => {
    setBusy(true);
    setError(null);
    try {
      const { history } = await submitHistory(detail.id, input);
      if (input.outcome === 'fixed') haptics.success();
      else haptics.tap();
      onUpdated(history);
    } catch (err) {
      if (err instanceof ApiError) {
        haptics.error();
        setError('Could not save. Try again.');
      } else {
        // Hors-ligne : on met en file et on reflète le résultat localement.
        enqueue({
          kind: 'history',
          path: `/diagnoses/${detail.id}/history`,
          body: input,
          label: detail.diagnosis.problem,
        });
        haptics.tap();
        setQueued(true);
        onUpdated([optimisticEntry(input), ...detail.history]);
      }
    } finally {
      setBusy(false);
    }
  };

  const addAfterPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    setBusy(true);
    setError(null);
    try {
      const up = await uploadImage(res.assets[0].uri, 'after');
      const { history } = await submitHistory(detail.id, {
        outcome: 'fixed',
        feedbackWorked: true,
        afterImageId: up.id,
      });
      onUpdated(history);
    } catch {
      setError('Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  if (solved) {
    const before = imageSourceFromKey(detail.input.imageIds[0] ? `uploads/${detail.input.imageIds[0]}` : null);
    const after = imageSourceFromKey(latest?.afterR2Key ?? null);
    return (
      <Card style={{ backgroundColor: theme.colors.successBg, borderColor: theme.colors.success }}>
        <Text variant="heading" color={theme.colors.success}>
          Problem solved 🎉
        </Text>
        {latest?.feedbackNote ? <Text muted>{latest.feedbackNote}</Text> : null}
        {queued ? (
          <Text variant="caption" muted>
            Saved — will sync when you’re back online.
          </Text>
        ) : null}
        {before || after ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.md, marginTop: theme.spacing.sm }}>
            {before ? (
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="caption" muted>
                  BEFORE
                </Text>
                <Image source={before} style={{ width: '100%', aspectRatio: 1, borderRadius: theme.radii.md }} contentFit="cover" />
              </View>
            ) : null}
            {after ? (
              <View style={{ flex: 1, gap: 4 }}>
                <Text variant="caption" muted>
                  AFTER
                </Text>
                <Image source={after} style={{ width: '100%', aspectRatio: 1, borderRadius: theme.radii.md }} contentFit="cover" />
              </View>
            ) : null}
          </View>
        ) : null}
        {!after ? (
          <Button
            label="Add an 'after' photo"
            variant="secondary"
            loading={busy}
            onPress={addAfterPhoto}
          />
        ) : null}
      </Card>
    );
  }

  return (
    <Card>
      <Text variant="heading">Did this fix it?</Text>
      {mode === 'note' ? (
        <View style={{ gap: theme.spacing.sm }}>
          <Text muted>What happened?</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            placeholder="It didn't work because…"
            placeholderTextColor={theme.colors.textMuted}
            style={{
              minHeight: 80,
              color: theme.colors.text,
              fontSize: theme.typography.body.fontSize,
              textAlignVertical: 'top',
            }}
          />
          <Button
            label="Submit"
            loading={busy}
            onPress={() =>
              send({ outcome: 'not_fixed', feedbackWorked: false, feedbackNote: note.trim() || null })
            }
          />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
          <Button
            label="👍 Yes"
            fullWidth={false}
            loading={busy}
            onPress={() => send({ outcome: 'fixed', feedbackWorked: true })}
          />
          <Button
            label="👎 No"
            variant="secondary"
            fullWidth={false}
            onPress={() => setMode('note')}
          />
          <Button
            label="🔧 Called a pro"
            variant="secondary"
            fullWidth={false}
            onPress={() => send({ outcome: 'pro' })}
          />
        </View>
      )}
      {error ? (
        <Text variant="caption" color={theme.colors.danger}>
          {error}
        </Text>
      ) : null}
      {queued ? (
        <Text variant="caption" muted>
          Saved — will sync when you’re back online.
        </Text>
      ) : null}
    </Card>
  );
}
