import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { MAX_VIDEO_DURATION_SECONDS } from '@fixit/shared';
import { Button, Text } from '@/components';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';

/** Enregistre un clip court (coupé à MAX_VIDEO_DURATION_SECONDS) et renvoie son URI local. */
export function VideoCapture({ onRecorded }: { onRecorded: (uri: string) => void }) {
  const theme = useTheme();
  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.min(MAX_VIDEO_DURATION_SECONDS, Math.round((Date.now() - started) / 1000)));
    }, 250);
    return () => clearInterval(id);
  }, [recording]);

  if (!camPerm || !micPerm) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text muted>Preparing camera…</Text>
      </View>
    );
  }

  if (!camPerm.granted || !micPerm.granted) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.md }}>
        <Text variant="heading">Camera and microphone needed</Text>
        <Text muted>
          FixIt AI films a short clip so it can see movement and hear the sound of the problem.
        </Text>
        <Button
          label="Allow camera and microphone"
          onPress={async () => {
            if (!camPerm.granted) await requestCam();
            if (!micPerm.granted) await requestMic();
          }}
        />
      </View>
    );
  }

  const start = async () => {
    if (recording) return;
    haptics.impact();
    setElapsed(0);
    setRecording(true);
    try {
      // Résout quand l'enregistrement s'arrête (stop manuel ou maxDuration atteint).
      const video = await cameraRef.current?.recordAsync({
        maxDuration: MAX_VIDEO_DURATION_SECONDS,
      });
      if (video?.uri) onRecorded(video.uri);
    } catch {
      /* enregistrement annulé */
    } finally {
      setRecording(false);
    }
  };

  const stop = () => {
    if (!recording) return;
    haptics.impact();
    cameraRef.current?.stopRecording();
  };

  return (
    <View style={{ flex: 1, borderRadius: theme.radii.lg, overflow: 'hidden' }}>
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" mode="video" />

      {recording ? (
        <View
          style={{
            position: 'absolute',
            top: theme.spacing.md,
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
            backgroundColor: theme.colors.surface,
            paddingHorizontal: theme.spacing.sm,
            paddingVertical: 4,
            borderRadius: theme.radii.md,
          }}
        >
          <View
            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.danger }}
          />
          <Text variant="caption">
            {elapsed}s / {MAX_VIDEO_DURATION_SECONDS}s
          </Text>
        </View>
      ) : null}

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
          accessibilityLabel={recording ? 'Stop recording' : 'Start recording'}
          onPress={recording ? stop : start}
          style={{
            width: 72,
            height: 72,
            borderRadius: recording ? 16 : 36,
            backgroundColor: theme.colors.danger,
            borderWidth: 4,
            borderColor: theme.colors.surface,
          }}
        />
      </View>
    </View>
  );
}
