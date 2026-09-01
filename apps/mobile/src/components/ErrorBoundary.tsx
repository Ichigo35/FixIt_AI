import { Component, type ReactNode } from 'react';
import { View } from 'react-native';
import { useTheme } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

function Fallback({ onReset }: { onReset: () => void }) {
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
      <Text style={{ fontSize: 40 }}>🧩</Text>
      <Text variant="heading" center>
        Something broke on this screen
      </Text>
      <Text muted center>
        The app hit an unexpected error. You can try again — your data is safe.
      </Text>
      <Button label="Reload the screen" onPress={onReset} fullWidth={false} />
    </View>
  );
}

/** Capture les erreurs de rendu React pour éviter l'écran blanc. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Pas de service de crash au MVP : au moins une trace console.
    console.error('[ErrorBoundary]', error);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) return <Fallback onReset={this.reset} />;
    return this.props.children;
  }
}
