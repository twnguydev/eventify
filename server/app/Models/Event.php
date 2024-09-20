<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Event extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'description',
        'location_name',
        'city',
        'address',
        'location_coord_x',
        'location_coord_y',
        'start_date',
        'end_date',
        'image',
        'url',
        'id_creator',
        'qr_code'
    ];

    public function creator()
    {
        return $this->belongsTo(User::class, 'id_creator');
    }

    public function users()
    {
        return $this->belongsToMany(User::class, 'user_event');
    }

    public function rooms()
    {
        return $this->hasMany(Room::class, 'event_id');
    }
}