import { useRouter } from 'expo-router';
import { View } from 'react-native';
import type { DiagnosisResult } from '@fixit/shared';
import { Button, Card, Text } from '@/components';
import { useTheme } from '@/theme';

export function StopView({ result }: { result: DiagnosisResult }) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Card style={{ backgroundColor: theme.colors.dangerBg, borderColor: theme.colors.danger }}>
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
      </Card>

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
