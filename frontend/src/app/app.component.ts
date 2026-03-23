import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BrandingService } from './core/services/branding.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>',
  styles: [':host { display: block; }'],
})
export class AppComponent implements OnInit {
  private branding = inject(BrandingService);

  ngOnInit(): void {
    this.branding.load();
  }
}
