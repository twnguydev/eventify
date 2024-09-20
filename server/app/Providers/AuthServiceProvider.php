<?php

namespace App\Providers;

use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Gate;
use Laravel\Passport\Passport;

class AuthServiceProvider extends ServiceProvider
{
    /**
     * Les politiques de votre application.
     *
     * @var array
     */
    protected $policies = [
        // Déclarez vos politiques ici, par exemple :
        'App\Models\Model' => 'App\Policies\ModelPolicy',
    ];

    /**
     * Enregistre toutes les autorisations et les routes Passport.
     *
     * @return void
     */
    public function boot()
    {
        $this->registerPolicies();
        
        Passport::tokensExpireIn(now()->addDays(15));
        Passport::refreshTokensExpireIn(now()->addDays(30));
    }
}