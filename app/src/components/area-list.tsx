import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type PressableStateCallbackType } from 'react-native';

import type { Opportunity } from '@/api/types';
import { font, space, weight } from '@/design/tokens';
import { dateParts } from '@/lib/dates';
import { formatAmount, formatAmountRange } from '@/lib/money';
import { attentionFor, missionGroup } from '@/lib/mission';
import { useTheme } from '@/state/theme';

type MoneyLine = { text: string; label: string; certainty: 'expected' | 'possible' };

export function AreaList({ missions }: { missions: Opportunity[]; empty?: string }) {
  const router = useRouter();
  const { color } = useTheme();

  return (
    <View>
      {missions.map((mission, index) => (
        <View key={mission.id} style={index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line } : null}>
          <RecordRow mission={mission} onPress={() => router.push(`/opportunities/${mission.id}`)} />
        </View>
      ))}
    </View>
  );
}

function RecordRow({ mission, onPress }: { mission: Opportunity; onPress: () => void }) {
  if (mission.type === 'sell') {
    return <SellRow mission={mission} onPress={onPress} />;
  }

  if (mission.type === 'recover' || mission.type === 'save') {
    return <RecoverRow mission={mission} onPress={onPress} />;
  }

  return <LeadRow mission={mission} onPress={onPress} />;
}

function SellRow({ mission, onPress }: { mission: Opportunity; onPress: () => void }) {
  const { color } = useTheme();
  const money = moneyLine(mission);

  return (
    <Hit onPress={onPress} label={mission.title}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={titleStyle(color.ink)}>{mission.title}</Text>
        <Text numberOfLines={1} style={metaStyle(color.ink2)}>
          {mission.stage_label}
          {mission.next_action ? ` · ${mission.next_action.title}` : ''}
        </Text>
      </View>
      {money ? <Amount money={money} quiet={money.certainty === 'possible'} /> : null}
    </Hit>
  );
}

function LeadRow({ mission, onPress }: { mission: Opportunity; onPress: () => void }) {
  const { color } = useTheme();
  const money = moneyLine(mission);
  const due = mission.next_action?.due_on;

  return (
    <Hit onPress={onPress} label={mission.title}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={titleStyle(color.ink)}>{mission.title}</Text>
        <Text numberOfLines={1} style={metaStyle(color.ink2)}>
          {mission.stage_label}
          {mission.next_action ? ` · ${mission.next_action.title}` : ''}
          {due ? ` · ${dateParts(due).day} ${dateParts(due).month}` : ''}
        </Text>
      </View>
      {money ? <Amount money={money} quiet={money.certainty === 'possible'} /> : null}
    </Hit>
  );
}

function RecoverRow({ mission, onPress }: { mission: Opportunity; onPress: () => void }) {
  const { color } = useTheme();
  const money = moneyLine(mission);
  const due = mission.next_action?.due_on;
  const parts = due ? dateParts(due) : null;
  const attention = attentionFor(due);
  const late = attention === 'overdue' || attention === 'today';

  return (
    <Hit onPress={onPress} label={mission.title}>
      <View style={{ width: 48 }}>
        <Text style={[titleStyle(late ? color.overdue : color.ink), { fontSize: 16 }]}>{parts?.day ?? '—'}</Text>
        <Text style={metaStyle(late ? color.overdue : color.ink3)}>{parts?.month ?? ''}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={titleStyle(color.ink)}>{mission.title}</Text>
        <Text numberOfLines={1} style={metaStyle(color.ink2)}>
          {mission.next_action?.title ?? mission.stage_label}
          {late ? ` · ${attention === 'overdue' ? 'Overdue' : 'Due today'}` : ''}
        </Text>
      </View>
      {money ? <Amount money={money} quiet={money.certainty === 'possible'} emphasis={late} /> : null}
    </Hit>
  );
}

function Amount({ money, quiet, emphasis = false }: { money: MoneyLine; quiet: boolean; emphasis?: boolean }) {
  const { color } = useTheme();

  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={{ fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 15, color: emphasis ? color.overdue : quiet ? color.ink3 : color.ink }}>{money.text}</Text>
      <Text style={metaStyle(color.ink3)}>{money.label}</Text>
    </View>
  );
}

function Hit({ onPress, label, children }: { onPress: () => void; label: string; children: ReactNode }) {
  const { color } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={(state) => {
        const hovered = (state as PressableStateCallbackType & { hovered?: boolean }).hovered;

        return {
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          paddingVertical: 12,
          backgroundColor: hovered ? color.sunken : 'transparent',
          ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
        };
      }}
    >
      {children}
    </Pressable>
  );
}

function titleStyle(color: string) {
  return { fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 16, lineHeight: 22, color };
}

function metaStyle(color: string) {
  return { fontFamily: font.medium, fontWeight: weight.medium, fontSize: 13, lineHeight: 18, color };
}

function moneyLine(mission: Opportunity): MoneyLine | null {
  if (missionGroup(mission) === 'done') {
    return null;
  }

  if (mission.expected_amount_minor != null) {
    return { text: formatAmount(mission.expected_amount_minor, mission.currency), label: 'Expected', certainty: 'expected' };
  }

  const range = formatAmountRange(mission.potential_min_minor, mission.potential_max_minor, mission.currency);

  return range ? { text: range, label: 'Possible', certainty: 'possible' } : null;
}
