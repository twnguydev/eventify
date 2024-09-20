<?php

namespace App\Models;

use GuzzleHttp\Psr7\Message;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    use HasFactory;

    protected $table = 'rooms';
    protected $fillable = ['id_group'];

    public function users()
    {
        return $this->belongsToMany(User::class, 'room_user')->withPivot('is_creator');
    }

    public function event()
    {
        return $this->belongsTo(Group::class, 'id_group');
    }

    public function messages()
    {
        return $this->hasMany(Message::class);
    }
}
