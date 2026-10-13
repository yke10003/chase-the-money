import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { mediaUrl } from '@/api/client';
import {
  addSellComparable,
  completeAction,
  deleteSellComparable,
  getSellCatalog,
  getSellItem,
  reportEvent,
  updateSellItem,
} from '@/api/endpoints';
import type { PlaybookOutcome, SellItemView } from '@/api/types';
import { GlassClose, GlassIconButton } from '@/components/glass-close';
import { EditingSheet } from '@/components/editing-sheet';
import { Icon } from '@/components/icon';
import { ChoiceBlock, queueSellResume, sellIcon } from '@/components/sell-flow';
import { Button, Field, InlineError, LoadingState, MoneyField, T } from '@/components/ui';
import { useLayout } from '@/design/layout';
import { font, space, weight } from '@/design/tokens';
import { errorMessage } from '@/lib/errors';
import { formatAmount, formatAmountRange, majorToMinor, minorToMajorInput } from '@/lib/money';
import { coverIndex, listingPlace, listingStatus, productFacts } from '@/lib/product-detail';
import { categoryIcon, rememberSellItem, startSellWrite } from '@/lib/sell-cache';
import { listingSuggestion } from '@/lib/sell';
import { parseValueEdit, valueDraft, withUnknown } from '@/lib/value-edit';
import { useRefreshProduct } from '@/state/query';
import { useTheme } from '@/state/theme';

type SheetName = 'details' | 'value' | 'description' | 'action' | 'outcome' | 'listings' | null;

