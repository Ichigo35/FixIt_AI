import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { Text } from '@/components';
import { useTheme } from '@/theme';

export function RepairabilityMeter({ score, label }: { score: number; label: string }) {
  const theme = useTheme();
  const clamped = Math.max(2, Math.min(100, score));
  const fill = useRef(new Animated.Value(0)).current;

  const color =
    score >= 75
      ? theme.colors.success
      : score >= 50
        ? theme.colors.caution
        : score >= 25
          ? theme.colors.advanced
          : theme.colors.danger;

  useEffect(() => {
    const anim = Animated.timing(fill, {
      toValue: clamped,
      duration: 600,
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [fill, clamped]);

  return (
    <View
      style={{ gap: theme.spacing.sm }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Repairability score: ${score} out of 100. ${label}`}
      accessibilityValue={{ min: 0, max: 100, now: score }}
    >
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
        <Animated.View
          style={{
            width: fill.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
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
