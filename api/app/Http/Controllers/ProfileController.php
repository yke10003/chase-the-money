<?php

namespace App\Http\Controllers;

use App\Domain\PersonalizationCatalog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    public function catalog(): JsonResponse
    {
        return response()->json([
            'data' => PersonalizationCatalog::all(),
        ]);
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->payload($request->user()),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $catalog = PersonalizationCatalog::all();
        $data = $request->validate([
            'work_categories' => ['nullable', 'array', 'max:6'],
            'work_categories.*' => ['string', 'distinct', Rule::in(array_column($catalog['work_categories'], 'key'))],
            'experience_level' => ['nullable', 'string', Rule::in(array_column($catalog['experience_levels'], 'key'))],
            'availability' => ['nullable', 'string', Rule::in(array_column($catalog['availability'], 'key'))],
            'starting_capital' => ['nullable', 'string', Rule::in(array_column($catalog['starting_capital'], 'key'))],
            'willing' => ['nullable', 'array'],
            'willing.*' => ['string', Rule::in(array_column($catalog['willing'], 'key'))],
            'excluded' => ['nullable', 'array'],
            'excluded.*' => ['string', Rule::in(array_column($catalog['excluded'], 'key'))],
            'situation' => ['nullable', 'array'],
            'situation.*' => ['string', Rule::in(array_column($catalog['situation'], 'key'))],
            'skills' => ['nullable', 'array', 'max:20'],
            'skills.*.name' => ['required', 'string', 'max:80'],
            'skills.*.proficiency' => ['nullable', 'string', Rule::in(array_column($catalog['experience_levels'], 'key'))],
        ]);

        $user = $request->user();
        $profile = $user->profile()->firstOrNew(['user_id' => $user->id]);

        foreach (['experience_level', 'availability', 'starting_capital'] as $field) {
            if (array_key_exists($field, $data)) {
                $profile->{$field} = $data[$field];
            }
        }

        foreach (['work_categories', 'willing', 'excluded', 'situation'] as $field) {
            if (array_key_exists($field, $data)) {
                $profile->{$field} = $data[$field] ?? [];
            }
        }

        $profile->save();

        if (array_key_exists('skills', $data)) {
            $user->skills()->delete();

            foreach ($data['skills'] ?? [] as $skill) {
                $user->skills()->create([
                    'name' => $skill['name'],
                    'proficiency' => $skill['proficiency'] ?? ($data['experience_level'] ?? null),
                ]);
            }
        }

        Log::info('Profile updated', [
            'user_id' => $user->id,
            'work_categories' => $profile->work_categories,
            'skills' => array_key_exists('skills', $data) ? count($data['skills'] ?? []) : null,
        ]);

        return response()->json([
            'data' => $this->payload($user->fresh()),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(User $user): array
    {
        $profile = $user->profile;

        return [
            'work_categories' => $profile?->work_categories ?? [],
            'experience_level' => $profile?->experience_level,
            'availability' => $profile?->availability,
            'starting_capital' => $profile?->starting_capital,
            'willing' => $profile?->willing ?? [],
            'excluded' => $profile?->excluded ?? [],
            'situation' => $profile?->situation ?? [],
            'skills' => $user->skills()->orderBy('name')->get(['name', 'proficiency']),
        ];
    }
}
