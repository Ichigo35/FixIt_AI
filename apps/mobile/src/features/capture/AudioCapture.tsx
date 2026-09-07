import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { MAX_AUDIO_DURATION_SECONDS } from '@fixit/shared';
import { Button, Text } from '@/components';
import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';
import { formatClock } from './audioMeta';

type Perm = 'checking' | 'granted' | 'denied';

/** Enregistre un court clip audio (coupé à MAX_AUDIO_DURATION_SECONDS) et renvoie son URI local. */
export function AudioCapture({ onRecorded }: { onRecorded: (uri: string) => void }) {
  const theme = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [perm, setPerm] = useState<Perm>('checking');
  const [busy, setBusy] = useState(false);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getRecordingPermissionsAsync()
      .then((p) => setPerm(p.granted ? 'granted' : p.canAskAgain ? 'checking' : 'denied'))
      .catch(() => setPerm('checking'));
  }, []);

  useEffect(
    () => () => {
      if (autoStopRef.current) clearTimeout(autoStopRef.current);
    },
    [],
  );

  const elapsed = Math.min(
    MAX_AUDIO_DURATION_SECONDS,
    Math.round((state.durationMillis ?? 0) / 1000),
  );

  const askPermission = async () => {
    const p = await requestRecordingPermissionsAsync();
    setPerm(p.granted ? 'granted' : 'denied');
  };

  const start = async () => {
    if (busy || state.isRecording) return;
    setBusy(true);
    try {
      if (perm !== 'granted') {
        const p = await requestRecordingPermissionsAsync();
        if (!p.granted) {
          setPerm('denied');
          return;
        }
        setPerm('granted');
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      haptics.impact();
      recorder.record();
      autoStopRef.current = setTimeout(() => void stop(), MAX_AUDIO_DURATION_SECONDS * 1000);
    } catch {
      /* démarrage annulé */
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (!state.isRecording && !recorder.isRecording) return;
    haptics.impact();
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (uri) onRecorded(uri);
    } catch {
      /* arrêt sans fichier */
    }
  };

  if (perm === 'checking' && !state.isRecording) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md }}>
        <Text muted>{t('capture.preparingMic')}</Text>
        <Button label={t('capture.allowMic')} variant="secondary" onPress={askPermission} />
      </View>
    );
  }

  if (perm === 'denied') {
    return (
      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.md }}>
        <Text variant="heading">{t('capture.micNeededTitle')}</Text>
        <Text muted>{t('capture.micDenied')}</Text>
        <Button label={t('capture.allowMic')} onPress={askPermission} />
      </View>
    );
  }

  const recording = state.isRecording;

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xl }}>
      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
          }}
        >
          {recording ? (
            <View
              style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.danger }}
            />
          ) : null}
          <Text variant="heading">
            {formatClock(elapsed)} / {formatClock(MAX_AUDIO_DURATION_SECONDS)}
          </Text>
        </View>
        <Text variant="caption" muted center>
          {t('capture.audioHint')}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recording ? t('capture.stopRecording') : t('capture.startRecording')}
        onPress={recording ? stop : start}
        style={{
          width: 88,
          height: 88,
          borderRadius: recording ? 20 : 44,
          backgroundColor: theme.colors.danger,
          borderWidth: 4,
          borderColor: theme.colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 30 }}>{recording ? '■' : '🎙️'}</Text>
      </Pressable>
    </View>
  );
}
