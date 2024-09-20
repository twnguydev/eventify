import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { AuthService } from '@services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private apiUrl: string = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  send(slug: string, groupId: string, data: any): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.post<any>(`${this.apiUrl}/event/${slug}/send-message/${groupId}`, data, { headers });
  }
}