export function ProductPage() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const client = useQueryClient();
  const refresh = useRefreshProduct();
  const { color, scheme, type: typeScale, typeColor } = useTheme();
  const sell = typeColor.sell;
  const phone = useLayout().phone;
  const insets = useSafeAreaInsets();
  const itemQuery = useQuery({
    queryKey: ['sell', 'item', id],
    queryFn: () => getSellItem(id),
    enabled: Number.isFinite(id),
    placeholderData: () => {
      const list = client.getQueryData<SellItemView[]>(['sell', 'items']);
      const seeded = list?.find((entry) => entry.id === id);

      return seeded ? { data: seeded } : undefined;
    },
  });
  const catalog = useQuery({ queryKey: ['sell', 'catalog'], queryFn: getSellCatalog });
  const [sheet, setSheet] = useState<SheetName>(null);
  const [adding, setAdding] = useState(false);
  const [outcomeKey, setOutcomeKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const item = itemQuery.data?.data;

  useEffect(() => {
    setSheet(null);
    setAdding(false);
    setOutcomeKey(null);
    setError(null);
  }, [id]);

  function close() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/sell');
  }

  async function keep(next: SellItemView) {
    await rememberSellItem(client, next, startSellWrite(id));
  }

  async function reload() {
    const fresh = await getSellItem(id);
    await keep(fresh.data);
    await refresh();
    await rememberSellItem(client, fresh.data, startSellWrite(id));
  }

  if (!Number.isFinite(id) || (itemQuery.isError && !item)) {
    return (
      <View style={[styles.fill, { backgroundColor: color.paper, paddingTop: insets.top + 8, paddingHorizontal: 20 }]}>
        <GlassClose onPress={close} />
        <InlineError message={errorMessage(itemQuery.error)} />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.fill, { backgroundColor: color.paper, paddingTop: insets.top + 8, paddingHorizontal: 16 }]}>
        <GlassClose onPress={close} />
        <LoadingState label="Loading the item" />
      </View>
    );
  }

  const record = item;
  const category = catalog.data?.data.categories.find((entry) => entry.key === record.category);
  const fields = [...(category?.identity ?? []), ...(category?.details ?? [])];
  const facts = productFacts(record, fields);
  const kind = record.subcategory_label ?? record.category_label;
  const estimate = formatAmountRange(record.value_min_minor, record.value_max_minor, record.currency);
  const asking = record.asking_price_minor != null ? formatAmount(record.asking_price_minor, record.currency) : null;
  const offer = record.offer_minor != null ? formatAmount(record.offer_minor, record.currency) : null;
  const agreed = record.agreed_amount_minor != null ? formatAmount(record.agreed_amount_minor, record.currency) : null;
  const received = record.received_minor != null && record.received_minor > 0 ? formatAmount(record.received_minor, record.currency) : null;
  const next = record.next;
  const outcomes = (record.outcomes ?? []).filter((outcome) => outcome.key !== next?.playbook_key);
  const icon = categoryIcon(catalog.data?.data.categories, record.category);

  function resume() {
    queueSellResume(record.id);
    router.dismissTo('/sell');
  }

  const body = (
    <View style={{ paddingHorizontal: 20, paddingTop: 22, gap: 28, paddingBottom: phone ? 28 : 48 }}>
      <View style={{ gap: 6 }}>
        <Text style={[typeScale.eyebrow, { color: sell.ink }]}>{kind}</Text>
        <Text style={[typeScale.title, { fontSize: phone ? 34 : 40, lineHeight: phone ? 38 : 44 }]}>{record.name?.trim() || 'Untitled item'}</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <Text style={{ color: color.ink2, fontSize: 15 }}>{record.stage_label}</Text>
          {record.xp_earned > 0 ? <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, color: sell.ink }}>+{record.xp_earned} XP</Text> : null}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <T variant="eyebrow">Value</T>
          {record.setup_done ? <TextButton label="Edit" onPress={() => { setError(null); setSheet('value'); }} /> : null}
        </View>
        <Text style={[typeScale.figure, { fontSize: phone ? 28 : 32, lineHeight: phone ? 34 : 38 }]}>{estimate ? `${estimate} possible` : 'Value still unknown'}</Text>
        {asking ? <Text style={{ color: color.ink, fontSize: 16 }}>{asking} asking{record.listed_on ? ` on ${record.listed_on}` : ''}</Text> : null}
        {offer ? <Text style={{ color: color.ink2, fontSize: 16 }}>{offer} offer</Text> : null}
        {agreed ? <Text style={{ color: color.ink2, fontSize: 16 }}>{agreed} agreed</Text> : null}
        {received ? <Text style={{ color: sell.ink, fontSize: 16 }}>{received} received</Text> : null}
        {record.listing_url ? (
          <TextButton label={record.listing_url} onPress={() => void Linking.openURL(record.listing_url!)} />
        ) : null}
      </View>

      {record.setup_done ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T variant="eyebrow">Listing</T>
            <TextButton label="Edit" onPress={() => { setError(null); setSheet('description'); }} />
          </View>
          <Text style={[typeScale.body, { color: color.ink }]}>{record.listing_title?.trim() || record.name?.trim() || 'Untitled item'}</Text>
          {record.listing_description ? <Text style={[typeScale.body, { color: color.ink2 }]}>{record.listing_description}</Text> : null}
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T variant="eyebrow">Details</T>
          <TextButton label="Edit" onPress={() => { setError(null); setSheet('details'); }} />
        </View>
        {facts.length === 0 ? <Text style={{ color: color.ink3 }}>Nothing recorded yet.</Text> : facts.map((fact) => (
          <View key={fact.label} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line }}>
            <Text style={{ color: color.ink3, fontSize: 15 }}>{fact.label}</Text>
            <Text style={{ flex: 1, textAlign: 'right', color: color.ink, fontFamily: font.medium, fontSize: 15 }}>{fact.value}</Text>
          </View>
        ))}
      </View>

      {record.comparables.length > 0 || record.setup_done ? (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <T variant="eyebrow">Similar listings</T>
            <TextButton label={record.comparables.length > 0 ? 'Edit' : 'Add'} onPress={() => { setError(null); setAdding(false); setSheet('listings'); }} />
          </View>
          {record.comparables.map((comparable) => (
            <Pressable key={comparable.id} accessibilityRole="link" onPress={() => void Linking.openURL(comparable.url)} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line }}>
              <Text style={{ color: comparable.state === 'asking' ? color.ink2 : color.ink, fontFamily: font.medium }}>{listingStatus(comparable.state)}</Text>
              <Text style={{ flex: 1, textAlign: 'right', color: color.ink }}>{formatAmount(comparable.amount_minor, record.currency)} · {listingPlace(comparable.platform, comparable.url)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {outcomes.length > 0 ? (
        <View style={{ gap: 10 }}>
          <T variant="eyebrow">Something changed?</T>
          {outcomes.map((outcome) => (
            <Pressable key={outcome.key} accessibilityRole="button" onPress={() => { setError(null); setOutcomeKey(outcome.key); setSheet('outcome'); }} style={{ paddingVertical: 8 }}>
              <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 16, color: outcome.tone === 'danger' ? color.danger : color.ink }}>{outcome.label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );

  const footerLabel = !record.setup_done ? 'Continue setup' : next ? next.title : null;

  return (
    <View style={[styles.fill, { backgroundColor: color.paper }]}>
      {phone ? (
        <ScrollView style={styles.fill} contentContainerStyle={{ paddingBottom: footerLabel ? 12 : insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
          <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8 }}>
            <GlassClose onPress={close} />
          </View>
          <Gallery item={record} icon={icon} onManage={() => router.push(`/product/${record.id}/photos`)} />
          {body}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ width: '100%', maxWidth: 880, alignSelf: 'center' }}>
          <View style={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: 8 }}>
            <GlassClose onPress={close} />
          </View>
          <Gallery item={record} icon={icon} onManage={() => router.push(`/product/${record.id}/photos`)} />
          {body}
        </ScrollView>
      )}
      {footerLabel ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 16), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line, backgroundColor: color.paper }}>
          {error && sheet == null ? <InlineError message={error} /> : null}
          <Button
            label={footerLabel}
            size="lg"
            full
            busy={busy}
            onPress={() => {
              setError(null);
              if (!record.setup_done) {
                resume();
                return;
              }
              if (next && (next.fields ?? []).length > 0) {
                setSheet('action');
                return;
              }
              if (next) {
                void run(async () => {
                  await completeAction(record.opportunity_id, next.id, {});
                  await reload();
                });
              }
            }}
          />
        </View>
      ) : null}
      <Editor
        name={sheet}
        item={record}
        outcome={outcomes.find((entry) => entry.key === outcomeKey) ?? null}
        fields={fields}
        conditions={catalog.data?.data.conditions ?? []}
        busy={busy}
        adding={adding}
        error={error}
        onClose={() => { setSheet(null); setAdding(false); setError(null); }}
        onError={setError}
        onAdd={() => { setError(null); setAdding(true); }}
        onBack={() => { setError(null); setAdding(false); }}
        run={run}
        onSaved={async (nextItem) => {
          await keep(nextItem);
          if (sheet === 'listings') {
            setAdding(false);
            return;
          }
          setSheet(null);
        }}
        onEvent={async (input) => {
          await run(async () => {
            await reportEvent(record.opportunity_id, input);
            await reload();
            setSheet(null);
          });
        }}
        onAction={async (input) => {
          if (!next) {
            return;
          }
          await run(async () => {
            await completeAction(record.opportunity_id, next.id, input);
            await reload();
            setSheet(null);
          });
        }}
      />
    </View>
  );

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError(null);

    try {
      await work();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }
}

