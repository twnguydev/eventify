<?php

namespace App\Services;

use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;

class OpenAgendaService
{
    protected $client;
    protected $apiUrl = 'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/evenements-publics-openagenda/records';
    protected $dataset = 'evenements-publics-openagenda';
    protected $restaurantDataset = 'osm-france-food-service';

    public function __construct()
    {
        $this->client = new Client();
    }

    /**
     * 
     * @param int
     * @param int
     * @param string|null
     * @param string|null
     * @param string|null
     * @return array
     */
    public function fetchEvents($limit = 10, $offset = 0, $sort = null, $cityName = null, $eventName = null)
    {
        set_time_limit(60);
        
        $maxRowsPerRequest = 50;
        $maxOffset = 10000;
        $allEvents = [];
        $currentDate = now()->format('Y-m-d');

        do {
            if ($offset >= $maxOffset) {
                break;
            }

            $url = $this->apiUrl . '?where=firstdate_begin%20%3E%3D%20%22' . $currentDate . '%22';

            if ($eventName) {
                $url .= '%20AND%20title_fr%20LIKE%20%22' . urlencode($eventName) . '%22';
            }

            if ($cityName) {
                $url .= '%20AND%20location_city%20%3D%20%22' . urlencode($cityName) . '%22';
            }

            $url .= '&limit=' . $maxRowsPerRequest . '&offset=' . $offset;

            $response = $this->client->get($url);

            $data = json_decode($response->getBody(), true);

            if (!isset($data['results']) || count($data['results']) === 0) {
                break;
            }

            $mappedEvents = array_map(function ($results) {
                return [
                    'title' => $results['title_fr'] ?? 'Sans titre',
                    'description' => $results['description_fr'] ?? 'Pas de description',
                    'location' => [
                        'name' => $results['location_name'] ?? 'Lieu inconnu',
                        'city' => $results['location_city'] ?? 'Ville inconnue',
                        'coordinates' => [
                            $results['location_coordinates']['lat'] ?? null,
                            $results['location_coordinates']['lon'] ?? null
                        ],
                        'address' => $results['location_address'] ?? 'Adresse inconnue',
                    ],
                    'dates' => [
                        'start' => $results['firstdate_begin'] ?? 'Date de début inconnue',
                        'end' => $results['lastdate_end'] ?? 'Date de fin inconnue',
                    ],
                    'image' => $results['thumbnail'] ?? null,
                    'url' => $results['canonicalurl'] ?? null,
                    'slug' => $results['slug'] ?? null,
                ];
            }, $data['results']);

            $allEvents = array_merge($allEvents, $mappedEvents);
            $offset += $maxRowsPerRequest;
    
        } while (count($data['results']) > 0 && $offset < $maxOffset);

        return [
            'events' => array_slice($allEvents, 0, $limit),
        ];
    }

    public function fetchEventBySlug($slug)
    {
        $apiUrl = 'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/evenements-publics-openagenda/records';

        $queryParams = [
            'where' => 'slug="' . $slug . '"',
            'limit' => 1
        ];

        $url = $apiUrl . '?' . http_build_query($queryParams);

        try {
            $response = $this->client->get($url);
            
            $data = json_decode($response->getBody(), true);

            if (empty($data['results'])) {
                return response()->json([
                    'message' => 'Événement non trouvé.'
                ], 404);
            }

            $result = $data['results'][0];

            return [
                'title' => $result['title_fr'] ?? 'Sans titre',
                'description' => $result['description_fr'] ?? 'Pas de description',
                'location' => [
                    'name' => $result['location_name'] ?? 'Lieu inconnu',
                    'city' => $result['location_city'] ?? 'Ville inconnue',
                    'coordinates' => [
                        $result['location_coordinates']['lat'] ?? null,
                        $result['location_coordinates']['lon'] ?? null,
                    ],
                    'address' => $result['location_address'] ?? 'Adresse inconnue',
                ],
                'dates' => [
                    'start' => $result['firstdate_begin'] ?? 'Date de début inconnue',
                    'end' => $result['lastdate_end'] ?? 'Date de fin inconnue',
                ],
                'image' => $result['thumbnail'] ?? null,
                'url' => $result['canonicalurl'] ?? null,
                'slug' => $result['slug'] ?? null
            ];
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la récupération des données.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function fetchRestaurantsAndBars($cityName, $restaurantLimit = 10, $barLimit = 10)
    {
        $apiBaseUrl = 'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/osm-france-food-service/records';
    
        try {
            $restaurantUrl = $apiBaseUrl . '?where=meta_name_com%20LIKE%20%22' . urlencode($cityName) . '%22%20AND%20type%20%3D%20%22restaurant%22';
            $restaurantUrl .= '&limit=' . $restaurantLimit;

            $barUrl = $apiBaseUrl . '?where=meta_name_com%20LIKE%20%22' . urlencode($cityName) . '%22%20AND%20type%20%3D%20%22bar%22';
            $barUrl .= '&limit=' . $barLimit;

            Log::info('Restaurant URL: ' . $restaurantUrl);
            Log::info('Bar URL: ' . $barUrl);

            $restaurantResponse = $this->client->get($restaurantUrl);
            $restaurantData = json_decode($restaurantResponse->getBody(), true);

            $barResponse = $this->client->get($barUrl);
            $barData = json_decode($barResponse->getBody(), true);

            if (!isset($restaurantData['results']) || count($restaurantData['results']) === 0) {
                return response()->json([
                    'message' => 'Aucun restaurant trouvé.'
                ], 404);
            }

            if (!isset($barData['results']) || count($barData['results']) === 0) {
                return response()->json([
                    'message' => 'Aucun bar trouvé.'
                ], 404);
            }

            $restaurants = array_map(function ($record) {
                return [
                    'name' => $record['name'] ?? 'Nom non disponible',
                    'type' => $record['type'] ?? 'Type non disponible',
                    'phone' => $record['phone'] ?? 'Téléphone non disponible',
                    'website' => $record['website'] ?? 'Site web non disponible',
                    'address' => $record['meta_name_com'] ?? 'Adresse non disponible',
                    'coordinates' => [
                        'lat' => $record['meta_geo_point']['lat'] ?? null,
                        'lon' => $record['meta_geo_point']['lon'] ?? null,
                    ],
                    'opening_hours' => $record['opening_hours'] ?? 'Horaires non disponibles',
                ];
            }, $restaurantData['results']);

            $bars = array_map(function ($record) {
                return [
                    'name' => $record['name'] ?? 'Nom non disponible',
                    'type' => $record['type'] ?? 'Type non disponible',
                    'phone' => $record['phone'] ?? 'Téléphone non disponible',
                    'website' => $record['website'] ?? 'Site web non disponible',
                    'address' => $record['meta_name_com'] ?? 'Adresse non disponible',
                    'coordinates' => [
                        'lat' => $record['meta_geo_point']['lat'] ?? null,
                        'lon' => $record['meta_geo_point']['lon'] ?? null,
                    ],
                    'opening_hours' => $record['opening_hours'] ?? 'Horaires non disponibles',
                ];
            }, $barData['results']);

            return [
                'restaurants' => $restaurants,
                'bars' => $bars
            ];
    
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Erreur lors de la récupération des données.',
                'error' => $e->getMessage()
            ], 500);
        }
    }    
}