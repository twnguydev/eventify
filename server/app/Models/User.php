<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Passport\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Les attributs qui peuvent être attribués en masse.
     *
     * @var array<int, string>
     */
    protected $fillable = ['pseudo', 'name', 'email', 'password', 'avatar', 'bio'];

    /**
     * Les attributs qui doivent être cachés pour la sérialisation.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Les attributs qui doivent être castés.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    /**
     * Générer ou mettre à jour l'utilisateur à partir des informations d'un service tiers (OAuth).
     *
     * @param  array  $data
     * @return \App\Models\User
     */
    public static function createOrUpdateFromOAuth(array $data)
    {
        return self::updateOrCreate(
            ['email' => $data['email']],
            [
                'pseudo' => $data['pseudo'] ?? $data['name'],
                'email' => $data['email'],
                'name' => $data['name'],
                'password' => $data['password'],
                'avatar' => $data['avatar'] ?? '/default_avatar.png',
                'bio' => $data['bio'] ?? '',
                'email_verified_at' => now(),
            ]
        );
    }

    /**
     * Retourne l'URL de l'avatar. Priorité à l'avatar uploadé, puis à celui d'OAuth2.
     *
     * @return string
     */
    public function getAvatarUrlAttribute()
    {
        if ($this->avatar) {
            return asset('storage/avatars/' . $this->avatar);
        }

        if ($this->oauth_avatar) {
            return $this->oauth_avatar;
        }

        return asset('images/default_avatar.png');
    }

    public function events()
    {
        return $this->belongsToMany(Event::class, 'user_event');
    }

    public function rooms()
    {
        return $this->belongsToMany(Room::class, 'user_room')->withPivot('is_creator');
    }
}