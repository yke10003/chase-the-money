import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { createSellItem, getDiscover, getProfile, getCatalog, startPlaybook } from '@/api/endpoints';
import type { OpportunityType } from '@/api/types';
import { Icon, type IconName } from '@/components/icon';
import { Button, Chips, DateField, ErrorState, Field, InlineError, LinkButton, LoadingState, MoneyField, PageHeader, Panel, T, TypeGlyph } from '@/components/ui';
import { useLayout } from '@/design/layout';
import type { Palette, TypeTint } from '@/design/palette';
import { font, radius, space, weight } from '@/design/tokens';
import { useTheme } from '@/state/theme';

function useDiscoverUi() {
  const theme = useTheme();
  const styles = useMemo(() => createDiscoverStyles(theme.color, theme.typeColor.earn), [theme.color, theme.typeColor]);

  return { ...theme, styles, typeScale: theme.type };
}
import { errorMessage } from '@/lib/errors';
import { majorToMinor } from '@/lib/money';
import { rememberSellItem, startSellWrite } from '@/lib/sell-cache';
import { useRefreshProduct } from '@/state/query';

type Tool = 'hunt' | 'skills' | 'recovery' | 'expenses';

const TOOLS: Array<{ value: Tool; type: OpportunityType; title: string; hook: string }> = [
  { value: 'hunt', type: 'sell', title: 'Money Hunt', hook: 'Things you own that someone would pay for' },
  { value: 'skills', type: 'earn', title: 'Your skills', hook: 'Work people already trust you with' },
  { value: 'recovery', type: 'recover', title: 'Money owed to you', hook: 'Cash that is already yours' },
  { value: 'expenses', type: 'save', title: 'Expense audit', hook: 'Recurring costs you might not need' },
];

const HUNT_CATEGORY: Record<string, string> = {
  Wardrobe: 'wardrobe',
  Electronics: 'tech',
  'Jewelry / metals': 'metals',
  Collectibles: 'collectibles',
  Tools: 'tools',
  'Sports / hobby gear': 'sports',
  Furniture: 'home',
  Storage: 'other',
};

const HUNT: Record<string, { icon: IconName; prompt: string; example: string }> = {
  Wardrobe: { icon: 'tshirt', prompt: 'Jackets, shoes and bags you haven’t worn in a year. Designer pieces go fastest.', example: 'Versace jacket' },
  Electronics: { icon: 'laptop', prompt: 'Old phones, laptops, consoles, cameras. Even broken ones sell for parts.', example: 'iPhone 12' },
  'Jewelry / metals': { icon: 'diamond', prompt: 'Gold, silver and watches. The value comes down to weight and purity.', example: 'Silver collection' },
  Collectibles: { icon: 'medal', prompt: 'Cards, vinyl, toys, first editions. Recent sold prices tell you the real value.', example: 'Pokémon cards' },
  Tools: { icon: 'wrench', prompt: 'Power tools and kits you used once and stored.', example: 'Makita drill set' },
  'Sports / hobby gear': { icon: 'bicycle', prompt: 'Bikes, rackets, instruments: gear from a hobby you dropped.', example: 'Road bike' },
  Furniture: { icon: 'armchair', prompt: 'A chair, lamp or desk you replaced. Local pick-up sells quickly.', example: 'Eames-style chair' },
  Storage: { icon: 'package', prompt: 'The attic, the basement, the box under the bed. Open one.', example: 'Box of old games' },
};

const RECOVERY_ICONS: Record<string, IconName> = {
  friend: 'handshake',
  invoice: 'receipt',
  refund: 'refund',
  reimbursement: 'wallet',
  tax: 'fileText',
};

const RECOVERY_PLACEHOLDERS: Record<string, string> = {
  friend: 'Sam, concert tickets',
  invoice: 'Invoice #2024-031',
  refund: 'Cancelled flight',
  reimbursement: 'Work travel expenses',
  tax: '2025 tax return',
};

