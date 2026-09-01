import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { getMe, type Me } from '@/api/me';
import { useAuth } from '@/auth/AuthProvider';
import { Card, FadeInView, Screen, Text } from '@/components';
import { useTheme } from '@/theme';

interface Action {
  icon: string;
  title: string;
  subtitle: string;
  route?: '/capture' | '/describe';
  params?: Record<string, string>;
  soon?: boolean;
}

const ACTIONS: Action[] = [
  {
    icon: '📷',
    title: 'Take a photo',
    subtitle: 'Snap the problem and let AI look',
    route: '/capture',
    params: { mode: 'camera' },
  },
  {
    icon: '🖼️',
    title: 'Upload a photo',
    subtitle: 'Pick an existing photo from your library',
    route: '/capture',
    params: { mode: 'library' },
  },
  {
    icon: '✍️',
    title: 'Describe the problem',
    subtitle: 'Tell us what is wrong in your own words',
    route: '/describe',
  },
  {
    icon: '🎥',
    title: 'Record a video',
    subtitle: 'Strange noises & movement — coming soon',
    soon: true,
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { signOut } = useAuth();
  const [me, setMe] = useState<Me | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getMe()
        .then((v) => alive && setMe(v))
        .catch(() => alive && setMe(null));
      return () => {
        alive = false;
      };
    }, []),
  );

  const quotaLine = me
    ? me.plan === 'premium'
      ? 'Premium · unlimited'
      : `${Math.max(0, me.quota.limit - me.quota.used)} of ${me.quota.limit} diagnoses left`
    : null;

  return (
    <Screen scroll>
      <FadeInView>
        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xl }}>
          <Text variant="display" accessibilityRole="header">
            FixIt AI
          </Text>
          <Text variant="body" muted>
            What&apos;s wrong? Let&apos;s figure it out.
          </Text>
        </View>
      </FadeInView>

      {me ? (
        <Card>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <View>
              <Text variant="caption" muted>
                {me.email ?? 'Signed in'}
              </Text>
              <Text variant="bodyStrong" accessibilityLabel={quotaLine ?? undefined}>
                {quotaLine}
              </Text>
            </View>
            <Pressable
              onPress={signOut}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
            >
              <Text variant="caption" color={theme.colors.primary}>
                Sign out
              </Text>
            </Pressable>
          </View>
        </Card>
      ) : null}

      <Card
        onPress={() => router.push('/history')}
        accessibilityLabel="My Repairs"
        accessibilityHint="Past diagnoses, guides and before/after photos"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Text style={{ fontSize: 26 }}>🧰</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading">My Repairs</Text>
            <Text variant="caption" muted>
              Past diagnoses, guides and before/after
            </Text>
          </View>
          <Text variant="heading" muted>
            ›
          </Text>
        </View>
      </Card>

      <View style={{ gap: theme.spacing.md }}>
        {ACTIONS.map((action) => (
          <Card
            key={action.title}
            disabled={action.soon}
            onPress={
              action.route
                ? () => router.push({ pathname: action.route!, params: action.params })
                : action.soon
                  ? () => undefined
                  : undefined
            }
            accessibilityLabel={
              action.soon ? `${action.title}. Coming soon.` : action.title
            }
            accessibilityHint={action.soon ? undefined : action.subtitle}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
              <Text style={{ fontSize: 26 }}>{action.icon}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="heading">{action.title}</Text>
                <Text variant="caption" muted>
                  {action.subtitle}
                </Text>
              </View>
              {action.soon ? (
                <Text variant="caption" color={theme.colors.caution}>
                  SOON
                </Text>
              ) : (
                <Text variant="heading" muted>
                  ›
                </Text>
              )}
            </View>
          </Card>
        ))}
      </View>

      <Text variant="caption" muted center style={{ marginTop: theme.spacing.md }}>
        FixIt AI gives likely causes, not certainties. For anything involving mains power, gas,
        pressure or vehicle safety systems, it will tell you to call a professional.
      </Text>
    </Screen>
  );
}
