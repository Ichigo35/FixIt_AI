import type { ExpoConfig } from 'expo/config';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8788';

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
        cameraPermission: 'FixIt AI uses the camera so you can photograph the problem you want to fix.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission: 'FixIt AI needs access to your photos so you can pick a picture of the problem.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    apiBaseUrl: API_BASE_URL,
    appEnv: process.env.EXPO_PUBLIC_APP_ENV ?? 'development',
  },
};

export default config;
