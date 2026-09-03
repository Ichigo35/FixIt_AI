import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import type { RepairStep, StepVerdict } from '@fixit/shared';
import { uploadImage } from '@/api/uploads';
import { verifyStep } from '@/api/repairSession';
import { VERDICT_META } from './verdictMeta';
import { Button, Card, FadeInView, Text } from '@/components';
import { t } from '@/i18n';
import { friendlyError } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';

type Phase =
  | { name: 'idle' }
  | { name: 'working' }
  | { name: 'result'; verdict: StepVerdict; summary: string; advice: string[]; photoUri: string }
  | { name: 'error'; message: string };

/** Prend une photo (caméra, repli galerie) et renvoie l'URI locale, ou null si annulé. */
async function capturePhoto(): Promise<string | null> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.granted) {
      const res = await ImagePicker.launchCameraAsync({ quality: 0.6 });
      if (!res.canceled && res.assets[0]) return res.assets[0].uri;
      return null;
    }
  } catch {
    /* pas de caméra -> galerie */
  }
  const lib = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
  if (!lib.canceled && lib.assets[0]) return lib.assets[0].uri;
  return null;
}

export function StepCheck({
  diagnosisId,
  stepIndex,
  step,
  onVerdict,
}: {
  diagnosisId: string;
  stepIndex: number;
  step: RepairStep;
  onVerdict?: (verdict: StepVerdict) => void;
}) {
  const theme = useTheme();
  const [phase, setPhase] = useState<Phase>({ name: 'idle' });

  const toneColor = (tone: 'success' | 'caution' | 'danger' | 'muted') =>
    tone === 'success'
      ? theme.colors.success
      : tone === 'caution'
        ? theme.colors.caution
        : tone === 'danger'
          ? theme.colors.danger
          : theme.colors.textMuted;

  const toneBg = (tone: 'success' | 'caution' | 'danger' | 'muted') =>
    tone === 'success'
      ? theme.colors.successBg
      : tone === 'caution'
        ? theme.colors.cautionBg
        : tone === 'danger'
          ? theme.colors.dangerBg
          : theme.colors.surface;

  const run = async () => {
    const uri = await capturePhoto();
    if (!uri) return;
    setPhase({ name: 'working' });
    try {
      const upload = await uploadImage(uri, 'step');
      const { check } = await verifyStep(diagnosisId, { stepIndex, imageId: upload.id });
      if (check.verdict === 'pass') haptics.success();
      else if (check.verdict === 'unsafe') haptics.error();
      else haptics.warning();
      setPhase({
        name: 'result',
        verdict: check.verdict,
        summary: check.summary,
        advice: check.advice,
        photoUri: uri,
      });
      onVerdict?.(check.verdict);
    } catch (err) {
      haptics.error();
      setPhase({ name: 'error', message: friendlyError(err, 'repairGuide') });
    }
  };

  if (phase.name === 'result') {
    const meta = VERDICT_META[phase.verdict];
    return (
      <FadeInView offset={10}>
        <Card style={{ backgroundColor: toneBg(meta.tone), borderColor: toneColor(meta.tone) }}>
          <Text variant="caption" color={toneColor(meta.tone)} accessibilityRole="header">
            {meta.emoji} {t(`repair.verdict.${phase.verdict}`).toUpperCase()}
          </Text>
          <Text>{phase.summary}</Text>
          {phase.advice.map((a) => (
            <Text key={a} muted>
              • {a}
            </Text>
          ))}
          <Image
            source={{ uri: phase.photoUri }}
            style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radii.md, marginTop: theme.spacing.sm }}
            contentFit="cover"
          />
          <Button
            label={t('repair.checkAgain')}
            variant="secondary"
            onPress={() => setPhase({ name: 'idle' })}
          />
        </Card>
      </FadeInView>
    );
  }

  return (
    <Card>
      <Text variant="caption" muted>
        {t('repair.checkTitle')}
      </Text>
      <Text muted>{t('repair.checkBody', { title: step.title })}</Text>
      {phase.name === 'error' ? (
        <Text variant="caption" color={theme.colors.danger}>
          {phase.message}
        </Text>
      ) : null}
      <Button
        label={phase.name === 'working' ? t('repair.checking') : `📷 ${t('repair.checkCta')}`}
        variant="secondary"
        loading={phase.name === 'working'}
        onPress={run}
      />
    </Card>
  );
}
