import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components';
import { CaptureFlow } from '@/features/capture/CaptureFlow';

export default function CaptureScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const captureMode =
    mode === 'library' ? 'library' : mode === 'video' ? 'video' : 'camera';
  return (
    <Screen scroll={captureMode === 'library'}>
      <CaptureFlow mode={captureMode} />
    </Screen>
  );
}
