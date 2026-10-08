<?php

namespace App\Domain;

use App\Models\User;

/**
 * Deterministic starter missions. Not a recommendation model.
 */
final class FirstPlan
{
    /**
     * @return list<array{key: string, title: string, detail: string, destination: string}>
     */
    public function forUser(User $user): array
    {
        $profile = $user->profile;
        $willing = $profile?->willing ?? [];
        $situation = $profile?->situation ?? [];
        $skills = $user->skills()->pluck('name')->all();
        $categories = $profile?->work_categories ?? [];

        if (in_array('none', $situation, true) && count($situation) === 1) {
            $situation = [];
        }

        $missions = [];

        if ($this->has($situation, 'owns_sellable') || $this->has($willing, 'sell')) {
            $missions[] = $this->mission(
                'value_item',
                'Value one item you could sell',
                'Pick one thing you no longer use and find out what it is worth. About 15 minutes.',
                'money_hunt',
            );
        }

        if ($this->canFreelance($categories, $skills, $willing, $situation)) {
            $missions[] = $this->mission(
                'colleagues',
                'Message someone who knows your work',
                'One short, specific note. Then decide if you want another.',
                'skills',
            );
        }

        if (in_array('software', $categories, true) && $this->has($willing, 'build_product')) {
            $missions[] = $this->mission(
                'build',
                'Explore one small thing you could charge for',
                'Sketch one small paid tool or service. A direction, not a build.',
                'build',
            );
        }

        if ($this->has($situation, 'money_owed') || $this->has($situation, 'unpaid_invoice') || $this->has($situation, 'refund') || $this->has($willing, 'recover')) {
            $missions[] = $this->mission(
                'recover',
                'Enter the money you are expecting',
                'Who owes you, and roughly how much. Unknown amounts can wait.',
                'recovery',
            );
        }

        if ($this->has($situation, 'subscriptions') || $this->has($willing, 'reduce_expenses')) {
            $missions[] = $this->mission(
                'expense',
                'Review one recurring subscription',
                'Pick one charge and decide: keep it, cut it, or pay less.',
                'expenses',
            );
        }

        foreach ($this->defaults() as $mission) {
            if (count($missions) >= 4) {
                break;
            }

            $keys = array_column($missions, 'key');

            if (! in_array($mission['key'], $keys, true)) {
                $missions[] = $mission;
            }
        }

        return array_slice($missions, 0, 4);
    }

    /**
     * @param  list<string>  $categories
     * @param  list<string>  $skills
     * @param  list<string>  $willing
     * @param  list<string>  $situation
     */
    private function canFreelance(array $categories, array $skills, array $willing, array $situation): bool
    {
        $wantsWork = $this->has($willing, 'freelance') || $this->has($willing, 'consult') || $willing === [];
        $hasLead = $this->has($situation, 'freelance_lead') || $this->has($situation, 'waiting_response');
        $sellableWork = array_intersect($categories, ['software', 'design', 'sales', 'finance', 'teaching']);
        $hasSkill = $skills !== [] || $sellableWork !== [];

        return $wantsWork && ($hasLead || $hasSkill);
    }

    /**
     * @param  list<string>  $values
     */
    private function has(array $values, string $key): bool
    {
        return in_array($key, $values, true);
    }

    /**
     * @return list<array{key: string, title: string, detail: string, destination: string}>
     */
    private function defaults(): array
    {
        return [
            $this->mission('value_item', 'Find something worth selling', 'Look through what you own. About 15 minutes.', 'money_hunt'),
            $this->mission('recover', 'Check whether money is already owed to you', 'Invoices, friends, refunds, a tax return. About 5 minutes.', 'recovery'),
            $this->mission('expense', 'Check one recurring cost', 'One subscription. Keep it, cut it, or pay less.', 'expenses'),
            $this->mission('colleagues', 'Turn a skill into one outreach', 'Pick one person who already knows your work.', 'skills'),
        ];
    }

    /**
     * @return array{key: string, title: string, detail: string, destination: string}
     */
    private function mission(string $key, string $title, string $detail, string $destination): array
    {
        return [
            'key' => $key,
            'title' => $title,
            'detail' => $detail,
            'destination' => $destination,
        ];
    }
}
