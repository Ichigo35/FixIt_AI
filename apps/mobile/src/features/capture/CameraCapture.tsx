import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Text } from '@/components';
import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';

export function CameraCapture({ onCaptured }: { onCaptured: (uri: string) => void }) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text muted>{t('capture.preparingCamera')}</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.md }}>
        <Text variant="heading">{t('capture.cameraNeededTitle')}</Text>
        <Text muted>{t('capture.cameraNeededBody')}</Text>
        <Button label={t('capture.allowCamera')} onPress={requestPermission} />
      </View>
    );
  }

  const take = async () => {
    haptics.impact();
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
    if (photo?.uri) onCaptured(photo.uri);
  };

  return (
    <View style={{ flex: 1, borderRadius: theme.radii.lg, overflow: 'hidden' }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
      <View
        style={{
          position: 'absolute',
          bottom: theme.spacing.xl,
          left: 0,
          right: 0,
          alignItems: 'center',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('capture.takePhoto')}
          onPress={take}
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: theme.colors.surface,
            borderWidth: 4,
            borderColor: theme.colors.primary,
          }}
        />
      </View>
    </View>
  );
}
