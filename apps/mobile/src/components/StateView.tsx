import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

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
        style={{ alignItems: 'center', gap: theme.spacing.sm }}
      >
        <Text style={{ fontSize: 34 }}>😕</Text>
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
      <Text style={{ fontSize: 34 }}>{icon}</Text>
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
