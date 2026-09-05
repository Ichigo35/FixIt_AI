import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, View, type ViewStyle } from 'react-native';
import {
  sceneSpec,
  type SceneBody,
  type SceneFocus,
  type SceneMotion,
  type SceneSpec,
  type StepScene,
} from '@fixit/shared';
import { StepIcon, ToolIcon } from '@/components';
import { useReducedMotion } from '@/lib/reducedMotion';
import { useTheme } from '@/theme';

/**
 * Moteur d'illustration d'étape — 100 % natif, 0 réseau, 0 quota IA.
 *
 * Une scène (`StepScene`) est décrite dans `@fixit/shared` par une composition
 * « corps + cible + outil + geste ». Ici on la **dessine** avec des primitives
 * React Native (Views, bordures, transforms) : aucune dépendance SVG, donc
 * aucun module natif à ajouter, et le rendu est identique hors ligne.
 *
 * Repère : canevas virtuel de 100 × 62.5 unités (ratio 16/10). `u` = largeur
 * mesurée / 100, donc tout est proportionnel à la largeur réelle.
 */

const CANVAS_H = 62.5;

interface Ctx {
  /** Taille d'une unité en pixels. */
  u: number;
  /** Trait principal (contours de l'objet). */
  line: string;
  /** Couleur d'accent (cible + geste). */
  accent: string;
  /** Remplissage doux de l'accent. */
  accentSoft: string;
  /** Fond de l'objet. */
  surface: string;
}

/** Position absolue en unités -> style RN en pixels. */
function at(ctx: Ctx, x: number, y: number, w: number, h: number): ViewStyle {
  return {
    position: 'absolute',
    left: x * ctx.u,
    top: y * ctx.u,
    width: w * ctx.u,
    height: h * ctx.u,
  };
}

/* --------------------------------- Animation -------------------------------- */

