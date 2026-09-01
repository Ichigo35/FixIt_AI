import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useAuth } from '@/auth/AuthProvider';
import { OAuthCancelledError } from '@/auth/oauth';
import { StackAuthError } from '@/auth/stackClient';
import { Button, Card, Screen, Text } from '@/components';
import { t } from '@/i18n';
import { friendlyError } from '@/lib/errors';
import { useTheme } from '@/theme';

export default function AuthScreen() {
  const theme = useTheme();
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const google = async () => {
    setGoogleBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      if (!(err instanceof OAuthCancelledError)) {
        setError(err instanceof StackAuthError ? err.message : friendlyError(err, 'auth'));
      }
      setGoogleBusy(false);
    }
  };

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
            ? t('auth.wrongCredentials')
            : err.code === 'USER_EMAIL_ALREADY_EXISTS'
              ? t('auth.emailExists')
              : err.message,
        );
      } else {
        setError(friendlyError(err, 'auth'));
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
        <Text muted>{mode === 'in' ? t('auth.signInSubtitle') : t('auth.signUpSubtitle')}</Text>
      </View>

      <Card>
        <Text variant="caption" muted>
          {t('auth.email')}
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          placeholder={t('auth.emailPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          style={inputStyle}
        />
      </Card>

      <Card>
        <Text variant="caption" muted>
          {t('auth.password')}
        </Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          placeholder={t('auth.passwordPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          style={inputStyle}
        />
      </Card>

      {error ? (
        <Text
          variant="caption"
          color={theme.colors.danger}
          accessibilityLiveRegion="assertive"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : null}

      <Button
        label={mode === 'in' ? t('auth.signIn') : t('auth.createAccount')}
        loading={busy}
        disabled={!canSubmit}
        onPress={submit}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
        <Text variant="caption" muted>
          {t('auth.or')}
        </Text>
        <View style={{ flex: 1, height: 1, backgroundColor: theme.colors.border }} />
      </View>

      <Button
        label={t('auth.continueWithGoogle')}
        variant="secondary"
        loading={googleBusy}
        onPress={google}
      />
      <Button
        label={mode === 'in' ? t('auth.toSignUp') : t('auth.toSignIn')}
        variant="ghost"
        onPress={() => {
          setMode(mode === 'in' ? 'up' : 'in');
          setError(null);
        }}
      />
    </Screen>
  );
}