function Gallery({
  item,
  icon,
  onManage,
}: {
  item: SellItemView;
  icon: string;
  onManage: () => void;
}) {
  const { color } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(windowWidth);
  const [page, setPage] = useState(() => coverIndex(item.photos));
  const scroller = useRef<ScrollView>(null);
  const photos = item.photos;
  const start = coverIndex(photos);
  const height = Math.min(Math.max(width, 1) * 1.12, 680);

  useEffect(() => {
    setPage(start);
    scroller.current?.scrollTo({ x: start * width, animated: false });
  }, [item.id, start, width]);

  return (
      <View onLayout={(event) => {
        const next = Math.round(event.nativeEvent.layout.width);
        setWidth((current) => (Math.round(current) === next ? current : next));
      }}>
      {photos.length === 0 ? (
        <View style={{ width: '100%', height, backgroundColor: color.sunken, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={sellIcon(icon)} size={88} color={color.ink} weight="duotone" />
        </View>
      ) : (
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            if (width <= 0) {
              return;
            }
            setPage(Math.round(event.nativeEvent.contentOffset.x / width));
          }}
          style={{ width: '100%', height }}
        >
          {photos.map((photo) => (
            <Image key={`${photo.id}-${photo.url}`} source={{ uri: mediaUrl(photo.url) }} accessibilityLabel="" resizeMode="cover" style={{ width, height }} />
          ))}
        </ScrollView>
      )}
      {photos.length > 1 ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 14, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {photos.map((photo, index) => (
              <View key={photo.id} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: index === page ? '#FFFFFF' : 'rgba(255,255,255,0.45)' }} />
            ))}
          </View>
        </View>
      ) : null}
      <View style={{ position: 'absolute', right: 16, bottom: photos.length > 1 ? 32 : 16 }}>
        <GlassIconButton systemName="pencil" label="Manage photos" onPress={onManage} />
      </View>
    </View>
  );
}

