<?php

namespace App\Http\Controllers;

use App\Models\Event;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class UserController extends Controller
{
  /**
   *
   * @return \Illuminate\Http\JsonResponse
   */
  public function getProfile()
  {
    $user = Auth::user();
    return response()->json(['user' => $user]);
  }

  /**
   * 
   * @param  int  $id
   * @return \Illuminate\Http\JsonResponse
   */
  public function getUserById($id)
  {
    $user = User::find($id);
    return response()->json(['user' => $user]);
  }

  /**
   *
   * @param  \Illuminate\Http\Request
   * @return \Illuminate\Http\JsonResponse
   */
  public function updateProfile(Request $request)
  {
      Log::info('Received request data', $request->all());
      Log::info('Received request files', $request->file());
  
      $user = Auth::user();
      $user = User::find($user->id);
  
      $request->validate([
          'pseudo' => 'required|string',
          'name' => 'required|string',
          'avatar' => 'nullable|image|mimes:jpg,jpeg,png|max:2048',
          'bio' => 'nullable|string',
      ]);
  
      if ($request->hasFile('avatar')) {
          if ($user->avatar && Storage::disk('public')->exists('avatars/' . $user->avatar)) {
              Storage::disk('public')->delete('avatars/' . $user->avatar);
          }
  
          $avatarPath = $request->file('avatar')->store('avatars', 'public');
          $user->avatar = basename($avatarPath);
      }
  
      $user->pseudo = $request->input('pseudo', $user->pseudo);
      $user->name = $request->input('name', $user->name);
      $user->bio = $request->input('bio', null);
      $user->updated_at = now();
      $user->save();
  
      return response()->json(['message' => 'Profil mis à jour avec succès', 'user' => $user]);
  }

  public function getAllUsers(Request $request) {
    $query = $request->input('q');

    if ($query) {
      $users = User::where('pseudo', 'LIKE', $query . '%')->pluck('pseudo');
    } else {
        $users = User::pluck('pseudo');
    }

    return response()->json(
        $users
    );
  }

  public function getAllEvents($id) {
    $user = User::find($id);

    if (!$user) {
        return response()->json([
            'message' => 'Utilisateur non trouvé.'
        ], 404);
    }

    $events = Event::whereHas('users', function ($query) use ($id) {
        $query->where('user_id', $id);
    })->get();

    $mappedEvents = $events->map(function ($event) {
      $participants = $event->users()->get();
      return [
          'title' => $event->title,
          'creator' => $event->users()->wherePivot('is_creator', true)->first(),
          'description' => $event->description,
          'location' => [
              'name' => $event->location_name,
              'city' => $event->city,
              'coordinates' => [
                  $event->location_coord_x,
                  $event->location_coord_y
              ],
              'address' => $event->address
          ],
          'dates' => [
              'start' => $event->start_date,
              'end' => $event->end_date
          ],
          'image' => $event->image,
          'participants' => $participants,
          'url' => url('/events/' . $event->url),
          'slug' => $event->url,
          'visibility' => $event->visibility,
      ];
    });

    return response()->json([
      'events' => $mappedEvents
    ]);
  }

  public function getMyEvents($id)
  {
      $user = User::find($id);

      if (!$user) {
          return response()->json([
              'message' => 'Utilisateur non trouvé.'
          ], 404);
      }

      $events = Event::whereHas('users', function ($query) use ($id) {
          $query->where('user_id', $id)
              ->where('is_creator', 1);
      })->get();

      $mappedEvents = $events->map(function ($event) {
          $participants = $event->users()->get();

          return [
              'title' => $event->title,
              'creator' => $event->users()->wherePivot('is_creator', true)->first(),
              'description' => $event->description,
              'location' => [
                  'name' => $event->location_name,
                  'city' => $event->city,
                  'coordinates' => [
                      $event->location_coord_x,
                      $event->location_coord_y
                  ],
                  'address' => $event->address
              ],
              'dates' => [
                  'start' => $event->start_date,
                  'end' => $event->end_date
              ],
              'image' => $event->image,
              'participants' => $participants,
              'url' => url('/events/' . $event->url),
              'slug' => $event->url,
              'visibility' => $event->visibility,
          ];
      });

      return response()->json([
          'events' => $mappedEvents
      ]);
  }

    public function getGroups($id) {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'message' => 'Utilisateur non trouvé.'
            ], 404);
        }

        $groups = DB::table('groups')
            ->join('user_groups', 'groups.id', '=', 'user_groups.group_id')
            ->join('rooms', 'groups.id', '=', 'rooms.id_group')
            ->join('room_user', function($join) use ($id) {
                $join->on('rooms.id', '=', 'room_user.room_id')
                    ->where('room_user.user_id', '=', $id);
            })
            ->where('user_groups.user_id', $id)
            ->select('groups.*', 'room_user.is_creator', 'rooms.created_at')
            ->get();

        $groupsWithParticipants = $groups->map(function ($group) {
            $participants = DB::table('user_groups')
                ->join('users', 'user_groups.user_id', '=', 'users.id')
                ->where('user_groups.group_id', $group->id)
                ->select('users.id', 'users.pseudo', 'users.email')
                ->get();
        
            $group->participants = $participants;
            return $group;
        });
        
        return response()->json([
            'message' => 'Groupes récupérés avec succès.',
            'groups' => $groupsWithParticipants
        ], 200);
    }
}
