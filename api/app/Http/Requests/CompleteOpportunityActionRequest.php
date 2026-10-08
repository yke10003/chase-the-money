<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CompleteOpportunityActionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('action'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'potential_min_minor' => ['nullable', 'integer', 'min:0'],
            'potential_max_minor' => ['nullable', 'integer', 'min:0'],
            'asking_price_minor' => ['nullable', 'integer', 'min:1'],
            'listed_on' => ['nullable', 'string', 'max:80'],
            'listing_url' => ['nullable', 'string', 'max:500'],
            'amount_minor' => ['nullable', 'integer', 'min:1'],
            'expected_on' => ['nullable', 'date_format:Y-m-d'],
            'follow_up_on' => ['nullable', 'date_format:Y-m-d'],
            'payment_due_on' => ['nullable', 'date_format:Y-m-d'],
            'proposed_amount_minor' => ['nullable', 'integer', 'min:1'],
            'invoice_amount_minor' => ['nullable', 'integer', 'min:1'],
            'worth_min_minor' => ['nullable', 'integer', 'min:1'],
            'worth_max_minor' => ['nullable', 'integer', 'min:1'],
            'current_monthly_minor' => ['nullable', 'integer', 'min:1'],
            'new_monthly_minor' => ['nullable', 'integer', 'min:0'],
            'xp_reward' => ['prohibited'],
        ];
    }
}
