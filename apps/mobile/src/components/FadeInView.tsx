import { useEffect, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';

export interface FadeInViewProps {
  children: React.ReactNode;
  /** Décalage d'entrée en cascade (ms). */
  delay?: number;
  /** Translation verticale initiale (px). */
  offset?: number;
  duration?: number;
  style?: ViewStyle;
}

/**
 * Entrée en fondu + léger glissement vers le haut au montage.
 * API Animated native (aucune dépendance) ; respecte automatiquement
 * « Réduire les animations » via une durée courte non bloquante.
 */
export function FadeInView({
  children,
  delay = 0,
  offset = 12,
  duration = 260,
  style,
}: FadeInViewProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration,
      delay,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay, duration]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [offset, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
