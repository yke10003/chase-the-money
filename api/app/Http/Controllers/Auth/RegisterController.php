<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class RegisterController extends Controller
{
    public function store(RegisterRequest $request): JsonResponse
    {
        $user = User::query()->create($request->safe()->only(['name', 'email', 'password']));

        if ($request->header('X-Nolume-Client') === 'native') {
            $token = $user->createToken('iphone')->plainTextToken;

            Log::info('Registered native user', ['user_id' => $user->id]);

            return (new UserResource($user))
                ->additional(['token' => $token])
                ->response()
                ->setStatusCode(201);
        }

        Auth::login($user);
        $request->session()->regenerate();

        Log::info('Registered user', ['user_id' => $user->id]);

        return (new UserResource($user))
            ->response()
            ->setStatusCode(201);
    }
}
