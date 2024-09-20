import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { UserService } from '@services/user.service';
import { AuthService } from '@services/auth.service';
import { EditProfileDialogComponent } from '@components/edit-profile-dialog/edit-profile-dialog.component';
import { NavbarComponent } from '@components/navbar/navbar.component';
import { IUser, IUserResponse } from '@interfaces/user.interface';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.css']
})
export class ProfileComponent implements OnInit {
  today: Date = new Date();
  user: IUser = {} as IUser;
  userId: number = 0;
  events: any[] = [];
  isOwner: boolean = false;
  isUserNewUser: boolean = false;

  constructor(
    private authService: AuthService, 
    private userService: UserService, 
    public dialog: MatDialog, 
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const userId = params.get('id') ? parseInt(params.get('id') as string) : null;
      if (userId) {
        this.userId = userId;
        this.loadUserData(userId);
        this.loadUserEvents();
      }
    });
  }

  private loadUserData(userId: number): void {
    this.userService.getUserById(userId).pipe(
      catchError(error => {
        console.error('User not found', error);
        this.router.navigate(['/404']);
        return of(null);
      })
    ).subscribe(user => {
      if (user) {
        if (user.user === null) {
          this.router.navigate(['/404']);
          return;
        }
        this.user = user.user;
        this.checkIfOwner(userId);
        this.checkIfNewUser();
      }
    });
  }

  loadUserEvents(): void {
    if (!this.authService.isAuthenticated() || !this.authService.user || !this.authService.user.id) return;

    this.userService.retrieveCreatedEvents(this.userId).subscribe({
      next: (response) => {
        this.events = response.events;
  
        this.events.forEach(event => {
          event.start = new Date(event.start);
          event.end = new Date(event.end);
          event.timeAgo = event.end < this.today ? '0' : '1';
          event.countParticipants = event.participants.length;
          event.role = event.creator.id === this.userId ? 'Organisateur' : 'Participant';
          event.type = 'Événement';
        });
  
        this.sortEventsBySortDate();
      },
      error: (err) => console.error('Error loading created events', err)
    });

    this.userService.retrieveGroups(this.userId).subscribe({
      next: (response) => {
        const participatedEvents = response.groups.map((group: any) => {
          group.countParticipants = group.participants.length;
          group.role = group.is_creator === 1 ? 'Organisateur' : 'Participant';
          group.slug = `${group.event_slug}/group/${group.id}`;
          group.type = 'Groupe';
          return group;
        });

        this.events = [...this.events, ...participatedEvents];
        this.sortEventsBySortDate();
      },
      error: (err) => console.error('Error loading participated events', err)
    });
  }

  sortEventsBySortDate(): void {
    this.events.sort((a, b) => {
      const dateA = a.start ? a.start.getTime() : new Date(a.created_at).getTime();
      const dateB = b.start ? b.start.getTime() : new Date(b.created_at).getTime();
  
      return dateA - dateB;
    });
  }

  private checkIfOwner(userId: number): void {
    const currentUser = this.authService.authenticatedUser.getValue();
    this.isOwner = currentUser && currentUser.id === userId ? true : false;
  }

  private checkIfNewUser(): void {
    const currentDate = new Date();
    const createdAt = new Date(this.user.created_at ?? '');
    const monthsDifference = (currentDate.getFullYear() - createdAt.getFullYear()) * 12 + (currentDate.getMonth() - createdAt.getMonth());
    this.isUserNewUser = monthsDifference < 2;
  }

  openEditDialog(): void {
    if (!this.isOwner || !this.user) return;
  
    const dialogRef = this.dialog.open(EditProfileDialogComponent, {
      width: '500px',
      data: { user: this.user }
    });
  
    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.user = result.user;
        this.authService.updateCurrentUser(result.user);
      }
    });
  }

  triggerFileInput(): void {
    if (!this.isOwner) return;
    const fileInput = document.querySelector<HTMLInputElement>('#fileInput');
    fileInput?.click();
  }

  onFileSelected(event: any): void {
    if (!this.isOwner || !this.user) return;
    const file = event.target.files[0];
    if (file) {
      const formData = new FormData();
      formData.append('avatar', file);
      formData.append('name', this.user.name || '');
      formData.append('pseudo', this.user.pseudo || '');
      formData.append('bio', this.user.bio || '');

      this.userService.updateUser(formData).subscribe({
        next: (response) => {
          if (response) {
            this.user = response.user;
            this.authService.updateCurrentUser(response.user);
          }
        },
        error: (err) => console.error('Error updating profile', err)
      });
    }
  }

  openCreateEventDialog() {
    this.router.navigate(['/events/create']);
  }

  logout(): void {
    this.authService.logout(true);
  }
}