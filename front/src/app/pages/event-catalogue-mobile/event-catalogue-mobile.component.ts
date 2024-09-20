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
import { SharedModule } from 'app/shared.module';

@Component({
  selector: 'app-event-catalogue',
  standalone: true,
  imports: [CommonModule, NavbarComponent, FormsModule, SharedModule],
  templateUrl: './event-catalogue-mobile.component.html',
  styleUrls: ['./event-catalogue-mobile.component.css']
})
export class EventCatalogueMobileComponent implements OnInit {
  map!: L.Map;
  userLocation: any = { lat: 0, lng: 0 };
  events: IEvent[] = [];
  eventMarkers: L.Marker[] = [];
  filteredEvents = this.events;
  isMapLoading: boolean = true;
  isCatalogueNull: boolean = false;

  cityName: string | null = null;
  eventName: string | null = null;
  limit: number = 10;
  sort: string | null = null;
  distance: string | null = null;
  private cityNameChanged: Subject<string> = new Subject<string>();

  constructor(private eventService: EventService, private http: HttpClient, private router: Router) {
    this.cityNameChanged.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(cityName => {
      this.cityName = cityName;
      this.loadEvents();
    });
  }

  ngOnInit(): void {
    this.initializeMap();
    this.getUserLocation();
  }

  @HostListener('window:resize', ['$event'])
  onResize(event: any) {
    const width = event.target.innerWidth;

    if (width <= 768) {
      this.router.navigate(['/m/event-list']);
    } else {
      this.router.navigate(['/event-list']);
    }
  }

  loadEvents() {
    this.isMapLoading = true;
    this.eventService.getEvents(this.limit, 0, this.sort, this.cityName, this.eventName).subscribe(response => {
      this.events = response.events;

      if (this.events.length === 0) {
        this.isCatalogueNull = true;
      }

      this.calculateDistances();
      this.applyFilters();
      this.onDistanceChange();
      this.displayEventMarkers();

      if (!this.cityName || this.cityName.trim() === '') {
        this.map.setView([46.603354, 1.888334], 6);
        setTimeout(() => {
          this.isMapLoading = false;
        }, 1500);
      } else {
        if (this.isSearchingOwnCity(this.cityName)) {
          this.map.setView([this.userLocation.lat, this.userLocation.lng], 13);
          setTimeout(() => {
            this.isMapLoading = false;
          }, 1500);
        } else {
          this.getCityCoordinates(this.cityName).subscribe(coords => {
            this.map.setView([coords.lat, coords.lng], 13);
            setTimeout(() => {
              this.isMapLoading = false;
            }, 1500);
          }, error => {
            console.error('Erreur lors de l\'obtention des coordonnées de la ville:', error);
            setTimeout(() => {
              this.isMapLoading = false;
            }, 1500);
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
    this.map = L.map('map').setView([51.505, -0.09], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map).on('load', () => {
      setTimeout(() => {
        this.isMapLoading = false;
      }, 1500);
    });
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

          const userIcon = L.divIcon({
            html: `<svg xmlns="http://www.w3.org/1500/svg" viewBox="0 0 384 512" width="30" height="30">
                    <path fill="red" d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/>
                   </svg>`,
            className: '',
            iconSize: [30, 30]
          });

          L.marker([this.userLocation.lat, this.userLocation.lng], { icon: userIcon })
            .addTo(this.map)
            .bindPopup('Vous êtes ici.')
            .openPopup();

          this.reverseGeocode(this.userLocation.lat, this.userLocation.lng);
          setTimeout(() => {
            this.isMapLoading = false;
          }, 1500);
        },
        error => {
          console.error('Erreur lors de la géolocalisation:', error);
          alert('Impossible de récupérer la géolocalisation. Veuillez vérifier vos paramètres.');
          setTimeout(() => {
            this.isMapLoading = false;
          }, 1500);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      alert('La géolocalisation n\'est pas supportée par votre navigateur.');
      setTimeout(() => {
        this.isMapLoading = false;
      }, 1500);
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
    }
    this.onSortChange();
    setTimeout(() => {
      this.isMapLoading = false;
    }, 1500);
  }

  displayEventMarkers() {
    this.isMapLoading = true;
    this.eventMarkers.forEach(marker => marker.remove());
    this.eventMarkers = [];

    const eventIcon = L.divIcon({
      html: `<svg xmlns="http://www.w3.org/1500/svg" viewBox="0 0 384 512" width="30" height="30">
              <path fill="black" d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/>
             </svg>`,
      className: '',
      iconSize: [20, 20]
    });

    this.filteredEvents.forEach(event => {
      if (event.location?.coordinates?.length === 2) {
        const eventLat: number = event.location.coordinates[0];
        const eventLng: number = event.location.coordinates[1];
  
        const city = event.location.city || 'Ville non spécifiée';
  
        const marker = L.marker([eventLat, eventLng], { icon: eventIcon })
          .addTo(this.map)
          .bindPopup(`<strong>${event.title}</strong><br><br>${event.description}<br>${city}<br><br><a href="${event.url}" target="_blank">Voir l'événement</a>`);
  
        this.eventMarkers.push(marker);
      } else {
        console.warn(`L'événement "${event.title}" n'a pas de coordonnées valides.`);
      }
    });
    setTimeout(() => {
      this.isMapLoading = false;
    }, 1500);
  }

  onCityNameChange() {
    if (this.cityName !== null) {
      this.cityNameChanged.next(this.cityName.trim());
    }
  }

  onEventNameChange() {
    this.isMapLoading = true;
    this.loadEvents();
    this.displayEventMarkers();
  }

  onLimitChange() {
    this.isMapLoading = true;
    this.loadEvents();
  }

  onSortChange() {
    if (this.sort === 'date_asc') {
      this.filteredEvents.sort((a, b) => new Date(a.dates.start).getTime() - new Date(b.dates.start).getTime());
    } else if (this.sort === 'date_desc') {
      this.filteredEvents.sort((a, b) => new Date(b.dates.start).getTime() - new Date(a.dates.start).getTime());
    }
    this.displayEventMarkers();
  }

  onDistanceChange() {
    if (this.distance === 'distance_asc') {
      this.filteredEvents.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    } else if (this.distance === 'distance_desc') {
      this.filteredEvents.sort((a, b) => (b.distance || 0) - (a.distance || 0));
    }
    this.displayEventMarkers();
  }
}