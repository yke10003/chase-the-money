<?php

namespace App\Http\Requests;

use App\Domain\GoalPeriod;
use App\Enums\GoalRhythm;
use App\Enums\GoalStatus;
use App\Enums\OpportunityType;
use App\Models\Goal;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use InvalidArgumentException;

class StoreGoalRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Goal::class);
    }

    protected function prepareForValidation(): void
    {
        $merge = [];

        if ($this->filled('currency')) {
            $merge['currency'] = strtoupper((string) $this->input('currency'));
        }

        if (! $this->exists('included_types')) {
            $merge['included_types'] = array_map(
                fn (OpportunityType $type) => $type->value,
                OpportunityType::cases(),
            );
        }

        if (! $this->exists('status')) {
            $merge['status'] = GoalStatus::Active->value;
        }

        if ($this->filled('rhythm') && ! $this->filled('anchor_day') && $this->input('rhythm') !== GoalRhythm::ByDate->value) {
            $merge['anchor_day'] = 1;
        }

        $this->merge($merge);

        try {
            $this->merge(GoalPeriod::fillMissingDates($this->all(), now()));
        } catch (InvalidArgumentException) {
            // The rules below reject an anchor day the period cannot use.
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'amount_minor' => ['required', 'integer', 'min:1'],
            'currency' => ['required', 'string', 'regex:/^[A-Z]{3}$/'],
            'starts_on' => ['required', 'date_format:Y-m-d'],
            'ends_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:starts_on'],
            'status' => ['required', Rule::enum(GoalStatus::class)],
            'rhythm' => ['sometimes', Rule::enum(GoalRhythm::class)],
            'anchor_day' => ['nullable', 'integer', function (string $attribute, mixed $value, \Closure $fail): void {
                if ($value === null) {
                    return;
                }

                $rhythm = $this->input('rhythm');

                if ($rhythm === GoalRhythm::Weekly->value && ($value < 1 || $value > 7)) {
                    $fail('Pick a day from Monday through Sunday.');
                }

                if ($rhythm === GoalRhythm::Monthly->value && ($value < 1 || $value > 28)) {
                    $fail('Pick a day from 1 to 28.');
                }
            }],
            'included_types' => ['required', 'array', 'min:1'],
            'included_types.*' => ['required', 'distinct', Rule::enum(OpportunityType::class)],
        ];
    }
}
