import type { ReactNode, RefObject } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /** Remonte le contenu au-dessus du clavier (formulaires avec saisie en bas d'écran). */
  keyboardAware?: boolean;
  /** Accès au ScrollView interne (ex. `scrollToEnd` au focus d'un champ). */
  scrollRef?: RefObject<ScrollView | null>;
  edges?: readonly Edge[];
  style?: ViewStyle;
}

export function Screen({
  children,
  scroll = false,
  padded = true,
  keyboardAware = false,
  scrollRef,
  edges = ['top', 'bottom'],
  style,
}: ScreenProps) {
  const theme = useTheme();
  const inner: ViewStyle = {
    flexGrow: scroll ? 1 : undefined,
    flex: scroll ? undefined : 1,
    padding: padded ? theme.spacing.lg : 0,
    gap: theme.spacing.lg,
  };

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={inner}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={inner}>{children}</View>
  );

  return (
    <SafeAreaView
      edges={edges}
      style={[{ flex: 1, backgroundColor: theme.colors.background }, style]}
    >
      {keyboardAware ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}
