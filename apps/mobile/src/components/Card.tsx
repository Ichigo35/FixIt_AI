import type { ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';

export interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  elevated?: boolean;
  style?: ViewStyle;
}

export function Card({ children, onPress, elevated = false, style }: CardProps) {
  const theme = useTheme();
  const base: ViewStyle = {
    backgroundColor: elevated ? theme.colors.surfaceElevated : theme.colors.surface,
    borderRadius: theme.radii.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    gap: theme.spacing.sm,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, pressed && { opacity: 0.7 }, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}
