<?php

namespace Tests\Feature\Api;

use App\Models\FinancialImpact;
use App\Models\Goal;
use App\Models\Opportunity;
use App\Models\OpportunityAction;
use App\Models\User;
use App\Models\XpEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class AccountDeletionTest extends TestCase
{
    use RefreshDatabase;

    #[Test]
    public function guests_cannot_delete_an_account(): void
    {
        $this->deleteJson('/api/v1/account', [
            'password' => 'password',
        ])->assertUnauthorized();
    }

    #[Test]
    public function a_wrong_password_does_not_delete_the_account(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->deleteJson('/api/v1/account', ['password' => 'not-the-password'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');

        $this->assertDatabaseHas('users', ['id' => $user->id]);
    }

    #[Test]
    public function deleting_an_account_removes_that_users_data_and_signs_them_out(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $user->profile()->create([
            'work_categories' => ['software'],
            'experience_level' => 'experienced',
            'availability' => '4_8',
            'starting_capital' => 'none',
            'willing' => ['freelance'],
            'excluded' => [],
            'situation' => [],
        ]);
        $user->skills()->create([
            'name' => 'Software development',
            'proficiency' => 'experienced',
        ]);
        $user->createToken('device');

        $goal = Goal::factory()->for($user)->create();
        $opportunity = Opportunity::factory()->for($user)->create();
        $action = OpportunityAction::factory()->for($opportunity)->create(['xp_reward' => 10]);
        $action->complete();
        $opportunity->recordRealizedImpact(1500);

        $otherGoal = Goal::factory()->for($other)->create();
        $otherOpportunity = Opportunity::factory()->for($other)->create();

        $this->withHeader('Origin', 'http://localhost:8081')
            ->actingAs($user)
            ->deleteJson('/api/v1/account', ['password' => 'password'])
            ->assertNoContent();

        $this->assertGuest('web');
        $this->assertDatabaseMissing('users', ['id' => $user->id]);
        $this->assertDatabaseMissing('user_profiles', ['user_id' => $user->id]);
        $this->assertDatabaseMissing('user_skills', ['user_id' => $user->id]);
        $this->assertDatabaseMissing('goals', ['id' => $goal->id]);
        $this->assertDatabaseMissing('opportunities', ['id' => $opportunity->id]);
        $this->assertDatabaseMissing('opportunity_actions', ['id' => $action->id]);
        $this->assertSame(0, FinancialImpact::query()->where('user_id', $user->id)->count());
        $this->assertSame(0, XpEvent::query()->where('user_id', $user->id)->count());
        $this->assertDatabaseMissing('personal_access_tokens', [
            'tokenable_id' => $user->id,
            'tokenable_type' => User::class,
        ]);

        $this->assertDatabaseHas('users', ['id' => $other->id]);
        $this->assertDatabaseHas('goals', ['id' => $otherGoal->id]);
        $this->assertDatabaseHas('opportunities', ['id' => $otherOpportunity->id]);
    }

    #[Test]
    public function the_deleted_email_can_register_again_and_cannot_log_in_as_the_old_account(): void
    {
        $user = User::factory()->create([
            'email' => 'gone@example.test',
        ]);

        $this->withHeader('Origin', 'http://localhost:8081')
            ->actingAs($user)
            ->deleteJson('/api/v1/account', ['password' => 'password'])
            ->assertNoContent();

        Auth::shouldUse('web');

        $this->postJson('/api/v1/login', [
            'email' => 'gone@example.test',
            'password' => 'password',
        ])->assertUnprocessable();

        $this->withHeader('Origin', 'http://localhost:8081')
            ->postJson('/api/v1/register', [
                'name' => 'Again',
                'email' => 'gone@example.test',
                'password' => 'password',
                'password_confirmation' => 'password',
            ])->assertCreated()
            ->assertJsonPath('data.email', 'gone@example.test');
    }

    #[Test]
    public function saving_skills_does_not_erase_fields_that_were_not_sent(): void
    {
        $user = User::factory()->create();
        $user->profile()->create([
            'work_categories' => ['software'],
            'experience_level' => 'experienced',
            'availability' => '4_8',
            'starting_capital' => 'none',
            'willing' => ['freelance', 'sell'],
            'excluded' => ['delivery'],
            'situation' => ['owns_sellable'],
        ]);

        $this->actingAs($user)->putJson('/api/v1/profile', [
            'skills' => [
                ['name' => 'Data', 'proficiency' => 'comfortable'],
            ],
        ])->assertOk()
            ->assertJsonPath('data.work_categories', ['software'])
            ->assertJsonPath('data.situation.0', 'owns_sellable')
            ->assertJsonPath('data.skills.0.name', 'Data');
    }
}
