import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import type { DiagnosisResult } from '@fixit/shared';
import { Button, Card, Text } from '@/components';
import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';

/**
 * Affine un diagnostic (« multi-tours léger ») : les questions de l'IA
 * (`moreInfoNeeded`) deviennent des champs de réponse ; les réponses + un champ
 * libre sont concaténées à la description d'origine et un nouveau diagnostic est
 * relancé avec les mêmes médias (non consommé pour un accès illimité).
 */
export function RefineDiagnosis({ result }: { result: DiagnosisResult }) {
  const theme = useTheme();
  const router = useRouter();
  const questions = useMemo(
    () => result.diagnosis.moreInfoNeeded ?? [],
    [result.diagnosis.moreInfoNeeded],
  );
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [other, setOther] = useState('');
  const submitted = useRef(false);

  const answeredCount = Object.values(answers).filter((a) => a.trim().length > 1).length;
  const canSubmit = answeredCount > 0 || other.trim().length >= 4;

  const inputStyle = {
    minHeight: 44,
    marginTop: 4,
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    textAlignVertical: 'top' as const,
  };

  const submit = () => {
    if (!canSubmit || submitted.current) return;
    submitted.current = true;
    haptics.impact();

    const lines: string[] = [];
    const base = result.input.description?.trim();
    if (base) lines.push(base);

    const qa = questions
      .map((q, i) => ({ q, a: (answers[i] ?? '').trim() }))
      .filter((x) => x.a.length > 0);
    if (qa.length > 0) {
      lines.push('', "User's answers:");
      for (const { q, a } of qa) lines.push(`- ${q} → ${a}`);
    }
    const extra = other.trim();
    if (extra) {
      lines.push('', `Other notes from the user: ${extra}`);
    }

    router.push({
      pathname: '/diagnosis/new',
      params: {
        description: lines.join('\n'),
        ...(result.category ? { category: result.category } : {}),
        ...(result.input.brand ? { brand: result.input.brand } : {}),
        ...(result.input.model ? { model: result.input.model } : {}),
        ...(result.input.serialNumber ? { serialNumber: result.input.serialNumber } : {}),
        ...(result.input.errorCode ? { errorCode: result.input.errorCode } : {}),
        ...(result.input.measurements ? { measurements: result.input.measurements } : {}),
        ...(result.input.replacementCost != null
          ? { replacementCost: String(result.input.replacementCost) }
          : {}),
        imageIds: JSON.stringify(result.input.imageIds),
        videoIds: JSON.stringify(result.input.videoIds ?? []),
        audioIds: JSON.stringify(result.input.audioIds ?? []),
      },
    });
  };

  return (
    <Card>
      <Text variant="caption" muted>
        {t('diagnosis.refineTitle')}
      </Text>
      <Text muted>{t('diagnosis.refineIntro')}</Text>

      <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.sm }}>
        {questions.map((q, i) => (
          <View key={q}>
            <Text variant="caption">• {q}</Text>
            <TextInput
              value={answers[i] ?? ''}
              onChangeText={(v) => setAnswers((prev) => ({ ...prev, [i]: v }))}
              multiline
              placeholder={t('diagnosis.refineAnswerPlaceholder')}
              placeholderTextColor={theme.colors.textMuted}
              style={inputStyle}
            />
          </View>
        ))}

        <View>
          <Text variant="caption" muted>
            {t('diagnosis.refineOtherLabel')}
          </Text>
          <TextInput
            value={other}
            onChangeText={setOther}
            multiline
            placeholder={t('diagnosis.refineOtherPlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            style={{ ...inputStyle, minHeight: 72 }}
          />
        </View>
      </View>

      <View style={{ marginTop: theme.spacing.sm }}>
        <Button
          label={t('diagnosis.refineSubmit')}
          icon="🔁"
          disabled={!canSubmit}
          onPress={submit}
        />
      </View>
    </Card>
  );
}
