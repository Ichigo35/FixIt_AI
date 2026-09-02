import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { ErrorBoundary, LoadingState, OfflineBanner } from '@/components';
import { ConnectivityProvider } from '@/lib/connectivity';
import { OutboxProvider } from '@/lib/outbox';
import { OnboardingProvider, useOnboarding } from '@/lib/onboarding';
import { ThemeProvider, useTheme } from '@/theme';

function RootStack() {
  const theme = useTheme();
  const { status } = useAuth();
  const onboarding = useOnboarding();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading' || onboarding.status === 'loading') return;
    const route = segments[0];

    if (onboarding.status === 'pending' && route !== 'onboarding') {
      router.replace('/onboarding');
      return;
    }
    if (onboarding.status === 'done' && route === 'onboarding') {
      router.replace('/');
      return;
    }
    if (onboarding.status !== 'pending') {
      // `oauth` = route de rebond OAuth : joignable même déconnecté, le temps de
      // finir l'échange du code.
      if (status === 'signedOut' && route !== 'auth' && route !== 'oauth') router.replace('/auth');
      else if (status === 'signedIn' && route === 'auth') router.replace('/');
    }
  }, [status, onboarding.status, segments, router]);

  if (status === 'loading' || onboarding.status === 'loading') {
    return <LoadingState />;
  }

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
          animationDuration: 240,
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="auth" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="oauth" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen name="describe" options={{ title: 'Describe the problem' }} />
        <Stack.Screen name="capture" options={{ title: 'Photo' }} />
        <Stack.Screen name="history" options={{ title: 'My Repairs' }} />
        <Stack.Screen name="diagnosis/new" options={{ title: 'Diagnosis', headerBackVisible: false }} />
        <Stack.Screen name="diagnosis/[id]" options={{ title: 'Diagnosis' }} />
        <Stack.Screen name="repair/[id]" options={{ title: 'Repair guide' }} />
      </Stack>
      <OfflineBanner />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <ConnectivityProvider>
            <OutboxProvider>
              <OnboardingProvider>
                <AuthProvider>
                  <RootStack />
                </AuthProvider>
              </OnboardingProvider>
            </OutboxProvider>
          </ConnectivityProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
