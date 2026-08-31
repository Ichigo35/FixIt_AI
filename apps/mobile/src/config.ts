import Constants from 'expo-constants';

interface AppExtra {
  apiBaseUrl: string;
  appEnv: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<AppExtra>;

export const config = {
  apiBaseUrl: extra.apiBaseUrl ?? 'http://localhost:8787',
  appEnv: extra.appEnv ?? 'development',
} as const;
