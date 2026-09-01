import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnectivity } from '@/lib/connectivity';
import { useOutbox } from '@/lib/outbox';
import { t } from '@/i18n';
import { useTheme } from '@/theme';
import { Text } from './Text';

/**
 * Bandeau discret en haut de l'écran :
 * - hors-ligne → « pas de connexion »
 * - de retour en ligne avec des changements en attente → « synchronisation… »
 */
export function OfflineBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { offline } = useConnectivity();
  const { pending, flushing } = useOutbox();
  const slide = useRef(new Animated.Value(0)).current;

  const syncing = !offline && (flushing || pending.length > 0);
  const visible = offline || syncing;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  const message = offline
    ? t('offline.banner')
    : flushing
      ? t('offline.syncing', { count: pending.length })
      : t('offline.syncPending', { count: pending.length });

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
        backgroundColor: offline ? theme.colors.text : theme.colors.primary,
        transform: [
          { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-120, 0] }) },
        ],
      }}
    >
      <Text variant="caption" color={theme.colors.background}>
        {message}
      </Text>
    </Animated.View>
  );
}
