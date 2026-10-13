<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class LoginController extends Controller
{
    public function store(LoginRequest $request): UserResource
    {
        if ($request->header('X-Nolume-Client') === 'native') {
            $user = User::query()->where('email', $request->string('email')->toString())->first();

            if (! $user || ! Hash::check($request->string('password')->toString(), $user->password)) {
                throw ValidationException::withMessages([
                    'email' => ['These credentials do not match our records.'],
                ]);
            }

            $token = $user->createToken('iphone')->plainTextToken;

            Log::info('Logged in native user', ['user_id' => $user->id]);

            return (new UserResource($user))->additional(['token' => $token]);
        }

        if (! Auth::attempt($request->safe()->only(['email', 'password']))) {
            throw ValidationException::withMessages([
                'email' => ['These credentials do not match our records.'],
            ]);
        }

        $request->session()->regenerate();

        Log::info('Logged in user', ['user_id' => $request->user()->id]);

        return new UserResource($request->user());
    }
}
