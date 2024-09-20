<?php

namespace App\Http\Controllers;

use Laravel\Socialite\Facades\Socialite;
use Illuminate\Support\Facades\Session;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;


class OAuthController extends Controller
{
    /**
     * Redirige l'utilisateur vers le fournisseur OAuth spécifié.
     *
     * @param  string  $provider
     * @return \Illuminate\Http\Response
     */
    public function redirectToProvider($provider)
    {
        if (!Session::has('state')) {
            Session::put('state', Str::random(40));
        }

        return Socialite::driver($provider)->redirect();
    }

    /**
     * Gère le callback du fournisseur OAuth spécifié.
     *
     * @param  string  $provider
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function handleProviderCallback($provider, Request $request)
    {
        try {
            $socialUser = Socialite::driver($provider)->stateless()->user();
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to authenticate with ' . ucfirst($provider), 'details' => $e->getMessage()], 400);
        }

        $user = User::firstOrCreate(
            ['email' => $socialUser->getEmail()],
            [
                'name' => $socialUser->getName(),
                'pseudo' => strtolower(str_replace(' ', '_', $socialUser->getName())) . '_' . Str::random(5),
                'email' => $socialUser->getEmail(),
                'password' => Hash::make(rand(100000, 999999)),
                'bio' => '',
                'avatar' => 'default_avatar.png',
                'oauth_avatar' => $socialUser->getAvatar(),
                'email_verified_at' => now()
            ]
        );

        if (!$user->wasRecentlyCreated) {
            $user->oauth_avatar = $socialUser->getAvatar();
            $user->save();
        }

        Auth::login($user);

        $avatarPath = $user->avatar ? 'avatars/' . $user->avatar : null;

        if ($avatarPath) {
            $user->avatar = $user->avatar;
        } elseif ($user->oauth_avatar) {
            try {
                $response = Http::get($user->oauth_avatar);

                if ($response->failed()) {
                    throw new \Exception('Failed to fetch avatar from ' . $user->oauth_avatar);
                }

                $avatarData = $response->body();
                $avatarPath = 'avatars/' . basename($user->oauth_avatar);
                Storage::disk('public')->put($avatarPath, $avatarData);

                $user->avatar = basename($avatarPath);
                $user->save();
            } catch (\Exception $e) {
                Log::error('Error fetching or saving avatar: ' . $e->getMessage());
            }
        }

        $tokenResult = $user->createToken('Eventify');
        $token = $tokenResult->plainTextToken ?? $tokenResult->accessToken;

        return response()->json([
            'token' => $token,
            'user' => $user
        ]);
    }
}
