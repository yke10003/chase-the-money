<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function product_routes_require_authentication(): void
    {
        $this->getJson('/api/v1/me')->assertUnauthorized();
        $this->getJson('/api/v1/goals')->assertUnauthorized();
        $this->getJson('/api/v1/opportunities')->assertUnauthorized();
        $this->getJson('/api/v1/home')->assertUnauthorized();
        $this->getJson('/api/v1/progress')->assertUnauthorized();
    }

    #[Test]
    public function a_user_can_register_and_is_signed_in(): void
    {
        $this->withHeader('Origin', 'http://localhost:8081')
            ->postJson('/api/v1/register', [
                'name' => 'Founder',
                'email' => 'founder@example.test',
                'password' => 'password',
                'password_confirmation' => 'password',
            ])->assertCreated()
            ->assertJsonPath('data.email', 'founder@example.test')
            ->assertJsonMissingPath('data.password');

        $this->assertAuthenticated();
        $this->assertDatabaseHas('users', ['email' => 'founder@example.test']);
    }

    #[Test]
    public function a_user_can_log_in_and_out(): void
    {
        $user = User::factory()->create();

        $this->withHeader('Origin', 'http://localhost:8081')
            ->postJson('/api/v1/login', [
                'email' => $user->email,
                'password' => 'password',
            ])->assertOk()
            ->assertJsonPath('data.id', $user->id)
            ->assertCookie(config('session.cookie'));

        $this->assertAuthenticatedAs($user);

        $this->withHeader('Origin', 'http://localhost:8081')
            ->postJson('/api/v1/logout')
            ->assertNoContent();

        $this->assertGuest('web');
    }

    #[Test]
    public function bad_credentials_are_rejected(): void
    {
        $user = User::factory()->create();

        $this->postJson('/api/v1/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    #[Test]
    public function the_current_user_endpoint_returns_the_signed_in_user(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/v1/me')
            ->assertOk()
            ->assertJsonPath('data.email', $user->email)
            ->assertJsonMissingPath('data.password');
    }
}
