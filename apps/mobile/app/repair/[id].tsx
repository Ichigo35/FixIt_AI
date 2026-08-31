import { useLocalSearchParams } from 'expo-router';
import { Card, Screen, Text } from '@/components';

export default function RepairGuideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <Screen>
      <Card>
        <Text variant="heading">Repair guide — PHASE 5</Text>
        <Text muted>
          Step-by-step guide (tools, parts, per-step safety warnings) for diagnosis {String(id).slice(0, 8)}…
          is built in the next phase.
        </Text>
      </Card>
    </Screen>
  );
}
