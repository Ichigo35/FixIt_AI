import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { ThemeProvider, useTheme } from '@/theme';

function RootStack() {
  const theme = useTheme();
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    const onAuthScreen = segments[0] === 'auth';
    if (status === 'signedOut' && !onAuthScreen) router.replace('/auth');
    else if (status === 'signedIn' && onAuthScreen) router.replace('/');
  }, [status, segments, router]);

  if (status === 'loading') {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.background },
          headerTintColor: theme.colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="describe" options={{ title: 'Describe the problem' }} />
        <Stack.Screen name="capture" options={{ title: 'Photo' }} />
        <Stack.Screen name="history" options={{ title: 'My Repairs' }} />
        <Stack.Screen name="diagnosis/new" options={{ title: 'Diagnosis', headerBackVisible: false }} />
        <Stack.Screen name="diagnosis/[id]" options={{ title: 'Diagnosis' }} />
        <Stack.Screen name="repair/[id]" options={{ title: 'Repair guide' }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootStack />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
