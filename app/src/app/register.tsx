import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AuthFrame } from '@/components/auth-frame';
import { Button, Field, InlineError, LinkButton } from '@/components/ui';
import { space } from '@/design/tokens';
import { errorMessage, fieldError } from '@/lib/errors';
import { useAuth } from '@/state/auth';

export default function RegisterScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const ready = name.trim() !== '' && email.trim() !== '' && password.length >= 8;

  async function submit() {
    if (!ready) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await auth.register({
        name: name.trim(),
        email: email.trim(),
        password,
        password_confirmation: confirmation,
      });
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  const known = ['name', 'email', 'password'].some((key) => fieldError(error, key));

  return (
    <AuthFrame title="Create your account" lead="Two minutes of setup, then your first moves.">
      <View style={{ gap: space.md }}>
        <Field label="First name" value={name} onChangeText={setName} autoComplete="given-name" error={fieldError(error, 'name')} />
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" error={fieldError(error, 'email')} />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" hint="At least 8 characters" error={fieldError(error, 'password')} />
        <Field label="Password again" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoComplete="new-password" onSubmitEditing={submit} />
        {error && !known ? <InlineError message={errorMessage(error)} /> : null}
        <Button label="Create account" size="lg" full busy={busy} disabled={!ready} onPress={submit} />
      </View>
      <LinkButton label="Already have an account? Sign in" icon="arrowRight" onPress={() => router.push('/login')} />
    </AuthFrame>
  );
}
