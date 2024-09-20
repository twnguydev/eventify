import { Component } from '@angular/core';
import { NavbarComponent } from '@components/navbar/navbar.component';

@Component({
  selector: 'app-legal-mentions',
  standalone: true,
  imports: [
    NavbarComponent
  ],
  templateUrl: './legal-mentions.component.html',
  styleUrl: './legal-mentions.component.css'
})
export class LegalMentionsComponent {

}
