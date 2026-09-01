import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnectivity } from '@/lib/connectivity';
import { useTheme } from '@/theme';
import { Text } from './Text';

/** Bandeau discret en haut de l'écran quand le réseau est indisponible. */
export function OfflineBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { offline } = useConnectivity();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: offline ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [offline, slide]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: insets.top + 6,
        paddingBottom: 8,
        alignItems: 'center',
        backgroundColor: theme.colors.text,
        transform: [
          { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] }) },
        ],
      }}
    >
      <Text variant="caption" color={theme.colors.background}>
        No connection — changes will retry when you’re back online
      </Text>
    </Animated.View>
  );
}
