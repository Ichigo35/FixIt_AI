import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { audioSource, imageSource, videoSource } from '@/api/uploads';
import { Card, Text } from '@/components';
import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';

type Selected = { kind: 'image' | 'video' | 'audio'; id: string } | null;

const THUMB = 76;

/** Vignettes des médias envoyés (photos + vidéos + audio), avec visionneuse plein écran. */
export function DiagnosisMedia({
  imageIds,
  videoIds,
  audioIds = [],
}: {
  imageIds: string[];
  videoIds: string[];
  audioIds?: string[];
}) {
  const theme = useTheme();
  const [selected, setSelected] = useState<Selected>(null);

  if (imageIds.length === 0 && videoIds.length === 0 && audioIds.length === 0) return null;

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
        {audioIds.map((id) => (
          <Pressable
            key={id}
            onPress={() => open({ kind: 'audio', id })}
            accessibilityRole="button"
            accessibilityLabel={t('media.playAudio')}
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
            <Text style={{ fontSize: 22 }}>🎙️</Text>
            <Text variant="caption" muted>
              {t('media.audio')}
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
          ) : selected?.kind === 'audio' ? (
            <AudioPlayerBox audioId={selected.id} />
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

function AudioPlayerBox({ audioId }: { audioId: string }) {
  const theme = useTheme();
  const player = useAudioPlayer(audioSource(audioId));
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;
  const toggle = () => {
    haptics.tap();
    if (playing) {
      player.pause();
    } else {
      if (status.didJustFinish || status.currentTime >= (status.duration || 0)) player.seekTo(0);
      player.play();
    }
  };
  return (
    <View style={{ alignItems: 'center', gap: theme.spacing.lg }}>
      <Text style={{ fontSize: 44 }}>🎙️</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('media.playAudio')}
        onPress={toggle}
        style={{
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: 'rgba(255,255,255,0.15)',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontSize: 34 }}>{playing ? '❚❚' : '▶'}</Text>
      </Pressable>
      <Text style={{ color: 'rgba(255,255,255,0.7)' }} variant="caption">
        {formatSeconds(status.currentTime)} / {formatSeconds(status.duration)}
      </Text>
    </View>
  );
}

function formatSeconds(value: number | undefined): string {
  const s = Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : 0;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