/** Boucle 0→1 (`pingPong` = aller-retour). Figée si « réduire les animations ». */
function useLoop(duration: number, pingPong: boolean, enabled: boolean): Animated.Value {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) {
      value.setValue(pingPong ? 0.5 : 0);
      return;
    }
    const forward = Animated.timing(value, {
      toValue: 1,
      duration,
      easing: pingPong ? Easing.inOut(Easing.ease) : Easing.linear,
      useNativeDriver: true,
    });
    const anim = Animated.loop(
      pingPong
        ? Animated.sequence([
            forward,
            Animated.timing(value, {
              toValue: 0,
              duration,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        : forward,
    );
    anim.start();
    return () => {
      anim.stop();
      value.setValue(0);
    };
  }, [value, duration, pingPong, enabled]);
  return value;
}

/* -------------------------------- Primitives -------------------------------- */

function Triangle({ ctx, size, color, direction }: { ctx: Ctx; size: number; color: string; direction: 'up' | 'down' | 'left' | 'right' }) {
  const s = size * ctx.u;
  const half = s / 2;
  const base: ViewStyle = { width: 0, height: 0, backgroundColor: 'transparent' };
  if (direction === 'right') {
    return (
      <View
        style={{
          ...base,
          borderTopWidth: half,
          borderBottomWidth: half,
          borderLeftWidth: s,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color,
        }}
      />
    );
  }
  if (direction === 'left') {
    return (
      <View
        style={{
          ...base,
          borderTopWidth: half,
          borderBottomWidth: half,
          borderRightWidth: s,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderRightColor: color,
        }}
      />
    );
  }
  if (direction === 'up') {
    return (
      <View
        style={{
          ...base,
          borderLeftWidth: half,
          borderRightWidth: half,
          borderBottomWidth: s,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
        }}
      />
    );
  }
  return (
    <View
      style={{
        ...base,
        borderLeftWidth: half,
        borderRightWidth: half,
        borderTopWidth: s,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: color,
      }}
    />
  );
}

/** Trait pointillé horizontal (n segments) — fiable sur Android, contrairement à `borderStyle`. */
function DashedLine({ ctx, x, y, width, color }: { ctx: Ctx; x: number; y: number; width: number; color: string }) {
  const dashes = Math.max(4, Math.round(width / 5));
  const dashW = (width / dashes) * 0.6;
  return (
    <>
      {Array.from({ length: dashes }, (_, i) => (
        <View
          key={i}
          style={[
            at(ctx, x + (i * width) / dashes, y, dashW, 0.9),
            { backgroundColor: color, borderRadius: ctx.u },
          ]}
        />
      ))}
    </>
  );
}

/** Équerres de visée autour d'une zone (lecture « cible », sans bordure pointillée). */
function Reticle({ ctx, x, y, w, h, color }: { ctx: Ctx; x: number; y: number; w: number; h: number; color: string }) {
  const arm = Math.min(w, h) * 0.34;
  const t = 1.8;
  // sx/sy : +1 = l'équerre part vers la droite / vers le bas depuis le coin.
  const corner = (cx: number, cy: number, sx: 1 | -1, sy: 1 | -1, key: string) => (
    <View key={key}>
      <View
        style={[
          at(ctx, sx > 0 ? cx : cx - arm, sy > 0 ? cy : cy - t, arm, t),
          { backgroundColor: color, borderRadius: ctx.u },
        ]}
      />
      <View
        style={[
          at(ctx, sx > 0 ? cx : cx - t, sy > 0 ? cy : cy - arm, t, arm),
          { backgroundColor: color, borderRadius: ctx.u },
        ]}
      />
    </View>
  );
  return (
    <>
      {corner(x, y, 1, 1, 'tl')}
      {corner(x + w, y, -1, 1, 'tr')}
      {corner(x, y + h, 1, -1, 'bl')}
      {corner(x + w, y + h, -1, -1, 'br')}
    </>
  );
}

/* ---------------------------------- Corps ---------------------------------- */

/** Point d'accroche de la cible, par silhouette. */
const FOCUS_POINT: Record<SceneBody, { x: number; y: number }> = {
  appliance: { x: 50, y: 36 },
  panel: { x: 30, y: 20 },
  pipe: { x: 62, y: 30 },
  outlet: { x: 44, y: 28 },
  board: { x: 70, y: 40 },
  none: { x: 50, y: 31 },
};

function Body({ ctx, body }: { ctx: Ctx; body: SceneBody }) {
  const stroke = { borderWidth: 2, borderColor: ctx.line, backgroundColor: ctx.surface };

  if (body === 'appliance') {
    // Silhouette **neutre** : un simple objet à deux zones (dessus/dessous),
    // sans détail identifiable. Utilisée pour la majorité des scènes (inspect,
    // clean, replace, reassemble…), elle doit rester crédible pour N'IMPORTE
    // QUEL objet réparé — un piano, un meuble, un vélo, une carte électronique
    // — pas seulement un électroménager. Avant : hublot rond + pieds = lisible
    // comme un lave-linge précis, donc visiblement faux (et déroutant) dès que
    // l'objet réel n'en est pas un — signalé par l'utilisateur sur un piano.
    return (
      <>
        <View style={[at(ctx, 14, 8, 72, 46), stroke, { borderRadius: 4 * ctx.u }]} />
        <View style={[at(ctx, 14, 20, 72, 0.9), { backgroundColor: ctx.line, opacity: 0.35 }]} />
      </>
    );
  }

  if (body === 'panel') {
    return (
      <>
        <View style={[at(ctx, 16, 10, 68, 42), stroke, { borderRadius: 3 * ctx.u }]} />
        {[
          [30, 20],
          [70, 20],
          [30, 42],
          [70, 42],
        ].map(([sx, sy]) => (
          <View
            key={`${sx}-${sy}`}
            style={[
              at(ctx, sx - 3, sy - 3, 6, 6),
              { borderWidth: 1.6, borderColor: ctx.line, borderRadius: 3 * ctx.u, opacity: 0.6 },
            ]}
          />
        ))}
      </>
    );
  }

  if (body === 'pipe') {
    return (
      <>
        <View style={[at(ctx, 6, 24, 88, 12), stroke, { borderRadius: 6 * ctx.u }]} />
        <View style={[at(ctx, 24, 22, 7, 16), stroke, { borderRadius: 1.5 * ctx.u }]} />
        <View style={[at(ctx, 76, 22, 7, 16), stroke, { borderRadius: 1.5 * ctx.u }]} />
      </>
    );
  }

  if (body === 'outlet') {
    return (
      <>
        <View style={[at(ctx, 8, 12, 30, 32), stroke, { borderRadius: 3 * ctx.u }]} />
        <View style={[at(ctx, 19, 20, 2.4, 8), { backgroundColor: ctx.line, borderRadius: ctx.u }]} />
        <View style={[at(ctx, 25, 20, 2.4, 8), { backgroundColor: ctx.line, borderRadius: ctx.u }]} />
        <View style={[at(ctx, 22, 34, 2.4, 4), { backgroundColor: ctx.line, opacity: 0.5, borderRadius: ctx.u }]} />
        <View style={[at(ctx, 56, 20, 20, 16), stroke, { borderRadius: 3 * ctx.u }]} />
        <View style={[at(ctx, 51, 23, 5, 2.4), { backgroundColor: ctx.line, borderRadius: ctx.u }]} />
        <View style={[at(ctx, 51, 30, 5, 2.4), { backgroundColor: ctx.line, borderRadius: ctx.u }]} />
        <View style={[at(ctx, 76, 26.5, 14, 2.4), { backgroundColor: ctx.line, opacity: 0.6, borderRadius: ctx.u }]} />
      </>
    );
  }

  if (body === 'board') {
    return (
      <>
        <View style={[at(ctx, 12, 12, 76, 38), stroke, { borderRadius: 2 * ctx.u }]} />
        <View style={[at(ctx, 20, 20, 12, 9), { borderWidth: 1.6, borderColor: ctx.line, borderRadius: ctx.u, opacity: 0.7 }]} />
        <View style={[at(ctx, 38, 20, 8, 9), { borderWidth: 1.6, borderColor: ctx.line, borderRadius: ctx.u, opacity: 0.7 }]} />
        <View style={[at(ctx, 20, 35, 26, 2), { backgroundColor: ctx.line, opacity: 0.35, borderRadius: ctx.u }]} />
        <View style={[at(ctx, 20, 40, 18, 2), { backgroundColor: ctx.line, opacity: 0.35, borderRadius: ctx.u }]} />
      </>
    );
  }

  return null;
}

/* ---------------------------------- Cibles ---------------------------------- */

function Focus({ ctx, focus, point, body }: { ctx: Ctx; focus: SceneFocus; point: { x: number; y: number }; body: SceneBody }) {
  const { x, y } = point;

  if (focus === 'screw') {
    const d = 13;
    return (
      <>
        <View
          style={[
            at(ctx, x - d / 2, y - d / 2, d, d),
            { borderWidth: 2.4, borderColor: ctx.accent, borderRadius: (d / 2) * ctx.u, backgroundColor: ctx.accentSoft },
          ]}
        />
        <View style={[at(ctx, x - 4, y - 0.8, 8, 1.8), { backgroundColor: ctx.accent, transform: [{ rotate: '45deg' }], borderRadius: ctx.u }]} />
        <View style={[at(ctx, x - 4, y - 0.8, 8, 1.8), { backgroundColor: ctx.accent, transform: [{ rotate: '-45deg' }], borderRadius: ctx.u }]} />
      </>
    );
  }

  if (focus === 'bolt') {
    const d = 13;
    return (
      <>
        <View
          style={[
            at(ctx, x - d / 2, y - d / 2, d, d),
            {
              borderWidth: 2.4,
              borderColor: ctx.accent,
              borderRadius: 2 * ctx.u,
              backgroundColor: ctx.accentSoft,
              transform: [{ rotate: '30deg' }],
            },
          ]}
        />
        <View style={[at(ctx, x - 2.5, y - 2.5, 5, 5), { borderWidth: 1.6, borderColor: ctx.accent, borderRadius: 2.5 * ctx.u }]} />
      </>
    );
  }

  if (focus === 'seam') {
    const width = body === 'appliance' ? 72 : 68;
    const left = body === 'appliance' ? 14 : 16;
    return <DashedLine ctx={ctx} x={left} y={body === 'appliance' ? 20 : 12} width={width} color={ctx.accent} />;
  }

  if (focus === 'connector') {
    return (
      <>
        <View
          style={[
            at(ctx, x - 7, y - 5, 14, 10),
            { borderWidth: 2.2, borderColor: ctx.accent, borderRadius: 1.6 * ctx.u, backgroundColor: ctx.accentSoft },
          ]}
        />
        <View style={[at(ctx, x - 11, y - 3, 4, 1.8), { backgroundColor: ctx.accent, borderRadius: ctx.u }]} />
        <View style={[at(ctx, x - 11, y + 1.2, 4, 1.8), { backgroundColor: ctx.accent, borderRadius: ctx.u }]} />
      </>
    );
  }

  if (focus === 'valve') {
    return (
      <>
        <View
          style={[
            at(ctx, x - 7, y - 7, 14, 14),
            { borderWidth: 2.4, borderColor: ctx.accent, borderRadius: 7 * ctx.u, backgroundColor: ctx.accentSoft },
          ]}
        />
        <View style={[at(ctx, x - 10, y - 1.2, 20, 2.4), { backgroundColor: ctx.accent, borderRadius: ctx.u }]} />
      </>
    );
  }

  if (focus === 'part') {
    return (
      <View
        style={[
          at(ctx, x - 8, y - 7, 16, 14),
          { borderWidth: 2.4, borderColor: ctx.accent, borderRadius: 2 * ctx.u, backgroundColor: ctx.accentSoft },
        ]}
      />
    );
  }

  if (focus === 'zone') {
    return <Reticle ctx={ctx} x={x - 14} y={y - 10} w={28} h={20} color={ctx.accent} />;
  }

  return null;
}

/* ---------------------------------- Gestes ---------------------------------- */

function Motion({ ctx, motion, point, moving }: { ctx: Ctx; motion: SceneMotion; point: { x: number; y: number }; moving: boolean }) {
  const spin = useLoop(2600, false, moving && (motion === 'cw' || motion === 'ccw'));
  const slide = useLoop(1100, true, moving && ['out', 'in', 'up', 'down', 'sweep'].includes(motion));
  const pulse = useLoop(1600, false, moving && motion === 'pulse');
  const fall = useLoop(1500, false, moving && (motion === 'drip' || motion === 'heat'));
  const { x, y } = point;

  if (motion === 'cw' || motion === 'ccw') {
    const d = 30;
    const rotate = spin.interpolate({
      inputRange: [0, 1],
      outputRange: motion === 'cw' ? ['0deg', '360deg'] : ['0deg', '-360deg'],
    });
    return (
      <Animated.View style={[at(ctx, x - d / 2, y - d / 2, d, d), { transform: [{ rotate }] }]}>
        <View
          style={{
            width: d * ctx.u,
            height: d * ctx.u,
            borderRadius: (d / 2) * ctx.u,
            borderWidth: 2.2,
            borderColor: ctx.accent,
            opacity: 0.4,
          }}
        />
        {/* Deux pointes tangentes opposées : le sens se lit même à l'arrêt. */}
        <View style={{ position: 'absolute', left: (d / 2 - 3) * ctx.u, top: -2 * ctx.u }}>
          <Triangle ctx={ctx} size={6} color={ctx.accent} direction={motion === 'cw' ? 'right' : 'left'} />
        </View>
        <View style={{ position: 'absolute', left: (d / 2 - 3) * ctx.u, top: (d - 4) * ctx.u }}>
          <Triangle ctx={ctx} size={6} color={ctx.accent} direction={motion === 'cw' ? 'left' : 'right'} />
        </View>
      </Animated.View>
    );
  }

  if (motion === 'out' || motion === 'in' || motion === 'up' || motion === 'down' || motion === 'sweep') {
    const horizontal = motion === 'out' || motion === 'in' || motion === 'sweep';
    const range = motion === 'sweep' ? [-4, 4] : motion === 'in' ? [6, 0] : [0, 6];
    const shift = slide.interpolate({ inputRange: [0, 1], outputRange: range });
    const dir = motion === 'in' ? 'left' : motion === 'up' ? 'up' : motion === 'down' ? 'down' : 'right';
    const shaft = 14;

    const offset = horizontal
      ? { x: motion === 'in' ? x + 12 : x + 12, y: y - 1 }
      : { x: x - 1, y: motion === 'up' ? y - 26 : y + 12 };

    return (
      <Animated.View
        style={[
          at(ctx, offset.x, offset.y, horizontal ? shaft + 5 : 3, horizontal ? 3 : shaft + 5),
          { transform: horizontal ? [{ translateX: shift }] : [{ translateY: shift }] },
        ]}
      >
        <View
          style={{
            position: 'absolute',
            left: horizontal ? (dir === 'left' ? 5 * ctx.u : 0) : 0.4 * ctx.u,
            top: horizontal ? 0.4 * ctx.u : dir === 'up' ? 5 * ctx.u : 0,
            width: horizontal ? shaft * ctx.u : 2.2 * ctx.u,
            height: horizontal ? 2.2 * ctx.u : shaft * ctx.u,
            backgroundColor: ctx.accent,
            borderRadius: ctx.u,
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: horizontal ? (dir === 'left' ? 0 : shaft * ctx.u - ctx.u) : -1.4 * ctx.u,
            top: horizontal ? -1.4 * ctx.u : dir === 'up' ? 0 : shaft * ctx.u - ctx.u,
          }}
        >
          <Triangle ctx={ctx} size={6} color={ctx.accent} direction={dir} />
        </View>
      </Animated.View>
    );
  }

  if (motion === 'pulse') {
    const d = 34;
    return (
      <Animated.View
        style={[
          at(ctx, x - d / 2, y - d / 2, d, d),
          {
            borderRadius: (d / 2) * ctx.u,
            borderWidth: 2,
            borderColor: ctx.accent,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.25] }) }],
          },
        ]}
      />
    );
  }

  if (motion === 'drip' || motion === 'heat') {
    const rising = motion === 'heat';
    return (
      <>
        {[0, 1, 2].map((i) => {
          const phase = Animated.add(fall, new Animated.Value(i / 3));
          const progress = phase.interpolate({ inputRange: [0, 1, 1.001, 2], outputRange: [0, 1, 0, 1] });
          return (
            <Animated.View
              key={i}
              style={[
                at(ctx, x - 6 + i * 6, rising ? y - 14 : y - 12, rising ? 2.4 : 3.4, rising ? 7 : 3.4),
                {
                  backgroundColor: ctx.accent,
                  borderRadius: 3 * ctx.u,
                  opacity: progress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.9, 0.4, 0] }),
                  transform: [
                    { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, rising ? -10 * ctx.u : 11 * ctx.u] }) },
                  ],
                },
              ]}
            />
          );
        })}
      </>
    );
  }

  return null;
}

