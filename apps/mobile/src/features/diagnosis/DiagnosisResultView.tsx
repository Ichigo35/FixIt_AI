import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { RECOMMENDATION_META, type DiagnosisResult } from '@fixit/shared';
import {
  Button,
  Card,
  DifficultyBadge,
  RecommendationBadge,
  RiskBadge,
  Text,
} from '@/components';
import { useTheme } from '@/theme';
import { RepairabilityMeter } from './RepairabilityMeter';

function formatCost(cost: DiagnosisResult['diagnosis']['estimatedCost']): string {
  if (!cost) return 'Cost estimate unavailable';
  const c = cost.currency === 'USD' ? '$' : `${cost.currency} `;
  return cost.min === cost.max ? `${c}${cost.min}` : `${c}${cost.min}–${cost.max}`;
}

function formatTime(min?: number | null): string {
  if (!min) return 'Time estimate unavailable';
  if (min < 60) return `~${min} min`;
  const h = Math.round((min / 60) * 10) / 10;
  return `~${h} h`;
}

export function DiagnosisResultView({ result }: { result: DiagnosisResult }) {
  const theme = useTheme();
  const router = useRouter();
  const { diagnosis, safety, repairability } = result;
  const isPro = safety.recommendation === 'PROFESSIONAL';
  const rec = RECOMMENDATION_META[safety.recommendation];

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Card elevated>
        <Text variant="caption" muted>
          LIKELY PROBLEM
        </Text>
        <Text variant="title">{diagnosis.problem}</Text>
        <Text variant="caption" muted>
          Confidence {Math.round(diagnosis.confidence * 100)}%
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.sm,
            marginTop: theme.spacing.sm,
          }}
        >
          <RecommendationBadge level={safety.recommendation} />
          <DifficultyBadge level={diagnosis.difficulty} />
          <RiskBadge level={safety.riskLevel} />
        </View>
      </Card>

      <Card>
        <RepairabilityMeter score={repairability.score} label={repairability.label} />
        <View style={{ flexDirection: 'row', gap: theme.spacing.xl, marginTop: theme.spacing.sm }}>
          <View>
            <Text variant="caption" muted>
              TIME
            </Text>
            <Text variant="bodyStrong">{formatTime(diagnosis.estimatedTimeMinutes)}</Text>
          </View>
          <View>
            <Text variant="caption" muted>
              COST
            </Text>
            <Text variant="bodyStrong">{formatCost(diagnosis.estimatedCost)}</Text>
          </View>
        </View>
      </Card>

      <Card style={isPro ? { borderColor: theme.colors.caution } : undefined}>
        <Text variant="heading">
          {rec.emoji} {rec.title}
        </Text>
        <Text muted>{rec.blurb}</Text>
        <Text style={{ marginTop: theme.spacing.xs }}>{diagnosis.recommendedAction}</Text>
      </Card>

      <Card>
        <Text variant="caption" muted>
          POSSIBLE CAUSES
        </Text>
        {diagnosis.possibleCauses.map((cause, i) => (
          <Text key={cause}>
            {i + 1}. {cause}
          </Text>
        ))}
      </Card>

      {diagnosis.moreInfoNeeded.length > 0 ? (
        <Card style={{ backgroundColor: theme.colors.cautionBg, borderColor: theme.colors.caution }}>
          <Text variant="caption" color={theme.colors.caution}>
            MORE INFORMATION WOULD HELP
          </Text>
          {diagnosis.moreInfoNeeded.map((q) => (
            <Text key={q}>• {q}</Text>
          ))}
        </Card>
      ) : null}

      <Button
        label={isPro ? 'Repair guide not recommended' : 'Start Repair'}
        icon={isPro ? '⚠️' : '🛠️'}
        disabled={isPro}
        onPress={() =>
          router.push({ pathname: '/repair/[id]', params: { id: result.id } })
        }
      />
      <Button label="Back to home" variant="ghost" onPress={() => router.replace('/')} />
    </View>
  );
}