function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { typeColor } = useTheme();

  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={6}>
      <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, color: typeColor.sell.ink, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

function Editor({
  name,
  item,
  outcome,
  fields,
  conditions,
  busy,
  adding,
  error,
  onClose,
  onError,
  onAdd,
  onBack,
  run,
  onSaved,
  onEvent,
  onAction,
}: {
  name: SheetName;
  item: SellItemView;
  outcome: PlaybookOutcome | null;
  fields: Array<{ key: string; label: string; placeholder?: string; choices?: string[]; detail?: boolean }>;
  conditions: Array<{ key: string; label: string }>;
  busy: boolean;
  adding: boolean;
  error: string | null;
  onClose: () => void;
  onError: (message: string) => void;
  onAdd: () => void;
  onBack: () => void;
  run: (work: () => Promise<void>) => Promise<void>;
  onSaved: (item: SellItemView) => Promise<void>;
  onEvent: (input: Record<string, unknown>) => Promise<void>;
  onAction: (input: Record<string, unknown>) => Promise<void>;
}) {
  const listingAdd = name === 'listings' && adding;
  const title = listingAdd
    ? 'Add similar listing'
    : name === 'details' ? 'Details'
      : name === 'value' ? 'Value'
        : name === 'description' ? 'Description'
          : name === 'action' ? item.next?.title ?? 'Next step'
            : name === 'outcome' ? outcome?.label ?? 'Update'
              : name === 'listings' ? 'Similar listings'
                : '';

  return (
    <Modal
      visible={name != null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (listingAdd) {
          onBack();
          return;
        }
        onClose();
      }}
    >
      <EditingSheet
        title={title}
        onClose={listingAdd ? onBack : onClose}
        right={name === 'listings' && !adding ? <GlassIconButton systemName="plus" icon="plus" label="Add similar listing" onPress={onAdd} /> : null}
      >
        <ScrollView style={styles.fill} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: space.md }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
          {error ? <InlineError message={error} /> : null}
          {name === 'details' ? <DetailsForm item={item} fields={fields} conditions={conditions} busy={busy} onError={onError} onSaved={onSaved} run={run} /> : null}
          {name === 'value' ? <ValueForm item={item} busy={busy} onError={onError} onSaved={onSaved} run={run} /> : null}
          {name === 'description' ? <DescriptionForm item={item} busy={busy} onSaved={onSaved} run={run} /> : null}
          {name === 'action' && item.next ? <ActionForm item={item} busy={busy} onError={onError} onAction={onAction} /> : null}
          {name === 'outcome' && outcome ? <OutcomeForm outcome={outcome} busy={busy} onError={onError} onEvent={onEvent} /> : null}
          {listingAdd ? <ComparableForm item={item} busy={busy} onError={onError} onSaved={onSaved} run={run} /> : null}
          {name === 'listings' && !adding ? <ListingsOverview item={item} onAdd={onAdd} onSaved={onSaved} run={run} /> : null}
        </ScrollView>
      </EditingSheet>
    </Modal>
  );
}

