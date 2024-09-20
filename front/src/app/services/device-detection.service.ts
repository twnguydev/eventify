import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class DeviceDetectionService {
  isMobileOrTablet(): Observable<boolean> {
    const width = window.innerWidth;
    return of(width <= 1024);
  }
}