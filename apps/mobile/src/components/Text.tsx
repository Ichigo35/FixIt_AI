import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme, type TypographyVariant } from '@/theme';

export interface TextProps extends RNTextProps {
  variant?: TypographyVariant;
  muted?: boolean;
  color?: string;
  center?: boolean;
}

export function Text({
  variant = 'body',
  muted = false,
  color,
  center = false,
  style,
  ...rest
}: TextProps) {
  const theme = useTheme();
  return (
    <RNText
      style={[
        theme.typography[variant],
        { color: color ?? (muted ? theme.colors.textMuted : theme.colors.text) },
        center && { textAlign: 'center' },
        style,
      ]}
      {...rest}
    />
  );
}
