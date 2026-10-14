import { useState } from 'react';
import { View } from 'react-native';

import { CreateFrame, FormError, FormLead, readMoney, useCreationExit, usePlaybookStart } from '@/components/create-flow';
import { Button, DateField, Field, MoneyField, OptionCard } from '@/components/ui';
import { useLayout } from '@/design/layout';
import { space } from '@/design/tokens';
import { addDaysIso } from '@/lib/dates';
import { useTheme } from '@/state/theme';

const STATES = [
  { value: 'lead', label: 'I haven’t reached out yet', detail: 'Start with a short note' },
  { value: 'conversation', label: 'We’re talking', detail: 'Next up is a proposal' },
  { value: 'proposal_sent', label: 'I sent a proposal', detail: 'Waiting to hear back' },
  { value: 'accepted', label: 'They said yes', detail: 'Time to do the work' },
  { value: 'working', label: 'I’m doing the work', detail: 'Invoice comes next' },
  { value: 'invoice_sent', label: 'I sent the invoice', detail: 'Waiting to get paid' },
];

export default function FreelanceNewScreen() {
  const { accent } = useTheme();
  const paint = accent.earn;
  const layout = useLayout();
  const [title, setTitle] = useState('');
  const [state, setState] = useState('lead');
  const [quoted, setQuoted] = useState('');
  const [agreed, setAgreed] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [followUp, setFollowUp] = useState(addDaysIso(7));
  const [paymentDue, setPaymentDue] = useState(addDaysIso(14));
  // Typed text and amounts count. The preselected state and the default dates alone do not.
  const dirty = [title, quoted, agreed, invoiceAmount].some((value) => value.trim() !== '');
  const exit = useCreationExit(dirty);
  const form = usePlaybookStart(exit.finish);

  async function submit() {
    const name = title.trim();

    if (name === '') {
      form.setError(new Error('Name the client or project first.'));
      return;
    }

    const input: Record<string, unknown> = { title: name, current_state: state };

    if (state === 'proposal_sent') {
      const proposed = readMoney(quoted);

      if (typeof proposed === 'string') {
        form.setError(new Error(proposed));
        return;
      }

      if (followUp.trim() === '') {
        form.setError(new Error('Choose the day you will follow up.'));
        return;
      }

      input.proposed_amount_minor = proposed;
      input.follow_up_on = followUp;
    }

    if (state === 'accepted' || state === 'working') {
      const agreedMinor = readMoney(agreed);

      if (typeof agreedMinor === 'string' || agreedMinor == null) {
        form.setError(new Error(typeof agreedMinor === 'string' ? agreedMinor : 'Enter what you agreed on.'));
        return;
      }

      input.agreed_amount_minor = agreedMinor;
    }

    if (state === 'invoice_sent') {
      const billed = readMoney(invoiceAmount);

      if (typeof billed === 'string' || billed == null) {
        form.setError(new Error(typeof billed === 'string' ? billed : 'Enter the invoice amount.'));
        return;
      }

      if (paymentDue.trim() === '') {
        form.setError(new Error('Choose the day the payment is due.'));
        return;
      }

      input.invoice_amount_minor = billed;
      input.payment_due_on = paymentDue;
    }

    await form.start('freelance', input);
  }

  return (
    <CreateFrame title="Add a lead" lede="This stays in Freelance." backLabel="Freelance" onClose={exit.close} accent={paint.from}>
      <Field label="Client, company, or project" value={title} onChangeText={setTitle} placeholder="Website rebuild for Studio K" />
      <View style={{ gap: space.sm }}>
        <FormLead>Where are you with it?</FormLead>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {STATES.map((option) => (
            <View key={option.value} style={{ width: layout.phone ? '100%' : '49%' }}>
              <OptionCard title={option.label} detail={option.detail} selected={state === option.value} onPress={() => setState(option.value)} accent={paint.from} />
            </View>
          ))}
        </View>
      </View>
      {state === 'proposal_sent' ? (
        <View style={{ gap: space.sm }}>
          <MoneyField label="What did you quote?" value={quoted} onChangeText={setQuoted} hint="Optional. This is possible money, not received." />
          <DateField label="Follow up on" value={followUp} onChange={setFollowUp} />
        </View>
      ) : null}
      {state === 'accepted' || state === 'working' ? (
        <MoneyField label="What did you agree on?" value={agreed} onChangeText={setAgreed} />
      ) : null}
      {state === 'invoice_sent' ? (
        <View style={{ gap: space.sm }}>
          <MoneyField label="Invoice amount" value={invoiceAmount} onChangeText={setInvoiceAmount} />
          <DateField label="Payment due on" value={paymentDue} onChange={setPaymentDue} />
        </View>
      ) : null}
      <FormError error={form.error} />
      <Button label="Add lead" iconRight="arrowRight" size="lg" busy={form.busy} onPress={submit} />
    </CreateFrame>
  );
}
