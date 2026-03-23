import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface BrandingInfo {
  app_name: string;
  has_logo: boolean;
  has_favicon: boolean;
}

@Injectable({ providedIn: 'root' })
export class BrandingService {
  appName = signal('Quiz Compétences IA');
  hasLogo = signal(false);
  hasFavicon = signal(false);
  logoUrl = signal('');
  faviconUrl = signal('');

  constructor(private http: HttpClient) {}

  load(): void {
    this.http.get<BrandingInfo>(`${environment.apiUrl}/branding`).subscribe({
      next: (info) => {
        if (info.app_name) {
          this.appName.set(info.app_name);
          document.title = info.app_name;
        }
        this.hasLogo.set(info.has_logo);
        this.hasFavicon.set(info.has_favicon);
        const base = environment.apiUrl;
        this.logoUrl.set(`${base}/admin/config/asset/logo?t=${Date.now()}`);
        this.faviconUrl.set(`${base}/admin/config/asset/favicon?t=${Date.now()}`);

        if (info.has_favicon) {
          const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
          if (link) {
            link.href = `${base}/admin/config/asset/favicon?t=${Date.now()}`;
          }
        }
      },
      error: () => {}, // silently fall back to defaults
    });
  }
}
