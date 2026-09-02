import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { getMe, type Me } from '@/api/me';
import { useAuth } from '@/auth/AuthProvider';
import { Card, FadeInView, Screen, Text } from '@/components';
import { t } from '@/i18n';
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
    title: t('home.actionPhotoTitle'),
    subtitle: t('home.actionPhotoSub'),
    route: '/capture',
    params: { mode: 'camera' },
  },
  {
    icon: '🖼️',
    title: t('home.actionUploadTitle'),
    subtitle: t('home.actionUploadSub'),
    route: '/capture',
    params: { mode: 'library' },
  },
  {
    icon: '✍️',
    title: t('home.actionDescribeTitle'),
    subtitle: t('home.actionDescribeSub'),
    route: '/describe',
  },
  {
    icon: '🎥',
    title: t('home.actionVideoTitle'),
    subtitle: t('home.actionVideoSub'),
    route: '/capture',
    params: { mode: 'video' },
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

  const unlimited =
    !!me && (me.role === 'admin' || me.plan === 'premium' || !Number.isFinite(me.quota.limit));
  const quotaLine = !me
    ? null
    : unlimited
      ? me.role === 'admin'
        ? t('home.quotaAdmin')
        : t('home.quotaPremium')
      : t('home.quotaLeft', {
          left: Math.max(0, me.quota.limit - me.quota.used),
          limit: me.quota.limit,
        });

  return (
    <Screen scroll>
      <FadeInView>
        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xl }}>
          <Text variant="display" accessibilityRole="header">
            FixIt AI
          </Text>
          <Text variant="body" muted>
            {t('home.tagline')}
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
                {me.email ?? t('common.signedIn')}
              </Text>
              <Text variant="bodyStrong" accessibilityLabel={quotaLine ?? undefined}>
                {quotaLine}
              </Text>
            </View>
            <Pressable
              onPress={signOut}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.signOut')}
            >
              <Text variant="caption" color={theme.colors.primary}>
                {t('common.signOut')}
              </Text>
            </Pressable>
          </View>
        </Card>
      ) : null}

      <Card
        onPress={() => router.push('/history')}
        accessibilityLabel={t('home.myRepairs')}
        accessibilityHint={t('home.myRepairsSub')}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Text style={{ fontSize: 26 }}>🧰</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading">{t('home.myRepairs')}</Text>
            <Text variant="caption" muted>
              {t('home.myRepairsSub')}
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
              action.soon ? `${action.title}. ${t('home.comingSoon')}` : action.title
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
                  {t('home.soon')}
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
        {t('home.disclaimer')}
      </Text>
    </Screen>
  );
}