const COMMON_COSTS = ['Streaming', 'Music', 'Software', 'Phone plan', 'Gym', 'Cloud storage', 'News', 'Insurance'];

const MOVED: Record<string, string> = {
  hunt: '/sell?start=hunt',
  skills: '/freelance?start=work',
  recovery: '/recover?start=find',
  expenses: '/opportunities?start=cost',
};

/** Old links land in the cockpit that now owns the tool. */
export default function DiscoverScreen() {
  const params = useLocalSearchParams<{ tool?: string }>();
  const router = useRouter();
  const tool = typeof params.tool === 'string' ? params.tool : 'hunt';

  useEffect(() => {
    router.dismissTo(MOVED[tool] ?? '/sell?start=hunt');
  }, [router, tool]);

  return <LoadingState label="Opening the right place…" />;
}

function useStart(onStarted?: (id: number) => void) {
  const refresh = useRefreshProduct();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function start(playbook: string, input: Record<string, unknown>) {
    setBusy(true);
    setError(null);

    try {
      const created = await startPlaybook(playbook, input);
      await refresh();

      if (onStarted) {
        onStarted(created.data.id);
      } else {
        router.push(`/opportunities/${created.data.id}`);
      }
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return { start, busy, error, setError };
}

function ToolHeader({ type, title, lead }: { type: OpportunityType; title: string; lead: string }) {
  const { color, typeColor, typeScale } = useDiscoverUi();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[typeScale.eyebrow, { color: typeColor[type].ink }]}>{type === 'sell' ? 'Sell' : type === 'earn' ? 'Freelance' : type === 'recover' ? 'Recover' : 'A cost'}</Text>
      <T variant="heading" style={{ fontSize: 26, lineHeight: 32 }}>{title}</T>
      <T variant="body" color={color.ink2}>{lead}</T>
    </View>
  );
}

export function MoneyHunt({ categories }: { categories: string[] }) {
  const { color, styles, typeColor } = useDiscoverUi();
  const layout = useLayout();
  const router = useRouter();
  const refresh = useRefreshProduct();
  const client = useQueryClient();
  const [category, setCategory] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [worth, setWorth] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const meta = category ? HUNT[category] : null;

  async function startSale() {
    const name = itemName.trim();

    if (category == null || name === '') {
      setError(new Error('Name the thing you found.'));
      return;
    }

    const worthMinor = worth.trim() === '' ? null : majorToMinor(worth);

    if (worth.trim() !== '' && worthMinor == null) {
      setError(new Error('Enter a rough value like 150, or leave it blank.'));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const created = await createSellItem({
        category: HUNT_CATEGORY[category] ?? 'other',
        name,
        worth_minor: worthMinor,
      });
      const token = startSellWrite(created.data.id);
      await rememberSellItem(client, created.data, token);
      await refresh();
      await rememberSellItem(client, created.data, token);
      router.push(`/sell/setup/${created.data.id}`);
    } catch (caught) {
      setError(caught);
      setBusy(false);
    }
  }

  return (
    <Panel padding="xl" style={{ gap: space.lg }}>
      <ToolHeader type="sell" title="Money Hunt" lead="Walk through one corner of your home. Where do you want to look?" />
      <View style={styles.huntGrid}>
        {categories.map((item) => {
          const selected = category === item;
          const icon = HUNT[item]?.icon ?? 'package';

          return (
            <Pressable
              key={item}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setCategory(item)}
              style={(state) => [
                styles.huntTile,
                { width: layout.phone ? '48%' : '23.5%' },
                selected && { borderColor: typeColor.sell.base, backgroundColor: typeColor.sell.soft },
                !selected && (state as { hovered?: boolean }).hovered && { borderColor: color.ink3 },
              ]}
            >
              <Icon name={icon} size={26} color={selected ? typeColor.sell.ink : color.ink2} weight="duotone" />
              <Text style={[styles.huntLabel, selected && { color: typeColor.sell.ink }]}>{item}</Text>
            </Pressable>
          );
        })}
      </View>
      {category ? (
        <View style={styles.found}>
          <T variant="body" color={color.ink2}>{meta?.prompt ?? 'Look for one thing you no longer use.'}</T>
          <Field label="What did you find?" value={itemName} onChangeText={setItemName} placeholder={meta?.example ?? 'Name one item'} />
          <View style={{ maxWidth: 260 }}>
            <MoneyField label="Rough value" value={worth} onChangeText={setWorth} hint="Not sure? Leave it. Valuing it becomes step one." />
          </View>
          {error ? <InlineError message={errorMessage(error)} /> : null}
          <Button label="Start selling it" iconRight="arrowRight" busy={busy} onPress={startSale} />
        </View>
      ) : null}
    </Panel>
  );
}