function DetailsForm({
  item,
  fields,
  conditions,
  busy,
  onError,
  onSaved,
  run,
}: {
  item: SellItemView;
  fields: Array<{ key: string; label: string; placeholder?: string; choices?: string[]; detail?: boolean }>;
  conditions: Array<{ key: string; label: string }>;
  busy: boolean;
  onError: (message: string) => void;
  onSaved: (item: SellItemView) => Promise<void>;
  run: (work: () => Promise<void>) => Promise<void>;
}) {
  const [name, setName] = useState(item.name ?? '');
  const [brand, setBrand] = useState(item.brand ?? '');
  const [condition, setCondition] = useState<string | null>(item.condition);
  const [details, setDetails] = useState<Record<string, string>>(item.details ?? {});
  const asksBrand = fields.some((field) => field.key === 'brand' && !field.detail) || Boolean(item.brand);

  return (
    <View style={{ gap: space.md }}>
      <Field label="Name" value={name} onChangeText={setName} />
      {asksBrand ? <Field label="Brand" value={brand} onChangeText={setBrand} /> : null}
      {conditions.map((entry) => (
        <ChoiceBlock key={entry.key} label={entry.label} selected={condition === entry.key} onPress={() => setCondition(entry.key)} />
      ))}
      {fields.filter((field) => field.key !== 'brand' || field.detail).map((field) => field.choices ? (
        <View key={field.key} style={{ gap: space.sm }}>
          <T variant="bodyStrong">{field.label}</T>
          {field.choices.map((choice) => (
            <ChoiceBlock key={choice} label={choice} selected={details[field.key] === choice} onPress={() => setDetails((current) => ({ ...current, [field.key]: choice }))} />
          ))}
        </View>
      ) : (
        <Field key={field.key} label={field.label} value={details[field.key] ?? ''} placeholder={field.placeholder} onChangeText={(value) => setDetails((current) => ({ ...current, [field.key]: value }))} />
      ))}
      <Button label="Save" size="lg" busy={busy} onPress={() => void run(async () => {
        const trimmed = name.trim();
        if (trimmed === '') {
          onError('Name the item first.');
          return;
        }
        const next = await updateSellItem(item.id, {
          name: trimmed,
          brand: asksBrand ? brand.trim() || null : undefined,
          condition,
          details,
        });
        await onSaved(next.data);
      })} />
    </View>
  );
}

function ValueForm({
  item,
  busy,
  onError,
  onSaved,
  run,
}: {
  item: SellItemView;
  busy: boolean;
  onError: (message: string) => void;
  onSaved: (item: SellItemView) => Promise<void>;
  run: (work: () => Promise<void>) => Promise<void>;
}) {
  const [draft, setDraft] = useState(() => valueDraft(item));
  const { low, high, unknown } = draft;

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ gap: space.sm, opacity: unknown ? 0.4 : 1 }} pointerEvents={unknown ? 'none' : 'auto'}>
        <MoneyField label="Estimated value" value={low} editable={!unknown} onChangeText={(value) => setDraft((current) => ({ ...current, low: value }))} />
        <MoneyField label="Maximum, if it's a range" value={high} editable={!unknown} onChangeText={(value) => setDraft((current) => ({ ...current, high: value }))} />
      </View>
      <ChoiceBlock label="I don't know yet" selected={unknown} onPress={() => setDraft((current) => withUnknown(current, !current.unknown))} />
      <Button label="Save" size="lg" busy={busy} onPress={() => void run(async () => {
        const parsed = parseValueEdit(draft);
        if ('error' in parsed) {
          onError(parsed.error);
          return;
        }
        const next = await updateSellItem(item.id, parsed);
        await onSaved(next.data);
      })} />
    </View>
  );
}

