import { useEffect, useRef } from 'react';
import { Animated, View, type DimensionValue } from 'react-native';
import { useTheme } from '@/theme';

/** Bloc gris qui pulse doucement (chargement). API Animated native. */
export function Skeleton({
  width = '100%',
  height = 16,
  radius,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}) {
  const theme = useTheme();
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width,
        height,
        borderRadius: radius ?? theme.radii.sm,
        backgroundColor: theme.colors.border,
        opacity: pulse,
      }}
    />
  );
}

/** Cartes fantômes pour une liste en cours de chargement. */
export function SkeletonList({ rows = 5 }: { rows?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{ gap: theme.spacing.md }}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.lg,
            borderWidth: 1,
            borderColor: theme.colors.border,
            padding: theme.spacing.lg,
            gap: theme.spacing.sm,
          }}
        >
          <Skeleton width="70%" height={16} />
          <Skeleton width="40%" height={12} />
        </View>
      ))}
    </View>
  );
}
