import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, View } from 'react-native';
import {
  resolveScene,
  sceneSpec,
  stepIconId,
  toolIconId,
  type Part,
  type RepairGuide,
  type RepairStep,
  type StepVerdict,
} from '@fixit/shared';
import {
  Button,
  Card,
  DifficultyBadge,
  FadeInView,
  Screen,
  StepIcon,
  Text,
  ToolIcon,
} from '@/components';
import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';
import { StepVisual } from './illustration';
import { StepCheck } from './StepCheck';

function priceLabel(p: Part): string {
  if (!p.priceKnown || p.priceMin == null) return t('repair.priceUnavailable');
  const c = !p.currency || p.currency === 'USD' ? '$' : `${p.currency} `;
  return p.priceMax && p.priceMax !== p.priceMin
    ? `${c}${p.priceMin}–${p.priceMax}`
    : `${c}${p.priceMin}`;
}

/* --------------------------------- Briques --------------------------------- */

/** Tuile « icône + nom » pour la liste d'outils de l'aperçu. */
function ToolTile({ name }: { name: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.sm,
        paddingVertical: theme.spacing.sm,
        paddingHorizontal: theme.spacing.md,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surfaceElevated,
        flexGrow: 1,
        flexBasis: '46%',
      }}
    >
      <ToolIcon id={toolIconId(name)} size={20} />
      <Text variant="caption" style={{ flex: 1 }} numberOfLines={2}>
        {name}
      </Text>
    </View>
  );
}

function ToolGrid({ title, items }: { title: string; items: string[] }) {
  const theme = useTheme();
  if (items.length === 0) return null;
  return (
    <Card>
      <Text variant="caption" muted>
        {title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {items.map((it) => (
          <ToolTile key={it} name={it} />
        ))}
      </View>
    </Card>
  );
}

/** Puce compacte « icône + nom d'outil » dans une étape. */
function ToolChip({ name }: { name: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: theme.radii.pill,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
      }}
    >
      <ToolIcon id={toolIconId(name)} size={16} />
      <Text variant="caption">{name}</Text>
    </View>
  );
}

/** Médaillon d'icône de type d'étape. */
function StepMedallion({ step, size = 40, tone }: { step: RepairStep; size?: number; tone?: string }) {
  const theme = useTheme();
  const color = tone ?? theme.colors.primary;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: color + (theme.scheme === 'dark' ? '33' : '1A'),
      }}
    >
      <StepIcon id={stepIconId(step)} size={size * 0.55} color={color} />
    </View>
  );
}

