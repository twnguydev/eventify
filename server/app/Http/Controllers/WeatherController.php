<?php

namespace App\Http\Controllers;

use App\Services\WeatherApiService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WeatherController extends Controller
{
  protected $weatherApiService;

  public function __construct(WeatherApiService $weatherApiService)
  {
    $this->weatherApiService = $weatherApiService;
  }

  /**
   *
   * @param Request
   * @return JsonResponse
   */
  public function fetchWeather(Request $request)
  {
    (float) $lat = $request->input('lat');
    (float) $lon = $request->input('lon');

    $weather = $this->weatherApiService->fetchWeather($lat, $lon);

    return response()->json(['weather' => $weather]);
  }
}
