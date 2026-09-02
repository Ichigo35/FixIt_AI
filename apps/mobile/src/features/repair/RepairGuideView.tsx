import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { stepIconId, toolIconId, type Part, type RepairGuide, type StepVerdict } from '@fixit/shared';
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
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';
import { StepCheck } from './StepCheck';

function priceLabel(p: Part): string {
  if (!p.priceKnown || p.priceMin == null) return 'Price unavailable';
  const c = !p.currency || p.currency === 'USD' ? '$' : `${p.currency} `;
  return p.priceMax && p.priceMax !== p.priceMin
    ? `${c}${p.priceMin}–${p.priceMax}`
    : `${c}${p.priceMin}`;
}

/** Liste d'outils/consommables : chaque entrée précédée de son icône au trait. */
function ToolList({ title, items }: { title: string; items: string[] }) {
  const theme = useTheme();
  if (items.length === 0) return null;
  return (
    <Card>
      <Text variant="caption" muted>
        {title}
      </Text>
      {items.map((it) => (
        <View
          key={it}
          style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}
        >
          <ToolIcon id={toolIconId(it)} size={22} />
          <Text style={{ flex: 1 }}>{it}</Text>
        </View>
      ))}
    </Card>
  );
}

/** Puce compacte « icône + nom d'outil » pour l'en-tête d'une étape. */
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

export function RepairGuideView({
  guide,
  diagnosisId,
}: {
  guide: RepairGuide;
  diagnosisId?: string;
}) {
  const theme = useTheme();
  const router = useRouter();
  // -1 = overview, 0..n-1 = steps, n = done
  const [pos, setPos] = useState(-1);
  const [verdicts, setVerdicts] = useState<Record<number, StepVerdict>>({});
  const done = pos >= guide.steps.length;
  const sawHazard = Object.values(verdicts).includes('unsafe');

  useEffect(() => {
    if (done) haptics.success();
  }, [done]);

  const go = (next: number) => {
    haptics.tap();
    setPos(next);
  };

  if (pos === -1) {
    return (
      <Screen scroll>
        <View style={{ gap: theme.spacing.sm }}>
          <Text variant="title">Repair guide</Text>
          <Text muted>{guide.summary}</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
            <DifficultyBadge level={guide.difficulty} />
          </View>
          {guide.estimatedTimeMinutes ? (
            <Text variant="caption" muted>
              Estimated time ~{guide.estimatedTimeMinutes} min · {guide.steps.length} steps
            </Text>
          ) : (
            <Text variant="caption" muted>
              {guide.steps.length} steps
            </Text>
          )}
        </View>

        {guide.generalWarnings.length > 0 ? (
          <Card style={{ backgroundColor: theme.colors.cautionBg, borderColor: theme.colors.caution }}>
            <Text variant="caption" color={theme.colors.caution}>
              ⚠ BEFORE YOU START
            </Text>
            {guide.generalWarnings.map((w) => (
              <Text key={w}>• {w}</Text>
            ))}
          </Card>
        ) : null}

        <ToolList title="TOOLS" items={guide.tools} />
        {guide.parts.length > 0 ? (
          <Card>
            <Text variant="caption" muted>
              PARTS
            </Text>
            {guide.parts.map((p) => (
              <View
                key={p.name}
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md }}
              >
                <Text style={{ flex: 1 }}>☑ {p.name}</Text>
                <Text muted>{priceLabel(p)}</Text>
              </View>
            ))}
          </Card>
        ) : null}
        <ToolList title="OPTIONAL" items={guide.optional} />

        <Button label="Start repair" icon="🛠️" onPress={() => go(0)} />
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
          <Text variant="display">{sawHazard ? 'Stop here 🛑' : 'Done 🎉'}</Text>
          {sawHazard ? (
            <Text muted>
              A check flagged a possible hazard during this repair. Don&apos;t keep going — have the
              item looked at by a qualified professional.
            </Text>
          ) : (
            <Text muted>
              You&apos;ve reached the end of the guide. If the problem is fixed, great — otherwise it
              may be time to call a professional.
            </Text>
          )}
          {diagnosisId ? (
            <Button
              label="Log the outcome"
              variant="secondary"
              onPress={() => router.replace({ pathname: '/diagnosis/[id]', params: { id: diagnosisId } })}
            />
          ) : null}
          <Button label="Back to home" onPress={() => router.replace('/')} />
        </View>
      </Screen>
    );
  }

  const step = guide.steps[pos]!;
  return (
    <Screen scroll>
      <FadeInView key={pos} offset={14}>
        <View style={{ gap: theme.spacing.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.colors.primary + (theme.scheme === 'dark' ? '33' : '1A'),
              }}
            >
              <StepIcon id={stepIconId(step)} size={24} />
            </View>
            <Text
              variant="caption"
              muted
              accessibilityRole="progressbar"
              accessibilityLabel={`Step ${pos + 1} of ${guide.steps.length}`}
            >
              STEP {pos + 1} / {guide.steps.length}
            </Text>
          </View>
          <Text variant="title">{step.title}</Text>
          <Text>{step.instruction}</Text>
        </View>
      </FadeInView>

      {step.safetyWarning ? (
        <Card style={{ backgroundColor: theme.colors.dangerBg, borderColor: theme.colors.danger }}>
          <Text
            variant="caption"
            color={theme.colors.danger}
            accessibilityRole="header"
          >
            ⚠ SAFETY
          </Text>
          <Text>{step.safetyWarning}</Text>
        </Card>
      ) : null}

      {step.tools.length > 0 || step.parts.length > 0 ? (
        <Card>
          {step.tools.length > 0 ? (
            <View style={{ gap: theme.spacing.sm }}>
              <Text variant="caption" muted>
                TOOLS
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
              PARTS: {step.parts.join(', ')}
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

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        {pos > 0 ? (
          <Button label="Back" variant="secondary" fullWidth={false} onPress={() => go(pos - 1)} />
        ) : null}
        <Button
          label={pos === guide.steps.length - 1 ? 'Finish' : 'Continue'}
          onPress={() => go(pos + 1)}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}
