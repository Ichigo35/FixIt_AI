import { ActivityIndicator, Pressable, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  loading = false,
  fullWidth = true,
  style,
}: ButtonProps) {
  const theme = useTheme();

  const bg: Record<Variant, string> = {
    primary: theme.colors.primary,
    secondary: theme.colors.surfaceElevated,
    ghost: 'transparent',
  };
  const fg: Record<Variant, string> = {
    primary: theme.colors.primaryText,
    secondary: theme.colors.text,
    ghost: theme.colors.primary,
  };

  const container: ViewStyle = {
    backgroundColor: bg[variant],
    borderRadius: theme.radii.md,
    borderWidth: variant === 'secondary' ? 1 : 0,
    borderColor: theme.colors.border,
    paddingVertical: theme.spacing.md + 2,
    paddingHorizontal: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={loading ? `${label}, please wait` : label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [container, pressed && { opacity: 0.8 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          {icon ? <Text style={{ fontSize: 18 }}>{icon}</Text> : null}
          <Text variant="bodyStrong" color={fg[variant]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
