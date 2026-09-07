import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { RECOMMENDATION_META, type DiagnosisResult } from '@fixit/shared';
import {
  Button,
  Card,
  DifficultyBadge,
  FadeInView,
  RecommendationBadge,
  RiskBadge,
  Text,
} from '@/components';
import { haptics } from '@/lib/haptics';
import { useMe } from '@/lib/me';
import { useTheme } from '@/theme';
import { DiagnosisMedia } from './DiagnosisMedia';
import { RefineDiagnosis } from './RefineDiagnosis';
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
  const { isAdmin } = useMe();
  const { diagnosis, safety, repairability } = result;
  const isPro = safety.recommendation === 'PROFESSIONAL';
  // Un admin peut ouvrir le guide malgré une reco « professionnel » (le serveur l'autorise aussi).
  const proBlocked = isPro && !isAdmin;
  const rec = RECOMMENDATION_META[safety.recommendation];

  const openGuide = () => {
    haptics.impact();
    router.push({ pathname: '/repair/[id]', params: { id: result.id } });
  };

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <FadeInView delay={0}>
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
      </FadeInView>

      {result.input.imageIds.length > 0 ||
      result.input.videoIds.length > 0 ||
      (result.input.audioIds?.length ?? 0) > 0 ? (
        <FadeInView delay={50}>
          <DiagnosisMedia
            imageIds={result.input.imageIds}
            videoIds={result.input.videoIds}
            audioIds={result.input.audioIds ?? []}
          />
        </FadeInView>
      ) : null}

      {diagnosis.identifiedModel?.confident &&
      (diagnosis.identifiedModel.brand ||
        diagnosis.identifiedModel.model ||
        diagnosis.identifiedModel.serialNumber) ? (
        <FadeInView delay={60}>
          <Card>
            <Text variant="caption" muted>
              IDENTIFIED MODEL
            </Text>
            {diagnosis.identifiedModel.brand || diagnosis.identifiedModel.model ? (
              <Text variant="bodyStrong">
                {[diagnosis.identifiedModel.brand, diagnosis.identifiedModel.model]
                  .filter(Boolean)
                  .join(' ')}
              </Text>
            ) : null}
            {diagnosis.identifiedModel.serialNumber ? (
              <Text variant="caption" muted>
                S/N {diagnosis.identifiedModel.serialNumber}
              </Text>
            ) : null}
          </Card>
        </FadeInView>
      ) : null}

      <FadeInView delay={70}>
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
      </FadeInView>

      <FadeInView delay={140}>
        <Card style={isPro ? { borderColor: theme.colors.caution } : undefined}>
          <Text variant="heading">
            {rec.emoji} {rec.title}
          </Text>
          <Text muted>{rec.blurb}</Text>
          <Text style={{ marginTop: theme.spacing.xs }}>{diagnosis.recommendedAction}</Text>
        </Card>
      </FadeInView>

      <FadeInView delay={210}>
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
      </FadeInView>

      {diagnosis.moreInfoNeeded.length > 0 ? (
        <FadeInView delay={280}>
          <Card
            style={{ backgroundColor: theme.colors.cautionBg, borderColor: theme.colors.caution }}
          >
            <Text variant="caption" color={theme.colors.caution}>
              MORE INFORMATION WOULD HELP
            </Text>
            {diagnosis.moreInfoNeeded.map((q) => (
              <Text key={q}>• {q}</Text>
            ))}
          </Card>
        </FadeInView>
      ) : null}

      <FadeInView delay={320}>
        <RefineDiagnosis result={result} />
      </FadeInView>

      {isPro && isAdmin ? (
        <Card style={{ borderColor: theme.colors.caution }}>
          <Text variant="caption" color={theme.colors.caution}>
            ⚠️ ADMIN OVERRIDE
          </Text>
          <Text muted>
            This repair is normally professional-only. The guide is unlocked for your account —
            follow every safety warning and stop if anything looks unsafe.
          </Text>
        </Card>
      ) : null}

      <Button
        label={
          proBlocked
            ? 'Repair guide not recommended'
            : isPro
              ? 'Open repair guide (override)'
              : 'Start Repair'
        }
        icon={proBlocked ? '⚠️' : '🛠️'}
        disabled={proBlocked}
        onPress={openGuide}
      />
      <Button label="Back to home" variant="ghost" onPress={() => router.replace('/')} />
    </View>
  );
}
