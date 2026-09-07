import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import type { DiagnosisResult } from '@fixit/shared';
import { Button, Card, Text } from '@/components';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';

/**
 * Permet d'ajouter des précisions à un diagnostic et de le relancer.
 * Les détails saisis sont concaténés à la description d'origine ; les photos /
 * vidéos déjà envoyées sont réutilisées (mêmes `imageIds` / `videoIds`).
 * Un nouveau diagnostic est créé (non consommé pour un accès illimité).
 */
export function RefineDiagnosis({ result }: { result: DiagnosisResult }) {
  const theme = useTheme();
  const router = useRouter();
  const [extra, setExtra] = useState('');
  const submitted = useRef(false);

  const submit = () => {
    const details = extra.trim();
    if (!details || submitted.current) return;
    submitted.current = true;
    haptics.impact();
    const base = result.input.description?.trim();
    const description = base
      ? `${base}\n\nAdditional details from the user:\n${details}`
      : details;
    router.push({
      pathname: '/diagnosis/new',
      params: {
        description,
        ...(result.category ? { category: result.category } : {}),
        imageIds: JSON.stringify(result.input.imageIds),
        videoIds: JSON.stringify(result.input.videoIds ?? []),
        audioIds: JSON.stringify(result.input.audioIds ?? []),
      },
    });
  };

  return (
    <Card>
      <Text variant="caption" muted>
        ADD MORE DETAILS
      </Text>
      <Text muted>
        Answer any of the questions above or add anything else you noticed. FixIt AI will run a
        fresh diagnosis using your photos and these details.
      </Text>
      <TextInput
        value={extra}
        onChangeText={setExtra}
        multiline
        placeholder="e.g. Bosch KGN39. The key presses down normally but stays stuck when released. It started suddenly."
        placeholderTextColor={theme.colors.textMuted}
        style={{
          minHeight: 96,
          marginTop: theme.spacing.sm,
          color: theme.colors.text,
          fontSize: theme.typography.body.fontSize,
          textAlignVertical: 'top',
        }}
      />
      <View style={{ marginTop: theme.spacing.sm }}>
        <Button
          label="Re-analyze with these details"
          icon="🔁"
          disabled={extra.trim().length < 4}
          onPress={submit}
        />
      </View>
    </Card>
  );
}
