<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Laravel\Passport\Http\Controllers\AccessTokenController;
use Laravel\Passport\Http\Controllers\PersonalAccessTokenController;

use App\Http\Controllers\OAuthController;
use App\Http\Controllers\EventController;
use App\Http\Controllers\GroupController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WeatherController;
use App\Models\Room;
use Laravel\Passport\Passport;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| is assigned the "api" middleware group. Enjoy building your API!
|
*/

Route::get('/test', function () {
    return response()->json(['message' => 'API is working']);
});

Route::get('/events', [EventController::class, 'fetchEvents']);
Route::get('/Sqlevents', [EventController::class, 'getAllEvents']);
Route::post('/events', [EventController::class, 'store']);
Route::get('/event/{id}', [EventController::class, 'show'])->name('event.show');
Route::get('/event-slug/{slug}', [EventController::class, 'showSlug']);
Route::get('/event/{id}/confirm', [EventController::class, 'generateQrCode']);
Route::get('/event/{id}/verify', [EventController::class, 'verifyPresence']);
Route::post('/event/{id}/create-group', [EventController::class, 'createGroup']);
Route::post('/event/{id}/unparticipate', [EventController::class, 'unparticipate']);
Route::post('/event/{id}/participate', [EventController::class, 'participate']);
Route::post('/event/{slug}/delete', [EventController::class, 'deleteEvent']);
Route::post('/event/{slug}/update', [EventController::class, 'updateEvent']);
Route::get('/event/{slug}/groups', [EventController::class, 'getGroups']);
Route::get('/restaurants-and-bars', [EventController::class, 'fetchRestaurantsAndBars']);

Route::get('/event/{slug}/group/{groupId}', [GroupController::class, 'getGroup']);
Route::patch('/event/{slug}/update-group/{groupId}', [GroupController::class, 'updateGroup']);
Route::delete('/event/{slug}/remove-participant/{groupId}', [GroupController::class, 'removeParticipant']);
Route::post('/event/{slug}/add-participant/{groupId}', [GroupController::class, 'addParticipant']);
Route::post('/event/{slug}/delete/{groupId}', [GroupController::class, 'deleteGroup']);
Route::post('/event/{slug}/send-message/{groupId}', [GroupController::class, 'sendMessage']);

Route::get('/event/{id}/get-rooms', [RoomController::class, 'getEventRooms']);
Route::post('/event/{id}/send-message', [RoomController::class, 'sendMessageInRoom']);
Route::get('/event/{id}/get-room-messages', [RoomController::class, 'getRoomMessages']);

Route::get('/weather', [WeatherController::class, 'fetchWeather']);

Route::get('/all-users', [UserController::class, 'getAllUsers']);
Route::get('/{id}/my-events', [UserController::class, 'getAllEvents']);
Route::get('/{id}/my-created-events', [UserController::class, 'getMyEvents']);
Route::get('/{id}/get-groups', [UserController::class, 'getGroups']);

Route::post('oauth/token', [AccessTokenController::class, 'issueToken']);
Route::post('oauth/personal-access-tokens', [PersonalAccessTokenController::class, 'store']);

Route::post('login/{provider}/callback', [OAuthController::class, 'handleProviderCallback']);

Route::middleware('auth:api')->group(function () {
    Route::get('/user', function (Request $request) {
        return $request->user();
    });
    Route::get('/user/me', [UserController::class, 'getProfile']);
    Route::post('/user/me', [UserController::class, 'updateProfile']);
});

Route::get('/user/{id}', [UserController::class, 'getUserById']);
