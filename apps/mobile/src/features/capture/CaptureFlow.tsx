import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';
import { uploadImage } from '@/api/uploads';
import { Button, Card, Text } from '@/components';
import { friendlyError } from '@/lib/errors';
import { useTheme } from '@/theme';
import { CameraCapture } from './CameraCapture';

type Mode = 'camera' | 'library';
type Status = 'idle' | 'uploading' | 'error';

async function pickFromLibrary(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0]?.uri ?? null;
}

export function CaptureFlow({ mode }: { mode: Mode }) {
  const theme = useTheme();
  const router = useRouter();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const openLibrary = useCallback(async () => {
    const uri = await pickFromLibrary();
    if (uri) setPhotoUri(uri);
  }, []);

  useEffect(() => {
    if (mode === 'library' && !photoUri) void openLibrary();
  }, [mode, photoUri, openLibrary]);

  const analyze = async () => {
    if (!photoUri) return;
    setStatus('uploading');
    setError(null);
    try {
      const upload = await uploadImage(photoUri, 'problem');
      router.replace({
        pathname: '/diagnosis/new',
        params: { imageIds: JSON.stringify([upload.id]), description: description.trim() },
      });
    } catch (err) {
      setStatus('error');
      setError(friendlyError(err, 'upload'));
    }
  };

  // --- Étape capture ---
  if (!photoUri) {
    if (mode === 'camera') {
      return (
        <View style={{ flex: 1 }}>
          <CameraCapture onCaptured={setPhotoUri} />
        </View>
      );
    }
    return (
      <Card>
        <Text variant="heading">Pick a photo</Text>
        <Text muted>Choose a picture of the problem from your library.</Text>
        <Button label="Open library" icon="🖼️" onPress={openLibrary} />
      </Card>
    );
  }

  // --- Étape preview + description ---
  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Image
        source={{ uri: photoUri }}
        style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radii.lg }}
        contentFit="cover"
      />

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Button
          label={mode === 'camera' ? 'Retake' : 'Choose another'}
          variant="secondary"
          onPress={() => {
            setPhotoUri(null);
            setStatus('idle');
            setError(null);
          }}
        />
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <Text variant="heading">What happened?</Text>
        <Card>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="e.g. Water is leaking from underneath when it spins."
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

      <Button label="Analyze" icon="🔍" loading={status === 'uploading'} onPress={analyze} />

      {error ? (
        <Text variant="caption" color={theme.colors.danger} center>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
