<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Laravel\Sanctum\TransientToken;

class LogoutController extends Controller
{
    public function store(Request $request): Response
    {
        $token = $request->user()?->currentAccessToken();

        if ($token && ! $token instanceof TransientToken) {
            $token->delete();

            return response()->noContent();
        }

        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }
}
