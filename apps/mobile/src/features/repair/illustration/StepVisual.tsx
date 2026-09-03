import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { resolveScene, sceneSpec, type RepairStep } from '@fixit/shared';
import { Text } from '@/components';
import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';
import { pickAnchor } from './geometry';
import { PhotoAnchorView } from './PhotoAnchorView';
import { SceneIllustration } from './SceneIllustration';

type Mode = 'photo' | 'scene';

/**
 * Bloc illustration d'une étape. Deux sources complémentaires :
 *  1. **la photo de l'utilisateur** avec la zone de l'étape mise en évidence
 *     (quand l'IA a su poser un repère) ;
 *  2. **le schéma** du geste, dessiné en natif, toujours disponible.
 * Aucune des deux ne coûte de requête IA supplémentaire.
 */
export function StepVisual({
  step,
  imageIds,
}: {
  step: RepairStep;
  imageIds: string[];
}) {
  const theme = useTheme();
  const scene = resolveScene(step);
  const spec = sceneSpec(scene);
  const anchor = pickAnchor(step.visual?.anchors, imageIds.length);
  const [mode, setMode] = useState<Mode>(anchor ? 'photo' : 'scene');

  const tone =
    spec.tone === 'danger'
      ? theme.colors.danger
      : spec.tone === 'caution'
        ? theme.colors.caution
        : spec.tone === 'success'
          ? theme.colors.success
          : theme.colors.primary;

  const sceneLabel = t(`repair.scene.${scene}`);
  const caption = step.visual?.caption?.trim() || step.title;

  const showPhoto = anchor !== null && mode === 'photo';

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: 3,
            borderRadius: theme.radii.pill,
            backgroundColor: tone + (theme.scheme === 'dark' ? '33' : '1A'),
          }}
        >
          <Text variant="caption" color={tone}>
            {sceneLabel}
          </Text>
        </View>
        <View style={{ flex: 1 }} />
        {anchor ? (
          <View
            style={{
              flexDirection: 'row',
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.border,
              overflow: 'hidden',
            }}
          >
            {(['photo', 'scene'] as const).map((value) => {
              const active = mode === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => {
                    haptics.tap();
                    setMode(value);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={t(`repair.view.${value}`)}
                  style={{
                    paddingHorizontal: theme.spacing.md,
                    paddingVertical: 5,
                    backgroundColor: active ? theme.colors.primary : 'transparent',
                  }}
                >
                  <Text variant="caption" color={active ? theme.colors.primaryText : theme.colors.textMuted}>
                    {t(`repair.view.${value}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {showPhoto && anchor ? (
        <PhotoAnchorView imageId={imageIds[anchor.imageIndex]!} anchor={anchor} tone={tone} />
      ) : (
        <SceneIllustration
          scene={scene}
          accessibilityLabel={t('repair.sceneA11y', { scene: sceneLabel, caption })}
        />
      )}

      <Text variant="caption" muted center>
        {caption}
      </Text>
    </View>
  );
}
