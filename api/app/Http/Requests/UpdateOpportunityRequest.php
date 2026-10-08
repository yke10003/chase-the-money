<?php

namespace App\Http\Requests;

use App\Domain\OpportunityStageCatalog;
use App\Enums\OpportunityType;
use App\Enums\RoughEffort;
use App\Models\Opportunity;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateOpportunityRequest extends FormRequest
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
            'type' => ['sometimes', Rule::enum(OpportunityType::class)],
            'title' => ['sometimes', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'stage' => ['nullable', 'string', 'max:100'],
            'potential_min_minor' => ['nullable', 'integer', 'min:0'],
            'potential_max_minor' => ['nullable', 'integer', 'min:0'],
            'expected_amount_minor' => ['nullable', 'integer', 'min:0'],
            'currency' => ['sometimes', 'string', 'regex:/^[A-Z]{3}$/'],
            'expected_on' => ['nullable', 'date_format:Y-m-d'],
            'effort' => ['nullable', Rule::enum(RoughEffort::class)],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            /** @var Opportunity $opportunity */
            $opportunity = $this->route('opportunity');
            $type = $this->filled('type')
                ? OpportunityType::tryFrom((string) $this->input('type'))
                : $opportunity->type;
            $stage = $this->exists('stage') ? $this->input('stage') : $opportunity->stage;

            if ($type !== null && $stage !== null && ! OpportunityStageCatalog::allows($type, $stage)) {
                $validator->errors()->add('stage', 'That stage is not valid for this opportunity type.');
            }

            $min = $this->exists('potential_min_minor')
                ? $this->input('potential_min_minor')
                : $opportunity->potential_min_minor;
            $max = $this->exists('potential_max_minor')
                ? $this->input('potential_max_minor')
                : $opportunity->potential_max_minor;

            if ($min !== null && $max !== null && (int) $min > (int) $max) {
                $validator->errors()->add('potential_min_minor', 'Potential minimum cannot exceed potential maximum.');
            }
        });
    }
}
