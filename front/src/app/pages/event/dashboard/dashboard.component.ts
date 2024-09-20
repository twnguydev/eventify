import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import * as L from 'leaflet';
import { NavbarComponent } from '@components/navbar/navbar.component';
import { UserService } from '@services/user.service';
import { EventService } from '@services/event.service';
import { AuthService } from '@services/auth.service';
import { GroupService } from '@services/group.service';
import { IEvent, ILocation } from '@interfaces/event.interface';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    ReactiveFormsModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  today: Date = new Date();
  events: any[] = [];
  event: IEvent = {} as IEvent;
  slug: string = '';
  isLoading: boolean = true;
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
  participatedGroups: number = 0;
  amountGroups: number = 0;

  private locationInput$ = new Subject<string>();

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private eventService: EventService,
    private userService: UserService,
    private authService: AuthService,
    private groupService: GroupService,
    private route: ActivatedRoute
  ) {
    this.eventForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(5)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      image: [''],
      start: ['', [Validators.required]],
      end: ['', [Validators.required]],
      locationName: ['', [Validators.required]],
      street: ['', [Validators.required, Validators.minLength(5)]],
      city: ['', [Validators.required, Validators.minLength(3)]],
      country: ['', Validators.required],
      postalcode: ['', [Validators.required, Validators.minLength(5)]],
      userSearch: ['']
    });
  }

  ngOnInit(): void {
    this.loadEventDetails();
    this.loadUserEvents();

    this.locationInput$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap((location: string) => this.getCoordinatesFromLocation(location))
    ).subscribe((data: any) => {
      if (data && data.length > 0) {
        const firstResult = data[0];
        this.locationData = {
          name: this.locationName || firstResult.display_name,
          address: firstResult.display_name,
          city: firstResult.address.city || firstResult.address.town || firstResult.address.village || '',
          coordinates: [parseFloat(firstResult.lat), parseFloat(firstResult.lon)]
        };

        this.updateMapMarker(this.locationData.coordinates);
      }
    });
  }

  loadEventDetails(): void {
    this.route.paramMap.subscribe(params => {
      const slug = params.get('slug') as string;
      this.slug = slug;

      this.eventService.getEventBySlug(slug).subscribe({
        next: (event) => {
          this.event = event.event;

          if (this.authService.user?.id !== this.event.creator?.id) {
            this.router.navigate(['/404']);
            return;
          }

          console.log('Event details:', this.event);

          this.eventForm.patchValue({
            name: this.event.title,
            description: this.event.description,
            image: this.event.image,
            start: this.event.dates?.start,
            end: this.event.dates?.end,
            locationName: this.event.location?.name,
            street: this.event.location?.address.split(',')[0],
            city: this.event.location?.city,
            country: this.event.location?.address.split(',').slice(-1)[0],
            postalcode: this.event.location?.address.split(',')[1].split(' ')[1]
          });

          this.locationData = {
            name: this.event.location?.name,
            address: this.event.location?.address,
            city: this.event.location?.city,
            coordinates: this.event.location?.coordinates
          };

          this.locationName = this.event.location?.name;

          this.initializeMap();
          this.updateMapMarker(this.event.location.coordinates);
          this.countGroupsAndParticipants();

          setTimeout(() => this.isLoading = false, 1000);
        },
        error: (error: HttpErrorResponse) => {
          console.error('Erreur lors du chargement des détails de l\'événement', error);
          setTimeout(() => this.isLoading = false, 1000);
        }
      });
    });
  }

  loadUserEvents(): void {
    if (!this.authService.isAuthenticated() || !this.authService.user?.id) return;

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
    this.map = L.map('map', { zoomControl: false }).setView([this.event.location.coordinates[0], this.event.location.coordinates[1]], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);
  }

  onLocationInput() {
    const formValues = this.eventForm.value;
    const { street, city, country, postalcode } = formValues;

    const location = { street, city, country, postalcode };
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
        this.filteredUsers = users.filter((user: any) => !this.selectedUsers.includes(user));
      });
    } else {
      this.allUsers = [];
      this.filteredUsers = [];
    }
  }

  selectUser(user: any) {
    this.selectedUsers.push(user);
    this.filteredUsers = this.filteredUsers.filter((u: any) => u !== user);
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
    this.locationMarker.bindPopup(`<strong>${this.locationName || this.locationData?.name}</strong><br>${this.locationData?.address}<br>${this.locationData?.city}`).openPopup();
    this.map.setView([coords[0], coords[1]], 13);
  }

  toggleEventList() {
    this.isListOpen = !this.isListOpen;
  }

  private formatDateTime(dateTime: string): string {
    const date = new Date(dateTime);
    if (isNaN(date.getTime())) {
      console.error('Invalid date format:', dateTime);
      return '';
    }

    return date.toISOString().split('.')[0];
  }

  updateEvent() {
    if (this.eventForm.valid && this.authService.user?.id) {
      const formData = new FormData();
      const formValues = this.eventForm.value;

      formData.append('user_id', this.authService.user.id.toString());
      formData.append('title', formValues.name);
      formData.append('description', formValues.description);
      if (this.selectedImage) {
        formData.append('image', this.selectedImage);
      }
      formData.append('start_date', this.formatDateTime(formValues.start));
      formData.append('end_date', this.formatDateTime(formValues.end));
      formData.append('id_creator', this.authService.user.id.toString());
      formData.append('location_name', this.locationName);
      formData.append('address', `${formValues.street}, ${formValues.postalcode} ${formValues.city}, ${formValues.country}`);
      formData.append('city', formValues.city);
      formData.append('location_coord_x', this.locationData?.coordinates[0].toString() ?? '');
      formData.append('location_coord_y', this.locationData?.coordinates[1].toString() ?? '');

      formData.forEach((value, key) => console.log(key, value));

      this.eventService.updateEvent(this.slug, formData).subscribe(
        () => this.router.navigate([`/event/${this.slug}`]),
        (error) => console.error('Erreur lors de la création de l\'événement', error)
      );
    } else {
      console.log('Formulaire invalide ou données manquantes');
    }
  }

  deleteEvent(): void {
    if (this.authService.isAuthenticated() && this.authService.user?.id) {
      const data = { user_id: this.authService.user.id };

      this.eventService.deleteEvent(this.slug, data).subscribe({
        next: () => this.router.navigate([`/profile/${this.authService.user?.id}`]),
        error: (err) => console.error('Error deleting event', err)
      });
    }
  }

  countGroupsAndParticipants(): void {
    if (!this.authService.isAuthenticated() || !this.authService.user || !this.authService.user.id) return;

    this.groupService.getGroupsByEventSlug(this.slug).subscribe({
      next: (response) => {
        this.amountGroups = response.groups.length;
        this.participatedGroups = response.groups.map((group: any) => group.group.participants).flat().length;

        console.log('Groups:', response.groups);
      },
      error: (err) => console.error('Error loading groups', err)
    });
  }
}