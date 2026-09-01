import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import type { DiagnosisResult } from '@fixit/shared';
import { Button, Card, Text } from '@/components';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';

export function StopView({ result }: { result: DiagnosisResult }) {
  const theme = useTheme();
  const router = useRouter();

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

      <Button label="Back to home" variant="secondary" onPress={() => router.replace('/')} />
    </View>
  );
}
