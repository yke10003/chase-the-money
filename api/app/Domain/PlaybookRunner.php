<?php

namespace App\Domain;

use App\Domain\Playbooks\FreelancePlaybook;
use App\Domain\Playbooks\PlaybookKit;
use App\Domain\Playbooks\RecoverPlaybook;
use App\Domain\Playbooks\SavePlaybook;
use App\Domain\Playbooks\SellPlaybook;
use App\Enums\OpportunityStatus;
use App\Models\Opportunity;
use App\Models\OpportunityAction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * State-driven missions. Each playbook creates only the action that fits the current state.
 */
final class PlaybookRunner
{
    public function __construct(
        private FreelancePlaybook $freelance,
        private SellPlaybook $sell,
        private RecoverPlaybook $recover,
        private SavePlaybook $save,
    ) {}

    public function start(User $user, string $playbook, array $input): Opportunity
    {
        $opportunity = match ($playbook) {
            'sell_item' => $this->sell->start($user, $input),
            'freelance' => $this->freelance->start($user, $input),
            'recover_money' => $this->recover->start($user, $input),
            'reduce_expense' => $this->save->start($user, $input),
            default => throw ValidationException::withMessages([
                'playbook' => 'That mission type is not available.',
            ]),
        };

        return $opportunity->load('actions');
    }

    public function complete(Opportunity $opportunity, OpportunityAction $action, array $input): void
    {
        if ($action->opportunity_id !== $opportunity->id) {
            abort(404);
        }

        if ($action->status->value === 'completed') {
            return;
        }

        if (! PlaybookKit::isActionable($action)) {
            throw ValidationException::withMessages([
                'due_on' => 'This step is not due yet.',
            ]);
        }

        DB::transaction(function () use ($opportunity, $action, $input): void {
            if ($opportunity->playbook !== null && $action->system_owned) {
                $this->handler($opportunity->playbook)->onComplete($opportunity, $action, $input);
            }

            $action->complete();
            $opportunity->refresh();

            if ($opportunity->status === OpportunityStatus::Completed) {
                PlaybookKit::discardOpenActions($opportunity);
            }
        });
    }

    public function report(Opportunity $opportunity, string $outcome, array $input): void
    {
        if ($opportunity->playbook === null) {
            throw ValidationException::withMessages([
                'outcome' => 'This mission has no guided outcomes.',
            ]);
        }

        DB::transaction(function () use ($opportunity, $outcome, $input): void {
            $this->handler($opportunity->playbook)->report($opportunity, $outcome, $input);
        });
    }

    public function updateDetails(Opportunity $opportunity, array $input): void
    {
        if ($opportunity->playbook === null) {
            throw ValidationException::withMessages([
                'playbook' => 'Only a guided mission can be edited this way.',
            ]);
        }

        DB::transaction(function () use ($opportunity, $input): void {
            $this->handler($opportunity->playbook)->updateDetails($opportunity, $input);
        });
    }

    public function present(Opportunity $opportunity): ?array
    {
        if ($opportunity->playbook === null) {
            return null;
        }

        return $this->handler($opportunity->playbook)->present($opportunity);
    }

    public function label(Opportunity $opportunity): string
    {
        if ($opportunity->playbook === null) {
            return ucfirst($opportunity->status->value);
        }

        return $this->handler($opportunity->playbook)->label($opportunity);
    }

    public function pause(Opportunity $opportunity): void
    {
        if (! in_array($opportunity->status, OpportunityStatus::open(), true)) {
            throw ValidationException::withMessages([
                'status' => 'Only an open mission can be paused.',
            ]);
        }

        $opportunity->status = OpportunityStatus::Paused;
        $opportunity->save();
    }

    public function resume(Opportunity $opportunity): void
    {
        if ($opportunity->status !== OpportunityStatus::Paused) {
            throw ValidationException::withMessages([
                'status' => 'Only a paused mission can be resumed.',
            ]);
        }

        $action = PlaybookKit::openAction($opportunity);
        $waiting = $action !== null && $action->due_on !== null && $action->due_on->toDateString() > PlaybookKit::today();
        $opportunity->status = $waiting ? OpportunityStatus::Waiting : OpportunityStatus::Active;
        $opportunity->save();
    }

    private function handler(string $playbook): FreelancePlaybook|SellPlaybook|RecoverPlaybook|SavePlaybook
    {
        return match ($playbook) {
            'sell_item' => $this->sell,
            'freelance' => $this->freelance,
            'recover_money' => $this->recover,
            'reduce_expense' => $this->save,
            default => throw ValidationException::withMessages([
                'playbook' => 'That mission type is not available.',
            ]),
        };
    }
}
