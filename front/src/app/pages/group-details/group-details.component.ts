import { Component, OnInit, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { MatDialog } from '@angular/material/dialog';
import { NavbarComponent } from '@components/navbar/navbar.component';
import { EditGroupDialogComponent } from '@components/edit-group-dialog/edit-group-dialog.component';
import { EventService } from '@services/event.service';
import { GroupService } from '@services/group.service';
import { UserService } from '@services/user.service';
import { AuthService } from '@services/auth.service';
import { MessageService } from '@services/message.service';
import { WeatherService } from '@services/weather.service';
import { IEvent } from '@interfaces/event.interface';


@Component({
  selector: 'app-group-details',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    ReactiveFormsModule,
    FormsModule
  ],
  templateUrl: './group-details.component.html',
  styleUrl: './group-details.component.css'
})
export class GroupDetailsComponent implements OnInit, AfterViewChecked {
  @ViewChild('messageContainer') private messageContainer: ElementRef<HTMLDivElement>;

  today: Date = new Date();
  slug: string = '';
  groupId: string = '';
  isLoading: boolean = true;
  group: any = {};
  event: IEvent = {} as IEvent;
  restaurants: any[] = [];
  bars: any[] = [];
  map!: L.Map;
  locationMarker!: L.Marker;
  weather: any = {};
  isUserOrganizer: boolean = false;
  userId: number = 0;
  userOrganizer: any = false;
  participants: any[] = [];
  message: string = '';
  messages: any[] = [];
  currentImage: string = '';
  isImageModalOpen: boolean = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private eventService: EventService,
    private weatherService: WeatherService,
    private authService: AuthService,
    private groupService: GroupService,
    private messageService: MessageService,
    public dialog: MatDialog,
    private elementRef: ElementRef
  ) {
    this.messageContainer = this.elementRef.nativeElement;
  }

  ngOnInit(): void {
    this.userId = this.authService.user?.id || 0;
    this.loadEventDetails();
    this.loadGroupDetails();

    if (!this.checkUserIsMember()) {
      this.router.navigate([`/event/${this.slug}`]);
    }
  }

  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  scrollToBottom() {
    try {
      this.messageContainer.nativeElement.scrollTop = this.messageContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }

  checkUserIsMember(): boolean {
    if (!this.authService.user) return false;
    if (!this.participants) return false;
    return this.participants.some(participant => participant.id === this.authService.user?.id) || this.isUserOrganizer;
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
          setTimeout(() => this.isLoading = false, 1000);
          this.initializeMap();
          this.loadEventMap();
          this.loadWeatherDetails();
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

  loadEventMap(): void {
    if (this.event.location.coordinates) {
      this.updateMapMarker(this.event.location.coordinates);
    }
  }

  updateMapMarker(coords: number[]): void {
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

  initializeMap(): void {
    if (document.getElementById('map') && this.event.location.coordinates) {
      const coordinates: L.LatLngExpression = [this.event.location.coordinates[0], this.event.location.coordinates[1]];
      this.map = L.map('map', { zoomControl: false }).setView(coordinates, 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.map);
    }
  }

  loadWeatherDetails(): void {
    if (this.event.location.coordinates) {
      this.weatherService.fetchWeather(this.event.location.coordinates[0], this.event.location.coordinates[1])
        .subscribe(weather => {
          this.weather = weather.forecast[0];
        });
    }
  }

  getWeatherIcon(iconPath: string): string {
    return `https:${iconPath}`;
  }

  isUrlExternal(url: string): boolean {
    if (!url) return false;
    return url.includes('openagenda.com');
  }

  formatImageUrl(image: string): string {
    if (typeof image !== 'string') return '';
    if (image.includes('http')) {
      return image;
    } else {
      return `http://localhost:8000/storage/${image}`;
    }
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

  loadGroupDetails(): void {
    this.route.paramMap.subscribe(params => {
      const groupId = params.get('groupId') as string;
      this.groupId = groupId;
  
      this.groupService.getGroupById(this.slug, groupId).subscribe({
        next: (group) => {
          if (!group) {
            this.router.navigate(['/404']);
            return;
          }
          this.group = group.group;
          this.participants = group.group.participants;
          this.isUserOrganizer = this.group.creator.id === this.userId;
          this.userOrganizer = this.group.creator;
          this.messages = group.room.messages;
          this.messages.sort((a, b) => new Date(a.posted_at).getTime() - new Date(b.posted_at).getTime());
          setTimeout(() => this.isLoading = false, 1000);

          console.log('Participants:', this.participants);
          console.log('Group:', this.group);
          console.log('Is user organizer:', this.isUserOrganizer);
          console.log('User organizer:', this.userOrganizer);
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 404) {
            this.router.navigate(['/404']);
          } else {
            console.error('Erreur lors du chargement des détails du groupe', error);
          }
          setTimeout(() => this.isLoading = false, 1000);
        }
      });
    });
  }

  unjoinGroup(): void {
    const data = {
      user_id: this.authService.user?.id,
      group_id: this.groupId
    };
  
    this.groupService.unparticipate(this.slug, data).subscribe({
      next: () => {
        this.router.navigate([`/event/${this.slug}`]);
      },
      error: (error) => {
        console.error('Error while participating to group', error);
      }
    });
  }

  openEditDialog(): void {
    if (!this.isUserOrganizer || !this.authService.isAuthenticated()) return;
  
    const dialogRef = this.dialog.open(EditGroupDialogComponent, {
      width: '500px',
      data: { group: this.group, slug: this.slug, groupId: this.groupId, userId: this.authService.user?.id, user: this.authService.user, participants: this.participants }
    });
  
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.group = result.group;
        this.loadGroupDetails();
      }
    });
  }

  onDeleteParticipant(participant: any): void {
    if (!this.isUserOrganizer) return;
    const data = {
      user_id: participant.id,
      group_id: this.groupId
    };

    this.groupService.unparticipate(this.slug, data).subscribe({
      next: () => {
        this.loadGroupDetails();
      },
      error: (error) => {
        console.error('Error while deleting participant', error);
      }
    });
  }

  onDeleteGroup(): void {
    if (!this.isUserOrganizer) return;
    
    const data = {
      user_id: this.authService.user?.id,
      group_id: this.groupId,
      event_slug: this.slug
    };

    this.groupService.deleteGroup(this.slug, this.groupId, data).subscribe({
      next: () => {
        this.router.navigate([`/event/${this.slug}`]);
      },
      error: (error) => {
        console.error('Error while deleting group', error);
      }
    });
  }

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && this.message.trim() !== '') {
      if (event.shiftKey) {
        event.preventDefault();
        this.message += '\n';
      } else {
        event.preventDefault();
        this.onSendMessage();
      }
    }
  }

  onSendMessage() {
    if (this.message.trim()) {
      const data = {
        user_id: this.authService.user?.id,
        event_slug: this.slug,
        message: this.message
      };

      this.messageService.send(this.slug, this.groupId, data).subscribe(response => {
        this.message = '';
        this.loadGroupDetails();
        this.scrollToBottom();
      }, error => {
        console.error('Error sending message:', error);
      });
    }
  }

  openImageModal(imageUrl: string): void {
    this.currentImage = imageUrl;
    this.isImageModalOpen = true;
  }

  closeImageModal(): void {
    this.isImageModalOpen = false;
  }
}