export function Skills({
  missions,
  bare = false,
  onStarted,
}: {
  missions: Array<{ title: string; detail: string; current_state: string; area: string | null }>;
  bare?: boolean;
  /** Takes over opening the new mission, e.g. after a sheet has closed. */
  onStarted?: (id: number) => void;
}) {
  const router = useRouter();
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: getCatalog });
  const profile = useQuery({ queryKey: ['profile'], queryFn: getProfile });
  const { start, busy, error } = useStart(onStarted);
  const [starting, setStarting] = useState<string | null>(null);
  const areaLabels = Object.fromEntries((catalog.data?.data.work_categories ?? []).map((item) => [item.key, item.label]));
  const { styles, typeColor, typeScale } = useDiscoverUi();
  const skills = profile.data?.data.skills.map((skill) => skill.name) ?? [];

  const body = (
    <>
      {bare ? null : <ToolHeader type="earn" title="Your skills" lead="Small, concrete offers to people who already know your work." />}
      {skills.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: space.xs, flexWrap: 'wrap', alignItems: 'center' }}>
          {skills.slice(0, 6).map((skill) => (
            <View key={skill} style={styles.skillPill}>
              <Text style={styles.skillPillText}>{skill}</Text>
            </View>
          ))}
          <LinkButton label="Edit" icon="pencil" onPress={() => router.push('/settings?tab=profile')} />
        </View>
      ) : null}
      {error ? <InlineError message={errorMessage(error)} /> : null}
      <View style={{ gap: space.xs }}>
        {missions.map((mission) => (
          <View key={mission.title} style={styles.skillRow}>
            <View style={{ flex: 1, gap: 4 }}>
              {mission.area && areaLabels[mission.area] ? <Text style={[typeScale.eyebrow, { color: typeColor.earn.ink }]}>{areaLabels[mission.area]}</Text> : null}
              <T variant="subheading">{mission.title}</T>
              <T variant="small">{mission.detail}</T>
            </View>
            <Button
              label="Start"
              tone="secondary"
              iconRight="arrowRight"
              busy={busy && starting === mission.title}
              disabled={busy}
              onPress={() => {
                setStarting(mission.title);
                void start('freelance', { title: mission.title, current_state: mission.current_state });
              }}
            />
          </View>
        ))}
      </View>
    </>
  );

  if (bare) {
    return <View style={{ gap: space.md }}>{body}</View>;
  }

  return <Panel padding="xl" style={{ gap: space.lg }}>{body}</Panel>;
}

