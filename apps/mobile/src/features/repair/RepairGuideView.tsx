import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { Part, RepairGuide, StepVerdict } from '@fixit/shared';
import { Button, Card, DifficultyBadge, FadeInView, Screen, Text } from '@/components';
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

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Card>
      <Text variant="caption" muted>
        {title}
      </Text>
      {items.map((it) => (
        <Text key={it}>☑ {it}</Text>
      ))}
    </Card>
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

        <List title="TOOLS" items={guide.tools} />
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
        <List title="OPTIONAL" items={guide.optional} />

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
          <Text
            variant="caption"
            muted
            accessibilityRole="progressbar"
            accessibilityLabel={`Step ${pos + 1} of ${guide.steps.length}`}
          >
            STEP {pos + 1} / {guide.steps.length}
          </Text>
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
          {step.tools.length > 0 ? <Text variant="caption" muted>TOOLS: {step.tools.join(', ')}</Text> : null}
          {step.parts.length > 0 ? <Text variant="caption" muted>PARTS: {step.parts.join(', ')}</Text> : null}
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
