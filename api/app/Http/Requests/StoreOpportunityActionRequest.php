<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreOpportunityActionRequest extends FormRequest
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
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'estimated_minutes' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'xp_reward' => ['prohibited'],
            'effort' => ['nullable', Rule::in(['quick', 'medium', 'deep'])],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
