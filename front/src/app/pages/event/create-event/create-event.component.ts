import { Component, OnInit } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import * as L from 'leaflet';
import { NavbarComponent } from '@components/navbar/navbar.component';
import { UserService } from '@services/user.service';
import { EventService } from '@services/event.service';
import { AuthService } from '@services/auth.service';
import { IEvent, ILocation } from '@interfaces/event.interface';

@Component({
  selector: 'app-create-event',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    HttpClientModule,
    ReactiveFormsModule
  ],
  templateUrl: './create-event.component.html',
  styleUrls: ['./create-event.component.css']
})
export class CreateEventComponent implements OnInit {
  today: Date = new Date();

  events: any[] = [];

  eventForm: FormGroup;
  map!: L.Map;
  locationMarker!: L.Marker;
  locationName: string = '';
  image: string = '';
  locationData: ILocation | null = null;
  selectedImage!: File;

  allUsers: any[] = [];
  filteredUsers: any[] = [];
  selectedUsers: any[] = [];

  isListOpen: boolean = false;

  private locationInput$ = new Subject<string>();

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private eventService: EventService,
    private userService: UserService,
    private authService: AuthService
  ) {
    this.eventForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(5)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      image: [''],
      start: ['', [Validators.required]],
      end: ['', [Validators.required]],
      locationName: ['', [Validators.required]],
      street: [''],
      city: [''],
      country: ['', Validators.required],
      postalcode: ['', [Validators.required, Validators.minLength(5)]],
      userSearch: ['']
    });
  }

  ngOnInit(): void {
    this.loadUserEvents();
    this.initializeMap();

    this.locationInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((location: string) => this.getCoordinatesFromLocation(location))
    ).subscribe((data: any) => {
      if (data && data.length > 0) {
        const firstResult = data[0];
        this.locationData = {
          name: this.locationName !== '' ? this.locationName : firstResult.display_name,
          address: firstResult.display_name,
          city: firstResult.address.city || firstResult.address.town || firstResult.address.village || '',
          coordinates: [parseFloat(firstResult.lat), parseFloat(firstResult.lon)]
        };

        this.updateMapMarker(this.locationData.coordinates);
      }
    });
  }

  loadUserEvents(): void {
    if (!this.authService.isAuthenticated() || !this.authService.user || !this.authService.user.id) return;

    this.userService.retrieveCreatedEvents(this.authService.user.id).subscribe({
      next: (response) => {
        this.events = response.events;
  
        this.events.forEach(event => {
          event.start = new Date(event.start);
          event.end = new Date(event.end);
          event.timeAgo = event.end < this.today ? '0' : '1';
          event.countParticipants = event.participants.length;
          event.role = event.creator.id === this.authService.user?.id ? 'Organisateur' : 'Participant';
        });
  
        this.sortEventsByStartDate();
      },
      error: (err) => console.error('Error loading created events', err)
    });
  }

  sortEventsByStartDate(): void {
    this.events.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  initializeMap() {
    this.map = L.map('map', { zoomControl: false }).setView([46.603354, 1.888334], 5);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);
  }

  onLocationInput() {
    const formValues = this.eventForm.value;
    const { street, city, country, postalcode } = formValues;

    const location = {
      street: street || '',
      city: city || '',
      country: country || '',
      postalcode: postalcode || ''
    };

    this.locationInput$.next(this.buildQueryString(location));
  }

  onFileSelected(event: any): void {
    this.selectedImage = event.target.files[0];
  }

  onUserSearch() {
    const query = this.eventForm.get('userSearch')?.value || '';
    
    if (query !== '') {
      this.userService.getUsers(query).subscribe((users: any) => {
        this.allUsers = users;
        this.filteredUsers = users.filter((user: any) => !this.selectedUsers.some((u: any) => u === user));
      });
    } else {
      this.allUsers = [];
      this.filteredUsers = [];
    }
  }

  selectUser(user: any) {
    this.selectedUsers.push(user);
    this.allUsers = [];
    this.filteredUsers = [];
    this.eventForm.get('userSearch')?.setValue('');
  }

  removeUser(user: any) {
    this.selectedUsers = this.selectedUsers.filter((u: any) => u !== user);
  }

  onLocationNameInput() {
    this.locationName = this.eventForm.value.locationName;
    this.updateMapMarker(this.locationData?.coordinates || [46.603354, 1.888334]);
  }

  getCoordinatesFromLocation(queryString: string): Observable<any> {
    const url = `https://nominatim.openstreetmap.org/search?${queryString}&format=json&addressdetails=1`;
    return this.http.get<any[]>(url);
  }

  buildQueryString(location: { street: string; city: string; country: string; postalcode: string }): string {
    const queryParts = [];

    if (location.street) queryParts.push(`street=${encodeURIComponent(location.street)}`);
    if (location.city) queryParts.push(`city=${encodeURIComponent(location.city)}`);
    if (location.country) queryParts.push(`country=${encodeURIComponent(location.country)}`);
    if (location.postalcode) queryParts.push(`postalcode=${encodeURIComponent(location.postalcode)}`);

    return queryParts.join('&');
  }

  updateMapMarker(coords: number[]) {
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
    this.locationMarker.bindPopup(`<strong>${this.locationName === '' ? this.locationData?.name : this.locationName}</strong><br><br>${this.locationData?.address}<br>${this.locationData?.city}`).openPopup();

    this.map.setView([coords[0], coords[1]], 13);
  }

  toggleEventList() {
    this.isListOpen = !this.isListOpen;
  }

  private formatDateTime(dateTime: string): string {
    if (dateTime.length === 19) {
      return dateTime;
    }

    if (dateTime.length === 16) {
      return dateTime + ':00';
    }

    return dateTime;
  }

  createEvent() {
    if (this.eventForm.valid && this.selectedImage && this.locationData && this.authService.user && this.authService.user.id) {
      const formData = new FormData();
      const formValues = this.eventForm.value;

      const address = `${formValues.street || this.locationData.address}, ${formValues.postalcode || ''} ${formValues.city || this.locationData.city}, ${formValues.country || ''}`;

      formData.append('title', formValues.name);
      formData.append('description', formValues.description);
      formData.append('image', this.selectedImage);
      formData.append('start_date', this.formatDateTime(formValues.start));
      formData.append('end_date', this.formatDateTime(formValues.end));
      formData.append('id_creator', this.authService.user.id.toString() || '');
      formData.append('location_name', this.locationName === '' ? this.locationData.name : this.locationName);
      formData.append('address', address);
      formData.append('city', formValues.city || this.locationData.city);
      formData.append('location_coord_x', this.locationData?.coordinates[0].toString() ?? '');
      formData.append('location_coord_y', this.locationData?.coordinates[1].toString() ?? '');
      formData.append('visibility', 'public');

      this.eventService.createEvent(formData).subscribe(
        (response) => {
          this.router.navigate([`/profile/${this.authService.user?.id}`]);
        },
        (error) => {
          console.error('Erreur lors de la création de l\'événement', error);
        }
      );
    } else {
      console.table('Valeurs: ', this.eventForm.value);
    }
  }
}