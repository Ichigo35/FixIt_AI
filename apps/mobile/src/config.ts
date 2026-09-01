import Constants from 'expo-constants';

interface AppExtra {
  apiBaseUrl: string;
  appEnv: string;
  stackProjectId: string;
  stackPublishableKey: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<AppExtra>;

export const config = {
  apiBaseUrl: extra.apiBaseUrl ?? 'http://localhost:8788',
  appEnv: extra.appEnv ?? 'development',
  stackProjectId: extra.stackProjectId ?? '',
  stackPublishableKey: extra.stackPublishableKey ?? '',
} as const;
