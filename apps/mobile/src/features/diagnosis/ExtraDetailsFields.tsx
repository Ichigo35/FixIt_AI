import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { isDtcFormat } from '@fixit/shared';
import { uploadImage } from '@/api/uploads';
import { Button, Card, Text } from '@/components';
import { t } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme';

export interface ExtraDetails {
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  errorCode: string | null;
  measurements: string | null;
  /** Prix du neuf approximatif (verdict « réparer ou remplacer »). */
  replacementCost: number | null;
  /** id d'upload de la photo de plaque signalétique (kind=label), à concaténer aux imageIds. */
  labelImageId: string | null;
}

export const EMPTY_EXTRA_DETAILS: ExtraDetails = {
  brand: null,
  model: null,
  serialNumber: null,
  errorCode: null,
  measurements: null,
  replacementCost: null,
  labelImageId: null,
};

function clean(v: string): string | null {
  const s = v.trim();
  return s.length > 0 ? s : null;
}

/**
 * Champs facultatifs qui affinent le diagnostic (plaque signalétique, code d'erreur,
 * mesures). Repliés par défaut. Remonte l'état complet via `onChange` à chaque frappe.
 */
export function ExtraDetailsFields({ onChange }: { onChange: (v: ExtraDetails) => void }) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serial, setSerial] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [measurements, setMeasurements] = useState('');
  const [replacementCost, setReplacementCost] = useState('');
  const [label, setLabel] = useState<{ status: 'idle' | 'uploading' | 'done' | 'error'; id: string | null }>({
    status: 'idle',
    id: null,
  });
  const uploading = useRef(false);

  // `onChange` est attendu stable (useCallback côté appelant) ; on ré-émet à chaque frappe.
  useEffect(() => {
    const rc = Number.parseFloat(replacementCost.replace(',', '.'));
    onChange({
      brand: clean(brand),
      model: clean(model),
      serialNumber: clean(serial),
      errorCode: clean(errorCode),
      measurements: clean(measurements),
      replacementCost: Number.isFinite(rc) && rc > 0 ? rc : null,
      labelImageId: label.id,
    });
  }, [onChange, brand, model, serial, errorCode, measurements, replacementCost, label.id]);

  const pickLabel = useCallback(async () => {
    if (uploading.current) return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7 }).catch(() => null);
    const picked =
      res && !res.canceled ? res : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (picked.canceled || picked.assets.length === 0) return;
    const asset = picked.assets[0];
    if (!asset?.uri) return;
    uploading.current = true;
    setLabel({ status: 'uploading', id: null });
    try {
      const up = await uploadImage(asset.uri, 'label', asset.mimeType);
      haptics.tap();
      setLabel({ status: 'done', id: up.id });
    } catch {
      setLabel({ status: 'error', id: null });
    } finally {
      uploading.current = false;
    }
  }, []);

  const dtcOk = isDtcFormat(errorCode);

  if (!open) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={{ paddingVertical: theme.spacing.xs }}
      >
        <Text variant="caption" color={theme.colors.primary}>
          ＋ {t('extra.toggle')}
        </Text>
      </Pressable>
    );
  }

  const fieldStyle = {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    paddingVertical: 6,
  } as const;

  return (
    <Card>
      <View style={{ gap: theme.spacing.md }}>
        <Text variant="caption" muted>
          {t('extra.heading')}
        </Text>

        <Button
          label={
            label.status === 'done'
              ? t('extra.labelPhotoAdded')
              : label.status === 'uploading'
                ? t('extra.labelPhotoUploading')
                : t('extra.labelPhoto')
          }
          variant="secondary"
          icon="🏷️"
          loading={label.status === 'uploading'}
          onPress={pickLabel}
        />
        {label.status === 'error' ? (
          <Text variant="caption" color={theme.colors.danger}>
            {t('extra.labelPhotoError')}
          </Text>
        ) : null}

        <View>
          <Text variant="caption" muted>
            {t('extra.brand')}
          </Text>
          <TextInput
            value={brand}
            onChangeText={setBrand}
            placeholder={t('extra.brandPlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            style={fieldStyle}
          />
        </View>
        <View>
          <Text variant="caption" muted>
            {t('extra.model')}
          </Text>
          <TextInput
            value={model}
            onChangeText={setModel}
            placeholder={t('extra.modelPlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            style={fieldStyle}
          />
        </View>
        <View>
          <Text variant="caption" muted>
            {t('extra.serial')}
          </Text>
          <TextInput
            value={serial}
            onChangeText={setSerial}
            autoCapitalize="characters"
            placeholder={t('extra.serialPlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            style={fieldStyle}
          />
        </View>

        <View>
          <Text variant="caption" muted>
            {t('extra.errorCode')}
          </Text>
          <TextInput
            value={errorCode}
            onChangeText={setErrorCode}
            autoCapitalize="characters"
            placeholder={t('extra.errorCodePlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            style={fieldStyle}
          />
          {dtcOk ? (
            <Text variant="caption" color={theme.colors.success}>
              {t('extra.dtcRecognized')}
            </Text>
          ) : null}
        </View>

        <View>
          <Text variant="caption" muted>
            {t('extra.measurements')}
          </Text>
          <TextInput
            value={measurements}
            onChangeText={setMeasurements}
            multiline
            placeholder={t('extra.measurementsPlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            style={{ ...fieldStyle, minHeight: 64, textAlignVertical: 'top' }}
          />
        </View>

        <View>
          <Text variant="caption" muted>
            {t('extra.replacementCost')}
          </Text>
          <TextInput
            value={replacementCost}
            onChangeText={setReplacementCost}
            keyboardType="decimal-pad"
            placeholder={t('extra.replacementCostPlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            style={fieldStyle}
          />
        </View>
      </View>
    </Card>
  );
}