export function Recovery({ prompts }: { prompts: Array<{ kind: string; label: string }> }) {
  const { styles } = useDiscoverUi();
  const [kind, setKind] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const { start, busy, error, setError } = useStart();

  async function track() {
    const name = title.trim();

    if (name === '') {
      setError(new Error('Say what the money is for.'));
      return;
    }

    const amountMinor = amount.trim() === '' ? null : majorToMinor(amount);

    if (amount.trim() !== '' && amountMinor == null) {
      setError(new Error('Enter a rough amount like 250, or leave it blank.'));
      return;
    }

    await start('recover_money', { title: name, kind, amount_minor: amountMinor, expected_on: date.trim() || null });
  }

  return (
    <Panel padding="xl" style={{ gap: space.lg }}>
      <ToolHeader type="recover" title="Money owed to you" lead="Money that is already yours. Most people find at least one." />
      <Chips
        single
        values={kind ? [kind] : []}
        options={prompts.map((item) => ({ value: item.kind, label: item.label, icon: RECOVERY_ICONS[item.kind] }))}
        onChange={(values) => setKind(values[0] ?? null)}
      />
      {kind ? (
        <View style={styles.found}>
          <Field label="What is it for?" value={title} onChangeText={setTitle} placeholder={RECOVERY_PLACEHOLDERS[kind] ?? 'Who owes you, and for what'} />
          <View style={{ flexDirection: 'row', gap: space.md, flexWrap: 'wrap' }}>
            <View style={{ flex: 1, minWidth: 200 }}>
              <MoneyField label="Roughly how much?" value={amount} onChangeText={setAmount} hint="Blank is fine. Pinning it down becomes step one." />
            </View>
            <View style={{ flex: 1, minWidth: 200 }}>
              <DateField label="I expect it by" value={date} onChange={setDate} hint="Optional" />
            </View>
          </View>
          {error ? <InlineError message={errorMessage(error)} /> : null}
          <Button label="Track this money" iconRight="arrowRight" busy={busy} onPress={track} />
        </View>
      ) : null}
    </Panel>
  );
}

export function Expenses() {
  const { color, styles } = useDiscoverUi();
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const { start, busy, error, setError } = useStart();

  async function review() {
    const title = name.trim();

    if (title === '') {
      setError(new Error('Name the cost.'));
      return;
    }

    const amountMinor = amount.trim() === '' ? null : majorToMinor(amount);

    if (amount.trim() !== '' && amountMinor == null) {
      setError(new Error('Enter the monthly amount like 12.99, or leave it blank.'));
      return;
    }

    await start('reduce_expense', { title, current_monthly_minor: amountMinor });
  }

  return (
    <Panel padding="xl" style={{ gap: space.lg }}>
      <ToolHeader type="save" title="Expense audit" lead="One recurring cost at a time. Keep it, cut it, or pay less." />
      <Chips
        label="Common suspects"
        single
        values={COMMON_COSTS.includes(name) ? [name] : []}
        options={COMMON_COSTS.map((item) => ({ value: item, label: item }))}
        onChange={(values) => setName(values[0] ?? '')}
      />
      <View style={styles.found}>
        <Field label="Which cost?" value={name} onChangeText={setName} placeholder="Adobe Creative Cloud" />
        <View style={{ maxWidth: 260 }}>
          <MoneyField label="What you pay each month" value={amount} onChangeText={setAmount} hint="Check your last charge, or fill it in later" />
        </View>
        <T variant="small" color={color.ink3}>A cut counts this month’s difference toward your goal. The yearly figure is shown, but not counted.</T>
        {error ? <InlineError message={errorMessage(error)} /> : null}
        <Button label="Review this cost" iconRight="arrowRight" busy={busy} onPress={review} />
      </View>
    </Panel>
  );
}

function createDiscoverStyles(color: Palette, earn: TypeTint) {
  return StyleSheet.create({
  tools: { gap: space.xs },
  tool: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: color.line },
  huntGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, justifyContent: 'space-between' },
  huntTile: { alignItems: 'flex-start', gap: space.sm, padding: space.md, borderRadius: 20, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface, minHeight: 112 },
  huntLabel: { fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 14, color: color.ink },
  found: { gap: space.md, paddingTop: space.lg, borderTopWidth: 1, borderColor: color.line },
  skillPill: { backgroundColor: earn.soft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  skillPillText: { fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 12, color: earn.ink },
  skillRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg, borderWidth: 1, borderColor: color.line, backgroundColor: color.surface, flexWrap: 'wrap' },
  });
}
