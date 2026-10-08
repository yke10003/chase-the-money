<?php

namespace App\Http\Requests;

use App\Enums\OpportunityStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReopenOpportunityRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('opportunity'));
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'status' => ['sometimes', Rule::in([
                OpportunityStatus::Explore->value,
                OpportunityStatus::Active->value,
                OpportunityStatus::Waiting->value,
            ])],
        ];
    }
}
