import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { getCatalog, getCurrentGoal, getProfile, saveProfile, updateGoal } from '@/api/endpoints';
import type { OpportunityType, UserProfile } from '@/api/types';
import { Icon } from '@/components/icon';
import { Button, Chips, DateField, Divider, ErrorState, Field, InlineError, LinkButton, LoadingState, MoneyField, PageHeader, Panel, Segmented, T, Tag, TypeTag } from '@/components/ui';
import { useLayout } from '@/design/layout';
import type { Palette } from '@/design/palette';
import { font, radius, space, weight } from '@/design/tokens';
import { confirmAction, confirmDiscard } from '@/lib/confirm';
import { isDirty } from '@/lib/discard';
import { errorMessage, fieldError } from '@/lib/errors';
import { goalPeriodName, goalRhythmSentence } from '@/lib/goal';
import { formatAmount, majorToMinor, minorToMajorInput } from '@/lib/money';
import { useDiscardGuard } from '@/lib/use-discard-guard';
import { useAuth } from '@/state/auth';
import { useRefreshProduct } from '@/state/query';
import { useTheme, type AppearancePreference } from '@/state/theme';

function useSettingsUi() {
  const theme = useTheme();
  const styles = useMemo(() => createSettingsStyles(theme.color), [theme.color]);

  return { ...theme, styles, typeScale: theme.type };
}

type Tab = 'profile' | 'goal' | 'account';

const WILLING_GROUPS: Array<{ type: OpportunityType; keys: string[] }> = [
  { type: 'earn', keys: ['freelance', 'consult', 'build_product', 'online_gigs', 'local_work', 'teach'] },
  { type: 'sell', keys: ['sell', 'resell'] },
  { type: 'recover', keys: ['recover'] },
  { type: 'save', keys: ['reduce_expenses'] },
];

export default function SettingsScreen() {
  const { preference, setPreference } = useSettingsUi();
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'goal' || params.tab === 'account' ? params.tab : 'profile');
  // The two editable forms stay mounted while their tab is hidden, so switching tabs never drops typed changes.
  // Each reports whether it has unsaved changes, and one guard asks before Close, a swipe or Android back leaves the page.
  const [dirty, setDirty] = useState({ profile: false, goal: false });
  const setProfileDirty = useCallback((value: boolean) => setDirty((current) => ({ ...current, profile: value })), []);
  const setGoalDirty = useCallback((value: boolean) => setDirty((current) => ({ ...current, goal: value })), []);

  useDiscardGuard(dirty.profile || dirty.goal, confirmDiscard);

  return (
    <View style={{ gap: space.xl, maxWidth: 880 }}>
      <PageHeader title="Profile" subtitle="Skills, goal, and account." />
      <AppearancePicker value={preference} onChange={setPreference} />
      {__DEV__ ? <LinkButton label="Bloom preview" onPress={() => router.push('/bloom')} /> : null}
      {__DEV__ ? <LinkButton label="Listing lab" onPress={() => router.push('/listing-lab')} /> : null}
      <Segmented
        value={tab}
        options={[
          { value: 'profile', label: 'What you bring' },
          { value: 'goal', label: 'Goal' },
          { value: 'account', label: 'Account' },
        ]}
        onChange={setTab}
      />
      <View style={{ display: tab === 'profile' ? 'flex' : 'none' }}>
        <ProfileForm onDirty={setProfileDirty} />
      </View>
      <View style={{ display: tab === 'goal' ? 'flex' : 'none' }}>
        <GoalForm onDirty={setGoalDirty} />
      </View>
      {tab === 'account' ? <Account /> : null}
    </View>
  );
}

function AppearancePicker({ value, onChange }: { value: AppearancePreference; onChange: (value: AppearancePreference) => void }) {
  return (
    <Panel padding="lg" style={{ gap: space.sm }}>
      <T variant="heading">Appearance</T>
      <Segmented
        value={value}
        options={[
          { value: 'system', label: 'System' },
          { value: 'dark', label: 'Dark' },
          { value: 'light', label: 'Light' },
        ]}
        onChange={onChange}
      />
    </Panel>
  );
}

function Section({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <Panel padding="xl" style={{ gap: space.lg }}>
      <View style={{ gap: 4 }}>
        <T variant="heading">{title}</T>
        {lead ? <T variant="small">{lead}</T> : null}
      </View>
      {children}
    </Panel>
  );
}

