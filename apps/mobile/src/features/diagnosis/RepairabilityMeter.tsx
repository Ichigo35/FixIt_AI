import { View } from 'react-native';
import { Text } from '@/components';
import { useTheme } from '@/theme';

export function RepairabilityMeter({ score, label }: { score: number; label: string }) {
  const theme = useTheme();
  const color =
    score >= 75
      ? theme.colors.success
      : score >= 50
        ? theme.colors.caution
        : score >= 25
          ? theme.colors.advanced
          : theme.colors.danger;

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: theme.spacing.sm }}>
        <Text variant="caption" muted>
          REPAIRABILITY
        </Text>
        <Text variant="bodyStrong" color={color}>
          {score}/100
        </Text>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.border,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.max(2, Math.min(100, score))}%`,
            height: '100%',
            backgroundColor: color,
          }}
        />
      </View>
      <Text variant="caption" muted>
        {label}
      </Text>
    </View>
  );
}
