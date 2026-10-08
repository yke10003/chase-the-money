import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createGoal, getCatalog, getCurrentGoal, saveProfile } from '@/api/endpoints';
import type { OpportunityType, PersonalizationCatalog } from '@/api/types';
import { Icon, type IconName } from '@/components/icon';
import { Button, Chips, DateField, ErrorState, Field, InlineError, LoadingState, MoneyField, OptionCard, Segmented, T, TypeTag } from '@/components/ui';
import { useLayout } from '@/design/layout';
import type { Palette } from '@/design/palette';
import { font, radius, space, weight } from '@/design/tokens';
import { todayIso } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { goalRhythmSentence, ordinal, WEEKDAY_NAMES } from '@/lib/goal';
import { formatAmount, majorToMinor } from '@/lib/money';
import { useTheme } from '@/state/theme';

function useOnboardingUi() {
  const theme = useTheme();
  const styles = useMemo(() => createOnboardingStyles(theme.color), [theme.color]);

  return { ...theme, styles };
}
import { useRefreshProduct } from '@/state/query';

const AMOUNTS = ['250', '500', '1000', '2000', '5000'];

const STEPS = ['Target', 'Skills', 'Approach', 'Right now'];

const WORK_ICONS: Record<string, IconName> = {
  software: 'laptop',
  design: 'pencil',
  sales: 'trendUp',
  operations: 'briefcase',
  finance: 'receipt',
  trades: 'wrench',
  teaching: 'users',
  hospitality: 'handshake',
  healthcare: 'checkCircle',
  student: 'fileText',
  other: 'dots',
};

const WILLING_GROUPS: Array<{ type: OpportunityType; keys: string[] }> = [
  { type: 'earn', keys: ['freelance', 'consult', 'build_product', 'online_gigs', 'local_work', 'teach'] },
  { type: 'sell', keys: ['sell', 'resell'] },
  { type: 'recover', keys: ['recover'] },
  { type: 'save', keys: ['reduce_expenses'] },
];

type Rhythm = 'weekly' | 'monthly' | 'by_date';

