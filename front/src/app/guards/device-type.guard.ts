import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { DeviceDetectionService } from '@services/device-detection.service';

@Injectable({
  providedIn: 'root',
})
export class DeviceTypeGuard implements CanActivate {

  constructor(private deviceDetectionService: DeviceDetectionService, private router: Router) {}

  canActivate(): Observable<boolean> {
    return this.deviceDetectionService.isMobileOrTablet().pipe(
      map(isMobileOrTablet => {
        if (isMobileOrTablet) {
          this.router.navigateByUrl('/m/event-list');
        } else {
          this.router.navigateByUrl('/event-list');
        }
        return false;
      })
    );
  }
}