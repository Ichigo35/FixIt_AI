import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme';

export default function DescribeScreen() {
  const theme = useTheme();
  const [text, setText] = useState('');

  return (
    <Screen scroll>
      <Text variant="title">What happened?</Text>
      <Text muted>
        Describe the problem in a sentence or two. Examples: “The washing machine makes a loud
        noise.” · “Water is leaking from underneath.” · “The computer won&apos;t turn on.”
      </Text>

      <Card>
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Describe the problem…"
          placeholderTextColor={theme.colors.textMuted}
          style={{
            minHeight: 120,
            color: theme.colors.text,
            fontSize: theme.typography.body.fontSize,
            textAlignVertical: 'top',
          }}
        />
      </Card>

      <View style={{ gap: theme.spacing.sm }}>
        <Button label="Analyze" icon="🔍" disabled={text.trim().length < 8} />
        <Text variant="caption" muted center>
          Diagnosis pipeline arrives in PHASE 4.
        </Text>
      </View>
    </Screen>
  );
}
