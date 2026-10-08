import { useState } from 'react';
import { View } from 'react-native';

import type { PlaybookField } from '@/api/types';
import { Button, DateField, Field, InlineError, MoneyField, OptionCard } from '@/components/ui';
import { space } from '@/design/tokens';
import { confirmAction } from '@/lib/confirm';
import { formatMoney, majorToMinor, minorToMajorInput } from '@/lib/money';

export function PlaybookFields({
  fields,
  submitLabel,
  currency,
  confirmsMoney = false,
  tone = 'primary',
  busy = false,
  onSubmit,
}: {
  fields: PlaybookField[];
  submitLabel: string;
  currency: string;
  confirmsMoney?: boolean;
  tone?: 'primary' | 'secondary' | 'danger' | 'money';
  busy?: boolean;
  onSubmit: (input: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => initialValues(fields));
  const [localError, setLocalError] = useState<string | null>(null);

  const visible = fields.filter((field) => isVisible(field, values, fields));

  async function submit() {
    const payload: Record<string, unknown> = {};

    for (const field of visible) {
      const raw = (values[field.key] ?? '').trim();
      const required = isRequired(field, values);

      if (raw === '') {
        if (required) {
          setLocalError(`${field.label} is needed.`);
          return;
        }
        continue;
      }

      if (field.type === 'money') {
        const minor = majorToMinor(raw);
        if (minor == null || (field.key !== 'new_monthly_minor' && minor < 1)) {
          setLocalError(`Enter ${field.label.toLowerCase()} as an amount, like 250 or 249.99.`);
          return;
        }
        payload[field.key] = minor;
        continue;
      }

      payload[field.key] = raw;
    }

    if (confirmsMoney) {
      const amount = typeof payload.amount_minor === 'number' ? payload.amount_minor : null;
      if (amount == null) {
        setLocalError('Enter the amount you received.');
        return;
      }
      const ok = await confirmAction(
        `Bank ${formatMoney(amount, currency)}?`,
        `This counts ${formatMoney(amount, currency)} toward your goal. Money you record stays in your history.`,
      );
      if (!ok) {
        return;
      }
    }

    setLocalError(null);
    onSubmit(payload);
  }

  return (
    <View style={{ gap: space.md }}>
      {visible.map((field) => (
        <PlaybookControl
          key={field.key}
          field={field}
          required={isRequired(field, values)}
          value={values[field.key] ?? ''}
          onChange={(next) => setValues((current) => ({ ...current, [field.key]: next }))}
        />
      ))}
      {localError ? <InlineError message={localError} /> : null}
      <Button label={submitLabel} tone={confirmsMoney && tone === 'primary' ? 'money' : tone} busy={busy} onPress={() => void submit()} />
    </View>
  );
}

function PlaybookControl({
  field,
  required,
  value,
  onChange,
}: {
  field: PlaybookField;
  required: boolean;
  value: string;
  onChange: (value: string) => void;
}) {
  if (field.type === 'date') {
    return <DateField label={field.label} value={value} onChange={onChange} hint={required ? undefined : 'Optional'} />;
  }

  if (field.type === 'choice') {
    return (
      <View style={{ gap: space.xs }}>
        {(field.options ?? []).map((option) => (
          <OptionCard key={option.value} title={option.label} selected={value === option.value} onPress={() => onChange(option.value)} />
        ))}
      </View>
    );
  }

  if (field.type === 'money') {
    return (
      <View style={{ maxWidth: 320 }}>
        <MoneyField label={field.label} value={value} onChangeText={onChange} hint={required ? undefined : 'Optional'} />
      </View>
    );
  }

  return <Field label={field.label.replace(/,? optional$/i, '')} value={value} onChangeText={onChange} hint={required ? undefined : 'Optional'} />;
}

function initialValues(fields: PlaybookField[]): Record<string, string> {
  const values: Record<string, string> = {};

  for (const field of fields) {
    if (field.type === 'money' && field.prefill_minor != null) {
      values[field.key] = minorToMajorInput(field.prefill_minor);
      continue;
    }

    if (field.type === 'date' && field.default) {
      values[field.key] = field.default;
      continue;
    }

    if (field.type === 'text' && field.default) {
      values[field.key] = field.default;
    }
  }

  return values;
}

function isVisible(field: PlaybookField, values: Record<string, string>, fields: PlaybookField[]): boolean {
  const asksWhatHappened = fields.some((item) => item.key === 'result');

  if (!asksWhatHappened) {
    return true;
  }

  const result = values.result;

  if (field.key === 'follow_up_on' || field.key === 'agreed_amount_minor') {
    if (!result) {
      return false;
    }
  }

  if (!result) {
    return true;
  }

  if (field.key === 'follow_up_on') {
    return result === 'still_waiting';
  }

  if (field.key === 'agreed_amount_minor') {
    return result === 'accepted';
  }

  return true;
}

function isRequired(field: PlaybookField, values: Record<string, string>): boolean {
  if (field.key === 'follow_up_on' && values.result === 'still_waiting') {
    return true;
  }

  if (field.key === 'agreed_amount_minor' && values.result === 'accepted') {
    return true;
  }

  return field.required;
}
