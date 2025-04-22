import { Component, OnInit, HostListener } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Observable, Subject, of } from 'rxjs';
import { map, debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { NavbarComponent } from "@components/navbar/navbar.component";
import { EventService } from "@services/event.service";
import { IEvent } from "@interfaces/event.interface";
import { UtcDatePipe } from '@pipes/utc-date.pipe';
import { SharedModule } from 'app/shared.module';

@Component({
  selector: 'app-event-catalogue',
  standalone: true,
  imports: [CommonModule, NavbarComponent, FormsModule, SharedModule],
  providers: [UtcDatePipe],
  templateUrl: './event-catalogue.component.html',
  styleUrls: ['./event-catalogue.component.css']
})
export class EventCatalogueComponent implements OnInit {
  map!: L.Map;
  userLocation: any = { lat: 0, lng: 0 };
  events: IEvent[] = [];
  eventMarkers: L.Marker[] = [];
  filteredEvents = this.events;
  isMapLoading: boolean = true;
  isCatalogueNull: boolean = false;
  showAdvancedFilters: boolean = false;
  showSidebar: boolean = false;
  private debounceTimer: any = null;
  private readonly DEBOUNCE_DELAY = 300;
  public innerWidth: number = 0;

  cityName: string | null = null;
  eventName: string | null = null;
  limit: number = 10;
  sort: string | null = null;
  distance: string | null = null;
  private cityNameChanged: Subject<string> = new Subject<string>();

  constructor(
    private eventService: EventService,
    private http: HttpClient,
    private router: Router
  ) {
    this.cityNameChanged.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(cityName => {
      this.cityName = cityName;
      this.loadEvents();
    });
  }

  ngOnInit(): void {
    this.innerWidth = window.innerWidth;
    this.initializeMap();
    this.getUserLocation();
    
    // Set default sidebar visibility based on screen size
    this.showSidebar = window.innerWidth >= 1024; // lg breakpoint
    
    // Applique les styles de carte personnalisés
    setTimeout(() => {
      this.applyMapStyle();
    }, 500);
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    this.innerWidth = event.target.innerWidth;
  }

  toggleSidebar() {
    this.showSidebar = !this.showSidebar;
  }

  loadEvents() {
    this.isMapLoading = true;
    this.eventService.getEvents(this.limit, 0, this.sort, this.cityName, this.eventName).subscribe(response => {
      this.events = response.events;

      if (this.events.length === 0) {
        this.isCatalogueNull = true;
      } else {
        this.isCatalogueNull = false;
      }

      this.calculateDistances();
      this.applyFilters();
      this.onDistanceChange();
      this.displayEventMarkers();

      if (!this.cityName || this.cityName.trim() === '') {
        this.map.setView([46.603354, 1.888334], 6);
        setTimeout(() => {
          this.isMapLoading = false;
        }, 800);
      } else {
        if (this.isSearchingOwnCity(this.cityName)) {
          this.map.setView([this.userLocation.lat, this.userLocation.lng], 13);
          setTimeout(() => {
            this.isMapLoading = false;
          }, 800);
        } else {
          this.getCityCoordinates(this.cityName).subscribe(coords => {
            this.map.setView([coords.lat, coords.lng], 13);
            setTimeout(() => {
              this.isMapLoading = false;
            }, 800);
          }, error => {
            console.error('Erreur lors de l\'obtention des coordonnées de la ville:', error);
            setTimeout(() => {
              this.isMapLoading = false;
            }, 800);
          });
        }
      }
    });
  }

  calculateDistances() {
    this.events.forEach(event => {
      if (event.location?.coordinates?.length === 2) {
        const eventLat = event.location.coordinates[0];
        const eventLng = event.location.coordinates[1];
        event['distance'] = this.calculateDistance(this.userLocation.lat, this.userLocation.lng, eventLat, eventLng);
      } else {
        event['distance'] = undefined;
        console.warn(`Impossible de calculer la distance pour l'événement "${event.title}" : coordonnées manquantes.`);
      }
    });
  }

  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.degreesToRadians(lat2 - lat1);
    const dLng = this.degreesToRadians(lng2 - lng1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.degreesToRadians(lat1)) * Math.cos(this.degreesToRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  degreesToRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  initializeMap() {
    this.isMapLoading = true;
    
    // Custom map style with better colors and contrast
    this.map = L.map('map', {
      zoomControl: false, // We'll add it in a custom position
      attributionControl: false // Hide default attribution
    }).setView([51.505, -0.09], 13);

    // Add custom map tiles (Mapbox or other stylish tiles)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(this.map).on('load', () => {
      setTimeout(() => {
        this.isMapLoading = false;
      }, 800);
    });

    // Add zoom control in the bottom right
    L.control.zoom({
      position: 'bottomright'
    }).addTo(this.map);
  }

  getUserLocation() {
    this.isMapLoading = true;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          this.userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            city: ''
          };

          this.map.setView([this.userLocation.lat, this.userLocation.lng], 13);

          // Modern user location marker with pulsing effect
          const pulsingIcon = L.divIcon({
            html: `
              <div class="relative">
                <div class="w-6 h-6 bg-[#00829B] rounded-full flex items-center justify-center z-20 relative shadow-lg">
                  <div class="w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>
            `,
            className: '',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });

          L.marker([this.userLocation.lat, this.userLocation.lng], { icon: pulsingIcon })
            .addTo(this.map)
            .bindPopup('<div class="font-medium">Votre position actuelle</div>')
            .openPopup();

          this.reverseGeocode(this.userLocation.lat, this.userLocation.lng);
          setTimeout(() => {
            this.isMapLoading = false;
          }, 800);
        },
        error => {
          console.error('Erreur lors de la géolocalisation:', error);
          
          // Show a nicer error message
          const errorPopup = L.popup()
            .setLatLng([46.603354, 1.888334])
            .setContent(`
              <div class="p-2 text-center">
                <p class="font-medium text-gray-800 mb-2">Localisation non disponible</p>
                <p class="text-sm text-gray-600">Veuillez vérifier vos paramètres de navigation.</p>
              </div>
            `)
            .openOn(this.map);
            
          setTimeout(() => {
            this.isMapLoading = false;
          }, 800);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      // Show a nicer message for unsupported browsers
      const browserPopup = L.popup()
        .setLatLng([46.603354, 1.888334])
        .setContent(`
          <div class="p-2 text-center">
            <p class="font-medium text-gray-800 mb-2">Géolocalisation non supportée</p>
            <p class="text-sm text-gray-600">Votre navigateur ne supporte pas la géolocalisation.</p>
          </div>
        `)
        .openOn(this.map);
        
      setTimeout(() => {
        this.isMapLoading = false;
      }, 800);
    }
  }

  reverseGeocode(lat: number, lng: number) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`;
    this.http.get<any>(url).subscribe(response => {
      const cityName = response.address.city || response.address.town || response.address.village || '';
      if (cityName && cityName !== this.cityName) {
        this.userLocation.city = cityName;
        this.cityName = cityName;
        this.loadEvents();
      }
    });
  }  

  getCityCoordinates(cityName: string): Observable<{ lat: number, lng: number }> {
    if (this.isSearchingOwnCity(cityName)) {
      return of({ lat: this.userLocation.lat, lng: this.userLocation.lng });
    }
  
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cityName)}&format=json&addressdetails=1`;
    return this.http.get<any[]>(url).pipe(
      map(results => {
        if (results && results.length > 0) {
          return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
        } else {
          throw new Error('City not found');
        }
      })
    );
  }

  isSearchingOwnCity(cityName: string): boolean {
    return cityName.trim().toLowerCase() === this.userLocation.city?.trim().toLowerCase();
  }

  applyFilters() {
    this.isMapLoading = true;
    this.filteredEvents = this.events.filter(event =>
      (this.eventName ? event.title.toLowerCase().includes(this.eventName.toLowerCase()) : true)
    );
    if (this.filteredEvents.length === 0) {
      this.isCatalogueNull = true;
    } else {
      this.isCatalogueNull = false;
    }
    this.onSortChange();
    setTimeout(() => {
      this.isMapLoading = false;
    }, 800);
  }

  displayEventMarkers() {
    this.isMapLoading = true;
    // Supprime les marqueurs existants
    this.eventMarkers.forEach(marker => marker.remove());
    this.eventMarkers = [];

    // Création d'un groupe de marqueurs pour faciliter la gestion
    const markerGroup = L.featureGroup().addTo(this.map);

    // Icône personnalisée pour les événements
    const eventIcon = L.divIcon({
      html: `
        <div class="flex items-center justify-center">
          <div class="w-8 h-8 rounded-lg bg-white shadow-md flex items-center justify-center transform hover:scale-110 transition-transform">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#00829B]" viewBox="0 0 20 20" fill="#00829B">
              <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd" />
            </svg>
          </div>
        </div>
      `,
      className: '',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    // Crée un popup personnalisé pour chaque événement
    this.filteredEvents.forEach(event => {
      if (event.location?.coordinates?.length === 2) {
        const eventLat: number = event.location.coordinates[0];
        const eventLng: number = event.location.coordinates[1];
        
        const city = event.location.city || 'Ville non spécifiée';
        const distance = event.distance !== undefined ? 
          `<span class="text-sm ${event.distance < 10 ? 'text-green-600' : event.distance < 50 ? 'text-yellow-600' : 'text-red-600'}">
            ${event.distance.toFixed(1)} km de votre position
           </span>` : '';
        
        // Création d'un popup stylisé
        const popupContent = `
          <div class="p-3 max-w-xs">
            <h3 class="font-bold text-lg text-gray-800 mb-2">${event.title}</h3>
            <div class="flex items-center text-gray-500 text-sm mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              ${new Date(event.dates.start).toLocaleDateString('fr-FR', {day: '2-digit', month: 'short', year: 'numeric'})}
            </div>
            <div class="flex items-center text-gray-500 text-sm mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              ${city}
            </div>
            ${distance ? `<div class="mb-3">${distance}</div>` : ''}
            <p class="text-sm text-gray-600 mb-3 line-clamp-3">${event.description.substring(0, 120)}${event.description.length > 120 ? '...' : ''}</p>
            <a href="/event/${event.slug}" class="inline-block py-2 px-4 bg-[#00829B] hover:bg-[#006d82] text-white text-center text-sm font-medium rounded-lg transition-colors w-full" style="color: #fff;">
              Voir l'événement
            </a>
          </div>
        `;
        
        // Options de popup personnalisées
        const popupOptions = {
          className: 'custom-popup',
          maxWidth: 300,
          minWidth: 250,
          closeButton: true,
          offset: [0, -10] as [number, number]
        };

        const marker = L.marker([eventLat, eventLng], { 
          icon: eventIcon,
          riseOnHover: true,
          title: event.title
        })
        .bindPopup(popupContent, popupOptions);
        
        // Ajouter l'écouteur d'événements avec une référence explicite
        marker.on('mouseover', (e) => {
          marker.openPopup();
        });
        
        // Ajoute le marqueur au groupe et à la liste des marqueurs
        marker.addTo(markerGroup);
        this.eventMarkers.push(marker);
      } else {
        console.warn(`L'événement "${event.title}" n'a pas de coordonnées valides.`);
      }
    });

    // Si des marqueurs sont présents, adapte la vue pour les afficher tous
    if (this.eventMarkers.length > 0 && (!this.cityName || this.cityName.trim() === '')) {
      try {
        this.map.fitBounds(markerGroup.getBounds(), {
          padding: [50, 50],
          maxZoom: 13
        });
      } catch (e) {
        console.warn("Impossible d'ajuster la vue sur les marqueurs", e);
      }
    }

    setTimeout(() => {
      this.isMapLoading = false;
    }, 800);
  }

  onCityNameChange() {
    if (this.cityName !== null) {
      this.cityNameChanged.next(this.cityName.trim());
      
      // Affiche un indicateur de chargement dans la barre de recherche
      const searchInput = document.querySelector('input[placeholder="Rechercher une ville..."]') as HTMLInputElement;
      if (searchInput) {
        searchInput.classList.add('animate-pulse');
        setTimeout(() => {
          searchInput.classList.remove('animate-pulse');
        }, 800);
      }
    }
  }

  onEventNameChange() {
    this.applyFilters();
  }

  onSortChange() {
    // Feedback visuel du changement de tri
    const listContainer = document.querySelector('ul');
    if (listContainer) {
      listContainer.classList.add('scale-98', 'transition-transform');
      setTimeout(() => {
        listContainer.classList.remove('scale-98');
      }, 300);
    }
    
    if (this.sort === 'date_asc') {
      this.filteredEvents.sort((a, b) => new Date(a.dates.start).getTime() - new Date(b.dates.start).getTime());
    } else if (this.sort === 'date_desc') {
      this.filteredEvents.sort((a, b) => new Date(b.dates.start).getTime() - new Date(a.dates.start).getTime());
    }
    this.displayEventMarkers();
  }
  
  onDistanceChange() {
    // Animation pour le changement de tri par distance
    const markers = document.querySelectorAll('.leaflet-marker-icon');
    markers.forEach(marker => {
      marker.classList.add('animate-bounce');
      setTimeout(() => {
        marker.classList.remove('animate-bounce');
      }, 500);
    });
    
    if (this.distance === 'distance_asc') {
      this.filteredEvents.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    } else if (this.distance === 'distance_desc') {
      this.filteredEvents.sort((a, b) => (b.distance || 0) - (a.distance || 0));
    }
    this.displayEventMarkers();
  }

  applyMapStyle() {
    const mapContainer = document.querySelector('.leaflet-container');
    if (mapContainer) {
      mapContainer.classList.add('custom-map-style');
    }
  }

  onLimitChange() {
    this.loadEvents();
  }
}