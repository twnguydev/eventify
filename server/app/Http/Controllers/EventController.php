<?php

namespace App\Http\Controllers;

use App\Models\Event;
use App\Models\Group;
use App\Models\Room;
use App\Models\User;
use App\Services\OpenAgendaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\ErrorCorrectionLevel;
use Endroid\QrCode\Label\LabelAlignment;
use Endroid\QrCode\Label\Font\NotoSans;
use Endroid\QrCode\RoundBlockSizeMode;
use Endroid\QrCode\Writer\PngWriter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class EventController extends Controller
{
    protected $openAgendaService;

    public function __construct(OpenAgendaService $openAgendaService)
    {
        $this->openAgendaService = $openAgendaService;
    }

    /**
     *
     * @param Request
     * @return JsonResponse
     */
    public function fetchEvents(Request $request)
    {
        $limit = $request->get('limit', 10);
        $start = $request->get('start', 0);
        $sort = $request->get('sort', null);
        $cityName = $request->get('cityName', null);
        $eventName = $request->get('eventName', null);
        $visibility = $request->get('visibility', null);
        $userId = $request->get('user_id', null);
        $currentDate = now();

        $mysqlEventsQuery = Event::with('users', 'creator')->where('start_date', '>=', $currentDate);

        if ($cityName) {
            $mysqlEventsQuery->where('city', 'LIKE', '%' . $cityName . '%');
        }
        if ($eventName) {
            $mysqlEventsQuery->where('title', 'LIKE', '%' . $eventName . '%');
        }
        if ($sort === 'dateAsc') {
            $mysqlEventsQuery->orderBy('start_date', 'asc');
        } elseif ($sort === 'dateDesc') {
            $mysqlEventsQuery->orderBy('start_date', 'desc');
        }

        if ($visibility === 'mes-evenements') {
            if ($userId === null) return [ 'error user id cannot be null'];
            $mysqlEventsQuery->whereHas('users', function ($query) use ($userId) {
                $query->where('user_id', $userId);
            });
        }

        $mysqlEvents = $mysqlEventsQuery->skip($start)->take($limit)->get()->map(function ($event) {
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

        $combinedEvents = $mysqlEvents;
    
        if($visibility !== 'mes-evenements') {
            $openAgendaEvents = $this->openAgendaService->fetchEvents($limit, $start, $sort, $cityName, $eventName);
            $mappedOpenAgendaEvents = collect($openAgendaEvents['events'])->map(function ($event) {
                return [
                    'title' => $event['title'] ?? null,
                    'creator' => null,
                    'description' => $event['description'] ?? null,
                    'location' => [
                        'name' => $event['location']['name'] ?? null,
                        'city' => $event['location']['city'] ?? null,
                        'coordinates' => $event['location']['coordinates'] ?? [null, null],
                        'address' => $event['location']['address'] ?? null
                    ],
                    'dates' => [
                        'start' => $event['dates']['start'] ?? null,
                        'end' => $event['dates']['end'] ?? null
                    ],
                    'image' => $event['image'] ?? null,
                    'participants' => [],
                    'url' => $event['url'] ?? null,
                    'slug' => $event['slug'] ?? null,
                    'visibility' => "public"
                ];
            });

            $combinedEvents = $combinedEvents->concat($mappedOpenAgendaEvents);
        }
    
        return response()->json([
            'events' => $combinedEvents
        ]);
    }

    /**
     * Fetch restaurants and bars for a given city.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function fetchRestaurantsAndBars(Request $request)
    {
        $cityName = $request->get('cityName', null);
        $restaurantLimit = $request->get('restaurantLimit', 10);
        $barLimit = $request->get('barLimit', 10);

        try {
            $data = $this->openAgendaService->fetchRestaurantsAndBars($cityName, $restaurantLimit, $barLimit);

            return response()->json($data, 200);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la récupération des restaurants et des bars.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     *
     * @param int
     * @param \Illuminate\Http\Request
     * @return \Illuminate\Http\JsonResponse
     */
    public function createGroup($slug, Request $request) {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'slug' => 'required|string',
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'visibility' => 'required|in:public,private',
            'participants' => 'nullable|array',
            'participants.*' => 'exists:users,pseudo',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::find($request->input('user_id'));
        $slug = $request->input('slug');
        $event = Event::where('url', $slug)->first();
        
        if (!$event) {
            $event = $this->openAgendaService->fetchEventBySlug($slug);
            if (!$event) {
                return response()->json([
                    'message' => 'Événement non trouvé dans SQL ou OpenAgenda.'
                ], 404);
            }
        }
        
        $group = Group::create([
            'title' => $request->input('title'),
            'description' => $request->input('description'),
            'event_slug' => $slug,
            'visibility' => $request->input('visibility'),
        ]);
        DB::table('user_groups')->insert([
            'user_id' => $user->id,
            'group_id' => $group->id,
        ]);
        $room = Room::create([
            'id_group' => $group->id,
        ]);
        $room->users()->attach($user->id, ['is_creator' => true]);

        if ($event instanceof Event) {
            $isAlreadyInEvent = $event->users()->where('user_id', $user->id)->exists();
            if (!$isAlreadyInEvent) {
                $event->users()->attach($user->id);
            }
        }

        if ($request->has('participants')) {
            $participantPseudos = $request->input('participants');
            $participants = User::whereIn('pseudo', $participantPseudos)->get();
    
            foreach ($participants as $participant) {
                DB::table('user_groups')->insert([
                    'user_id' => $participant->id,
                    'group_id' => $group->id,
                ]);
                $room->users()->attach($participant->id);
            }
        }

        $response = [
            'title' => $event instanceof Event ? $event->title : $event['title'],
            'creator' => $event instanceof Event ? $event->users()->wherePivot('is_creator', true)->first() : null,
            'description' => $event instanceof Event ? $event->description : $event['description'],
            'location' => [
                'name' => $event instanceof Event ? $event->location_name : $event['location']['name'],
                'city' => $event instanceof Event ? $event->city : $event['location']['city'],
                'coordinates' => $event instanceof Event
                    ? [$event->location_coord_x, $event->location_coord_y]
                    : [$event['location']['coordinates'][0], $event['location']['coordinates'][1]],
                'address' => $event instanceof Event ? $event->address : $event['location']['address'],
            ],
            'dates' => [
                'start' => $event instanceof Event ? $event->start_date : $event['dates']['start'],
                'end' => $event instanceof Event ? $event->end_date : $event['dates']['end'],
            ],
            'image' => $event instanceof Event ? $event->image : $event['image'],
            'url' => $event instanceof Event ? url('/events/' . $event->url) : $event['url'],
            'slug' => $event instanceof Event ? $event->slug : $event['slug'],
            'participants' => $event instanceof Event ? $event->users()->get() : [],
            'visibility' => $event instanceof Event ? $event->visibility : 'public',
        ];

        return response()->json([
            'message' => 'Utilisateur inscrit avec succès à l\'événement et groupe créé.',
            'event' => $response,
            'group' => $group,
            'room' => $room
        ], 200);
    }

    public function unparticipate($slug, Request $request) {
        $validator = Validator::make($request->all(), [
            'group_id' => 'required|exists:groups,id',
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

        $user = User::find($request->input('user_id'));
        $group = Group::find($request->input('group_id'));
        if (!$group) {
            return response()->json([
                'message' => 'Groupe non trouvé.'
            ], 404);
        }

        $isInGroup = DB::table('user_groups')
            ->where('user_id', $user->id)
            ->where('group_id', $group->id)
            ->exists();
        if (!$isInGroup) {
            return response()->json([
                'message' => 'L\'utilisateur ne fait pas partie de ce groupe.'
            ], 400);
        }

        if ($event instanceof Event) {
            if ($event->users()->where('user_id', $user->id)->exists()) {
                $event->users()->detach($user->id);
            }
        }

        DB::table('user_groups')
            ->where('user_id', $user->id)
            ->where('group_id', $group->id)
            ->delete();
        $room = Room::where('id_group', $group->id)->first();
        if ($room && $room->users()->where('user_id', $user->id)->exists()) {
            $room->users()->detach($user->id);
        }

        $response = [
            'title' => $event instanceof Event ? $event->title : $event['title'],
            'creator' => $event instanceof Event ? $event->users()->wherePivot('is_creator', true)->first() : null,
            'description' => $event instanceof Event ? $event->description : $event['description'],
            'location' => [
                'name' => $event instanceof Event ? $event->location_name : $event['location']['name'],
                'city' => $event instanceof Event ? $event->city : $event['location']['city'],
                'coordinates' => $event instanceof Event
                    ? [$event->location_coord_x, $event->location_coord_y]
                    : [$event['location']['coordinates'][0], $event['location']['coordinates'][1]],
                'address' => $event instanceof Event ? $event->address : $event['location']['address'],
            ],
            'dates' => [
                'start' => $event instanceof Event ? $event->start_date : $event['dates']['start'],
                'end' => $event instanceof Event ? $event->end_date : $event['dates']['end'],
            ],
            'image' => $event instanceof Event ? $event->image : $event['image'],
            'url' => $event instanceof Event ? url('/events/' . $event->url) : $event['url'],
            'slug' => $event instanceof Event ? $event->slug : $event['slug'],
            'participants' => $event instanceof Event ? $event->users()->get() : [],
            'visibility' => $event instanceof Event ? $event->visibility : 'public',
        ];
        return response()->json([
            'message' => 'Utilisateur désinscrit avec succès de l\'événement, du groupe et du salon.',
            'event' => $response
        ], 200);
    }

    public function participate($slug, Request $request) {
        $validator = Validator::make($request->all(), [
            'group_id' => 'required|exists:groups,id',
            'user_id' => 'required|exists:users,id',
        ]);
    
        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }
    
        $user = User::find($request->input('user_id'));
        $group = Group::find($request->input('group_id'));
        if (!$group || $group->visibility !== 'public') {
            return response()->json([
                'message' => 'Le groupe n\'existe pas ou n\'est pas public.'
            ], 403);
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
    
        $isInGroup = DB::table('user_groups')
            ->where('user_id', $user->id)
            ->where('group_id', $group->id)
            ->exists();
        if ($isInGroup) {
            return response()->json([
                'message' => 'L\'utilisateur est déjà inscrit dans ce groupe.'
            ], 400);
        }
    
        if ($event instanceof Event) {
            if (!$event->users()->where('user_id', $user->id)->exists()) {
                $event->users()->attach($user->id);
            }
        }
    
        DB::table('user_groups')->insert([
            'user_id' => $user->id,
            'group_id' => $group->id,
        ]);
        $room = Room::where('id_group', $group->id)->first();
        if ($room) {
            if (!$room->users()->where('user_id', $user->id)->exists()) {
                $room->users()->attach($user->id);
            }
        }

        $response = [
            'title' => $event instanceof Event ? $event->title : $event['title'],
            'creator' => $event instanceof Event ? $event->users()->wherePivot('is_creator', true)->first() : null,
            'description' => $event instanceof Event ? $event->description : $event['description'],
            'location' => [
                'name' => $event instanceof Event ? $event->location_name : $event['location']['name'],
                'city' => $event instanceof Event ? $event->city : $event['location']['city'],
                'coordinates' => $event instanceof Event
                    ? [$event->location_coord_x, $event->location_coord_y]
                    : [$event['location']['coordinates'][0], $event['location']['coordinates'][1]],
                'address' => $event instanceof Event ? $event->address : $event['location']['address'],
            ],
            'dates' => [
                'start' => $event instanceof Event ? $event->start_date : $event['dates']['start'],
                'end' => $event instanceof Event ? $event->end_date : $event['dates']['end'],
            ],
            'image' => $event instanceof Event ? $event->image : $event['image'],
            'url' => $event instanceof Event ? url('/events/' . $event->url) : $event['url'],
            'slug' => $event instanceof Event ? $event->slug : $event['slug'],
            'participants' => $event instanceof Event ? $event->users()->get() : [],
            'visibility' => $event instanceof Event ? $event->visibility : 'public',
        ];
        return response()->json([
            'message' => 'Utilisateur inscrit avec succès à l\'événement, au groupe et au salon.',
            'event' => $response
        ], 200);
    }    

    public function getGroups($slug)
    {
        $event = Event::where('url', $slug)->first();
        if (!$event) {
            $event = $this->openAgendaService->fetchEventBySlug($slug);
            if (!$event) {
                return response()->json([
                    'message' => 'Événement non trouvé dans SQL ou OpenAgenda.'
                ], 404);
            }
        }

        $groups = Group::where('event_slug', $slug)->get();

        if ($groups->isEmpty()) {
            return response()->json([
                'message' => 'Aucun groupe trouvé pour cet événement.',
                'groups' => []
            ], 200);
        }

        $groupDetails = [];
        foreach ($groups as $group) {
            $room = Room::where('id_group', $group->id)->first();
            
            $participants = DB::table('room_user')
            ->where('room_user.room_id', $room->id)
            ->join('users', 'room_user.user_id', '=', 'users.id')
            ->select('users.id', 'users.pseudo', 'room_user.is_creator')
            ->get()
            ->map(function ($p) {
                $p->is_creator = (int) $p->is_creator;
                return $p;
            });

            $groupDetails[] = [
                'group' => [
                    'id' => $group->id,
                    'title' => $group->title,
                    'description' => $group->description,
                    'visibility' => $group->visibility,
                    'creator' => $participants->where('is_creator', 1)->first(),
                    'participants' => $participants
                ]
            ];
        }
        return response()->json([
            'message' => 'Groupes récupérés avec succès.',
            'groups' => $groupDetails
        ], 200);
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'location_name' => 'required|string|max:255',
            'city' => 'required|string|max:255',
            'address' => 'required|string|max:255',
            'location_coord_x' => 'required|numeric',
            'location_coord_y' => 'required|numeric',
            'start_date' => 'required|date|date_format:Y-m-d\TH:i:s',
            'end_date' => 'required|date|after_or_equal:start_date|date_format:Y-m-d\TH:i:s',
            'image' => 'nullable|image|mimes:jpeg,png,jpg',
            'id_creator' => 'required|int',
            'visibility' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::find($request->input('id_creator'));
        if (!$user) {
            return response()->json([
                'message' => 'L\'utilisateur avec l\'id ' . $request->input('id_creator') . ' n\'existe pas.'
            ], 404);
        }

        $imagePath = null;
        if ($request->hasFile('image')) {
            $image = $request->file('image');
            $imagePath = $image->store('images', 'public');
        }

        $slug = Str::slug($request->input('title'));
        $event = Event::create([
            'title' => $request->input('title'),
            'description' => $request->input('description'),
            'location_name' => $request->input('location_name'),
            'city' => $request->input('city'),
            'address' => $request->input('address'),
            'location_coord_x' => $request->input('location_coord_x'),
            'location_coord_y' => $request->input('location_coord_y'),
            'start_date' => $request->input('start_date'),
            'end_date' => $request->input('end_date'),
            'image' => $imagePath,
            'url' => $slug,
            'slug' => $slug,
            'visibility' => $request->input('visibility'),
        ]);

        $event->users()->attach($user->id, ['is_creator' => true]);

        $response = [
            'title' => $event->title,
            'creator' => $user,
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
            'url' => url('/events/' . $event->url),
            'slug' => $event->url,
            'visibility' => $request->input('visibility'),
            'participants' => [],
        ];

        return response()->json([
            'message' => 'Événement créé avec succès',
            'event' => $response,
        ], 201);
    }

    public function generateQrCode($id)
    {
        $event = Event::find($id);

        if (!$event) {
            return response()->json([
                'message' => 'Événement non trouvé.'
            ], 404);
        }
        $qrCodeContent = url('/event/' . $event->id . '/verify');

        $result = Builder::create()
            ->writer(new PngWriter())
            ->writerOptions([])
            ->data($qrCodeContent)
            ->encoding(new Encoding('UTF-8'))
            ->errorCorrectionLevel(ErrorCorrectionLevel::High)
            ->size(300)
            ->margin(10)
            ->roundBlockSizeMode(RoundBlockSizeMode::Margin)
            ->logoPath(__DIR__.'/assets/sample.png')
            ->logoResizeToWidth(50)
            ->logoPunchoutBackground(true)
            ->labelText($event["title"])
            ->labelFont(new NotoSans(20))
            ->labelAlignment(LabelAlignment::Center)
            ->validateResult(false)
            ->build();

        $qrCodePath = 'qrcodes/' . str_replace(' ', '_', trim($event->name)) . "_" . $event->id . '.png';
        $result->saveToFile(storage_path('app/public/' . $qrCodePath));

        $event->qr_code = $qrCodePath;
        $event->save();

        return response($result->getString(), 200)
            ->header('Content-Type', 'image/png');
    }

    public function show($id)
    {
        $event = Event::find($id);

        if (!$event) {
            return response()->json([
                'message' => 'Événement non trouvé.'
            ], 404);
        }

        $participants = $event->users()->get();
        $creator = $event->users()->wherePivot('is_creator', true)->first();

        $response = [
            'title' => $event->title,
            'creator' => $creator,
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

        return response()->json([
            'event' => $response
        ]);
    }

    public function showSlug($slug)
    {
        $event = Event::where('url', $slug)->first();

        if ($event) {
            $participants = $event->users()->get();
            $creator = $event->users()->wherePivot('is_creator', true)->first();
            $response = [
                'title' => $event->title,
                'creator' => $creator,
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

            return response()->json([
                'event' => $response
            ]);
        }

        $openAgendaEvent = $this->openAgendaService->fetchEventBySlug($slug);
        if ($openAgendaEvent) {
            $mappedOpenAgendaEvent = [
                'title' => $openAgendaEvent['title'],
                'creator' => null,
                'description' => $openAgendaEvent['description'],
                'location' => [
                    'name' => $openAgendaEvent['location']['name'],
                    'city' => $openAgendaEvent['location']['city'],
                    'coordinates' => [
                        $openAgendaEvent['location']['coordinates'][0] ?? null,
                        $openAgendaEvent['location']['coordinates'][1] ?? null,
                    ],
                    'address' => $openAgendaEvent['location']['address'],
                ],
                'dates' => [
                    'start' => $openAgendaEvent['dates']['start'],
                    'end' => $openAgendaEvent['dates']['end'],
                ],
                'image' => $openAgendaEvent['image'],
                'participants' => [],
                'url' => $openAgendaEvent['url'],
                'slug' => $openAgendaEvent['slug'],
            ];
        
            return response()->json([
                'event' => $mappedOpenAgendaEvent
            ]);
        }

        return response()->json([
            'message' => 'Événement non trouvé.'
        ], 404);
    }

    public function getAllEvents()
    {
        $events = Event::with(['users', 'creator'])->get();

        $mappedEvents = $events->map(function ($event) {
            $participants = $event->users()->get();

            $creator = $event->users()->wherePivot('is_creator', true)->first();

            return [
                'title' => $event->title,
                'creator' => $creator,
                'description' => $event->description,
                'location' => [
                    'name' => $event->location_name,
                    'city' => $event->city,
                    'coordinates' => [
                        $event->location_coord_x,
                        $event->location_coord_y
                    ],
                    'address' => $event->address,
                ],
                'dates' => [
                    'start' => $event->start_date,
                    'end' => $event->end_date,
                ],
                'image' => $event->image,
                'participants' => $participants,
                'url' => url('/events/' . $event->url),
                'slug' => $event->url,
                'visibility' => $event->visibility,
            ];
        });

        return response()->json([
            'events' => $mappedEvents,
        ], 200);
    }

    public function verifyPresence(Request $request, $id) {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $event = Event::find($id);
        if (!$event) {
            return response()->json([
                'message' => 'Événement non trouvé.'
            ], 404);
        }

        $userId = $request->input('user_id');
        $presence = DB::table('user_event')
                        ->where('event_id', $id)
                        ->where('user_id', $userId)
                        ->exists();

        if ($presence) {
            return response()->json([
                'message' => 'L\'utilisateur est inscrit à cet événement.',
                'success' => true
            ], 200);
        } else {
            return response()->json([
                'message' => 'L\'utilisateur n\'est pas inscrit à cet événement.',
                'failure' => false
            ], 404);
        }
    }

    public function deleteEvent(Request $request, $slug) {
        $event = Event::where('url', $slug)->first();
        if (!$event) {
            return response()->json([
                'message' => 'Événement non trouvé.'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $userId = $request->input('user_id');

        $isCreator = DB::table('user_event')
            ->where('event_id', $event->id)
            ->where('user_id', $userId)
            ->where('is_creator', 1)
            ->exists();

        if (!$isCreator) {
            return response()->json([
                'message' => 'Seul le créateur de l\'événement peut le supprimer.'
            ], 403);
        }

        $groups = Group::where('event_slug', $slug)->get();
        foreach ($groups as $group) {
            $room = Room::where('id_group', $group->id)->first();
            if ($room) {
                $room->delete();
            }
            $group->delete();
        }

        $event->delete();
        return response()->json([
            'message' => 'Événement supprimé avec succès.'
        ], 200);
    }

    public function updateEvent(Request $request, $slug)
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'location_name' => 'sometimes|string|max:255',
            'city' => 'sometimes|string|max:255',
            'address' => 'sometimes|string|max:255',
            'location_coord_x' => 'sometimes|numeric',
            'location_coord_y' => 'sometimes|numeric',
            'start_date' => 'sometimes|date|date_format:Y-m-d\TH:i:s',
            'end_date' => 'sometimes|date|after_or_equal:start_date|date_format:Y-m-d\TH:i:s',
            'image' => 'sometimes|image|mimes:jpeg,png,jpg',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'errors' => $validator->errors()
            ], 422);
        }

        $userId = $request->input('user_id');
        $event = Event::where('url', $slug)->first();
        if (!$event) {
            return response()->json([
                'message' => 'Événement non trouvé.'
            ], 404);
        }

        $isCreator = DB::table('user_event')
                        ->where('event_id', $event->id)
                        ->where('user_id', $userId)
                        ->where('is_creator', 1)
                        ->exists();

        if (!$isCreator) {
            return response()->json([
                'message' => 'Seul le créateur de l\'événement peut le modifier.'
            ], 403);
        }

        $event->title = $request->input('title', $event->title);
        $event->description = $request->input('description', $event->description);
        $event->location_name = $request->input('location_name', $event->location_name);
        $event->city = $request->input('city', $event->city);
        $event->address = $request->input('address', $event->address);
        $event->location_coord_x = $request->input('location_coord_x', $event->location_coord_x);
        $event->location_coord_y = $request->input('location_coord_y', $event->location_coord_y);
        $event->start_date = $request->input('start_date', $event->start_date);
        $event->end_date = $request->input('end_date', $event->end_date);

        if ($request->hasFile('image')) {
            if ($event->image) {
                Storage::delete('public/' . $event->image);
            }
            $image = $request->file('image');
            $imagePath = $image->store('images', 'public');
            $event->image = $imagePath;
        }

        $event->save();
        $updatedEvent = [
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
            'image' => $event->image ? url('storage/' . $event->image) : null,
            'url' => url('/events/' . $event->url),
            'slug' => $event->url
        ];

        return response()->json([
            'message' => 'Événement mis à jour avec succès',
            'event' => $updatedEvent
        ], 200);
    }
}