<?php

namespace App\Http\Requests;

use App\Domain\OpportunityStageCatalog;
use App\Enums\OpportunityStatus;
use App\Enums\OpportunityType;
use App\Enums\RoughEffort;
use App\Models\Opportunity;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOpportunityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('create', Opportunity::class);
    }

    protected function prepareForValidation(): void
    {
        $merge = [];

        if ($this->filled('currency')) {
            $merge['currency'] = strtoupper((string) $this->input('currency'));
        }

        if (! $this->exists('status')) {
            $merge['status'] = OpportunityStatus::Explore->value;
        }

        $this->merge($merge);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'type' => ['required', Rule::enum(OpportunityType::class)],
            'title' => ['required', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'status' => ['required', Rule::enum(OpportunityStatus::class)],
            'stage' => ['nullable', 'string', 'max:100'],
            'potential_min_minor' => ['nullable', 'integer', 'min:0'],
            'potential_max_minor' => ['nullable', 'integer', 'min:0'],
            'expected_amount_minor' => ['nullable', 'integer', 'min:0'],
            'currency' => ['required', 'string', 'regex:/^[A-Z]{3}$/'],
            'expected_on' => ['nullable', 'date_format:Y-m-d'],
            'effort' => ['nullable', Rule::enum(RoughEffort::class)],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator): void {
            $type = OpportunityType::tryFrom((string) $this->input('type'));
            $stage = $this->input('stage');

            if ($type !== null && $stage !== null && ! OpportunityStageCatalog::allows($type, $stage)) {
                $validator->errors()->add('stage', 'That stage is not valid for this opportunity type.');
            }

            $min = $this->input('potential_min_minor');
            $max = $this->input('potential_max_minor');

            if ($min !== null && $max !== null && (int) $min > (int) $max) {
                $validator->errors()->add('potential_min_minor', 'Potential minimum cannot exceed potential maximum.');
            }
        });
    }
}
