import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import type { DiagnosisResult } from '@fixit/shared';
import { Button, Card, Text } from '@/components';
import { haptics } from '@/lib/haptics';
import { useMe } from '@/lib/me';
import { useTheme } from '@/theme';
import { DiagnosisMedia } from './DiagnosisMedia';
import { RefineDiagnosis } from './RefineDiagnosis';

export function StopView({ result }: { result: DiagnosisResult }) {
  const theme = useTheme();
  const router = useRouter();
  const { isAdmin } = useMe();

  useEffect(() => {
    haptics.warning();
  }, []);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={{
          backgroundColor: theme.colors.dangerBg,
          borderColor: theme.colors.danger,
          borderWidth: 1,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.lg,
          gap: theme.spacing.sm,
        }}
      >
        <Text variant="display" color={theme.colors.danger}>
          🔴 STOP
        </Text>
        <Text variant="title" color={theme.colors.danger}>
          Contact a professional
        </Text>
        <Text>
          Based on what you described, this is not safe to attempt yourself. FixIt AI will not
          provide repair steps for this.
        </Text>
      </View>

      <Card>
        <Text variant="caption" muted>
          WHAT WE THINK IS WRONG
        </Text>
        <Text variant="heading">{result.diagnosis.problem}</Text>
      </Card>

      {result.input.imageIds.length > 0 ||
      result.input.videoIds.length > 0 ||
      (result.input.audioIds?.length ?? 0) > 0 ? (
        <DiagnosisMedia
          imageIds={result.input.imageIds}
          videoIds={result.input.videoIds}
          audioIds={result.input.audioIds ?? []}
        />
      ) : null}

      {result.safety.reasons.length > 0 ? (
        <Card>
          <Text variant="caption" muted>
            WHY THIS IS DANGEROUS
          </Text>
          {result.safety.reasons.map((r) => (
            <Text key={r}>• {r}</Text>
          ))}
        </Card>
      ) : null}

      <RefineDiagnosis result={result} />

      {isAdmin ? (
        <Card style={{ borderColor: theme.colors.danger }}>
          <Text variant="caption" color={theme.colors.danger}>
            ⚠️ ADMIN OVERRIDE
          </Text>
          <Text muted>
            FixIt AI flagged this as unsafe for a non-professional. The step-by-step guide is
            unlocked for your account only. Do not attempt it unless you are qualified — follow
            every safety warning and stop at the first sign of danger.
          </Text>
          <View style={{ marginTop: theme.spacing.sm }}>
            <Button
              label="Open repair guide anyway"
              icon="🛠️"
              variant="secondary"
              onPress={() => {
                haptics.impact();
                router.push({ pathname: '/repair/[id]', params: { id: result.id } });
              }}
            />
          </View>
        </Card>
      ) : null}

      <Button label="Back to home" variant="secondary" onPress={() => router.replace('/')} />
    </View>
  );
}
