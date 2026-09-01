import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

/**
 * Médaillon illustré : l'emoji posé sur deux cercles concentriques teintés.
 * Illustration légère, sans dépendance (pas de SVG).
 */
function IconMedallion({ emoji, tone = 'primary' }: { emoji: string; tone?: 'primary' | 'danger' }) {
  const theme = useTheme();
  const base = tone === 'danger' ? theme.colors.danger : theme.colors.primary;
  return (
    <View
      style={{
        width: 112,
        height: 112,
        borderRadius: 56,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}
    >
      <View
        style={{
          position: 'absolute',
          width: 84,
          height: 84,
          borderRadius: 42,
          backgroundColor: base,
          opacity: theme.scheme === 'dark' ? 0.22 : 0.12,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: base,
          opacity: theme.scheme === 'dark' ? 0.32 : 0.18,
        }}
      />
      <Text style={{ fontSize: 40 }}>{emoji}</Text>
    </View>
  );
}

/** Bloc centré, occupe l'espace disponible. */
function Centered({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.lg,
        padding: theme.spacing.xl,
        backgroundColor: theme.colors.background,
      }}
    >
      {children}
    </View>
  );
}

export interface LoadingStateProps {
  /** Titre court, ex. « Analyzing… ». */
  title?: string;
  /** Ligne d'explication optionnelle. */
  detail?: string;
}

export function LoadingState({ title, detail }: LoadingStateProps) {
  const theme = useTheme();
  return (
    <Centered>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={title ?? 'Loading'}
        accessibilityLiveRegion="polite"
        style={{ alignItems: 'center', gap: theme.spacing.md }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
        {title ? <Text variant="heading">{title}</Text> : null}
      </View>
      {detail ? (
        <Text muted center>
          {detail}
        </Text>
      ) : null}
    </Centered>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({
  title = "That didn't work",
  message,
  onRetry,
  retryLabel = 'Try again',
}: ErrorStateProps) {
  const theme = useTheme();
  return (
    <Centered>
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={{ alignItems: 'center', gap: theme.spacing.md }}
      >
        <IconMedallion emoji="😕" tone="danger" />
        <Text variant="heading" center>
          {title}
        </Text>
        <Text muted center>
          {message}
        </Text>
      </View>
      {onRetry ? (
        <Button label={retryLabel} onPress={onRetry} fullWidth={false} />
      ) : null}
    </Centered>
  );
}

export interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon = '📭', title, message, action }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <Centered>
      <IconMedallion emoji={icon} />
      <View style={{ alignItems: 'center', gap: theme.spacing.sm }}>
        <Text variant="heading" center>
          {title}
        </Text>
        {message ? (
          <Text muted center>
            {message}
          </Text>
        ) : null}
      </View>
      {action ? (
        <Button label={action.label} onPress={action.onPress} fullWidth={false} />
      ) : null}
    </Centered>
  );
}
