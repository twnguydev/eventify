import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '@services/auth.service';
import { IUser } from '@interfaces/user.interface';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
})
export class NavbarComponent implements OnInit {
  @Input() activePage: string = 'accueil';

  isNavbarOpen: boolean = false;
  authenticatedUser: IUser | null = null;
  currentYear: number = new Date().getFullYear();
  safeAreaInsetTop = environment.safeAreaInsetTop;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.authenticatedUser = this.authService.user;
    }
  }

  toggleNavbar(): void {
    this.isNavbarOpen = !this.isNavbarOpen;
  }
}