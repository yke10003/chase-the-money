import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createGoal, getCatalog, getCurrentGoal, saveProfile } from '@/api/endpoints';
import type { OpportunityType, PersonalizationCatalog } from '@/api/types';
import { BrandMark } from '@/components/brand';
import { Icon, type IconName } from '@/components/icon';
import { Button, Chips, DateField, ErrorState, Field, InlineError, LoadingState, MoneyField, Segmented, T, TypeTag } from '@/components/ui';
import { useLayout } from '@/design/layout';
import type { Palette } from '@/design/palette';
import { font, radius, space, weight } from '@/design/tokens';
import { todayIso } from '@/lib/dates';
import { errorMessage } from '@/lib/errors';
import { goalRhythmSentence, ordinal, WEEKDAY_NAMES } from '@/lib/goal';
import { formatAmount, majorToMinor } from '@/lib/money';
import { useRefreshProduct } from '@/state/query';
import { useTheme } from '@/state/theme';

function useOnboardingUi() {
  const theme = useTheme();
  const styles = useMemo(() => createOnboardingStyles(theme.color), [theme.color]);

  return { ...theme, styles };
}

const AMOUNTS = ['250', '500', '1000', '2000', '5000'];

const STEPS = ['Target', 'Work', 'Skills', 'Level', 'Approach', 'Now'];
const STEP_TARGET = 0;
const STEP_AREAS = 1;
const STEP_SKILLS = 2;
const STEP_LEVEL = 3;
const STEP_APPROACH = 4;
const STEP_NOW = 5;
const DEFAULT_LEVEL = 'experienced';
const LEVEL_RANK = ['comfortable', 'experienced', 'expert'];

type SkillDraft = { name: string; proficiency: string };

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

const SKILL_ICONS: Record<string, IconName> = {
  'Software development': 'code',
  'Web development': 'browser',
  'Mobile apps': 'deviceMobile',
  'Product development': 'cube',
  'Technical consulting': 'chat',
  'DevOps / infrastructure': 'cloud',
  'AI / automation': 'robot',
  Data: 'database',
  'Team leadership': 'users',
  'Graphic design': 'paintBrush',
  'Product design': 'layout',
  Illustration: 'penNib',
  'Photo / video': 'camera',
  Writing: 'textT',
  Sales: 'trendUp',
  Marketing: 'megaphone',
  Copywriting: 'penNib',
  'Social media': 'share',
  Partnerships: 'handshake',
  Operations: 'gear',
  'Project coordination': 'kanban',
  'Customer support': 'headset',
  Admin: 'clipboard',
  Bookkeeping: 'receipt',
  'Financial analysis': 'chart',
  'Tax prep': 'fileText',
  Advice: 'chat',
  Repairs: 'wrench',
  'Making things': 'hammer',
  'Moving / labour': 'walk',
  Driving: 'car',
  Tutoring: 'chalkboard',
  Workshops: 'users',
  'Course design': 'bookOpen',
  Cooking: 'cookingPot',
  Events: 'calendar',
  Service: 'handshake',
  Care: 'heartbeat',
  'Health advice': 'firstAid',
  Research: 'search',
  'Campus jobs': 'briefcase',
};

const WILLING_ICONS: Record<string, IconName> = {
  freelance: 'briefcase',
  consult: 'chat',
  build_product: 'rocket',
  online_gigs: 'globe',
  local_work: 'mapPin',
  teach: 'chalkboard',
  sell: 'tag',
  resell: 'arrowsClockwise',
  recover: 'refund',
  reduce_expenses: 'scissors',
};

