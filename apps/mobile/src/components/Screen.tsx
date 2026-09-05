import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Keyboard, Platform, ScrollView, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';

/**
 * Hauteur courante du clavier logiciel (0 si masqué), pendant que `enabled`.
 *
 * On n'utilise PAS `KeyboardAvoidingView` : sa position/hauteur se calcule à
 * partir de `frame.y`/`frame.height` (mesurés par `onLayout`, relatifs au
 * parent) comparés à `screenY` (absolu, fenêtre entière) — cette comparaison
 * suppose que la vue démarre en haut de la fenêtre. Sous un `SafeAreaView`
 * (barre de statut) + éventuel en-tête, ce n'est pas le cas, et le calcul
 * produit une hauteur quasi nulle : reproduit sur device (OPPO/ColorOS,
 * Android 16, edge-to-edge) — le clavier recouvrait entièrement le champ de
 * saisie malgré `behavior="height"`. En ne demandant que la **hauteur** du
 * clavier (`endCoordinates.height`, une valeur absolue sans ambiguïté de
 * repère) et en l'ajoutant nous-mêmes en `paddingBottom` du contenu
 * défilable, on évite complètement ce calcul de position.
 */
function useKeyboardHeight(enabled: boolean): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [enabled]);

  return height;
}

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  /** Remonte le contenu au-dessus du clavier (formulaires avec saisie en bas d'écran). */
  keyboardAware?: boolean;
  /** Accès au ScrollView interne (ex. pour un scroll manuel additionnel). */
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
  const internalRef = useRef<ScrollView>(null);
  const keyboardHeight = useKeyboardHeight(keyboardAware && scroll);
  const padding = padded ? theme.spacing.lg : 0;

  // Dès que le clavier s'affiche, on descend en bas du contenu : c'est là que
  // vit le champ de saisie dans tous les écrans concernés (description en
  // dernier, bouton d'action juste après).
  useEffect(() => {
    if (keyboardHeight <= 0) return;
    const id = setTimeout(() => internalRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(id);
  }, [keyboardHeight]);

  const inner: ViewStyle = {
    flexGrow: scroll ? 1 : undefined,
    flex: scroll ? undefined : 1,
    padding,
    paddingBottom: padding + keyboardHeight,
    gap: theme.spacing.lg,
  };

  const body = scroll ? (
    <ScrollView
      ref={(node) => {
        internalRef.current = node;
        if (scrollRef) scrollRef.current = node;
      }}
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
      {body}
    </SafeAreaView>
  );
}
