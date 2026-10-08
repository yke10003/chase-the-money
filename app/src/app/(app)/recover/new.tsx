import { useState } from 'react';
import { View } from 'react-native';

import { CreateFrame, FormError, FormLead, readMoney, usePlaybookStart } from '@/components/create-flow';
import { Button, DateField, Field, MoneyField, OptionCard } from '@/components/ui';
import { space } from '@/design/tokens';
import { useTheme } from '@/state/theme';

const KINDS = [
  { value: 'friend', label: 'Friend repayment' },
  { value: 'invoice', label: 'Unpaid invoice' },
  { value: 'refund', label: 'Refund' },
  { value: 'reimbursement', label: 'Reimbursement' },
  { value: 'tax', label: 'Tax refund' },
  { value: 'other', label: 'Something else' },
];

export default function RecoverNewScreen() {
  const { accent } = useTheme();
  const paint = accent.recover;
  const [kind, setKind] = useState('friend');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [expectedOn, setExpectedOn] = useState('');
  const form = usePlaybookStart('/recover');

  async function submit() {
    const name = title.trim();

    if (name === '') {
      form.setError(new Error('Say who owes it, or what it’s for.'));
      return;
    }

    const amountMinor = readMoney(amount);

    if (typeof amountMinor === 'string') {
      form.setError(new Error(amountMinor));
      return;
    }

    await form.start('recover_money', {
      title: name,
      kind,
      amount_minor: amountMinor,
      expected_on: expectedOn.trim() || null,
    });
  }

  return (
    <CreateFrame title="Add money to recover" lede="This stays in Recover." backHref="/recover" backLabel="Recover" accent={paint.from}>
      <View style={{ gap: space.sm }}>
        <FormLead>What kind of money?</FormLead>
        {KINDS.map((option) => (
          <OptionCard key={option.value} title={option.label} selected={kind === option.value} onPress={() => setKind(option.value)} accent={paint.from} />
        ))}
      </View>
      <Field label="Who owes it, or what it’s for" value={title} onChangeText={setTitle} placeholder="Sam, the old invoice" />
      <MoneyField label="How much?" value={amount} onChangeText={setAmount} hint="Leave blank if you are not sure yet" />
      <DateField label="I expect it by" value={expectedOn} onChange={setExpectedOn} hint="Optional. If it’s already late, it shows as overdue." />
      <FormError error={form.error} />
      <Button label="Add it" iconRight="arrowRight" size="lg" busy={form.busy} onPress={submit} />
    </CreateFrame>
  );
}
