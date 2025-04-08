<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\Group;
use App\Models\Messages;
use App\Models\Room;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Services\OpenAgendaService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GroupController extends Controller
{
    protected $openAgendaService;

    public function __construct(OpenAgendaService $openAgendaService)
    {
        $this->openAgendaService = $openAgendaService;
    }

    public function getGroup($slug, $groupId) {
        $event = Event::where('url', $slug)->first();
        if (!$event) {
            $event = $this->openAgendaService->fetchEventBySlug($slug);
            if (!$event) {
                return response()->json([
                    'message' => 'Événement non trouvé dans SQL ou OpenAgenda.'
                ], 404);
            }
        }
    
        $group = Group::where('id', $groupId)->where('event_slug', $slug)->first();
    
        if (!$group) {
            return response()->json([
                'message' => 'Groupe non trouvé pour cet événement.'
            ], 404);
        }
    
        $room = Room::where('id_group', $groupId)->first();
        if (!$room) {
            return response()->json([
                'message' => 'Salon associé au groupe non trouvé.'
            ], 404);
        }

        $participants = DB::table('room_user')
            ->where('room_user.room_id', $room->id)
            ->join('users', 'room_user.user_id', '=', 'users.id')
            ->select('users.id', 'users.pseudo', 'users.avatar', 'users.oauth_avatar', 'room_user.is_creator')
            ->get()
            ->map(function ($p) {
                $p->is_creator = (int) $p->is_creator;
                return $p;
            });
    
        $messages = DB::table('messages')
            ->where('room_id', $room->id)
            ->join('users', 'messages.user_id', '=', 'users.id')
            ->select('messages.message', 'messages.posted_at', 'users.id', 'users.pseudo', 'users.avatar', 'users.oauth_avatar')
            ->orderBy('messages.posted_at', 'desc')
            ->get();
    
        return response()->json([
            'group' => [
                'title' => $group->title,
                'description' => $group->description,
                'visibility' => $group->visibility,
                'creator' => $participants->first(fn($p) => $p->is_creator === 1),
                'participants' => $participants,
            ],
            'room' => [
                'id' => $room->id,
                'messages' => $messages
            ]
        ]);
    }

    public function updateGroup(Request $request, $slug, $groupId) {
        Log::info('Received request data', $request->all());
        $validator = Validator::make($request->all(), [
            'title' => 'sometimes|string|max:255',
            'description' => 'sometimes|string',
            'user_id' => 'required|exists:users,id',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $event = Event::where('url', $slug)->first();
        if (!$event) {
            $event = $this->openAgendaService->fetchEventBySlug($slug);
            if (!$event) {
                return response()->json([
                    'message' => 'Événement non trouvé dans SQL ou OpenAgenda.'
                ], 404);
            }
        }

        $group = Group::where('id', $groupId)->where('event_slug', $slug)->first();
        if (!$group) {
            return response()->json([
                'message' => 'Groupe non trouvé pour cet événement.'
            ], 404);
        }

        $room = Room::where('id_group', $group->id)->first();
        if (!$room) {
            return response()->json([
                'message' => 'Room not found for this group.'
            ], 404);
        }
        $userId = $request->input('user_id');
        $isCreator = DB::table('room_user')
            ->where('room_id', $room->id)
            ->where('user_id', $userId)
            ->where('is_creator', 1)
            ->exists();

        if (!$isCreator) {
            return response()->json([
                'message' => 'Non autorisé. Seul le créateur du groupe peut effectuer cette modification.'
            ], 403);
        }
        
        if ($request->has('title')) {
            $group->title = $request->input('title');
        }
        if ($request->has('description')) {
            $group->description = $request->input('description');
        }
        if ($request->has('visibility')) {
            $group->visibility = $request->input('visibility');
        }

        $group->save();
        return response()->json([
            'message' => 'Le groupe a été mis à jour avec succès.',
            'group' => $group
        ], 200);
    }

    public function removeParticipant(Request $request, $groupId) {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'participants' => 'required|array',
            'participants.*' => 'exists:users,pseudo',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $userId = $request->input('user_id');
        $group = Group::find($groupId);
        if (!$group) {
            return response()->json([
                'message' => 'Groupe non trouvé.'
            ], 404);
        }

        $room = Room::where('id_group', $group->id)->first();
        if (!$room) {
            return response()->json([
                'message' => 'Salon associé au groupe non trouvé.'
            ], 404);
        }

        $isCreator = DB::table('room_user')
            ->where('room_id', $room->id)
            ->where('user_id', $userId)
            ->where('is_creator', 1)
            ->exists();
        if (!$isCreator) {
            return response()->json([
                'message' => 'Seul le créateur du groupe peut retirer des participants.'
            ], 403);
        }

        $participantPseudos = $request->input('participants');
        $participants = User::whereIn('pseudo', $participantPseudos)->get();
        foreach ($participants as $participant) {
            DB::table('user_groups')
                ->where('user_id', $participant->id)
                ->where('group_id', $group->id)
                ->delete();
            if ($room->users()->where('user_id', $participant->id)->exists()) {
                $room->users()->detach($participant->id);
            }
        }
        return response()->json([
            'message' => 'Participants retirés avec succès du groupe et du salon.',
        ], 200);
    }

    public function addParticipant(Request $request, $groupId)
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'participants' => 'required|array',
            'participants.*' => 'exists:users,pseudo',
            'event_slug' => 'required|exists:groups,event_slug'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $slug = $request->input('event_slug');
        $userId = $request->input('user_id');

        $group = Group::where('event_slug', $slug)->first();

        if (!$group) {
            return response()->json([
                'message' => 'Groupe non trouvé pour cet événement.'
            ], 404);
        }

        $room = Room::where('id_group', $group->id)->first();
        if (!$room) {
            return response()->json([
                'message' => 'Salon associé au groupe non trouvé.'
            ], 404);
        }

        $isCreator = DB::table('room_user')
            ->where('room_id', $room->id)
            ->where('user_id', $userId)
            ->where('is_creator', 1)
            ->exists();
        if (!$isCreator) {
            return response()->json([
                'message' => 'Seul le créateur du groupe peut ajouter des participants.'
            ], 403);
        }

        $participantPseudos = $request->input('participants');
        $participants = User::whereIn('pseudo', $participantPseudos)->get();
        foreach ($participants as $participant) {
            DB::table('user_groups')->insert([
                'user_id' => $participant->id,
                'group_id' => $group->id,
            ]);
            if (!$room->users()->where('user_id', $participant->id)->exists()) {
                $room->users()->attach($participant->id);
            }
        }
        return response()->json([
            'message' => 'Participants ajoutés avec succès au groupe et au salon.',
        ], 200);
    }

    public function deleteGroup(Request $request, $groupId) {
        $validator = validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'group_id' => 'required|exists:groups,id',
            'event_slug' => 'required|exists:groups,event_slug'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $slug = $request->input('event_slug');
        $userId = $request->input('user_id');
        $group = Group::where('event_slug', $slug)->first();
        if (!$group) {
            return response()->json([
                'message' => 'Groupe non trouvé pour cet événement.'
            ], 404);
        }

        $room = Room::where('id_group', $group->id)->first();
        if (!$room) {
            return response()->json([
                'message' => 'Salon associé au groupe non trouvé.'
            ], 404);
        }

        $isCreator = DB::table('room_user')
            ->where('room_id', $room->id)
            ->where('user_id', $userId)
            ->where('is_creator', 1)
            ->exists();
        if (!$isCreator) {
            return response()->json([
                'message' => 'Seul le créateur du groupe peut supprimer le groupe.'
            ], 403);
        }

        DB::transaction(function() use ($group, $room) {
            DB::table('messages')->where('room_id', $room->id)->delete();
            DB::table('room_user')->where('room_id', $room->id)->delete();
            $room->delete();
            DB::table('user_groups')->where('group_id', $group->id)->delete();
            $group->delete();
        });

        return response()->json([
            'message' => 'Le groupe et toutes ses données associées ont été supprimés avec succès.'
        ], 200);
    }

    public function sendMessage(Request $request) {
        $validator = validator::make($request->all(), [
            "user_id" => 'required|exists:users,id',
            "event_slug" => 'required|exists:groups,event_slug',
            "message" => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $slug = $request->input('event_slug');
        $userId = $request->input('user_id');
        $messageContent = $request->input('message');

        $group = Group::where('event_slug', $slug)->first();
        if (!$group) {
            return response()->json([
                'message' => 'Groupe non trouvé pour cet événement.'
            ], 404);
        }

        $room = Room::where('id_group', $group->id)->first();
        if (!$room) {
            return response()->json([
                'message' => 'Salon associé au groupe non trouvé.'
            ], 404);
        }

        DB::table('messages')->insert([
            'user_id' => $userId,
            'room_id' => $room->id,
            'message' => $messageContent,
            'posted_at' => now(),
        ]);
    
        return response()->json([
            'status' => true,
            'message' => $messageContent
        ], 201);
    }
}