export default function OnboardingScreen() {
  const { color, styles } = useOnboardingUi();
  const existing = useQuery({ queryKey: ['goal', 'current'], queryFn: getCurrentGoal });
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog });
  const [step, setStep] = useState(0);
  const [resumed, setResumed] = useState(false);
  const [amount, setAmount] = useState('2000');
  const [rhythm, setRhythm] = useState<Rhythm>('monthly');
  const [anchorDay, setAnchorDay] = useState('1');
  const [customDay, setCustomDay] = useState(false);
  const [weekDay, setWeekDay] = useState('1');
  const [startOn, setStartOn] = useState(todayIso());
  const [endOn, setEndOn] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [level, setLevel] = useState<string>('experienced');
  const [skills, setSkills] = useState<string[]>([]);
  const [customSkill, setCustomSkill] = useState('');
  const [willing, setWilling] = useState<string[]>([]);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string | null>(null);
  const [situation, setSituation] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useRefreshProduct();
  const router = useRouter();
  const layout = useLayout();

  useEffect(() => {
    if (existing.data && !resumed) {
      setStep(1);
      setResumed(true);
    }
  }, [existing.data, resumed]);

  if (existing.isLoading || catalog.isLoading) {
    return (
      <View style={styles.page}>
        <LoadingState label="Getting set up" />
      </View>
    );
  }

  if (catalog.isError || !catalog.data) {
    return (
      <View style={styles.page}>
        <ErrorState message={errorMessage(catalog.error)} onRetry={() => catalog.refetch()} />
      </View>
    );
  }

  const options = catalog.data.data;

  async function saveGoal() {
    if (existing.data) {
      setStep(1);
      return;
    }

    const amountMinor = majorToMinor(amount);

    if (amountMinor == null || amountMinor < 100) {
      setError(new Error('Enter a target like 2000.'));
      return;
    }

    const day = Number(anchorDay);

    if (rhythm === 'monthly' && (!Number.isInteger(day) || day < 1 || day > 28)) {
      setError(new Error('Pick a start day between 1 and 28.'));
      return;
    }

    if (rhythm === 'by_date' && endOn.trim() === '') {
      setError(new Error('Choose the date you want to reach this by.'));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await createGoal({
        amount_minor: amountMinor,
        currency: 'EUR',
        rhythm,
        anchor_day: rhythm === 'weekly' ? Number(weekDay) : rhythm === 'monthly' ? day : null,
        starts_on: rhythm === 'by_date' ? startOn : undefined,
        ends_on: rhythm === 'by_date' ? endOn.trim() : undefined,
        status: 'active',
      });
      await refresh();
      setStep(1);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    setError(null);

    try {
      await saveProfile({
        work_categories: areas,
        experience_level: level,
        availability,
        willing,
        excluded,
        situation,
        skills: skills.map((name) => ({ name, proficiency: level })),
      });
      await refresh();
      router.replace('/?welcome=1');
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  }

  function next() {
    setError(null);

    if (step === 0) {
      void saveGoal();
      return;
    }

    if (step === STEPS.length - 1) {
      void finish();
      return;
    }

    setStep(step + 1);
  }

  const canContinue = step === 0
    ? amount.trim() !== ''
    : step === 1
      ? areas.length > 0
      : step === 3
        ? availability != null
        : true;
  const amountMinor = majorToMinor(amount);
  const goalPreview = amountMinor
    ? `${formatAmount(amountMinor, 'EUR')} · ${goalRhythmSentence({ rhythm, anchor_day: rhythm === 'weekly' ? Number(weekDay) : Number(anchorDay), starts_on: startOn, ends_on: endOn || startOn }).toLowerCase()}`
    : null;

  return (
    <View style={styles.page}>
      <View style={[styles.top, { paddingHorizontal: layout.phone ? space.md : space.xl }]}>
        <View style={styles.wordmark}>
          <View style={styles.mark}>
            <View style={styles.markFill} />
          </View>
          <Text style={styles.wordmarkText}>Nolume</Text>
        </View>
        <View style={styles.progress}>
          {STEPS.map((label, index) => (
            <View key={label} style={{ flex: 1, gap: 6 }}>
              <View style={[styles.progressBar, index <= step && { backgroundColor: color.ink }]} />
              {layout.phone ? null : <Text style={[styles.progressLabel, index === step && { color: color.ink }]}>{label}</Text>}
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.body, { paddingHorizontal: layout.phone ? space.md : space.xl }]}>
        {step === 0 ? (
          <Step
            title={existing.data ? 'Your target is set' : 'What would feel like real progress?'}
            lead={existing.data ? 'You can change it any time from your profile.' : 'Pick a money target. Earning, selling, recovering and saving all count toward it.'}
          >
            {existing.data ? (
              <T variant="display" color={color.money}>{formatAmount(existing.data.amount_minor, existing.data.currency)}</T>
            ) : (
              <>
                <View style={{ maxWidth: 360 }}>
                  <MoneyField value={amount} onChangeText={setAmount} large autoFocus accessibilityLabel="Target amount" />
                </View>
                <Chips
                  single
                  values={[amount]}
                  options={AMOUNTS.map((value) => ({ value, label: `€${Number(value).toLocaleString('en-GB')}` }))}
                  onChange={(values) => setAmount(values[0] ?? amount)}
                />
                <View style={{ gap: space.md, marginTop: space.md }}>
                  <Segmented
                    label="How often?"
                    value={rhythm}
                    options={[
                      { value: 'weekly', label: 'Every week' },
                      { value: 'monthly', label: 'Every month' },
                      { value: 'by_date', label: 'By a date' },
                    ]}
                    onChange={setRhythm}
                  />
                  {rhythm === 'monthly' ? (
                    <View style={{ gap: space.xs }}>
                      <Chips
                        label="My month starts on the"
                        single
                        values={customDay ? ['other'] : [anchorDay]}
                        options={[
                          { value: '1', label: '1st' },
                          { value: '15', label: '15th' },
                          { value: '25', label: '25th, payday' },
                          { value: 'other', label: 'Another day' },
                        ]}
                        onChange={(values) => {
                          const picked = values[0];
                          if (picked === 'other') {
                            setCustomDay(true);
                            return;
                          }
                          setCustomDay(false);
                          setAnchorDay(picked ?? '1');
                        }}
                      />
                      {customDay ? (
                        <View style={{ maxWidth: 180 }}>
                          <Field label="Day of the month" value={anchorDay} onChangeText={setAnchorDay} keyboardType="number-pad" hint="1 to 28" />
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                  {rhythm === 'weekly' ? (
                    <Chips
                      label="My week starts on"
                      single
                      values={[weekDay]}
                      options={WEEKDAY_NAMES.map((name, index) => ({ value: String(index + 1), label: name.slice(0, 3) }))}
                      onChange={(values) => setWeekDay(values[0] ?? '1')}
                    />
                  ) : null}
                  {rhythm === 'by_date' ? (
                    <View style={{ flexDirection: layout.phone ? 'column' : 'row', gap: space.md }}>
                      <DateField label="Counting from" value={startOn} onChange={setStartOn} hint="Can be in the past" />
                      <DateField label="Reach it by" value={endOn} onChange={setEndOn} />
                    </View>
                  ) : null}
                </View>
                {goalPreview && (rhythm !== 'by_date' || endOn) ? (
                  <View style={styles.preview}>
                    <Icon name="target" size={18} color={color.money} weight="bold" />
                    <T variant="bodyStrong">
                      {goalPreview}
                      {rhythm === 'monthly' && Number(anchorDay) > 1 && Number(anchorDay) <= 28 ? ` (the ${ordinal(Number(anchorDay))} to the ${ordinal(Number(anchorDay) - 1)})` : ''}
                    </T>
                  </View>
                ) : null}
              </>
            )}
          </Step>
        ) : null}

        {step === 1 ? (
          <Step title="What do you bring?" lead="Pick everything that fits. Most people are more than one thing.">
            <Chips
              values={areas}
              options={options.work_categories.map((item) => ({ value: item.key, label: item.label, icon: WORK_ICONS[item.key] }))}
              onChange={setAreas}
            />
            {areas.length > 0 ? (
              <SkillPicker options={options} areas={areas} skills={skills} onSkills={setSkills} customSkill={customSkill} onCustomSkill={setCustomSkill} />
            ) : null}
            {areas.length > 0 ? (
              <Segmented
                label="Roughly how experienced are you?"
                value={level}
                options={options.experience_levels.map((item) => ({ value: item.key, label: item.label }))}
                onChange={setLevel}
              />
            ) : null}
          </Step>
        ) : null}

        {step === 2 ? (
          <Step title="How would you like to get there?" lead="We only suggest things you are open to. You can change this later.">
            <View style={{ gap: space.lg }}>
              {WILLING_GROUPS.map((group) => {
                const groupOptions = options.willing.filter((item) => group.keys.includes(item.key));

                return (
                  <View key={group.type} style={{ gap: space.xs }}>
                    <TypeTag type={group.type} />
                    <Chips
                      values={willing}
                      options={groupOptions.map((item) => ({ value: item.key, label: item.label }))}
                      onChange={setWilling}
                    />
                  </View>
                );
              })}
            </View>
            <View style={[styles.avoid]}>
              <Chips
                label="Anything you would rather not do?"
                values={excluded}
                options={options.excluded.map((item) => ({ value: item.key, label: item.label }))}
                onChange={setExcluded}
              />
            </View>
          </Step>
        ) : null}

        {step === 3 ? (
          <Step title="What’s true for you right now?" lead="Tick what applies. This decides your first moves.">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
              {options.situation.map((item) => {
                const checked = situation.includes(item.key);

                return (
                  <Pressable
                    key={item.key}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked }}
                    onPress={() => {
                      if (item.key === 'none') {
                        setSituation(checked ? [] : ['none']);
                        return;
                      }
                      setSituation(checked ? situation.filter((value) => value !== item.key) : [...situation.filter((value) => value !== 'none'), item.key]);
                    }}
                    style={[styles.check, { width: layout.phone ? '100%' : '49.3%' }, checked && styles.checkOn]}
                  >
                    <View style={[styles.box, checked && styles.boxOn]}>{checked ? <Icon name="check" size={13} color={color.onInk} weight="bold" /> : null}</View>
                    <Text style={styles.checkText}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Chips
              label="How much time can you spare?"
              single
              values={availability ? [availability] : []}
              options={options.availability.map((item) => ({ value: item.key, label: item.label }))}
              onChange={(values) => setAvailability(values[0] ?? null)}
            />
          </Step>
        ) : null}

        {error ? <InlineError message={errorMessage(error)} /> : null}

        <View style={styles.footer}>
          {step > (existing.data ? 1 : 0) ? <Button label="Back" tone="ghost" icon="arrowLeft" onPress={() => setStep(step - 1)} /> : <View />}
          <Button
            label={step === STEPS.length - 1 ? 'Build my plan' : 'Continue'}
            iconRight="arrowRight"
            size="lg"
            busy={busy}
            disabled={!canContinue}
            onPress={next}
          />
        </View>
      </View>
    </View>
  );
}

function Step({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  const { color } = useOnboardingUi();
  const layout = useLayout();

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <T variant="display" style={layout.phone ? { fontSize: 30, lineHeight: 34 } : null}>{title}</T>
        <T variant="body" color={color.ink2} style={{ fontSize: 17, lineHeight: 26 }}>{lead}</T>
      </View>
      {children}
    </View>
  );
}

function SkillPicker({
  options,
  areas,
  skills,
  onSkills,
  customSkill,
  onCustomSkill,
}: {
  options: PersonalizationCatalog;
  areas: string[];
  skills: string[];
  onSkills: (skills: string[]) => void;
  customSkill: string;
  onCustomSkill: (value: string) => void;
}) {
  const { color, styles } = useOnboardingUi();
  const suggested = Array.from(new Set(areas.flatMap((area) => options.skills[area] ?? [])));
  const custom = skills.filter((skill) => !suggested.includes(skill));

  function add() {
    const name = customSkill.trim();

    if (name === '' || skills.some((skill) => skill.toLowerCase() === name.toLowerCase())) {
      onCustomSkill('');
      return;
    }

    onSkills([...skills, name]);
    onCustomSkill('');
  }

  return (
    <View style={{ gap: space.sm, paddingTop: space.md, borderTopWidth: 1, borderColor: color.line }}>
      <Chips label="Skills you could charge for" values={skills} options={[...suggested, ...custom].map((skill) => ({ value: skill, label: skill }))} onChange={onSkills} />
      <View style={{ flexDirection: 'row', gap: space.xs, alignItems: 'flex-end', maxWidth: 440 }}>
        <View style={{ flex: 1 }}>
          <Field value={customSkill} onChangeText={onCustomSkill} placeholder="Add your own, e.g. Shopify" onSubmitEditing={add} returnKeyType="done" accessibilityLabel="Add a skill" />
        </View>
        <Button label="Add" tone="secondary" icon="plus" onPress={add} disabled={customSkill.trim() === ''} />
      </View>
    </View>
  );
}

function createOnboardingStyles(color: Palette) {
  return StyleSheet.create({
  page: { flex: 1, backgroundColor: color.paper, paddingBottom: space.xxl },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.xl, paddingTop: space.lg, paddingBottom: space.md, flexWrap: 'wrap' },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: color.ink, overflow: 'hidden', justifyContent: 'flex-end' },
  markFill: { height: '55%', backgroundColor: color.money },
  wordmarkText: { fontFamily: font.displayHeavy, fontWeight: weight.bold, fontSize: 18, letterSpacing: -0.4, color: color.ink },
  progress: { flex: 1, flexDirection: 'row', gap: 6, minWidth: 220, maxWidth: 560, marginLeft: 'auto' },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: color.lineStrong },
  progressLabel: { fontFamily: font.semi, fontWeight: weight.medium, fontSize: 12, color: color.ink3 },
  body: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: space.xl, paddingTop: space.xxl },
  preview: { flexDirection: 'row', gap: space.xs, alignItems: 'center', backgroundColor: color.moneySoft, borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.md, alignSelf: 'flex-start' },
  avoid: { paddingTop: space.lg, borderTopWidth: 1, borderColor: color.line },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: space.md },
  checkOn: { borderColor: color.ink },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: color.lineStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: color.ink, borderColor: color.ink },
  checkText: { fontFamily: font.medium, fontWeight: weight.medium, fontSize: 15, color: color.ink, flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: space.lg, borderTopWidth: 1, borderColor: color.line },
  });
}
