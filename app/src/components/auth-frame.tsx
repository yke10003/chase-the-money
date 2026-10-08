import { useMemo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CertaintySwatch, T } from '@/components/ui';
import { useLayout } from '@/design/layout';
import type { Palette, Scheme } from '@/design/palette';
import { font, space, weight } from '@/design/tokens';
import { useTheme } from '@/state/theme';

const LAYERS = [
  { certainty: 'banked' as const, title: 'Banked', body: 'Money that actually landed. Only this fills your goal.' },
  { certainty: 'expected' as const, title: 'Expected', body: 'Agreed or promised, still on its way.' },
  { certainty: 'possible' as const, title: 'Possible', body: 'Quotes, valuations and leads you are chasing.' },
];

export function AuthFrame({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  const { color, scheme, type: typeScale } = useTheme();
  const styles = useMemo(() => createStyles(color, scheme), [color, scheme]);
  const layout = useLayout();

  return (
    <ScrollView style={{ flex: 1, backgroundColor: color.paper }} contentContainerStyle={{ flexGrow: 1, flexDirection: layout.desktop ? 'row' : 'column' }}>
      {layout.desktop ? (
        <View style={styles.side}>
          <View style={styles.wordmark}>
            <View style={styles.mark}>
              <View style={styles.markFill} />
            </View>
            <Text style={styles.wordmarkText}>sidehustle</Text>
          </View>
          <View style={{ gap: space.xl, maxWidth: 460 }}>
            <Text style={styles.manifesto}>Pick a move. Make progress.</Text>
            <T variant="body" color="#C8C3B8" style={{ fontSize: 17, lineHeight: 26 }}>
              Spare time, a skill, something you own, money you’re owed. One concrete move, then the next.
            </T>
            <View style={{ gap: space.md }}>
              {LAYERS.map((layer) => (
                <View key={layer.title} style={styles.layer}>
                  <View style={styles.swatchWrap}>
                    <CertaintySwatch certainty={layer.certainty} size={14} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[typeScale.bodyStrong, { color: '#F4F1EA' }]}>{layer.title}</Text>
                    <Text style={[typeScale.small, { color: '#C8C3B8' }]}>{layer.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
          <T variant="small" color="#8E887F">No bank connection. You record what happened.</T>
        </View>
      ) : null}
      <View style={[styles.main, { padding: layout.phone ? space.lg : space.xxl }]}>
        <View style={{ width: '100%', maxWidth: 400, gap: space.lg }}>
          {layout.desktop ? null : (
            <View style={[styles.wordmark, { marginBottom: space.md }]}>
              <View style={styles.mark}>
                <View style={styles.markFill} />
              </View>
              <Text style={[styles.wordmarkText, { color: color.ink }]}>sidehustle</Text>
            </View>
          )}
          <View style={{ gap: space.xs }}>
            <T variant="title">{title}</T>
            <T variant="body" color={color.ink2}>{lead}</T>
          </View>
          {children}
        </View>
      </View>
    </ScrollView>
  );
}

function createStyles(color: Palette, scheme: Scheme) {
  const poster = scheme === 'dark' ? '#101218' : '#1C1B19';

  return StyleSheet.create({
  side: { flex: 1.15, backgroundColor: poster, padding: space.xxl, justifyContent: 'space-between', gap: space.xxl },
  main: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wordmark: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 22, height: 22, borderRadius: 7, backgroundColor: color.ink, overflow: 'hidden', justifyContent: 'flex-end' },
  markFill: { height: '46%', backgroundColor: color.money },
  wordmarkText: { fontFamily: font.displayHeavy, fontWeight: weight.bold, fontSize: 18, letterSpacing: -0.4, color: '#F4F1EA' },
  manifesto: { fontFamily: font.displayHeavy, fontWeight: weight.bold, fontSize: 48, lineHeight: 52, letterSpacing: -1.1, color: '#F4F1EA' },
  layer: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  swatchWrap: { width: 26, height: 26, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  });
}