type Draft = Omit<UserProfile, 'skills'> & { skills: Array<{ name: string; proficiency: string | null }> };

function ProfileForm({ onDirty }: { onDirty: (dirty: boolean) => void }) {
  const { color, styles, typeScale } = useSettingsUi();
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog });
  const profile = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const refresh = useRefreshProduct();
  const layout = useLayout();
  const [draft, setDraft] = useState<Draft | null>(null);
  // What the form looked like when it was last loaded or saved. The draft is unsaved while it differs.
  const [baseline, setBaseline] = useState<Draft | null>(null);
  const [customSkill, setCustomSkill] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile.data && draft === null) {
      const loaded = { ...profile.data.data, skills: profile.data.data.skills.map((skill) => ({ ...skill })) };

      setDraft(loaded);
      setBaseline(loaded);
    }
  }, [profile.data, draft]);

  const dirty = draft != null && baseline != null && isDirty(baseline, draft);

  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);

  if (catalog.isError || profile.isError) {
    return <ErrorState message={errorMessage(catalog.error ?? profile.error)} />;
  }

  if (!catalog.data || !draft) {
    return <LoadingState label="Loading your profile" />;
  }

  const form = draft;
  const options = catalog.data.data;
  const suggested = Array.from(new Set(form.work_categories.flatMap((area) => options.skills[area] ?? [])));
  const names = form.skills.map((skill) => skill.name);

  function update(next: Partial<Draft>) {
    setDraft({ ...form, ...next });
    setSaved(false);
  }

  function addSkill(name: string) {
    const clean = name.trim();

    if (clean === '' || names.some((existing) => existing.toLowerCase() === clean.toLowerCase())) {
      return;
    }

    update({ skills: [...form.skills, { name: clean, proficiency: form.experience_level }] });
  }

  async function save() {
    const saving = form;

    setBusy(true);
    setError(null);

    try {
      await saveProfile({
        work_categories: form.work_categories,
        experience_level: form.experience_level,
        availability: form.availability,
        starting_capital: form.starting_capital,
        willing: form.willing,
        excluded: form.excluded,
        situation: form.situation,
        skills: form.skills.map((skill) => ({ name: skill.name, proficiency: skill.proficiency })),
      });
      setBaseline(saving);
      await refresh();
      setSaved(true);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      <Section title="Work and skills" lead="Pick every area that fits. Skills shape the freelance ideas in Discover.">
        <Chips values={form.work_categories} options={options.work_categories.map((item) => ({ value: item.key, label: item.label }))} onChange={(work_categories) => update({ work_categories })} />
        <Divider />
        <View style={{ gap: space.xs }}>
          {form.skills.length === 0 ? <T variant="small">No skills yet. Add one below.</T> : null}
          {form.skills.map((skill) => (
            <View key={skill.name} style={[styles.skillRow, layout.phone && { flexDirection: 'column', alignItems: 'flex-start' }]}>
              <Text style={[typeScale.bodyStrong, { flex: 1 }]}>{skill.name}</Text>
              <Segmented
                value={skill.proficiency}
                options={options.experience_levels.map((item) => ({ value: item.key, label: item.label }))}
                onChange={(value) => update({ skills: form.skills.map((item) => (item.name === skill.name ? { ...item, proficiency: value } : item)) })}
              />
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${skill.name}`} onPress={() => update({ skills: form.skills.filter((item) => item.name !== skill.name) })} style={styles.remove}>
                <Icon name="x" size={16} color={color.ink2} />
              </Pressable>
            </View>
          ))}
        </View>
        {suggested.filter((name) => !names.includes(name)).length > 0 ? (
          <Chips
            label="Suggestions"
            values={[]}
            options={suggested.filter((name) => !names.includes(name)).map((name) => ({ value: name, label: name, icon: 'plus' }))}
            onChange={(values) => values[0] && addSkill(values[0])}
          />
        ) : null}
        <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'flex-end', maxWidth: 440 }}>
          <View style={{ flex: 1 }}>
            <Field
              value={customSkill}
              onChangeText={setCustomSkill}
              placeholder="Add your own skill"
              accessibilityLabel="Add your own skill"
              onSubmitEditing={() => {
                addSkill(customSkill);
                setCustomSkill('');
              }}
            />
          </View>
          <Button
            label="Add"
            tone="secondary"
            icon="plus"
            disabled={customSkill.trim() === ''}
            onPress={() => {
              addSkill(customSkill);
              setCustomSkill('');
            }}
          />
        </View>
        <Segmented
          label="Overall experience"
          value={form.experience_level}
          options={options.experience_levels.map((item) => ({ value: item.key, label: item.label }))}
          onChange={(experience_level) => update({ experience_level })}
        />
      </Section>

      <Section title="What you are open to" lead="We only suggest these. Anything under “Rather not” stays out of your plan.">
        {WILLING_GROUPS.map((group) => (
          <View key={group.type} style={{ gap: space.xs }}>
            <TypeTag type={group.type} />
            <Chips
              values={form.willing}
              options={options.willing.filter((item) => group.keys.includes(item.key)).map((item) => ({ value: item.key, label: item.label }))}
              onChange={(willing) => update({ willing })}
            />
          </View>
        ))}
        <Divider />
        <Chips label="Rather not" values={form.excluded} options={options.excluded.map((item) => ({ value: item.key, label: item.label }))} onChange={(excluded) => update({ excluded })} />
      </Section>

      <Section title="Right now" lead="What applies today. This decides your starter moves on Home.">
        <Chips
          values={form.situation}
          options={options.situation.map((item) => ({ value: item.key, label: item.label }))}
          onChange={(next) => {
            const addedNone = next.includes('none') && !form.situation.includes('none');
            update({ situation: addedNone ? ['none'] : next.filter((item) => item !== 'none') });
          }}
        />
        <Chips
          label="Time you can spare"
          single
          values={form.availability ? [form.availability] : []}
          options={options.availability.map((item) => ({ value: item.key, label: item.label }))}
          onChange={(values) => update({ availability: values[0] ?? null })}
        />
        <View style={{ gap: space.xs }}>
          <Chips
            label="Money you could put in"
            single
            values={form.starting_capital ? [form.starting_capital] : []}
            options={options.starting_capital.map((item) => ({ value: item.key, label: item.label }))}
            onChange={(values) => update({ starting_capital: values[0] ?? null })}
          />
          <T variant="small" color={color.ink3}>Optional. Saved for later; suggestions do not use it yet.</T>
        </View>
      </Section>

      <View style={styles.saveBar}>
        {error ? <View style={{ flex: 1 }}><InlineError message={errorMessage(error)} /></View> : <View style={{ flex: 1 }}>{saved ? <Tag label="Saved. Suggestions updated." icon="check" tint={color.moneyInk} bg={color.moneySoft} /> : null}</View>}
        <Button label="Save changes" busy={busy} onPress={save} />
      </View>
    </View>
  );
}

function GoalForm({ onDirty }: { onDirty: (dirty: boolean) => void }) {
  const { color, styles, typeScale } = useSettingsUi();
  const goal = useQuery({ queryKey: ['goal', 'current'], queryFn: getCurrentGoal });
  const refresh = useRefreshProduct();
  const router = useRouter();
  const [amount, setAmount] = useState<string | null>(null);
  const [startsOn, setStartsOn] = useState<string | null>(null);
  const [endsOn, setEndsOn] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const server = goal.data;
  const amountChanged = server != null && amount != null && majorToMinor(amount) !== server.amount_minor;
  const startChanged = server != null && startsOn != null && startsOn !== server.starts_on;
  const endChanged = server != null && endsOn != null && endsOn !== server.ends_on;
  const dirty = (amountChanged || startChanged || endChanged) && !saved;

  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);

  if (goal.isLoading) {
    return <LoadingState />;
  }

  if (!goal.data) {
    return (
      <Section title="No goal right now" lead="Your last goal period ended. Set a new one to keep tracking.">
        <Button label="Set a new goal" onPress={() => router.push('/onboarding')} />
      </Section>
    );
  }

  const current = goal.data;

  async function save() {
    const amountMinor = majorToMinor(amount ?? minorToMajorInput(current.amount_minor));

    if (amountMinor == null) {
      setError(new Error('Enter a target like 2000.'));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await updateGoal(current.id, {
        amount_minor: amountMinor,
        ...(current.recurring ? {} : { starts_on: startsOn ?? current.starts_on, ends_on: endsOn ?? current.ends_on }),
      });
      await refresh();
      setSaved(true);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title={`${goalPeriodName(current)} goal`} lead="Changing the target never touches what you already banked.">
      <View style={styles.goalNow}>
        <Text style={[typeScale.figure, { fontSize: 26 }]}>
          <Text style={{ color: color.money }}>{formatAmount(current.realized_amount_minor, current.currency)}</Text>
          <Text style={{ color: color.ink3, fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 16 }}> received of {formatAmount(current.amount_minor, current.currency)}</Text>
        </Text>
        <T variant="small">{goalRhythmSentence(current)}{current.recurring ? '. Each new period starts on its own.' : ''}</T>
      </View>
      <View style={{ maxWidth: 280 }}>
        <MoneyField label="Target" value={amount ?? minorToMajorInput(current.amount_minor)} onChangeText={(value) => { setAmount(value); setSaved(false); }} error={fieldError(error, 'amount_minor')} />
      </View>
      {current.recurring ? null : (
        <View style={{ flexDirection: 'row', gap: space.md, flexWrap: 'wrap' }}>
          <DateField label="Counting from" value={startsOn ?? current.starts_on} onChange={(value) => { setStartsOn(value); setSaved(false); }} />
          <DateField label="Reach it by" value={endsOn ?? current.ends_on} onChange={(value) => { setEndsOn(value); setSaved(false); }} />
        </View>
      )}
      {error ? <InlineError message={errorMessage(error)} /> : null}
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <Button label="Save goal" busy={busy} onPress={save} />
        {saved ? <Tag label="Saved" icon="check" tint={color.moneyInk} bg={color.moneySoft} /> : null}
      </View>
    </Section>
  );
}

function Account() {
  const { styles } = useSettingsUi();
  const auth = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [deleteError, setDeleteError] = useState<unknown>(null);
  const [deleting, setDeleting] = useState(false);

  async function removeAccount() {
    const confirmed = await confirmAction(
      'Delete your account for good?',
      'Your profile, goals, missions, money history and XP are removed. This cannot be undone.',
    );

    if (!confirmed) {
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      await auth.deleteAccount(password);
    } catch (caught) {
      setDeleteError(caught);
      setDeleting(false);
    }
  }

  return (
    <View style={{ gap: space.lg }}>
      <Section title="Account">
        <View style={{ gap: 2 }}>
          <T variant="bodyStrong">{auth.user?.name}</T>
          <T variant="small">{auth.user?.email}</T>
        </View>
        <Button label="Log out" tone="secondary" icon="signOut" onPress={() => void auth.logout()} />
      </Section>

      <View style={styles.danger}>
        <View style={{ gap: 4 }}>
          <T variant="bodyStrong">Delete account</T>
          <T variant="small">Permanently removes your profile, goals, missions, money history and XP. Logging out is not the same thing.</T>
        </View>
        {deleteOpen ? (
          <View style={{ gap: space.sm }}>
            <View style={{ maxWidth: 320 }}>
              <Field label="Your current password" value={password} onChangeText={setPassword} secureTextEntry error={fieldError(deleteError, 'password')} />
            </View>
            {deleteError && !fieldError(deleteError, 'password') ? <InlineError message={errorMessage(deleteError)} /> : null}
            <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap' }}>
              <Button label="Permanently delete my account" tone="danger" icon="trash" busy={deleting} disabled={password.trim() === ''} onPress={removeAccount} />
              <Button
                label="Cancel"
                tone="ghost"
                onPress={() => {
                  setDeleteOpen(false);
                  setPassword('');
                  setDeleteError(null);
                }}
              />
            </View>
          </View>
        ) : (
          <Button label="Delete account…" tone="danger" size="sm" onPress={() => setDeleteOpen(true)} />
        )}
      </View>
    </View>
  );
}

function createSettingsStyles(color: Palette) {
  return StyleSheet.create({
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs, borderBottomWidth: 1, borderColor: color.line },
  remove: { padding: 6, borderRadius: radius.sm },
  saveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.lineStrong,
    ...(Platform.OS === 'web' ? ({ position: 'sticky', bottom: space.md } as unknown as ViewStyle) : {}),
  },
  goalNow: { gap: 4, padding: space.md, backgroundColor: color.sunken, borderRadius: radius.md },
  danger: { gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: color.dangerSoft },
  });
}
