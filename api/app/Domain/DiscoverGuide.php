<?php

namespace App\Domain;

use App\Models\User;

final class DiscoverGuide
{
    public function __construct(private FirstPlan $plan) {}

    /**
     * @return array<string, mixed>
     */
    public function forUser(User $user): array
    {
        $catalog = PersonalizationCatalog::all();

        return [
            'money_hunt_categories' => $catalog['money_hunt_categories'],
            'skill_missions' => $this->skillMissions($user),
            'recovery_prompts' => [
                ['kind' => 'friend', 'label' => 'Money a friend or relative owes you'],
                ['kind' => 'invoice', 'label' => 'An outstanding client invoice'],
                ['kind' => 'refund', 'label' => 'A refund'],
                ['kind' => 'reimbursement', 'label' => 'A reimbursement'],
                ['kind' => 'tax', 'label' => 'A tax filing that may return money'],
            ],
            'starter_missions' => $this->plan->forUser($user),
        ];
    }

    /**
     * Previous colleagues are warm contacts, so excluding cold calling only removes offers to strangers.
     *
     * @return list<array{title: string, detail: string, playbook: string, current_state: string, area: string|null}>
     */
    private function skillMissions(User $user): array
    {
        $categories = $user->profile?->work_categories ?? [];
        $willing = $user->profile?->willing ?? [];
        $excluded = $user->profile?->excluded ?? [];
        $coldOutreachOk = ! in_array('cold_calling', $excluded, true);
        $missions = [];

        if (in_array('software', $categories, true)) {
            $missions[] = $this->mission('Reach out to previous colleagues for freelance work', 'People who already know your work are the fastest yes.', 'software');

            if ($coldOutreachOk) {
                $missions[] = $this->mission('Offer a fixed-price technical audit', 'A small, bounded offer that is easy to say yes to.', 'software');
            }

            if (in_array('build_product', $willing, true)) {
                $missions[] = $this->mission('Explore building a small paid software tool', 'Pick one problem you have solved before and sketch what you would charge for.', 'software');
            }
        }

        if (in_array('design', $categories, true)) {
            $missions[] = $this->mission('Offer one design review to someone you have worked with', 'A bounded offer to someone who already trusts your eye.', 'design');
        }

        if (in_array('sales', $categories, true)) {
            $missions[] = $this->mission('Offer to sharpen one landing page or pitch', 'A concrete, one-off improvement for someone in your network.', 'sales');
        }

        if (in_array('operations', $categories, true)) {
            $missions[] = $this->mission('Offer to untangle one messy process', 'Small businesses pay for someone who makes the chaos stop.', 'operations');
        }

        if (in_array('finance', $categories, true)) {
            $missions[] = $this->mission('Offer a one-off bookkeeping clean-up', 'A fixed scope for a freelancer or small business you know.', 'finance');
        }

        if (in_array('teach', $willing, true) || in_array('teaching', $categories, true)) {
            $missions[] = $this->mission('Offer one tutoring or teaching session', 'Start with a person or topic you already know.', 'teaching');
        }

        if ($missions === []) {
            $missions[] = $this->mission('Turn one skill into a small paid offer', 'Describe the work in one sentence and who would want it.', null);
        }

        return $missions;
    }

    /**
     * @return array{title: string, detail: string, playbook: string, current_state: string, area: string|null}
     */
    private function mission(string $title, string $detail, ?string $area): array
    {
        return [
            'title' => $title,
            'detail' => $detail,
            'playbook' => 'freelance',
            'current_state' => 'lead',
            'area' => $area,
        ];
    }
}
