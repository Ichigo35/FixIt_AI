import type { ReactNode } from 'react';
import { ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: readonly Edge[];
  style?: ViewStyle;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ['top', 'bottom'],
  style,
}: ScreenProps) {
  const theme = useTheme();
  const inner: ViewStyle = {
    flex: scroll ? undefined : 1,
    padding: padded ? theme.spacing.lg : 0,
    gap: theme.spacing.lg,
  };

  return (
    <SafeAreaView
      edges={edges}
      style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={inner}>{children}</View>
      )}
    </SafeAreaView>
  );
}
