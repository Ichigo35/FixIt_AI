import { View, type ViewStyle } from 'react-native';
import {
  DIFFICULTY_META,
  RECOMMENDATION_META,
  type Difficulty,
  type Recommendation,
  type RiskLevel,
} from '@fixit/shared';
import { useTheme } from '@/theme';
import { Text } from './Text';

type Tone = 'neutral' | 'success' | 'caution' | 'danger' | 'advanced';

function Pill({
  tone,
  children,
  accessibilityLabel,
}: {
  tone: Tone;
  children: string;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const map: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: theme.colors.border, fg: theme.colors.textMuted },
    success: { bg: theme.colors.successBg, fg: theme.colors.success },
    caution: { bg: theme.colors.cautionBg, fg: theme.colors.caution },
    danger: { bg: theme.colors.dangerBg, fg: theme.colors.danger },
    advanced: { bg: theme.colors.cautionBg, fg: theme.colors.advanced },
  };
  const style: ViewStyle = {
    backgroundColor: map[tone].bg,
    borderRadius: theme.radii.pill,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs + 1,
    alignSelf: 'flex-start',
  };
  return (
    <View style={style} accessible accessibilityLabel={accessibilityLabel ?? children}>
      <Text variant="caption" color={map[tone].fg}>
        {children}
      </Text>
    </View>
  );
}

const RISK_TONE: Record<RiskLevel, Tone> = {
  LOW: 'success',
  MEDIUM: 'caution',
  HIGH: 'advanced',
  CRITICAL: 'danger',
};

const DIFFICULTY_TONE: Record<Difficulty, Tone> = {
  EASY: 'success',
  INTERMEDIATE: 'caution',
  ADVANCED: 'advanced',
  PROFESSIONAL: 'danger',
};

const RECOMMENDATION_TONE: Record<Recommendation, Tone> = {
  DIY: 'success',
  CAUTION: 'caution',
  PROFESSIONAL: 'danger',
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <Pill tone={RISK_TONE[level]} accessibilityLabel={`Risk level: ${level.toLowerCase()}`}>
      {`RISK · ${level}`}
    </Pill>
  );
}

export function DifficultyBadge({ level }: { level: Difficulty }) {
  const meta = DIFFICULTY_META[level];
  return (
    <Pill
      tone={DIFFICULTY_TONE[level]}
      accessibilityLabel={`Difficulty: ${meta.label.toLowerCase()}`}
    >
      {`${meta.emoji} ${meta.label.toUpperCase()}`}
    </Pill>
  );
}

export function RecommendationBadge({ level }: { level: Recommendation }) {
  const meta = RECOMMENDATION_META[level];
  return (
    <Pill
      tone={RECOMMENDATION_TONE[level]}
      accessibilityLabel={`Recommendation: ${meta.title.toLowerCase()}`}
    >
      {`${meta.emoji} ${meta.title}`}
    </Pill>
  );
}
