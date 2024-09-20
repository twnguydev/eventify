import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@services/auth.service';
import { IUser } from '@interfaces/user.interface';

@Component({
  selector: 'app-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './callback.component.html',
  styleUrls: ['./callback.component.css']
})
export class CallbackComponent implements OnInit {
  isLoading: boolean = true;
  user: IUser | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const code = params['code'];
      const provider: string | null = this.route.snapshot.paramMap.get('provider');

      if (provider !== 'google' && provider !== 'microsoft' && provider !== 'apple') {
        console.error('Fournisseur non pris en charge');
        this.isLoading = false;
        this.router.navigate(['/auth']);
        return;
      }

      if (code && provider) {
        this.authService.handleAuthCallback(provider, code).subscribe({
          next: () => {
            this.isLoading = false;
            this.router.navigate(['/']);
          },
          error: (err) => {
            console.error('Erreur lors de la récupération du token', err);
            this.isLoading = false;
          }
        });
      } else {
        console.error('Code ou fournisseur non fournis');
        this.isLoading = false;
      }
    });
  }
}