/** Outil (ou pictogramme d'étape) posé près de la cible, toujours dans le canevas. */
function ToolOverlay({ ctx, spec, point, color }: { ctx: Ctx; spec: SceneSpec; point: { x: number; y: number }; color: string }) {
  const centered = spec.body === 'none';
  const size = centered ? 32 : 22;
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
  const x = centered ? 50 - size / 2 : clamp(point.x + 6, 2, 100 - size - 2);
  const y = centered ? CANVAS_H / 2 - size / 2 : clamp(point.y - size - 6, 2, CANVAS_H - size - 2);
  return (
    <View style={[at(ctx, x, y, size, size), { transform: [{ rotate: centered ? '0deg' : '-18deg' }] }]}>
      {spec.tool ? (
        <ToolIcon id={spec.tool} size={size * ctx.u} color={color} />
      ) : (
        <StepIcon id={spec.stepIcon!} size={size * ctx.u} color={color} />
      )}
    </View>
  );
}

/* -------------------------------- Composant -------------------------------- */

export interface SceneIllustrationProps {
  scene: StepScene;
  /** Description lue par les lecteurs d'écran (l'image seule ne dit rien). */
  accessibilityLabel?: string;
}

/** Illustration schématique d'une étape (déterministe, hors ligne). */
export function SceneIllustration({ scene, accessibilityLabel }: SceneIllustrationProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const spec: SceneSpec = sceneSpec(scene);

  const toneColor =
    spec.tone === 'danger'
      ? theme.colors.danger
      : spec.tone === 'caution'
        ? theme.colors.caution
        : spec.tone === 'success'
          ? theme.colors.success
          : theme.colors.primary;

  const ctx: Ctx = useMemo(
    () => ({
      u: width / 100,
      line: theme.colors.textMuted,
      accent: toneColor,
      accentSoft: theme.scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
      surface: 'transparent',
    }),
    [width, theme.colors.textMuted, theme.scheme, toneColor],
  );

  const point = FOCUS_POINT[spec.body];

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{
        width: '100%',
        aspectRatio: 100 / CANVAS_H,
        borderRadius: theme.radii.md,
        backgroundColor: theme.scheme === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)',
        overflow: 'hidden',
      }}
    >
      {width > 0 ? (
        <>
          <Body ctx={ctx} body={spec.body} />
          <Focus ctx={ctx} focus={spec.focus} point={point} body={spec.body} />
          <Motion ctx={ctx} motion={spec.motion} point={point} moving={!reduced} />
          {spec.tool || spec.stepIcon ? (
            <ToolOverlay ctx={ctx} spec={spec} point={point} color={theme.colors.text} />
          ) : null}
        </>
      ) : null}
    </View>
  );
}