const EXCLUDED_ICONS: Record<string, IconName> = {
  delivery: 'moped',
  microtasks: 'cursorClick',
  local_physical: 'walk',
  inventory: 'package',
  cold_calling: 'phone',
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
  const [skills, setSkills] = useState<SkillDraft[]>([]);
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
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (existing.data && !resumed) {
      setStep(STEP_AREAS);
      setResumed(true);
    }
  }, [existing.data, resumed]);

  if (existing.isLoading || catalog.isLoading) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <LoadingState label="Getting set up" />
      </View>
    );
  }

  if (catalog.isError || !catalog.data) {
    return (
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <ErrorState message={errorMessage(catalog.error)} onRetry={() => catalog.refetch()} />
      </View>
    );
  }

  const options = catalog.data.data;

  async function saveGoal() {
    if (existing.data) {
      setStep(STEP_AREAS);
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
      setStep(STEP_AREAS);
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
        experience_level: strongestLevel(skills),
        availability,
        willing,
        excluded,
        situation,
        skills: skills.map((skill) => ({ name: skill.name, proficiency: skill.proficiency })),
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

    if (step === STEP_TARGET) {
      void saveGoal();
      return;
    }

    if (step === STEPS.length - 1) {
      void finish();
      return;
    }

    setStep(step + 1);
  }

  const canContinue = step === STEP_TARGET
    ? amount.trim() !== ''
    : step === STEP_AREAS
      ? areas.length > 0
      : step === STEP_NOW
        ? availability != null
        : true;
  const amountMinor = majorToMinor(amount);
  const goalPreview = amountMinor
    ? `${formatAmount(amountMinor, 'EUR')} · ${goalRhythmSentence({ rhythm, anchor_day: rhythm === 'weekly' ? Number(weekDay) : Number(anchorDay), starts_on: startOn, ends_on: endOn || startOn }).toLowerCase()}`
    : null;

  const horizontal = layout.phone ? space.md : space.xl;
  const showBack = step > (existing.data ? STEP_AREAS : STEP_TARGET);

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.top, { paddingTop: insets.top + (insets.top > 0 ? space.sm : space.lg), paddingHorizontal: horizontal }]}>
        <BrandMark color={color.ink} />
        <View style={styles.progress}>
          {STEPS.map((label, index) => (
            <View key={label} style={{ flex: 1, gap: 6 }}>
              <View style={[styles.progressBar, index <= step && { backgroundColor: color.ink }]} />
              {layout.phone ? null : <Text style={[styles.progressLabel, index === step && { color: color.ink }]}>{label}</Text>}
            </View>
          ))}
        </View>
      </View>

      <ScrollView key={step} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: space.lg }} keyboardShouldPersistTaps="handled">
      <View style={[styles.body, { paddingHorizontal: horizontal }]}>
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

        {step === STEP_AREAS ? (
          <Step title="What do you bring?" lead="Pick everything that fits. Most people are more than one thing.">
            <Chips
              values={areas}
              options={options.work_categories.map((item) => ({ value: item.key, label: item.label, icon: WORK_ICONS[item.key] }))}
              onChange={setAreas}
            />
          </Step>
        ) : null}

        {step === STEP_SKILLS ? (
          <Step title="Skills you can charge for" lead="Pick the ones people would pay you for. Add your own if it’s missing.">
            <SkillPicker options={options} areas={areas} skills={skills} onSkills={setSkills} customSkill={customSkill} onCustomSkill={setCustomSkill} />
          </Step>
        ) : null}

        {step === STEP_LEVEL ? (
          <Step title="How experienced are you?" lead="Set this for each skill. Comfortable is enough to charge for it.">
            {skills.length === 0 ? (
              <T variant="body" color={color.ink2}>No skills yet. Go back and add one, or continue without them.</T>
            ) : (
              <View style={{ gap: space.lg }}>
                {skills.map((skill) => (
                  <View key={skill.name} style={{ gap: space.xs }}>
                    <T variant="bodyStrong">{skill.name}</T>
                    <Segmented
                      value={skill.proficiency}
                      options={options.experience_levels.map((item) => ({ value: item.key, label: item.label }))}
                      onChange={(value) => setSkills(skills.map((item) => (item.name === skill.name ? { ...item, proficiency: value } : item)))}
                    />
                  </View>
                ))}
              </View>
            )}
          </Step>
        ) : null}

        {step === STEP_APPROACH ? (
          <Step title="How would you like to get there?" lead="We only suggest things you are open to. You can change this later.">
            <View style={{ gap: space.lg }}>
              {WILLING_GROUPS.map((group) => {
                const groupOptions = options.willing.filter((item) => group.keys.includes(item.key));

                return (
                  <View key={group.type} style={{ gap: space.xs }}>
                    <TypeTag type={group.type} />
                    <Chips
                      values={willing}
                      options={groupOptions.map((item) => ({ value: item.key, label: item.label, icon: WILLING_ICONS[item.key] }))}
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
                options={options.excluded.map((item) => ({ value: item.key, label: item.label, icon: EXCLUDED_ICONS[item.key] }))}
                onChange={setExcluded}
              />
            </View>
          </Step>
        ) : null}

        {step === STEP_NOW ? (
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
      </View>
      </ScrollView>

      <View style={[styles.footer, { paddingHorizontal: horizontal, paddingBottom: Math.max(insets.bottom, space.md) }]}>
        <View style={styles.footerInner}>
          {showBack ? <Button label="Back" tone="ghost" icon="arrowLeft" onPress={() => setStep(step - 1)} /> : <View />}
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
    </KeyboardAvoidingView>
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

function strongestLevel(skills: SkillDraft[]): string | null {
  if (skills.length === 0) {
    return null;
  }

  return skills.reduce((best, skill) => {
    const skillRank = LEVEL_RANK.indexOf(skill.proficiency);
    const bestRank = LEVEL_RANK.indexOf(best);

    return skillRank > bestRank ? skill.proficiency : best;
  }, skills[0].proficiency);
}

function withNames(current: SkillDraft[], names: string[]): SkillDraft[] {
  return names.map((name) => {
    const existing = current.find((skill) => skill.name.toLowerCase() === name.toLowerCase());

    return existing ?? { name, proficiency: DEFAULT_LEVEL };
  });
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
  skills: SkillDraft[];
  onSkills: (skills: SkillDraft[]) => void;
  customSkill: string;
  onCustomSkill: (value: string) => void;
}) {
  const { color } = useOnboardingUi();
  const suggested = Array.from(new Set(areas.flatMap((area) => options.skills[area] ?? [])));
  const names = skills.map((skill) => skill.name);
  const custom = names.filter((skill) => !suggested.includes(skill));
  const choices = [...suggested, ...custom];

  function add() {
    const name = customSkill.trim();

    if (name === '' || names.some((skill) => skill.toLowerCase() === name.toLowerCase())) {
      onCustomSkill('');
      return;
    }

    onSkills([...skills, { name, proficiency: DEFAULT_LEVEL }]);
    onCustomSkill('');
  }

  return (
    <View style={{ gap: space.sm }}>
      {choices.length === 0 ? <T variant="body" color={color.ink2}>Nothing suggested for what you picked. Add one below.</T> : (
        <Chips values={names} options={choices.map((skill) => ({ value: skill, label: skill, icon: SKILL_ICONS[skill] ?? 'sparkle' }))} onChange={(next) => onSkills(withNames(skills, next))} />
      )}
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
  page: { flex: 1, backgroundColor: color.paper },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.xl, paddingBottom: space.md, flexWrap: 'wrap', backgroundColor: color.paper },
  progress: { flex: 1, flexDirection: 'row', gap: 6, minWidth: 180, maxWidth: 640, marginLeft: 'auto' },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: color.lineStrong },
  progressLabel: { fontFamily: font.semi, fontWeight: weight.medium, fontSize: 12, color: color.ink3 },
  body: { width: '100%', maxWidth: 820, alignSelf: 'center', gap: space.xl, paddingTop: space.lg },
  preview: { flexDirection: 'row', gap: space.xs, alignItems: 'center', backgroundColor: color.moneySoft, borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.md, alignSelf: 'flex-start' },
  avoid: { paddingTop: space.lg, borderTopWidth: 1, borderColor: color.line },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: space.md },
  checkOn: { borderColor: color.ink },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: color.lineStrong, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: color.ink, borderColor: color.ink },
  checkText: { fontFamily: font.medium, fontWeight: weight.medium, fontSize: 15, color: color.ink, flex: 1 },
  footer: { paddingTop: space.md, borderTopWidth: 1, borderColor: color.line, backgroundColor: color.paper },
  footerInner: { width: '100%', maxWidth: 820, alignSelf: 'center', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm },
  });
}
