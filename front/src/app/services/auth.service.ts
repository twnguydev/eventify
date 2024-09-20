import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '@environments/environment';
import { IUser, IAuthCallbackResponse } from '@interfaces/user.interface';
import { tap, catchError } from 'rxjs/operators';
import { throwError, Observable, BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl: string = `${environment.apiUrl}/api/login`;

  user: IUser | null = null;
  tokenExpirationTimeout: any;

  authenticatedUser: BehaviorSubject<IUser | null> = new BehaviorSubject<IUser | null>(null);

  constructor(private http: HttpClient, private router: Router) {
    this.loadUserFromLocalStorage();
    this.checkTokenExpiration();
  }

  private loadUserFromLocalStorage(): void {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      this.user = JSON.parse(storedUser);
      this.authenticatedUser.next(this.user);
    }
  }

  updateCurrentUser(user: IUser): void {
    this.user = user;
    this.authenticatedUser.next(user);
    localStorage.setItem('currentUser', JSON.stringify(user));
  }

  handleAuthCallback(provider: 'google' | 'microsoft' | 'apple', code: string): Observable<IAuthCallbackResponse> {
    return this.http.post<IAuthCallbackResponse>(`${this.apiUrl}/${provider}/callback`, { code })
      .pipe(
        tap(response => {
          const { token, user } = response;
          localStorage.setItem('token', token);
          localStorage.setItem('currentUser', JSON.stringify(user));
          this.user = user;
          this.authenticatedUser.next(user);
          this.setTokenExpiration(token);
        }),
        catchError(error => {
          console.error('Error during OAuth callback', error);
          return throwError(error);
        })
      );
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token') && !!localStorage.getItem('currentUser');
  }

  redirectToLogin(): void {
    this.router.navigate(['/auth']);
  }

  logout(isTimeout: boolean = false): void {
    if (isTimeout) {
      this.performLogout();
    } else {
      console.log('Déconnexion annulée');
    }
  }

  getAuthHeaders(): HttpHeaders | null {
    const token = localStorage.getItem('token');
    return token ? new HttpHeaders({
      'Authorization': `Bearer ${token}`
    }) : null;
  }

  private performLogout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    this.user = null;
    this.authenticatedUser.next(null);
    clearTimeout(this.tokenExpirationTimeout);
    this.router.navigate(['/auth']);
  }

  private setTokenExpiration(token: string): void {
    const expirationDate = this.getTokenExpirationDate(token);
    if (expirationDate) {
      const now = new Date().getTime();
      const expirationTime = expirationDate.getTime() - now;

      if (expirationTime > 0) {
        this.tokenExpirationTimeout = setTimeout(() => {
          this.logout(true);
        }, expirationTime);
      } else {
        this.logout(true);
      }
    }
  }

  private getTokenExpirationDate(token: string): Date | null {
    try {
      const decoded = JSON.parse(atob(token.split('.')[1]));
      if (decoded.exp) {
        return new Date(decoded.exp * 1000);
      }
    } catch (error) {
      console.error('Error parsing token', error);
    }
    return null;
  }

  private checkTokenExpiration(): void {
    const token = localStorage.getItem('token');
    if (token) {
      this.setTokenExpiration(token);
    }
  }
}