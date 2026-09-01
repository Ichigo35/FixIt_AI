import { useRef, type ReactNode } from 'react';
import { Animated, Pressable, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  elevated?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: ViewStyle;
}

export function Card({
  children,
  onPress,
  elevated = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  style,
}: CardProps) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const base: ViewStyle = {
    backgroundColor: elevated ? theme.colors.surfaceElevated : theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  };

  if (!onPress) return <View style={[base, style]}>{children}</View>;

  const animate = (to: number) =>
    Animated.spring(scale, { toValue: to, useNativeDriver: true, speed: 40, bounciness: 0 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        style={[base, disabled && { opacity: 0.5 }, style]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
