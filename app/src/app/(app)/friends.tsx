import { StyleSheet, Text, View } from 'react-native';

import { PageHeader, T } from '@/components/ui';
import { font, space, weight } from '@/design/tokens';
import { useTheme } from '@/state/theme';

const IDEAS = [
  { title: 'Challenges', body: 'A shared week. Same goal shape, your own numbers.' },
  { title: 'Progress, not a leaderboard', body: 'Goal percent and XP. Not who made the most.' },
  { title: 'Shared wins', body: 'A sale, a payment, a goal hit. Amounts stay private unless you share them.' },
];

export default function FriendsScreen() {
  const { color } = useTheme();

  return (
    <View style={{ gap: space.xl, maxWidth: 720 }}>
      <PageHeader title="Friends" subtitle="Not live. No ranks." />
      <View>
        {IDEAS.map((idea, index) => (
          <View key={idea.title} style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.line }]}>
            <Text style={[styles.title, { color: color.ink }]}>{idea.title}</Text>
            <Text style={[styles.body, { color: color.ink2 }]}>{idea.body}</Text>
            <Text style={{ color: color.ink3, fontSize: 13 }}>Later</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: 4, paddingVertical: 14 },
  title: { fontFamily: font.semi, fontWeight: weight.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: font.medium, fontWeight: weight.regular, fontSize: 14, lineHeight: 20 },
});