function DescriptionForm({
  item,
  busy,
  onSaved,
  run,
}: {
  item: SellItemView;
  busy: boolean;
  onSaved: (item: SellItemView) => Promise<void>;
  run: (work: () => Promise<void>) => Promise<void>;
}) {
  const [title, setTitle] = useState(item.listing_title ?? '');
  const [text, setText] = useState(item.listing_description ?? '');

  return (
    <View style={{ gap: space.md }}>
      <Field label="Listing title" value={title} onChangeText={setTitle} placeholder={item.name ?? 'Listing title'} />
      <Field label="Description" value={text} onChangeText={setText} lines={6} />
      <Button label="Save" size="lg" busy={busy} onPress={() => void run(async () => {
        const next = await updateSellItem(item.id, {
          listing_title: title.trim() || null,
          listing_description: text.trim() || null,
        });
        await onSaved(next.data);
      })} />
    </View>
  );
}

function ActionForm({
  item,
  busy,
  onError,
  onAction,
}: {
  item: SellItemView;
  busy: boolean;
  onError: (message: string) => void;
  onAction: (input: Record<string, unknown>) => Promise<void>;
}) {
  const next = item.next;
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seeded: Record<string, string> = {};
    if (item.listing_description) {
      seeded.listing_description = item.listing_description;
    }
    return seeded;
  });
  const suggestion = listingSuggestion(item);

  if (!next) {
    return null;
  }

  return (
    <View style={{ gap: space.md }}>
      {next.description ? <T variant="body">{next.description}</T> : null}
      {next.playbook_key === 'prepare_item' ? (
        <Pressable accessibilityRole="button" onPress={() => setValues((current) => ({ ...current, listing_description: suggestion }))}>
          <T variant="small">{suggestion}</T>
          <T variant="bodyStrong">Use this</T>
        </Pressable>
      ) : null}
      {(next.fields ?? []).map((field) => field.type === 'money' ? (
        <MoneyField key={field.key} label={field.label} value={values[field.key] ?? (field.prefill_minor != null ? minorToMajorInput(field.prefill_minor) : '')} onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))} />
      ) : (
        <Field key={field.key} label={field.label} lines={field.key === 'listing_description' ? 5 : 1} value={values[field.key] ?? ''} onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))} autoCapitalize={field.key.includes('url') ? 'none' : 'sentences'} />
      ))}
      <Button label="Save" size="lg" busy={busy} onPress={() => {
        const input: Record<string, unknown> = {};
        for (const field of next.fields ?? []) {
          const raw = values[field.key] ?? (field.type === 'money' && field.prefill_minor != null ? minorToMajorInput(field.prefill_minor) : '');
          if (field.type === 'money') {
            if (raw.trim() === '' && !field.required) {
              continue;
            }
            const amount = majorToMinor(raw);
            if (amount == null) {
              onError(`Enter ${field.label.toLowerCase()}.`);
              return;
            }
            input[field.key] = amount;
          } else if (raw.trim() !== '') {
            input[field.key] = raw.trim();
          } else if (field.required) {
            onError(`${field.label} is required.`);
            return;
          }
        }
        void onAction(input);
      }} />
    </View>
  );
}

function OutcomeForm({
  outcome,
  busy,
  onError,
  onEvent,
}: {
  outcome: PlaybookOutcome;
  busy: boolean;
  onError: (message: string) => void;
  onEvent: (input: Record<string, unknown>) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, string>>({});

  return (
    <View style={{ gap: space.md }}>
      {outcome.fields.map((field) => field.type === 'money' ? (
        <MoneyField key={field.key} label={field.label} value={values[field.key] ?? (field.prefill_minor != null ? minorToMajorInput(field.prefill_minor) : '')} onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))} />
      ) : (
        <Field key={field.key} label={field.label} value={values[field.key] ?? field.default ?? ''} onChangeText={(value) => setValues((current) => ({ ...current, [field.key]: value }))} />
      ))}
      <Button label={outcome.confirms_money ? 'Bank it' : outcome.label} size="lg" busy={busy} onPress={() => {
        const input: Record<string, unknown> = { outcome: outcome.key };
        for (const field of outcome.fields) {
          const raw = values[field.key] ?? (field.type === 'money' && field.prefill_minor != null ? minorToMajorInput(field.prefill_minor) : field.default ?? '');
          if (field.type === 'money') {
            if (raw.trim() === '' && !field.required) {
              continue;
            }
            const amount = majorToMinor(raw);
            if (amount == null) {
              onError(`Enter ${field.label.toLowerCase()}.`);
              return;
            }
            input[field.key] = amount;
          } else if (raw.trim() !== '') {
            input[field.key] = raw.trim();
          } else if (field.required) {
            onError(`${field.label} is required.`);
            return;
          }
        }
        void onEvent(input);
      }} />
    </View>
  );
}

