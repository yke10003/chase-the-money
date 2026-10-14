import { CockpitFrame } from '@/components/moves';
import { ScoreHero } from '@/components/score-hero';
import { T } from '@/components/ui';
import { useLayout } from '@/design/layout';
import { formatAmount } from '@/lib/money';
import { navigation } from '@/lib/navigation';
import { useTheme } from '@/state/theme';

export default function BuildScreen() {
  const { color, accent } = useTheme();
  const layout = useLayout();
  const paint = accent.build;

  return (
    <CockpitFrame
      title="Build"
      moves={
        <ScoreHero
          wash="build"
          paint={paint}
          kicker={layout.phone ? '' : 'Products'}
          amount={formatAmount(0, 'EUR')}
          caption="product revenue"
          series={[{ period: '1970-01-01', amount_minor: 0 }]}
          note="No product is tracked yet. Revenue will show here when one exists."
          actions={[
            { label: 'Add a product', icon: 'plus', onPress: () => navigation.startCreation('build') },
            { label: 'Explore an idea', icon: 'lightbulb', onPress: () => navigation.startCreation('build') },
          ]}
        />
      }
      below={<T variant="small" color={color.ink3}>Paid work for someone else is in Freelance.</T>}
    />
  );
}
