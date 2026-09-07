import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button, Card, Screen, Text } from '@/components';
import {
  EMPTY_EXTRA_DETAILS,
  ExtraDetailsFields,
  type ExtraDetails,
} from '@/features/diagnosis/ExtraDetailsFields';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

export default function DescribeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [text, setText] = useState('');
  const [extra, setExtra] = useState<ExtraDetails>(EMPTY_EXTRA_DETAILS);
  const onExtraChange = useCallback((v: ExtraDetails) => setExtra(v), []);

  const submit = () => {
    const params: Record<string, string> = { description: text.trim() };
    if (extra.brand) params.brand = extra.brand;
    if (extra.model) params.model = extra.model;
    if (extra.serialNumber) params.serialNumber = extra.serialNumber;
    if (extra.errorCode) params.errorCode = extra.errorCode;
    if (extra.measurements) params.measurements = extra.measurements;
    if (extra.replacementCost != null) params.replacementCost = String(extra.replacementCost);
    if (extra.labelImageId) params.imageIds = JSON.stringify([extra.labelImageId]);
    router.push({ pathname: '/diagnosis/new', params });
  };

  return (
    <Screen scroll keyboardAware>
      <Text variant="title">{t('describe.title')}</Text>
      <Text muted>{t('describe.help')}</Text>

      <Card>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder={t('describe.placeholder')}
          placeholderTextColor={theme.colors.textMuted}
          style={{
            minHeight: 120,
            color: theme.colors.text,
            fontSize: theme.typography.body.fontSize,
            textAlignVertical: 'top',
          }}
        />
      </Card>

      <ExtraDetailsFields onChange={onExtraChange} />

      <View style={{ gap: theme.spacing.sm }}>
        <Button
          label={t('capture.analyze')}
          icon="🔍"
          disabled={text.trim().length < 8}
          onPress={submit}
        />
        <Text variant="caption" muted center>
          {t('describe.photoHint')}
        </Text>
      </View>
    </Screen>
  );
}
