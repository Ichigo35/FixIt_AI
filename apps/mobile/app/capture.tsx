import { useLocalSearchParams } from 'expo-router';
import { CaptureFlow } from '@/features/capture/CaptureFlow';

export default function CaptureScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const captureMode =
    mode === 'library'
      ? 'library'
      : mode === 'video'
        ? 'video'
        : mode === 'audio'
          ? 'audio'
          : 'camera';
  return <CaptureFlow mode={captureMode} />;
}
