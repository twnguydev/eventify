import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { AuthService } from '@services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  private apiUrl: string = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  createGroup(slug: string, data: any): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.post<any>(`${this.apiUrl}/event/${slug}/create-group`, data, { headers });
  }

  updateGroup(slug: string, groupId: string, data: any): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.patch<any>(`${this.apiUrl}/event/${slug}/update-group/${groupId}`, data, { headers });
  }

  addParticipants(slug: string, groupId: string, data: any): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.post<any>(`${this.apiUrl}/event/${slug}/add-participant/${groupId}`, data, { headers });
  }

  removeParticipants(slug: string, groupId: string, data: any): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.post<any>(`${this.apiUrl}/event/${slug}/remove-participant/${groupId}`, data, { headers });
  }

  participate(slug: string, data: any): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.post<any>(`${this.apiUrl}/event/${slug}/participate`, data, { headers });
  }

  unparticipate(slug: string, data: any): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.post<any>(`${this.apiUrl}/event/${slug}/unparticipate`, data, { headers });
  }

  getParticipantsByGroup(slug: string, groupId: string): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.get<any>(`${this.apiUrl}/event/${slug}/groups/${groupId}/participants`, { headers });
  }

  getGroupById(slug: string, groupId: string): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.get<any>(`${this.apiUrl}/event/${slug}/group/${groupId}`, { headers });
  }

  getGroupsByEventSlug(slug: string): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.get<any>(`${this.apiUrl}/event/${slug}/groups`, { headers });
  }

  deleteGroup(slug: string, groupId: string, data: any): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.post<any>(`${this.apiUrl}/event/${slug}/delete/${groupId}`, data, { headers });
  }
}