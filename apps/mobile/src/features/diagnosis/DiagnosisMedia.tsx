import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { imageSource, videoSource } from '@/api/uploads';
import { Card, Text } from '@/components';
import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';

type Selected = { kind: 'image' | 'video'; id: string } | null;

const THUMB = 76;

/** Vignettes des médias envoyés (photos + vidéos), avec visionneuse plein écran. */
export function DiagnosisMedia({
  imageIds,
  videoIds,
}: {
  imageIds: string[];
  videoIds: string[];
}) {
  const theme = useTheme();
  const [selected, setSelected] = useState<Selected>(null);

  if (imageIds.length === 0 && videoIds.length === 0) return null;

  const open = (value: Selected) => {
    haptics.tap();
    setSelected(value);
  };

  return (
    <Card>
      <Text variant="caption" muted>
        {t('media.heading')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: theme.spacing.sm, paddingTop: theme.spacing.sm }}
      >
        {imageIds.map((id) => (
          <Pressable
            key={id}
            onPress={() => open({ kind: 'image', id })}
            accessibilityRole="imagebutton"
            accessibilityLabel={t('media.photo')}
          >
            <Image
              source={imageSource(id)}
              style={{ width: THUMB, height: THUMB, borderRadius: theme.radii.md }}
              contentFit="cover"
            />
          </Pressable>
        ))}
        {videoIds.map((id) => (
          <Pressable
            key={id}
            onPress={() => open({ kind: 'video', id })}
            accessibilityRole="button"
            accessibilityLabel={t('media.playVideo')}
            style={{
              width: THUMB,
              height: THUMB,
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.surfaceElevated,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            }}
          >
            <Text style={{ fontSize: 22 }}>▶</Text>
            <Text variant="caption" muted>
              {t('media.video')}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <MediaViewer selected={selected} onClose={() => setSelected(null)} />
    </Card>
  );
}

function MediaViewer({ selected, onClose }: { selected: Selected; onClose: () => void }) {
  const theme = useTheme();
  return (
    <Modal
      visible={selected !== null}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' }}>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('media.close')}
          style={{
            position: 'absolute',
            top: theme.spacing.xl,
            right: theme.spacing.lg,
            zIndex: 1,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 18 }}>✕</Text>
        </Pressable>

        <View style={{ flex: 1, padding: theme.spacing.lg, justifyContent: 'center' }}>
          {selected?.kind === 'image' ? (
            <Image
              source={imageSource(selected.id)}
              style={{ flex: 1, width: '100%' }}
              contentFit="contain"
            />
          ) : selected?.kind === 'video' ? (
            <VideoPlayerBox videoId={selected.id} />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function VideoPlayerBox({ videoId }: { videoId: string }) {
  const player = useVideoPlayer(videoSource(videoId), (p) => {
    p.loop = false;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={{ flex: 1, width: '100%' }}
      contentFit="contain"
      nativeControls
    />
  );
}
