import { Image, type ImageLoadEventData } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import type { PhotoAnchor } from '@fixit/shared';
import { authBridge } from '@/api/client';
import { imageSource } from '@/api/uploads';
import { Text } from '@/components';
import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useReducedMotion } from '@/lib/reducedMotion';
import { useTheme } from '@/theme';
import { anchorRect, labelBelow } from './geometry';

type LoadState = 'loading' | 'loaded' | 'error';

/**
 * La photo **de l'utilisateur**, avec la zone de l'étape mise en évidence.
 * Le repère vient du plan visuel produit par l'IA dans le même appel que le
 * guide (`step.visual.anchors`) : aucune requête, aucun quota supplémentaire.
 *
 * Le reste de la photo est assombri (effet projecteur) ; un appui bascule
 * l'assombrissement pour revoir la photo entière.
 */
export function PhotoAnchorView({
  imageId,
  anchor,
  tone,
}: {
  imageId: string;
  anchor: PhotoAnchor;
  tone: string;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [ratio, setRatio] = useState(4 / 3);
  const [dimmed, setDimmed] = useState(true);
  const [state, setState] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);
  const refreshedOnce = useRef(false);
  const pulse = useRef(new Animated.Value(0)).current;

  // Repartir de zéro si la photo change (nouvelle étape).
  useEffect(() => {
    refreshedOnce.current = false;
    setState('loading');
    setAttempt(0);
  }, [imageId]);

  /**
   * `expo-image` ne réessaie jamais tout seul : un jeton d'accès expiré au
   * moment où l'écran s'ouvre échoue une fois, silencieusement, et l'image
   * reste vide **pour de bon** — c'est la « photo tout noire » signalée par
   * l'utilisateur (reproduit en direct : ça arrive typiquement après une
   * longue session, le rafraîchissement automatique des appels API ne
   * couvrant pas les images). On retente une fois avec un jeton frais avant
   * d'afficher un vrai état d'erreur (jamais un cadre noir muet).
   */
  const onError = () => {
    if (!refreshedOnce.current) {
      refreshedOnce.current = true;
      void authBridge.refresh().then((fresh) => {
        if (fresh) setAttempt((a) => a + 1);
        else setState('error');
      });
      return;
    }
    setState('error');
  };

  const retry = () => {
    haptics.tap();
    refreshedOnce.current = false;
    setState('loading');
    setAttempt((a) => a + 1);
  };

  useEffect(() => {
    if (reduced) {
      pulse.setValue(0.5);
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [pulse, reduced]);

  const rect = anchorRect(anchor.box);
  const below = labelBelow(rect);
  const dim = 'rgba(2,6,23,0.55)';

  const onLoad = (e: ImageLoadEventData) => {
    setState('loaded');
    const { width, height } = e.source;
    if (width > 0 && height > 0) setRatio(Math.min(2, Math.max(0.5, width / height)));
  };

  const failed = state === 'error';

  return (
    <Pressable
      onPress={failed ? retry : () => {
        haptics.tap();
        setDimmed((d) => !d);
      }}
      accessibilityRole="imagebutton"
      accessibilityLabel={
        failed ? t('repair.photoUnavailable') : t('repair.anchorA11y', { label: anchor.label })
      }
      accessibilityHint={failed ? t('repair.photoUnavailableHint') : t('repair.anchorHint')}
      style={{
        width: '100%',
        aspectRatio: ratio,
        borderRadius: theme.radii.md,
        overflow: 'hidden',
        backgroundColor: '#020617',
      }}
    >
      <Image
        key={attempt}
        source={imageSource(imageId)}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        onLoad={onLoad}
        onError={onError}
        transition={160}
      />

      {failed ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
            gap: theme.spacing.xs,
          }}
        >
          <Text style={{ fontSize: 28 }}>📷</Text>
          <Text color="#FFFFFF">{t('repair.photoUnavailable')}</Text>
          <Text variant="caption" color="rgba(255,255,255,0.7)">
            {t('repair.photoUnavailableHint')}
          </Text>
        </View>
      ) : dimmed ? (
        <>
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: `${rect.top}%`, backgroundColor: dim }} />
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${rect.top + rect.height}%`,
              bottom: 0,
              backgroundColor: dim,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: 0,
              width: `${rect.left}%`,
              top: `${rect.top}%`,
              height: `${rect.height}%`,
              backgroundColor: dim,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: `${rect.left + rect.width}%`,
              right: 0,
              top: `${rect.top}%`,
              height: `${rect.height}%`,
              backgroundColor: dim,
            }}
          />
        </>
      ) : null}

      {!failed ? (
        <>
          <Animated.View
            style={{
              position: 'absolute',
              left: `${rect.left}%`,
              top: `${rect.top}%`,
              width: `${rect.width}%`,
              height: `${rect.height}%`,
              borderWidth: 2.5,
              borderColor: tone,
              borderRadius: theme.radii.sm,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }),
            }}
          />

          <View
            style={{
              position: 'absolute',
              left: `${Math.max(2, Math.min(rect.left, 62))}%`,
              maxWidth: '58%',
              ...(below
                ? { top: `${Math.min(rect.top + rect.height + 2, 88)}%` }
                : { top: `${Math.max(rect.top - 11, 1)}%` }),
              backgroundColor: tone,
              borderRadius: theme.radii.pill,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.xs,
            }}
          >
            <Text variant="caption" color="#FFFFFF" numberOfLines={1}>
              {anchor.label}
            </Text>
          </View>
        </>
      ) : null}
    </Pressable>
  );
}
