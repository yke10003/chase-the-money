import { useRouter } from 'expo-router';

import { CockpitFrame } from '@/components/moves';
import { ScoreHero } from '@/components/score-hero';
import { T } from '@/components/ui';
import { useLayout } from '@/design/layout';
import { formatAmount } from '@/lib/money';
import { useTheme } from '@/state/theme';

export default function BuildScreen() {
  const { color, accent } = useTheme();
  const layout = useLayout();
  const paint = accent.build;
  const router = useRouter();

  return (
    <CockpitFrame
      title="Build"
      moves={
        <ScoreHero
          wash="build"
          paint={paint}
          kicker={layout.phone ? 'Build' : 'Products'}
          amount={formatAmount(0, 'EUR')}
          caption="product revenue"
          series={[{ period: '1970-01-01', amount_minor: 0 }]}
          note="No product is tracked yet. Revenue will show here when one exists."
          actions={[
            { label: 'Add a product', icon: 'plus', onPress: () => router.push('/build/new') },
            { label: 'Explore an idea', icon: 'lightbulb', onPress: () => router.push('/build/new') },
          ]}
        />
      }
      below={<T variant="small" color={color.ink3}>Paid work for someone else is in Freelance.</T>}
    />
  );
}
