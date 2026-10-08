<?php

use App\Http\Controllers\AccountController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\LogoutController;
use App\Http\Controllers\Auth\RegisterController;
use App\Http\Controllers\GoalController;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\MeController;
use App\Http\Controllers\OpportunityActionController;
use App\Http\Controllers\OpportunityController;
use App\Http\Controllers\OpportunityImpactController;
use App\Http\Controllers\PlaybookController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ProgressController;
use App\Http\Controllers\SellItemController;
use Illuminate\Support\Facades\Route;

Route::get('/status', function () {
    return response()->json([
        'name' => config('app.name'),
        'status' => 'ok',
    ]);
});

Route::prefix('v1')->group(function () {
    // Sanctum starts the session for requests from the Expo origin.
    // Do not add a second StartSession here. It replaces the logged-in session.
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('/register', [RegisterController::class, 'store']);
        Route::post('/login', [LoginController::class, 'store']);
    });

    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/logout', [LogoutController::class, 'store']);
        Route::delete('/account', [AccountController::class, 'destroy']);
        Route::get('/me', [MeController::class, 'show']);
        Route::get('/home', [HomeController::class, 'show']);
        Route::get('/progress', [ProgressController::class, 'show']);
        Route::get('/profile/catalog', [ProfileController::class, 'catalog']);
        Route::get('/profile', [ProfileController::class, 'show']);
        Route::put('/profile', [ProfileController::class, 'update']);
        Route::get('/sell/catalog', [SellItemController::class, 'catalog']);
        Route::get('/sell/items', [SellItemController::class, 'index']);
        Route::post('/sell/items', [SellItemController::class, 'store']);
        Route::post('/sell/items/listed', [SellItemController::class, 'storeListed']);
        Route::get('/sell/items/{item}', [SellItemController::class, 'show']);
        Route::patch('/sell/items/{item}', [SellItemController::class, 'update']);
        Route::post('/sell/items/{item}/finish', [SellItemController::class, 'finish']);
        Route::post('/sell/items/{item}/photos', [SellItemController::class, 'storePhoto']);
        Route::post('/sell/items/{item}/photos/reorder', [SellItemController::class, 'reorderPhotos']);
        Route::delete('/sell/items/{item}/photos/{photo}', [SellItemController::class, 'destroyPhoto']);
        Route::post('/sell/items/{item}/photos/{photo}/cover', [SellItemController::class, 'cover']);
        Route::post('/sell/items/{item}/comparables', [SellItemController::class, 'storeComparable']);
        Route::delete('/sell/items/{item}/comparables/{comparable}', [SellItemController::class, 'destroyComparable']);

        Route::get('/plan', [PlaybookController::class, 'plan']);
        Route::get('/discover', [PlaybookController::class, 'discover']);
        Route::post('/playbooks/{playbook}', [PlaybookController::class, 'store']);
        Route::post('/opportunities/{opportunity}/events', [PlaybookController::class, 'report']);
        Route::patch('/opportunities/{opportunity}/playbook', [PlaybookController::class, 'updateDetails']);
        Route::post('/opportunities/{opportunity}/pause', [PlaybookController::class, 'pause']);
        Route::post('/opportunities/{opportunity}/resume', [PlaybookController::class, 'resume']);

        Route::get('/goals', [GoalController::class, 'index']);
        Route::get('/goals/current', [GoalController::class, 'current']);
        Route::post('/goals', [GoalController::class, 'store']);
        Route::get('/goals/{goal}', [GoalController::class, 'show']);
        Route::patch('/goals/{goal}', [GoalController::class, 'update']);
        Route::post('/goals/{goal}/complete', [GoalController::class, 'complete']);
        Route::post('/goals/{goal}/abandon', [GoalController::class, 'abandon']);

        Route::get('/opportunities', [OpportunityController::class, 'index']);
        Route::post('/opportunities', [OpportunityController::class, 'store']);
        Route::get('/opportunities/{opportunity}', [OpportunityController::class, 'show']);
        Route::patch('/opportunities/{opportunity}', [OpportunityController::class, 'update']);
        Route::delete('/opportunities/{opportunity}', [OpportunityController::class, 'destroy']);
        Route::post('/opportunities/{opportunity}/complete', [OpportunityController::class, 'complete']);
        Route::post('/opportunities/{opportunity}/abandon', [OpportunityController::class, 'abandon']);
        Route::post('/opportunities/{opportunity}/reopen', [OpportunityController::class, 'reopen']);
        Route::post('/opportunities/{opportunity}/impacts', [OpportunityImpactController::class, 'store']);

        Route::scopeBindings()->group(function () {
            Route::post('/opportunities/{opportunity}/actions', [OpportunityActionController::class, 'store']);
            Route::patch('/opportunities/{opportunity}/actions/{action}', [OpportunityActionController::class, 'update']);
            Route::delete('/opportunities/{opportunity}/actions/{action}', [OpportunityActionController::class, 'destroy']);
            Route::post('/opportunities/{opportunity}/actions/{action}/complete', [OpportunityActionController::class, 'complete']);
        });
    });
});
