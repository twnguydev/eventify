<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\Messages;
use App\Models\Room;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class RoomController extends Controller
{
    public function getEventRooms(Request $request, $eventId)
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id'
        ]);
    
        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }
    
        $event = Event::find($eventId);
        if (!$event) {
            return response()->json([
                'message' => 'Événement non trouvé.'
            ], 404);
        }
    
        $room = Room::where('event_id', $eventId)->first();
        if (!$room) {
            return response()->json([
                'message' => 'Salon non trouvé pour cet événement.'
            ], 404);
        }
    
        $userId = $request->input('user_id');
        $isUserInRoom = $room->users()->where('user_id', $userId)->exists();
        if (!$isUserInRoom) {
            return response()->json([
                'message' => 'Utilisateur non présent dans ce salon.'
            ], 403);
        }
    
        $messages = Messages::where('room_id', $room->id)
            ->orderBy('posted_at', 'asc')
            ->with('user')
            ->get();
    
        $mappedMessages = $messages->map(function ($message) {
            return [
                'posted_at' => $message->posted_at,
                'user' => [
                    'pseudo' => $message->user->pseudo,
                ],
                'message' => $message->message
            ];
        });
    
        return response()->json([
            'room' => $room,
            'messages' => $mappedMessages
        ]);
    }

    public function sendMessageInRoom(Request $request, $eventId)
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'message' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $event = Event::find($eventId);
        if (!$event) {
            return response()->json([
                'message' => 'Événement non trouvé.'
            ], 404);
        }

        $room = Room::where('event_id', $eventId)->first();
        if (!$room) {
            return response()->json([
                'message' => 'Salon non trouvé pour cet événement.'
            ], 404);
        }

        $userId = $request->input('user_id');
        $isUserInRoom = $room->users()->where('user_id', $userId)->exists();
        if (!$isUserInRoom) {
            return response()->json([
                'message' => 'Utilisateur non présent dans ce salon.'
            ], 403);
        }

        $message = new Messages();
        $message->message = $request->input('message');
        $message->user_id = $userId;
        $message->room_id = $room->id;
        $message->posted_at = now();
        $message->save();

        return response()->json([
            'message' => 'Message envoyé avec succès.',
            'data' => $message
        ], 201);
    }
}