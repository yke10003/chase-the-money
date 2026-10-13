import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AuthFrame } from '@/components/auth-frame';
import { Button, Field, InlineError, LinkButton } from '@/components/ui';
import { space } from '@/design/tokens';
import { errorMessage, fieldError } from '@/lib/errors';
import { useAuth } from '@/state/auth';

export default function LoginScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email || !password) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await auth.login(email.trim(), password);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthFrame title="Welcome back" lead="Pick up where you left off.">
      <View style={{ gap: space.md }}>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={fieldError(error, 'email')} />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" onSubmitEditing={submit} error={fieldError(error, 'password')} />
        {error && !fieldError(error, 'email') && !fieldError(error, 'password') ? <InlineError message={errorMessage(error)} /> : null}
        <Button label="Sign in" size="lg" full busy={busy} disabled={!email || !password} onPress={submit} />
      </View>
      <LinkButton label="New here? Create an account" icon="arrowRight" onPress={() => router.push('/register')} />
      {__DEV__ ? <LinkButton label="Bloom preview" onPress={() => router.push('/bloom-preview')} /> : null}
    </AuthFrame>
  );
}
