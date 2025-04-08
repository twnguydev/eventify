import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatDialog } from '@angular/material/dialog';
import * as L from 'leaflet';
import { NavbarComponent } from '@components/navbar/navbar.component';
import { ShareDialogComponent } from '@components/share-dialog/share-dialog.component';
import { IEvent } from '@interfaces/event.interface';
import { EventService } from '@services/event.service';
import { AuthService } from '@services/auth.service';
import { WeatherService } from '@services/weather.service';
import { GroupService } from '@services/group.service';

@Component({
  selector: 'app-event-details',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent
  ],
  templateUrl: './event-details.component.html',
  styleUrls: ['./event-details.component.css']
})
export class EventDetailsComponent implements OnInit {
  event: IEvent = {} as IEvent;
  weather: any = {};
  isLoading: boolean = true;
  slug: string = '';

  groups: any[] = [];
  restaurants: any[] = [];
  bars: any[] = [];

  map!: L.Map;
  locationMarker!: L.Marker;
  isImageModalOpen: boolean = false;
  currentImage: string = '';

  isUserOrganizer: boolean = false;

  constructor(
    private eventService: EventService,
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private weatherService: WeatherService,
    private groupService: GroupService,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadEventDetails();
  }

  loadEventDetails(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug') as string;
      this.slug = slug;
  
      this.eventService.getEventBySlug(slug).subscribe({
        next: (event) => {
          if (!event.event) {
            this.router.navigate(['/404']);
            return;
          }
          this.event = event.event;
          this.isUserOrganizer = this.event.creator ? this.authService.user?.id === this.event.creator.id : false;
          setTimeout(() => this.isLoading = false, 1000);
          this.initializeMap();
          this.loadEventMap();
          this.loadWeatherDetails();
          this.loadGroups();
          this.loadRestaurantsAndBarsDetails();
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 500) {
            this.router.navigate(['/404']);
          } else {
            console.error('Erreur lors du chargement des détails de l\'événement', error);
          }
          setTimeout(() => this.isLoading = false, 1000);
        }
      });
    });
  }

  joinGroup(group: any): void {
    if (this.isAlreadyParticipating(group)) {
      this.navigateToGroup(group);
      return;
    }
    
    const data = {
      user_id: this.authService.user?.id,
      group_id: group.id
    };
  
    this.groupService.participate(group.event_slug, data).subscribe({
      next: () => {
        this.navigateToGroup(group);
      },
      error: (error) => {
        console.error('Error while participating to group', error);
      }
    });
  }
  
  navigateToGroup(group: any): void {
    this.router.navigate([`/event/${this.slug}/group/${group.id}`]);
  }
  
  isAlreadyParticipating(group: any): boolean {
    return Array.isArray(group.participants) && group.participants.some((participant: any) => participant.id === this.authService.user?.id);
  }

  loadGroups(): void {
    this.groupService.getGroupsByEventSlug(this.event.slug).subscribe({
      next: (response) => {
        this.groups = response.groups;
        console.log('Groups', this.groups);
      },
      error: (error) => {
        console.error('Error while loading groups', error);
      }
    });
  }

  loadWeatherDetails(): void {
    this.weatherService.fetchWeather(this.event.location.coordinates[0], this.event.location.coordinates[1]).subscribe(weather => {
      this.weather = weather.forecast[0];
    });
  }

  isUrlExternal(url: string): boolean {
    if (!url) return false;
    return url.includes('openagenda.com');
  }

  getWeatherIcon(iconPath: string): string {
    return `https:${iconPath}`;
  }

  initializeMap(): void {
    if (document.getElementById('map')) {
      this.map = L.map('map', { zoomControl: false }).setView([46.603354, 1.888334], 5);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(this.map);
    }
  }

  loadEventMap(): void {
    if (this.event.location.coordinates) {
      this.updateMapMarker(this.event.location.coordinates);
    }
  }

  updateMapMarker(coords: number[]): void {
    if (this.locationMarker) {
      this.map.removeLayer(this.locationMarker);
    }

    const locationIcon = L.divIcon({
      html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" width="30" height="30">
              <path fill="black" d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/>
             </svg>`,
      className: '',
      iconSize: [30, 30]
    });

    this.locationMarker = L.marker([coords[0], coords[1]], { icon: locationIcon }).addTo(this.map);
    this.locationMarker.bindPopup(`
      <strong>${this.event.location.name}</strong><br><br>
      ${this.event.location.address}<br>
      ${this.event.location.city}
    `).openPopup();

    this.map.setView([coords[0], coords[1]], 13);
  }

  openMaps(lat: number, lon: number) {
    const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent);
    let mapUrl: string;
  
    if (isIOS) {
      mapUrl = `https://maps.apple.com/?daddr=${lat},${lon}`;
    } else {
      mapUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
    }
  
    window.open(mapUrl, '_blank');
  }   

  loadRestaurantsAndBarsDetails() {
    this.eventService.getRestaurantsAndBars(this.event.location.city, 10, 10).subscribe({
      next: (response) => {
        this.restaurants = response.restaurants;
        this.bars = response.bars;
        this.displayRestaurantsMarkers();
        this.displayBarsMarkers();
      },
      error: (error) => {
        console.error('Error while loading restaurants and bars', error);
      }
    });
  }

  displayRestaurantsMarkers(): void {
    const restaurantIcon = L.divIcon({
      html: `<svg xmlns="http://www.w3.org/1500/svg" viewBox="0 0 384 512" width="20" height="20">
              <path fill="blue" d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/>
             </svg>`,
      className: '',
      iconSize: [10, 10]
    });

    this.restaurants.forEach(restaurant => {
      const marker = L.marker([restaurant.coordinates.lat, restaurant.coordinates.lon], { icon: restaurantIcon }).addTo(this.map);
      marker.bindPopup(`
        <strong>${restaurant.name}</strong><br><br>
        Adresse du restaurant : ${restaurant.address}<br><br>
        Téléphone : ${restaurant.phone}<br>
        Horaires d'ouvertures : ${restaurant.opening_hours}<br><br>
        ${restaurant.website !== 'Site web non disponible' ? `<a href="${restaurant.website}" target="_blank">Réservation</a>` : 'Réservation non disponible'}
      `);
    });
  }

  displayBarsMarkers(): void {
    const barIcon = L.divIcon({
      html: `<svg xmlns="http://www.w3.org/1500/svg" viewBox="0 0 384 512" width="20" height="20">
              <path fill="red" d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/>
             </svg>`,
      className: '',
      iconSize: [10, 10]
    });

    this.bars.forEach(bar => {
      const marker = L.marker([bar.coordinates.lat, bar.coordinates.lon], { icon: barIcon }).addTo(this.map);
      marker.bindPopup(`
        <strong>${bar.name}</strong><br><br>
        Adresse du bar : ${bar.address}<br><br>
        Téléphone : ${bar.phone}<br>
        Horaires d'ouvertures : ${bar.opening_hours}<br><br>
        ${bar.website !== 'Site web non disponible' ? `<a href="${bar.website}" target="_blank">Réservation</a>` : 'Réservation non disponible'}
      `);
    });
  }

  shareEvent(): void {
    if (navigator.share) {
      navigator.share({
        title: 'J\'ai trouvé un événement intéressant !',
        text: `Découvrez cet événement sur Eventify : ${this.event.title}`,
        url: window.location.href
      }).then(() => {
        console.log('Partage réussi');
      }).catch((error) => {
        console.error('Erreur lors du partage', error);
      });
    } else {
      this.copyToClipboard(window.location.href);
      this.dialog.open(ShareDialogComponent, {
        data: { message: "L'URL de l'événement a été copiée dans le presse-papiers." }
      });
    }
  }

  copyToClipboard(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  formatImageUrl(image: string): string {
    if (image.includes('http')) {
      return image;
    } else {
      return `http://localhost:8000/storage/${image}`;
    }
  }

  openImageModal(imageUrl: string): void {
    this.currentImage = imageUrl;
    this.isImageModalOpen = true;
  }

  closeImageModal(): void {
    this.isImageModalOpen = false;
  }

  formatDates(dates: { start: Date; end: Date }): string {
    const start = new Date(dates.start);
    const end = new Date(dates.end);
    return `${start.toLocaleDateString()} ${start.toLocaleTimeString()} - ${end.toLocaleDateString()} ${end.toLocaleTimeString()}`;
  }
}