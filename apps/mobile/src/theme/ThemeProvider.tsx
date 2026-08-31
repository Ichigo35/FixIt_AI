import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import {
  darkColors,
  lightColors,
  radii,
  spacing,
  typography,
  type ThemeColors,
} from './tokens';

export interface Theme {
  scheme: 'light' | 'dark';
  colors: ThemeColors;
  spacing: typeof spacing;
  radii: typeof radii;
  typography: typeof typography;
}

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme: 'light' | 'dark' = useColorScheme() === 'dark' ? 'dark' : 'light';

  const theme = useMemo<Theme>(
    () => ({
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      spacing,
      radii,
      typography,
    }),
    [scheme],
  );

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
