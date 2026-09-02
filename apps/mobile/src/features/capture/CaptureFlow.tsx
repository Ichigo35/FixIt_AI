import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { MAX_VIDEO_DURATION_SECONDS } from '@fixit/shared';
import { uploadImage, uploadVideo } from '@/api/uploads';
import { Button, Card, Text } from '@/components';
import { t } from '@/i18n';
import { friendlyError } from '@/lib/errors';
import { useTheme } from '@/theme';
import { CameraCapture } from './CameraCapture';
import { VideoCapture } from './VideoCapture';

type Mode = 'camera' | 'library' | 'video';
type Status = 'idle' | 'uploading' | 'error';

async function pickFromLibrary(kind: 'image' | 'video'): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync(
    kind === 'video'
      ? { mediaTypes: ['videos'], videoMaxDuration: MAX_VIDEO_DURATION_SECONDS, quality: 0.7 }
      : { mediaTypes: ['images'], quality: 0.7 },
  );
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0]?.uri ?? null;
}

export function CaptureFlow({ mode }: { mode: Mode }) {
  const theme = useTheme();
  const router = useRouter();
  const isVideo = mode === 'video';
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const openLibrary = useCallback(async () => {
    const uri = await pickFromLibrary(isVideo ? 'video' : 'image');
    if (uri) setMediaUri(uri);
  }, [isVideo]);

  useEffect(() => {
    if (mode === 'library' && !mediaUri) void openLibrary();
  }, [mode, mediaUri, openLibrary]);

  const analyze = async () => {
    if (!mediaUri) return;
    setStatus('uploading');
    setError(null);
    try {
      if (isVideo) {
        const upload = await uploadVideo(mediaUri);
        router.replace({
          pathname: '/diagnosis/new',
          params: { videoIds: JSON.stringify([upload.id]), description: description.trim() },
        });
      } else {
        const upload = await uploadImage(mediaUri, 'problem');
        router.replace({
          pathname: '/diagnosis/new',
          params: { imageIds: JSON.stringify([upload.id]), description: description.trim() },
        });
      }
    } catch (err) {
      setStatus('error');
      setError(friendlyError(err, 'upload'));
    }
  };

  // --- Étape capture ---
  if (!mediaUri) {
    if (mode === 'camera') {
      return (
        <View style={{ flex: 1 }}>
          <CameraCapture onCaptured={setMediaUri} />
        </View>
      );
    }
    if (mode === 'video') {
      return (
        <View style={{ flex: 1, gap: theme.spacing.md }}>
          <VideoCapture onRecorded={setMediaUri} />
          <Button
            label={t('capture.chooseVideoLibrary')}
            variant="secondary"
            icon="🎞️"
            onPress={openLibrary}
          />
        </View>
      );
    }
    return (
      <Card>
        <Text variant="heading">{t('capture.libraryTitle')}</Text>
        <Text muted>{t('capture.librarySub')}</Text>
        <Button label={t('capture.openLibrary')} icon="🖼️" onPress={openLibrary} />
      </Card>
    );
  }

  // --- Étape preview + description ---
  return (
    <View style={{ gap: theme.spacing.lg }}>
      {isVideo ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <Text style={{ fontSize: 26 }}>🎬</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="heading">{t('capture.videoReady')}</Text>
              <Text variant="caption" muted>
                {t('capture.videoReadySub')}
              </Text>
            </View>
          </View>
        </Card>
      ) : (
        <Image
          source={{ uri: mediaUri }}
          style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radii.lg }}
          contentFit="cover"
        />
      )}

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Button
          label={
            isVideo
              ? t('capture.recordAgain')
              : mode === 'camera'
                ? t('capture.retake')
                : t('capture.chooseAnother')
          }
          variant="secondary"
          onPress={() => {
            setMediaUri(null);
            setStatus('idle');
            setError(null);
          }}
        />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="heading">{t('capture.whatHappened')}</Text>
        <Card>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder={
              isVideo
                ? t('capture.descPlaceholderVideo')
                : t('capture.descPlaceholderPhoto')
            }
            placeholderTextColor={theme.colors.textMuted}
            style={{
              minHeight: 90,
              color: theme.colors.text,
              fontSize: theme.typography.body.fontSize,
              textAlignVertical: 'top',
            }}
          />
        </Card>
      </View>

      <Button
        label={t('capture.analyze')}
        icon="🔍"
        loading={status === 'uploading'}
        onPress={analyze}
      />

      {error ? (
        <Text variant="caption" color={theme.colors.danger} center>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
