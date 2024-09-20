<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Group extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'event_slug',
        'visibility',
    ];
    public $timestamps = false;

    public function users()
    {
        return $this->belongsToMany(User::class, 'user_groups', 'id_group', 'id_user');
    }

    public function event()
    {
        return $this->belongsTo(Event::class, 'event_slug', 'url');
    }
}