import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { TextInput, View, type ScrollView } from 'react-native';
import { MAX_VIDEO_DURATION_SECONDS } from '@fixit/shared';
import { uploadAudio, uploadImage, uploadVideo } from '@/api/uploads';
import { Button, Card, Screen, Text } from '@/components';
import { t } from '@/i18n';
import { friendlyError } from '@/lib/errors';
import { useTheme } from '@/theme';
import { AudioCapture } from './AudioCapture';
import { CameraCapture } from './CameraCapture';
import { VideoCapture } from './VideoCapture';

type Mode = 'camera' | 'library' | 'video' | 'audio';
type Status = 'idle' | 'uploading' | 'error';

/** Nombre minimal de caractères de description exigé quand le média est un clip audio. */
const AUDIO_MIN_DESCRIPTION = 8;

interface PickedMedia {
  uri: string;
  mimeType?: string | null;
}

async function pickFromLibrary(kind: 'image' | 'video'): Promise<PickedMedia | null> {
  const result = await ImagePicker.launchImageLibraryAsync(
    kind === 'video'
      ? { mediaTypes: ['videos'], videoMaxDuration: MAX_VIDEO_DURATION_SECONDS, quality: 0.7 }
      : { mediaTypes: ['images'], quality: 0.7 },
  );
  if (result.canceled || result.assets.length === 0) return null;
  const asset = result.assets[0];
  if (!asset?.uri) return null;
  return { uri: asset.uri, mimeType: asset.mimeType };
}

export function CaptureFlow({ mode }: { mode: Mode }) {
  const theme = useTheme();
  const router = useRouter();
  const isVideo = mode === 'video';
  const isAudio = mode === 'audio';
  const [media, setMedia] = useState<PickedMedia | null>(null);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const openLibrary = useCallback(async () => {
    const picked = await pickFromLibrary(isVideo ? 'video' : 'image');
    if (picked) setMedia(picked);
  }, [isVideo]);

  useEffect(() => {
    if (mode === 'library' && !media) void openLibrary();
  }, [mode, media, openLibrary]);

  const audioNeedsMore = isAudio && description.trim().length < AUDIO_MIN_DESCRIPTION;

  const analyze = async () => {
    if (!media || audioNeedsMore) return;
    setStatus('uploading');
    setError(null);
    try {
      if (isVideo) {
        const upload = await uploadVideo(media.uri, media.mimeType);
        router.replace({
          pathname: '/diagnosis/new',
          params: { videoIds: JSON.stringify([upload.id]), description: description.trim() },
        });
      } else if (isAudio) {
        const upload = await uploadAudio(media.uri, media.mimeType);
        router.replace({
          pathname: '/diagnosis/new',
          params: { audioIds: JSON.stringify([upload.id]), description: description.trim() },
        });
      } else {
        const upload = await uploadImage(media.uri, 'problem', media.mimeType);
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
  if (!media) {
    if (mode === 'camera') {
      return (
        <Screen>
          <View style={{ flex: 1 }}>
            <CameraCapture onCaptured={(uri) => setMedia({ uri })} />
          </View>
        </Screen>
      );
    }
    if (mode === 'video') {
      return (
        <Screen>
          <View style={{ flex: 1, gap: theme.spacing.md }}>
            <VideoCapture onRecorded={(uri) => setMedia({ uri })} />
            <Button
              label={t('capture.chooseVideoLibrary')}
              variant="secondary"
              icon="🎞️"
              onPress={openLibrary}
            />
          </View>
        </Screen>
      );
    }
    if (mode === 'audio') {
      return (
        <Screen>
          <View style={{ flex: 1 }}>
            <AudioCapture onRecorded={(uri) => setMedia({ uri })} />
          </View>
        </Screen>
      );
    }
    return (
      <Screen scroll>
        <Card>
          <Text variant="heading">{t('capture.libraryTitle')}</Text>
          <Text muted>{t('capture.librarySub')}</Text>
          <Button label={t('capture.openLibrary')} icon="🖼️" onPress={openLibrary} />
        </Card>
      </Screen>
    );
  }

  // --- Étape preview + description ---
  return (
    <Screen scroll keyboardAware scrollRef={scrollRef}>
      <View style={{ gap: theme.spacing.lg }}>
        {isVideo || isAudio ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Text style={{ fontSize: 26 }}>{isAudio ? '🎙️' : '🎬'}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading">
                  {isAudio ? t('capture.audioReady') : t('capture.videoReady')}
                </Text>
                <Text variant="caption" muted>
                  {isAudio ? t('capture.audioReadySub') : t('capture.videoReadySub')}
                </Text>
              </View>
            </View>
          </Card>
        ) : (
          <Image
            source={{ uri: media.uri }}
            style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radii.lg }}
            contentFit="cover"
          />
        )}

        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Button
            label={
              isAudio
                ? t('capture.recordAudioAgain')
                : isVideo
                  ? t('capture.recordAgain')
                  : mode === 'camera'
                    ? t('capture.retake')
                    : t('capture.chooseAnother')
            }
            variant="secondary"
            onPress={() => {
              setMedia(null);
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
                isAudio
                  ? t('capture.descPlaceholderAudio')
                  : isVideo
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
          disabled={audioNeedsMore}
          onPress={analyze}
        />

        {audioNeedsMore ? (
          <Text variant="caption" muted center>
            {t('capture.audioNeedsDescription')}
          </Text>
        ) : null}

        {error ? (
          <Text variant="caption" color={theme.colors.danger} center>
            {error}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
