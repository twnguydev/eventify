<?php

namespace App\Services;

use GuzzleHttp\Client;

class WeatherApiService
{
    protected $client;
    protected $apiKey = '2dfd1ba0e0dc44dd9ea82126241209';
    protected $apiUrl;

    public function __construct()
    {
        $this->client = new Client();
        $this->apiUrl = 'https://api.weatherapi.com/v1/forecast.json';
    }

    /**
     * Fetch the weather data for the given latitude and longitude.
     *
     * @param float $lat
     * @param float $lon
     * @return array
     */
    public function fetchWeather(float $lat, float $lon)
    {
        set_time_limit(60);

        $today_day = date('Y-m-d');

        $url = $this->apiUrl . '?q=' . $lat . ',' . $lon . '&lang=fr&dt=' . $today_day . '&key=' . $this->apiKey;

        try {
            $response = $this->client->get($url);
            $data = json_decode($response->getBody(), true);

            if (!isset($data['forecast']) || count($data['forecast']['forecastday']) === 0) {
                return [];
            }

            return [
                'forecast' => $data['forecast']['forecastday']
            ];
        } catch (\Exception $e) {
            return ['error' => $e->getMessage()];
        }
    }
}