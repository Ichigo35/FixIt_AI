import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import type { DiagnosisDetail, HistoryEntry } from '@/api/diagnoses';
import { submitHistory } from '@/api/diagnoses';
import { imageSourceFromKey, uploadImage } from '@/api/uploads';
import { Button, Card, Text } from '@/components';
import { useTheme } from '@/theme';

export function OutcomeSection({
  detail,
  onUpdated,
}: {
  detail: DiagnosisDetail;
  onUpdated: (history: HistoryEntry[]) => void;
}) {
  const theme = useTheme();
  const [mode, setMode] = useState<'buttons' | 'note'>('buttons');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const latest = detail.history[0];
  const solved = latest?.outcome === 'fixed';

  const send = async (input: Parameters<typeof submitHistory>[1]) => {
    setBusy(true);
    setError(null);
    try {
      const { history } = await submitHistory(detail.id, input);
      onUpdated(history);
    } catch {
      setError('Could not save. Try again.');
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
    </Card>
  );
}
