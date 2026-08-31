import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Text } from '@/components';
import { useTheme } from '@/theme';

export function CameraCapture({ onCaptured }: { onCaptured: (uri: string) => void }) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text muted>Preparing camera…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.md }}>
        <Text variant="heading">Camera access needed</Text>
        <Text muted>
          FixIt AI uses the camera so you can photograph the problem you want to fix.
        </Text>
        <Button label="Allow camera" onPress={requestPermission} />
      </View>
    );
  }

  const take = async () => {
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
          accessibilityLabel="Take photo"
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
