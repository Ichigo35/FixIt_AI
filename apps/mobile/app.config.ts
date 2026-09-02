import type { ExpoConfig } from 'expo/config';

// Prod par défaut = Worker Cloudflare déployé ; dev/local = wrangler dev sur :8788.
// Override explicite : EXPO_PUBLIC_API_BASE_URL.
const PROD_API_URL = 'https://fixit-ai-api.ichigo35.workers.dev';
const APP_ENV = process.env.EXPO_PUBLIC_APP_ENV ?? 'development';
const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  (APP_ENV === 'production' ? PROD_API_URL : 'http://localhost:8788');

const config: ExpoConfig = {
  name: 'FixIt AI',
  slug: 'fixit-ai',
  scheme: 'fixitai',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'ai.fixit.app',
  },
  android: {
    package: 'ai.fixit.app',
    adaptiveIcon: {
      backgroundColor: '#0B1120',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#0B1120',
        dark: { backgroundColor: '#0B1120' },
      },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'FixIt AI uses the camera so you can photograph or film the problem you want to fix.',
        microphonePermission:
          'FixIt AI uses the microphone so a short video can capture the sound of the problem.',
        recordAudioAndroid: true,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'FixIt AI needs access to your photos so you can pick a picture or a short video of the problem.',
      },
    ],
    'expo-secure-store',
    'expo-localization',
    'expo-web-browser',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiBaseUrl: API_BASE_URL,
    appEnv: APP_ENV,
    stackProjectId:
      process.env.EXPO_PUBLIC_STACK_PROJECT_ID ?? '3432abc2-2b77-4b7b-acff-0686a7b99697',
    stackPublishableKey:
      process.env.EXPO_PUBLIC_STACK_PUBLISHABLE_KEY ??
      'pck_marynb4bzhy8q7heg7r3j467011pjcmfa29f6hvzcqx90',
  },
};

export default config;
