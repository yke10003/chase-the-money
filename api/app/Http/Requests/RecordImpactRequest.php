<?php

namespace App\Http\Requests;

use App\Enums\OpportunityType;
use App\Enums\RecurrenceInterval;
use App\Enums\SettlementMode;
use App\Models\Opportunity;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RecordImpactRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('opportunity'));
    }

    protected function prepareForValidation(): void
    {
        if ($this->filled('currency')) {
            $this->merge([
                'currency' => strtoupper((string) $this->input('currency')),
            ]);
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
            'occurred_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:2000'],
            'recurring_amount_minor' => ['nullable', 'integer', 'min:1', 'required_with:recurrence_interval'],
            'recurrence_interval' => ['nullable', Rule::enum(RecurrenceInterval::class), 'required_with:recurring_amount_minor'],
            'settlement' => ['required', Rule::enum(SettlementMode::class)],
            'remaining_expected_minor' => ['nullable', 'integer', 'min:0'],
            'complete' => ['sometimes', 'boolean'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            /** @var Opportunity $opportunity */
            $opportunity = $this->route('opportunity');
            $settlement = SettlementMode::tryFrom((string) $this->input('settlement'));
            $complete = $this->boolean('complete');

            if (strtoupper((string) $this->input('currency')) !== $opportunity->currency) {
                $validator->errors()->add('currency', 'Currency must match the opportunity.');
            }

            if ($opportunity->type !== OpportunityType::Save && $this->filled('recurring_amount_minor')) {
                $validator->errors()->add('recurring_amount_minor', 'Only a Save opportunity can record a recurring amount.');
            }

            if ($settlement === SettlementMode::Partial) {
                if (! $this->exists('remaining_expected_minor') || $this->input('remaining_expected_minor') === null) {
                    $validator->errors()->add('remaining_expected_minor', 'A partial settlement needs an explicit remaining expected amount.');
                }

                if ($complete) {
                    $validator->errors()->add('complete', 'A partial settlement cannot complete the opportunity.');
                }
            }

            if ($settlement === SettlementMode::Full && $this->filled('remaining_expected_minor') && (int) $this->input('remaining_expected_minor') !== 0) {
                $validator->errors()->add('remaining_expected_minor', 'A full settlement cannot leave a remaining expected amount.');
            }

            if ($settlement === SettlementMode::None && $complete) {
                $validator->errors()->add('complete', 'Recording impact without settlement cannot complete the opportunity.');
            }

            if ($settlement === SettlementMode::None && $this->filled('remaining_expected_minor')) {
                $validator->errors()->add('remaining_expected_minor', 'Remaining expected is only set for a partial settlement.');
            }
        });
    }
}
