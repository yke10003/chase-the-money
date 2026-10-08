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

class UpdateGoalRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('goal'));
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('currency')) {
            $this->merge([
                'currency' => strtoupper((string) $this->input('currency')),
            ]);
        }

        if ($this->filled('rhythm') && ! $this->filled('starts_on') && ! $this->filled('ends_on')) {
            try {
                $this->merge(GoalPeriod::fillMissingDates($this->all(), now()));
            } catch (InvalidArgumentException) {
                // Anchor validation reports this.
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'amount_minor' => ['sometimes', 'integer', 'min:1'],
            'currency' => ['sometimes', 'string', 'regex:/^[A-Z]{3}$/'],
            'starts_on' => ['sometimes', 'date_format:Y-m-d'],
            'ends_on' => ['sometimes', 'date_format:Y-m-d'],
            'status' => ['sometimes', Rule::enum(GoalStatus::class)],
            'rhythm' => ['sometimes', Rule::enum(GoalRhythm::class)],
            'anchor_day' => ['nullable', 'integer', 'min:1', 'max:28'],
            'included_types' => ['sometimes', 'array', 'min:1'],
            'included_types.*' => ['required', 'distinct', Rule::enum(OpportunityType::class)],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            /** @var Goal $goal */
            $goal = $this->route('goal');
            $start = $this->input('starts_on', $goal->starts_on->toDateString());
            $end = $this->input('ends_on', $goal->ends_on?->toDateString() ?? $goal->periodOn()['ends_on']);

            if ($end < $start) {
                $validator->errors()->add('ends_on', 'The end date must be on or after the start date.');
            }
        });
    }
}
