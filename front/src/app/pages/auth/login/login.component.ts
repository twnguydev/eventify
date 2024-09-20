import { Component } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { environment } from '@environments/environment';
import { NavbarComponent } from '@components/navbar/navbar.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [HttpClientModule, NavbarComponent],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  constructor(private http: HttpClient) {}

  loginWithProvider(provider: 'google' | 'microsoft' | 'apple'): void {
    window.location.href = `${environment.apiUrl}/login/${provider}`;
  }
}