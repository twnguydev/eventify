import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { environment } from '@environments/environment';
import { AuthService } from '@services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  private apiUrl: string = `${environment.apiUrl}/api/weather`;

  constructor(private http: HttpClient, private authService: AuthService) {}

  fetchWeather(lat: number, lon: number): Observable<any> {
    const params: HttpParams = new HttpParams()
      .set('lat', lat.toString())
      .set('lon', lon.toString());

    const headers: any = this.authService.getAuthHeaders();
    if (!headers) return new Observable();

    return this.http.get<{ weather: any }>(this.apiUrl, { params, headers }).pipe(
      map(response => response.weather)
    );
  }
}