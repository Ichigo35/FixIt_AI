import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Retour haptique — silencieux sur web et si l'appareil ne le supporte pas.
 * `tap` : sélection légère · `success`/`warning`/`error` : notifications.
 */
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptics = {
  tap: () => {
    if (enabled) void Haptics.selectionAsync().catch(() => {});
  },
  impact: (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Medium) => {
    if (enabled) void Haptics.impactAsync(style).catch(() => {});
  },
  success: () => {
    if (enabled)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  warning: () => {
    if (enabled)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
  error: () => {
    if (enabled)
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
};