/** Barre de progression animée (largeur => pas de driver natif). */
function ProgressBar({ value }: { value: number }) {
  const theme = useTheme();
  const anim = useRef(new Animated.Value(value)).current;
  useEffect(() => {
    const a = Animated.timing(anim, { toValue: value, duration: 320, useNativeDriver: false });
    a.start();
    return () => a.stop();
  }, [anim, value]);
  return (
    <View
      style={{
        height: 6,
        borderRadius: 3,
        backgroundColor: theme.colors.border,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          height: '100%',
          borderRadius: 3,
          backgroundColor: theme.colors.primary,
          width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  );
}

const RAIL_ITEM = 40;

/** Rail d'étapes : état d'un coup d'œil + saut direct. */
function StepRail({
  guide,
  pos,
  furthest,
  onJump,
}: {
  guide: RepairGuide;
  pos: number;
  furthest: number;
  onJump: (index: number) => void;
}) {
  const theme = useTheme();
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    ref.current?.scrollTo({ x: Math.max(0, pos * RAIL_ITEM - RAIL_ITEM * 2), animated: true });
  }, [pos]);

  return (
    <ScrollView
      ref={ref}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: 2 }}
    >
      {guide.steps.map((step, i) => {
        const done = i < furthest;
        const active = i === pos;
        return (
          <Pressable
            key={step.index}
            onPress={() => onJump(i)}
            accessibilityRole="button"
            accessibilityLabel={t('repair.jumpTo', { n: i + 1, title: step.title })}
            accessibilityState={{ selected: active }}
            style={{
              width: RAIL_ITEM - 8,
              height: RAIL_ITEM - 8,
              borderRadius: (RAIL_ITEM - 8) / 2,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: active ? 0 : 1,
              borderColor: theme.colors.border,
              backgroundColor: active
                ? theme.colors.primary
                : done
                  ? theme.colors.successBg
                  : theme.colors.surface,
            }}
          >
            <Text
              variant="caption"
              color={
                active
                  ? theme.colors.primaryText
                  : done
                    ? theme.colors.success
                    : theme.colors.textMuted
              }
            >
              {done && !active ? '✓' : i + 1}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Point de contrôle cochable — le geste « je l'ai fait » de l'utilisateur. */
function CheckItem({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={t('repair.checkA11y', { label })}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.sm }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? theme.colors.success : theme.colors.border,
          backgroundColor: checked ? theme.colors.success : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {checked ? (
          <Text variant="caption" color={theme.colors.textInverse}>
            ✓
          </Text>
        ) : null}
      </View>
      <Text
        style={{ flex: 1, textDecorationLine: checked ? 'line-through' : 'none' }}
        muted={checked}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* ------------------------------- Écran guide ------------------------------- */

export function RepairGuideView({
  guide,
  diagnosisId,
  imageIds = [],
  onRebuild,
  rebuilding = false,
  rebuildError,
}: {
  guide: RepairGuide;
  diagnosisId?: string;
  /** Photos du diagnostic, dans l'ordre : cible des repères `visual.anchors`. */
  imageIds?: string[];
  /** Régénère un guide écrit avant les illustrations. */
  onRebuild?: () => void;
  rebuilding?: boolean;
  rebuildError?: string | null;
}) {
  const theme = useTheme();
  const router = useRouter();
  // -1 = aperçu, 0..n-1 = étapes, n = fin
  const [pos, setPos] = useState(-1);
  const [furthest, setFurthest] = useState(0);
  const [verdicts, setVerdicts] = useState<Record<number, StepVerdict>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<ScrollView>(null);

  const done = pos >= guide.steps.length;
  const sawHazard = Object.values(verdicts).includes('unsafe');
  const hasVisuals = useMemo(() => guide.steps.some((s) => s.visual != null), [guide.steps]);

  // L'écran reste allumé pendant la réparation : les mains sont occupées.
  useKeepAwake();

  useEffect(() => {
    if (done) haptics.success();
  }, [done]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [pos]);

  const go = (next: number) => {
    haptics.tap();
    setPos(next);
    setFurthest((f) => Math.max(f, Math.min(next, guide.steps.length)));
  };

  /* --------------------------------- Aperçu -------------------------------- */

  if (pos === -1) {
    // Reprise : la dernière étape atteinte, jamais au-delà de la dernière.
    const resumeIndex = Math.min(furthest, guide.steps.length - 1);
    return (
      <Screen scroll>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="title">{t('repair.title')}</Text>
          <Text muted>{guide.summary}</Text>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.spacing.sm,
              marginTop: theme.spacing.xs,
            }}
          >
            <DifficultyBadge level={guide.difficulty} />
            <Text variant="caption" muted>
              {t('repair.stepCount', { count: guide.steps.length })}
              {guide.estimatedTimeMinutes
                ? ` · ${t('repair.aboutMinutes', { min: guide.estimatedTimeMinutes })}`
                : ''}
            </Text>
          </View>
        </View>

        {guide.generalWarnings.length > 0 ? (
          <Card style={{ backgroundColor: theme.colors.cautionBg, borderColor: theme.colors.caution }}>
            <Text variant="caption" color={theme.colors.caution} accessibilityRole="header">
              ⚠ {t('repair.beforeYouStart')}
            </Text>
            {guide.generalWarnings.map((w) => (
              <Text key={w}>• {w}</Text>
            ))}
          </Card>
        ) : null}

        {!hasVisuals && onRebuild ? (
          <Card style={{ borderColor: theme.colors.primary }}>
            <Text variant="bodyStrong">{t('repair.noVisualsTitle')}</Text>
            <Text muted>{t('repair.noVisualsBody')}</Text>
            {rebuildError ? (
              <Text variant="caption" color={theme.colors.danger}>
                {rebuildError}
              </Text>
            ) : null}
            <Button
              label={rebuilding ? t('repair.rebuilding') : t('repair.rebuild')}
              variant="secondary"
              loading={rebuilding}
              onPress={onRebuild}
            />
          </Card>
        ) : null}

        <Card>
          <Text variant="caption" muted>
            {t('repair.plan')}
          </Text>
          {guide.steps.map((step, i) => {
            const tone = sceneSpec(resolveScene(step)).tone;
            const color =
              tone === 'danger'
                ? theme.colors.danger
                : tone === 'caution'
                  ? theme.colors.caution
                  : tone === 'success'
                    ? theme.colors.success
                    : theme.colors.primary;
            return (
              <Pressable
                key={step.index}
                onPress={() => go(i)}
                accessibilityRole="button"
                accessibilityLabel={t('repair.jumpTo', { n: i + 1, title: step.title })}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  paddingVertical: theme.spacing.sm,
                }}
              >
                <StepMedallion step={step} size={36} tone={color} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={2}>{step.title}</Text>
                  <Text variant="caption" muted>
                    {t('repair.stepShort', { n: i + 1 })}
                    {step.estimatedMinutes
                      ? ` · ${t('repair.aboutMinutes', { min: step.estimatedMinutes })}`
                      : ''}
                  </Text>
                </View>
                {step.safetyWarning ? (
                  <Text color={theme.colors.danger}>⚠</Text>
                ) : null}
              </Pressable>
            );
          })}
        </Card>

        <ToolGrid title={t('repair.tools')} items={guide.tools} />
        {guide.parts.length > 0 ? (
          <Card>
            <Text variant="caption" muted>
              {t('repair.parts')}
            </Text>
            {guide.parts.map((p) => (
              <View
                key={p.name}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: theme.spacing.md,
                }}
              >
                <Text style={{ flex: 1 }}>☑ {p.name}</Text>
                <Text muted>{priceLabel(p)}</Text>
              </View>
            ))}
          </Card>
        ) : null}
        <ToolGrid title={t('repair.optional')} items={guide.optional} />

        <Button
          label={furthest > 0 ? t('repair.resume', { n: resumeIndex + 1 }) : t('repair.start')}
          icon="🛠️"
          onPress={() => go(resumeIndex)}
        />
        <Button label={t('common.back')} variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  /* ----------------------------------- Fin ---------------------------------- */

  if (done) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
          <Text variant="display">
            {sawHazard ? `${t('repair.stopTitle')} 🛑` : `${t('repair.doneTitle')} 🎉`}
          </Text>
          <Text muted>{sawHazard ? t('repair.stopBody') : t('repair.doneBody')}</Text>
          {diagnosisId ? (
            <Button
              label={t('repair.logOutcome')}
              variant="secondary"
              onPress={() =>
                router.replace({ pathname: '/diagnosis/[id]', params: { id: diagnosisId } })
              }
            />
          ) : null}
          <Button label={t('repair.backHome')} onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  }

  /* ---------------------------------- Étape --------------------------------- */

  const step = guide.steps[pos]!;
  const progress = (pos + 1) / guide.steps.length;

  return (
    <Screen>
      <View style={{ gap: theme.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Pressable
            onPress={() => go(-1)}
            accessibilityRole="button"
            accessibilityLabel={t('repair.backToPlan')}
            hitSlop={10}
          >
            <Text variant="caption" color={theme.colors.primary}>
              ‹ {t('repair.plan')}
            </Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Text
            variant="caption"
            muted
            accessibilityRole="progressbar"
            accessibilityLabel={t('repair.progressA11y', {
              n: pos + 1,
              total: guide.steps.length,
              percent: Math.round(progress * 100),
            })}
          >
            {t('repair.stepOf', { n: pos + 1, total: guide.steps.length })}
          </Text>
        </View>
        <ProgressBar value={progress} />
        <StepRail guide={guide} pos={pos} furthest={furthest} onJump={go} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <FadeInView key={pos} offset={12}>
          <View style={{ gap: theme.spacing.md }}>
            <StepVisual step={step} imageIds={imageIds} />
            <Text variant="title">{step.title}</Text>
            <Text style={{ lineHeight: 24 }}>{step.instruction}</Text>
          </View>
        </FadeInView>

        {step.safetyWarning ? (
          <Card style={{ backgroundColor: theme.colors.dangerBg, borderColor: theme.colors.danger }}>
            <Text variant="caption" color={theme.colors.danger} accessibilityRole="header">
              ⚠ {t('repair.safety')}
            </Text>
            <Text>{step.safetyWarning}</Text>
          </Card>
        ) : null}

        {step.checks.length > 0 ? (
          <Card>
            <Text variant="caption" muted>
              {t('repair.checksTitle')}
            </Text>
            {step.checks.map((label, i) => {
              const key = `${pos}:${i}`;
              return (
                <CheckItem
                  key={key}
                  label={label}
                  checked={!!checked[key]}
                  onToggle={() => {
                    haptics.tap();
                    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
                  }}
                />
              );
            })}
          </Card>
        ) : null}

        {step.tools.length > 0 || step.parts.length > 0 ? (
          <Card>
            {step.tools.length > 0 ? (
              <View style={{ gap: theme.spacing.sm }}>
                <Text variant="caption" muted>
                  {t('repair.tools')}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                  {step.tools.map((tool) => (
                    <ToolChip key={tool} name={tool} />
                  ))}
                </View>
              </View>
            ) : null}
            {step.parts.length > 0 ? (
              <Text variant="caption" muted>
                {t('repair.parts')}: {step.parts.join(', ')}
              </Text>
            ) : null}
          </Card>
        ) : null}

        {diagnosisId ? (
          <StepCheck
            key={pos}
            diagnosisId={diagnosisId}
            stepIndex={pos}
            step={step}
            onVerdict={(v) => setVerdicts((prev) => ({ ...prev, [pos]: v }))}
          />
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {pos > 0 ? (
          <Button
            label={t('repair.previous')}
            variant="secondary"
            fullWidth={false}
            onPress={() => go(pos - 1)}
          />
        ) : null}
        <Button
          label={pos === guide.steps.length - 1 ? t('repair.finish') : t('repair.next')}
          onPress={() => go(pos + 1)}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}
