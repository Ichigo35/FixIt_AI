import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, FadeInView, Screen, Text } from '@/components';
import { ONBOARDING_SLIDES, useOnboarding } from '@/lib/onboarding';
import { useTheme } from '@/theme';

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { complete } = useOnboarding();
  const [index, setIndex] = useState(0);

  const slide = ONBOARDING_SLIDES[index]!;
  const last = index === ONBOARDING_SLIDES.length - 1;

  const finish = async () => {
    await complete();
    router.replace('/');
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        {!last ? (
          <Pressable onPress={finish} hitSlop={12} accessibilityRole="button">
            <Text variant="caption" color={theme.colors.primary}>
              Skip
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ flex: 1, justifyContent: 'center', gap: theme.spacing.lg }}>
        <FadeInView key={index} offset={16}>
          <View style={{ gap: theme.spacing.lg }}>
            <Text style={{ fontSize: 56 }}>{slide.icon}</Text>
            <Text variant="display">{slide.title}</Text>
            <Text variant="body" muted>
              {slide.body}
            </Text>
          </View>
        </FadeInView>
      </View>

      <View
        style={{ flexDirection: 'row', gap: theme.spacing.sm, justifyContent: 'center' }}
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${index + 1} of ${ONBOARDING_SLIDES.length}`}
      >
        {ONBOARDING_SLIDES.map((s, i) => (
          <View
            key={s.title}
            style={{
              width: i === index ? 20 : 8,
              height: 8,
              borderRadius: theme.radii.pill,
              backgroundColor: i === index ? theme.colors.primary : theme.colors.border,
            }}
          />
        ))}
      </View>

      <Button
        label={last ? 'Get started' : 'Next'}
        onPress={last ? finish : () => setIndex((i) => i + 1)}
      />
    </Screen>
  );
}
