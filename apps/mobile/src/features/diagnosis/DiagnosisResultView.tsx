import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { RECOMMENDATION_META, repairVsReplace, type DiagnosisResult } from '@fixit/shared';
import {
  Button,
  Card,
  DifficultyBadge,
  FadeInView,
  RecommendationBadge,
  RiskBadge,
  Text,
} from '@/components';
import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useMe } from '@/lib/me';
import { useTheme } from '@/theme';
import { DiagnosisMedia } from './DiagnosisMedia';
import { RefineDiagnosis } from './RefineDiagnosis';
import { RepairabilityMeter } from './RepairabilityMeter';

function formatCost(cost: DiagnosisResult['diagnosis']['estimatedCost']): string {
  if (!cost) return t('diagnosis.costUnavailable');
  const c = cost.currency === 'USD' ? '$' : `${cost.currency} `;
  return cost.min === cost.max ? `${c}${cost.min}` : `${c}${cost.min}–${cost.max}`;
}

function formatTime(min?: number | null): string {
  if (!min) return t('diagnosis.timeUnavailable');
  if (min < 60) return t('diagnosis.aboutMin', { n: min });
  return t('diagnosis.aboutHours', { n: Math.round((min / 60) * 10) / 10 });
}

const RVR_LABEL = {
  repair: 'diagnosis.rvrRepair',
  borderline: 'diagnosis.rvrBorderline',
  replace: 'diagnosis.rvrReplace',
} as const;

export function DiagnosisResultView({ result }: { result: DiagnosisResult }) {
  const theme = useTheme();
  const router = useRouter();
  const { isAdmin } = useMe();
  const { diagnosis, safety, repairability } = result;
  const isPro = safety.recommendation === 'PROFESSIONAL';
  // Un admin peut ouvrir le guide malgré une reco « professionnel » (le serveur l'autorise aussi).
  const proBlocked = isPro && !isAdmin;
  const rec = RECOMMENDATION_META[safety.recommendation];

  const rvr = repairVsReplace({
    estimatedCost: diagnosis.estimatedCost ?? null,
    repairabilityScore: repairability.score,
    partsAvailability: diagnosis.partsAvailability,
    riskOfWorseningDamage: diagnosis.riskOfWorseningDamage,
    replacementCost: result.input.replacementCost ?? null,
  });
  const rvrTone =
    rvr.verdict === 'repair'
      ? theme.colors.success
      : rvr.verdict === 'replace'
        ? theme.colors.danger
        : theme.colors.caution;
  const partsLine =
    diagnosis.partsAvailability === 'common'
      ? t('diagnosis.rvrPartsCommon')
      : diagnosis.partsAvailability === 'uncommon'
        ? t('diagnosis.rvrPartsUncommon')
        : t('diagnosis.rvrPartsUnknown');
  const riskLine =
    diagnosis.riskOfWorseningDamage === 'low'
      ? t('diagnosis.rvrRiskLow')
      : diagnosis.riskOfWorseningDamage === 'high'
        ? t('diagnosis.rvrRiskHigh')
        : t('diagnosis.rvrRiskMedium');

  const openGuide = () => {
    haptics.impact();
    router.push({ pathname: '/repair/[id]', params: { id: result.id } });
  };

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <FadeInView delay={0}>
        <Card elevated>
          <Text variant="caption" muted>
            {t('diagnosis.likelyProblem')}
          </Text>
          <Text variant="title">{diagnosis.problem}</Text>
          <Text variant="caption" muted>
            {t('diagnosis.confidence', { pct: Math.round(diagnosis.confidence * 100) })}
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
              {t('diagnosis.identifiedModel')}
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
                {t('diagnosis.serial', { value: diagnosis.identifiedModel.serialNumber })}
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
                {t('diagnosis.time')}
              </Text>
              <Text variant="bodyStrong">{formatTime(diagnosis.estimatedTimeMinutes)}</Text>
            </View>
            <View>
              <Text variant="caption" muted>
                {t('diagnosis.cost')}
              </Text>
              <Text variant="bodyStrong">{formatCost(diagnosis.estimatedCost)}</Text>
            </View>
          </View>
        </Card>
      </FadeInView>

      <FadeInView delay={100}>
        <Card style={{ borderColor: rvrTone }}>
          <Text variant="caption" muted>
            {t('diagnosis.rvrTitle')}
          </Text>
          <Text variant="heading" color={rvrTone}>
            {t(RVR_LABEL[rvr.verdict])}
          </Text>
          {rvr.ratio != null ? (
            <Text variant="caption" muted>
              {t('diagnosis.rvrRatio', { pct: Math.round(rvr.ratio * 100) })}
            </Text>
          ) : null}
          <View style={{ marginTop: theme.spacing.xs }}>
            <Text variant="caption">• {partsLine}</Text>
            <Text variant="caption">• {riskLine}</Text>
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
            {t('diagnosis.possibleCauses')}
          </Text>
          {diagnosis.possibleCauses.map((cause, i) => (
            <Text key={cause}>
              {i + 1}. {cause}
            </Text>
          ))}
        </Card>
      </FadeInView>

      <FadeInView delay={320}>
        <RefineDiagnosis result={result} />
      </FadeInView>

      {isPro && isAdmin ? (
        <Card style={{ borderColor: theme.colors.caution }}>
          <Text variant="caption" color={theme.colors.caution}>
            {t('diagnosis.adminOverrideTitle')}
          </Text>
          <Text muted>{t('diagnosis.adminOverrideBody')}</Text>
        </Card>
      ) : null}

      <Button
        label={
          proBlocked
            ? t('diagnosis.guideBlocked')
            : isPro
              ? t('diagnosis.guideOverride')
              : t('diagnosis.startRepair')
        }
        icon={proBlocked ? '⚠️' : '🛠️'}
        disabled={proBlocked}
        onPress={openGuide}
      />
      <Button
        label={t('diagnosis.backHome')}
        variant="ghost"
        onPress={() => router.replace('/')}
      />
    </View>
  );
}
