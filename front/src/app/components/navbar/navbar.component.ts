import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '@services/auth.service';
import { IUser } from '@interfaces/user.interface';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css']
})
export class NavbarComponent implements OnInit {
  @Input() activePage: string = '';
  
  isNavbarOpen: boolean = false;
  authenticatedUser: IUser | null = null;
  currentYear: number = new Date().getFullYear();

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.authenticatedUser = this.authService.user;
    }
  }

  toggleNavbar(): void {
    this.isNavbarOpen = !this.isNavbarOpen;

    if (this.isNavbarOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }

    const mobileMenu = document.querySelector('.fixed.inset-y-0.right-0');
    if (mobileMenu) {
      if (this.isNavbarOpen) {
        mobileMenu.classList.remove('translate-x-full');
        mobileMenu.classList.add('translate-x-0');
      } else {
        mobileMenu.classList.remove('translate-x-0');
        mobileMenu.classList.add('translate-x-full');
      }
    }
  }

  logout(): void {
    this.authService.logout(true);
  }
}