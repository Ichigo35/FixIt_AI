import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { StackAuthError } from '@/auth/stackClient';
import { Button, Card, Screen, Text } from '@/components';
import { useTheme } from '@/theme';

export default function AuthScreen() {
  const theme = useTheme();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = /.+@.+\..+/.test(email) && password.length >= 8 && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'in') await signIn(email.trim(), password);
      else await signUp(email.trim(), password);
    } catch (err) {
      if (err instanceof StackAuthError) {
        setError(
          err.code === 'USER_NOT_FOUND' || err.code === 'PASSWORD_MISMATCH' || err.code === 'EMAIL_PASSWORD_MISMATCH'
            ? 'Wrong email or password.'
            : err.code === 'USER_EMAIL_ALREADY_EXISTS'
              ? 'An account with this email already exists — sign in instead.'
              : err.message,
        );
      } else {
        setError('Network error. Check your connection and that the API is running.');
      }
      setBusy(false);
    }
  };

  const inputStyle = {
    color: theme.colors.text,
    fontSize: theme.typography.body.fontSize,
    paddingVertical: theme.spacing.sm,
  };

  return (
    <Screen scroll>
      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xxl }}>
        <Text variant="display">FixIt AI</Text>
        <Text muted>{mode === 'in' ? 'Sign in to continue' : 'Create your account'}</Text>
      </View>

      <Card>
        <Text variant="caption" muted>
          EMAIL
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@example.com"
          placeholderTextColor={theme.colors.textMuted}
          style={inputStyle}
        />
      </Card>

      <Card>
        <Text variant="caption" muted>
          PASSWORD
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder="At least 8 characters"
          placeholderTextColor={theme.colors.textMuted}
          style={inputStyle}
        />
      </Card>

      {error ? (
        <Text variant="caption" color={theme.colors.danger}>
          {error}
        </Text>
      ) : null}

      <Button
        label={mode === 'in' ? 'Sign in' : 'Create account'}
        loading={busy}
        disabled={!canSubmit}
        onPress={submit}
      />
      <Button
        label={mode === 'in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        variant="ghost"
        onPress={() => {
          setMode(mode === 'in' ? 'up' : 'in');
          setError(null);
        }}
      />
    </Screen>
  );
}
