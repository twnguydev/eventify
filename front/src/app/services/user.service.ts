import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { AuthService } from '@services/auth.service';
import { IUser, IUserResponse, IUserPseudoResponse, IUserUpdateResponse } from '@interfaces/user.interface';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl: string = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  getUser(): Observable<IUser> {
    const headers: any = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.get<IUser>(`${this.apiUrl}/user`, { headers });
  }

  getUserById(id: number): Observable<IUserResponse> {
    const headers: any = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.get<IUserResponse>(`${this.apiUrl}/user/${id}`, { headers });
  }

  updateUser(formData: FormData): Observable<IUserUpdateResponse> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.post<IUserUpdateResponse>(`${this.apiUrl}/user/me`, formData, { headers });
  }

  getUsers(query: string): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    const url = `${this.apiUrl}/all-users?q=${encodeURIComponent(query)}`;
    return this.http.get<any>(url, { headers });
  }

  retrieveParticipatedEvents(userId: number): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.get<any>(`${this.apiUrl}/${userId}/my-events`, { headers });
  }

  retrieveCreatedEvents(userId: number): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.get<any>(`${this.apiUrl}/${userId}/my-created-events`, { headers });
  }

  retrieveGroups(userId: number): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.get<any>(`${this.apiUrl}/${userId}/get-groups`, { headers });
  }
}