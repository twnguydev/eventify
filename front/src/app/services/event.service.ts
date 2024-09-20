import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { AuthService } from '@services/auth.service';
import { IEventResponse, IEvent, IEventRequest } from '@interfaces/event.interface';

@Injectable({
  providedIn: 'root'
})
export class EventService {
  private apiUrl: string = `${environment.apiUrl}/api`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  getEvents(limit: number = 10, start: number = 0, sort: string | null = null, cityName: string | null = null, eventName: string | null = null): Observable<IEventResponse> {
    let params: HttpParams = new HttpParams()
      .set('limit', limit.toString())
      .set('start', start.toString());

    if (sort) {
      params = params.set('sort', sort);
    }
    if (cityName) {
      params = params.set('cityName', cityName);
    }
    if (eventName) {
      params = params.set('eventName', eventName);
    }

    return this.http.get<IEventResponse>(`${this.apiUrl}/events`, { params });
  }

  getRestaurantsAndBars(cityName: string | null = null, restaurantLimit: number = 10, barLimit: number = 10): Observable<any> {
    let params: HttpParams = new HttpParams()
      .set('restaurantLimit', restaurantLimit.toString())
      .set('barLimit', barLimit.toString());

    if (cityName) {
      params = params.set('cityName', cityName);
    }

    return this.http.get<any>(`${this.apiUrl}/restaurants-and-bars`, { params });
  }

  getEventById(id: number): Observable<IEventRequest> {
    const headers: any = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.get<IEventRequest>(`${this.apiUrl}/event/${id}`, { headers });
  }

  getEventBySlug(slug: string): Observable<IEventRequest> {
    const headers: any = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.get<IEventRequest>(`${this.apiUrl}/event-slug/${slug}`, { headers });
  }

  createEvent(formData: FormData): Observable<IEvent> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.post<IEvent>(`${this.apiUrl}/events`, formData, { headers });
  }

  deleteEvent(slug: string, data: any): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.post<any>(`${this.apiUrl}/event/${slug}/delete`, data, { headers });
  }

  updateEvent(slug: string, data: any): Observable<any> {
    const headers = this.authService.getAuthHeaders();
    if (!headers) return new Observable();
    return this.http.post<any>(`${this.apiUrl}/event/${slug}/update`, data, { headers });
  }
}