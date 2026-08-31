import { useLocalSearchParams } from 'expo-router';
import { Card, Screen, Text } from '@/components';

export default function CaptureScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  return (
    <Screen>
      <Card>
        <Text variant="heading">Camera & upload — PHASE 3</Text>
        <Text muted>
          This screen will handle {mode === 'library' ? 'picking a photo' : 'taking a photo'},
          preview, description and upload to storage. Not implemented yet.
        </Text>
      </Card>
    </Screen>
  );
}
