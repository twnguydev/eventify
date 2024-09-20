<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\OAuthController;

Route::get('/', function () {
    return view('welcome');
});

Route::middleware('web')->group(function () {
    Route::get('login/{provider}', [OAuthController::class, 'redirectToProvider'])->name('login.provider');
});