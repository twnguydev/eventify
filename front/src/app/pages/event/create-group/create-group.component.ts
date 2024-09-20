import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router, ActivatedRoute } from '@angular/router';
import { FormGroup, FormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { NavbarComponent } from '@components/navbar/navbar.component';
import { EventService } from '@services/event.service';
import { GroupService } from '@services/group.service';
import { UserService } from '@services/user.service';
import { AuthService } from '@services/auth.service';
import { WeatherService } from '@services/weather.service';
import { IEvent } from '@interfaces/event.interface';

@Component({
  selector: 'app-create-group',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    ReactiveFormsModule
  ],
  templateUrl: './create-group.component.html',
  styleUrls: ['./create-group.component.css']
})
export class CreateGroupComponent implements OnInit {
  today: Date = new Date();
  slug: string = '';
  isLoading: boolean = true;
  event: IEvent = {} as IEvent;
  groupForm: FormGroup;
  map!: L.Map;
  locationMarker!: L.Marker;
  weather: any = {};

  allUsers: any[] = [];
  filteredUsers: any[] = [];
  selectedUsers: any[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private eventService: EventService,
    private userService: UserService,
    private weatherService: WeatherService,
    private authService: AuthService,
    private groupService: GroupService
  ) {
    this.groupForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(5)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      visibility: ['public', Validators.required],
      userSearch: ['']
    });
  }

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
          setTimeout(() => this.isLoading = false, 1000);
          this.initializeMap();
          this.loadEventMap();
          this.loadWeatherDetails();
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

  onUserSearch() {
    const query = this.groupForm.get('userSearch')?.value || '';
  
    if (query !== '') {
      this.userService.getUsers(query).subscribe((users: any) => {
        this.filteredUsers = users.filter((user: any) => {
          const isAlreadySelected = this.selectedUsers.some((selectedUser: any) => selectedUser === user);
          const isCurrentUser = user === this.authService.user?.pseudo;

          return !isAlreadySelected && !isCurrentUser;
        });
      });
    } else {
      this.filteredUsers = [];
    }
  }

  selectUser(user: any) {
    this.selectedUsers.push(user);
    this.allUsers = [];
    this.filteredUsers = [];
    this.groupForm.get('userSearch')?.setValue('');
  }

  removeUser(user: any) {
    this.selectedUsers = this.selectedUsers.filter((u: any) => u !== user);
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

  createGroup() {
    if (this.groupForm.valid && this.authService.user && this.authService.user.id) {
      const formValues = this.groupForm.value;

      let data = {
        user_id: this.authService.user.id,
        title: formValues.name,
        description: formValues.description,
        visibility: formValues.visibility,
        participants: [] as any[],
        slug: this.slug
      }

      if (this.selectedUsers.length > 0) {
        data = {
          ...data,
          participants: this.selectedUsers.map(user => user) as any[],
          slug: this.slug
        };
      }

      this.groupService.createGroup(this.slug, data).subscribe(
        (response) => {
          this.router.navigate([`/event/${this.slug}`]);
        },
        (error) => {
          console.error('Erreur lors de la création du groupe', error);
        }
      );
    } else {
      console.log('Formulaire invalide');
      console.table('Valeurs: ', this.groupForm.value);
    }
  }

  cancelGroupCreation() {
    this.router.navigate([`/event/${this.slug}`]);
  }
}