function ListingsOverview({
  item,
  onAdd,
  onSaved,
  run,
}: {
  item: SellItemView;
  onAdd: () => void;
  onSaved: (item: SellItemView) => Promise<void>;
  run: (work: () => Promise<void>) => Promise<void>;
}) {
  const { color, type: typeScale } = useTheme();

  if (item.comparables.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 36, gap: 12, paddingHorizontal: 8 }}>
        <Icon name="search" size={44} color={color.ink3} />
        <Text style={[typeScale.title, { fontSize: 22, lineHeight: 26, textAlign: 'center' }]}>No similar listings yet</Text>
        <Text style={{ color: color.ink2, fontSize: 16, lineHeight: 22, textAlign: 'center' }}>
          Similar listings can help you understand what buyers are asking or paying for comparable items.
        </Text>
        <Button label="Add similar listing" onPress={onAdd} />
      </View>
    );
  }

  return (
    <View>
      {item.comparables.map((comparable) => (
        <View key={comparable.id} style={{ paddingVertical: 14, gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, alignItems: 'baseline' }}>
            <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, color: comparable.state === 'asking' ? color.ink2 : color.ink }}>{listingStatus(comparable.state)}</Text>
            <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 17, color: color.ink }}>{formatAmount(comparable.amount_minor, item.currency)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Text style={{ flex: 1, color: color.ink2 }} numberOfLines={1}>{listingPlace(comparable.platform, comparable.url)}</Text>
            <TextButton label="Open" onPress={() => void Linking.openURL(comparable.url)} />
            <TextButton label="Remove" onPress={() => {
              Alert.alert('Remove this listing?', 'It will leave the similar listings for this item.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Remove',
                  style: 'destructive',
                  onPress: () => void run(async () => {
                    await deleteSellComparable(item.id, comparable.id);
                    const fresh = await getSellItem(item.id);
                    await onSaved(fresh.data);
                  }),
                },
              ]);
            }} />
          </View>
        </View>
      ))}
    </View>
  );
}

function ComparableForm({
  item,
  busy,
  onError,
  onSaved,
  run,
}: {
  item: SellItemView;
  busy: boolean;
  onError: (message: string) => void;
  onSaved: (item: SellItemView) => Promise<void>;
  run: (work: () => Promise<void>) => Promise<void>;
}) {
  const [link, setLink] = useState('');
  const [price, setPrice] = useState('');
  const [saleState, setSaleState] = useState<'sold' | 'asking'>('sold');

  return (
    <View style={{ gap: space.md }}>
      <Field label="Link" value={link} onChangeText={setLink} autoCapitalize="none" placeholder="https://" />
      <MoneyField label="Price" value={price} onChangeText={setPrice} />
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}><ChoiceBlock label="Sold" selected={saleState === 'sold'} onPress={() => setSaleState('sold')} /></View>
        <View style={{ flex: 1 }}><ChoiceBlock label="Asking" selected={saleState === 'asking'} onPress={() => setSaleState('asking')} /></View>
      </View>
      <Button label="Add" size="lg" busy={busy} onPress={() => void run(async () => {
        const amount = majorToMinor(price);
        if (amount == null) {
          onError('Enter the price you saw.');
          return;
        }
        const next = await addSellComparable(item.id, { url: link.trim(), amount_minor: amount, state: saleState });
        await onSaved(next.data);
      })} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
