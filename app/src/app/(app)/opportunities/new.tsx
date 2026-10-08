import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { createOpportunity, startPlaybook } from '@/api/endpoints';
import type { OpportunityType } from '@/api/types';
import { FormError, readMoney, usePlaybookStart } from '@/components/create-flow';
import { Button, Field, MoneyField, PageHeader, Segmented, T } from '@/components/ui';
import { space } from '@/design/tokens';
import { useRefreshProduct } from '@/state/query';
import { useTheme } from '@/state/theme';

export default function CustomMissionScreen() {
  const params = useLocalSearchParams<{ mode?: string; start?: string }>();
  const router = useRouter();

  useEffect(() => {
    if (params.mode === 'sell') {
      router.replace(params.start ? `/sell/new?start=${params.start}` : '/sell/new');
    } else if (params.mode === 'freelance') {
      router.replace('/freelance/new');
    } else if (params.mode === 'recover') {
      router.replace('/recover/new');
    } else if (params.mode === 'build') {
      router.replace('/build/new');
    }
  }, [params.mode, params.start, router]);

  if (params.mode === 'sell' || params.mode === 'freelance' || params.mode === 'recover' || params.mode === 'build') {
    return null;
  }

  return (
    <View style={{ gap: space.xxl, maxWidth: 720, width: '100%' }}>
      <PageHeader title="Custom mission" subtitle="For work that is not a sale, a lead, or money to recover. You add the steps yourself." />
      <CustomForm />
      <CutCost />
    </View>
  );
}

function CustomForm() {
  const { color } = useTheme();
  const router = useRouter();
  const refresh = useRefreshProduct();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<OpportunityType>('earn');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const name = title.trim();

    if (name === '') {
      setError(new Error('Give it a name first.'));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const created = await createOpportunity({ type, title: name, status: 'explore', currency: 'EUR' });
      await refresh();
      router.replace(`/opportunities/${created.data.id}`);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.md }}>
      <Field label="What is it?" value={title} onChangeText={setTitle} placeholder="Rent out the parking spot" />
      <Segmented
        label="What kind of money?"
        value={type}
        options={[
          { value: 'earn', label: 'Earn' },
          { value: 'sell', label: 'Sell' },
          { value: 'recover', label: 'Recover' },
          { value: 'save', label: 'Save' },
        ]}
        onChange={setType}
      />
      <FormError error={error} />
      <Button label="Create" iconRight="arrowRight" size="lg" busy={busy} onPress={submit} />
      <T variant="small" color={color.ink3}>Sell, Freelance, and Recover each have their own add flow. Use those when the work fits.</T>
    </View>
  );
}

function CutCost() {
  const { color } = useTheme();
  const [title, setTitle] = useState('');
  const [monthly, setMonthly] = useState('');
  const form = usePlaybookStart('/opportunities');

  async function submit() {
    const name = title.trim();

    if (name === '') {
      form.setError(new Error('Name the cost first.'));
      return;
    }

    const monthlyMinor = readMoney(monthly);

    if (typeof monthlyMinor === 'string') {
      form.setError(new Error(monthlyMinor));
      return;
    }

    await form.start('reduce_expense', { title: name, current_monthly_minor: monthlyMinor });
  }

  return (
    <View style={{ gap: space.md }}>
      <T variant="heading">Cut a cost</T>
      <T variant="small" color={color.ink3}>Not one of the four areas. A subscription or bill you might drop.</T>
      <Field label="Which cost?" value={title} onChangeText={setTitle} placeholder="Adobe Creative Cloud" />
      <MoneyField label="What you pay each month" value={monthly} onChangeText={setMonthly} hint="Optional. You can fill it in later." />
      <FormError error={form.error} />
      <Button label="Add cost" tone="secondary" busy={form.busy} onPress={submit} />
    </View>
  );
}
