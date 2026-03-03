import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  role: string;
  username: string;
  full_name: string;
}

export interface UserSession {
  token: string;
  role: string;
  username: string;
  fullName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly STORAGE_KEY = 'quiz_ia_session';
  private session = signal<UserSession | null>(this.loadSession());

  currentUser = computed(() => this.session());
  isLoggedIn = computed(() => !!this.session());
  isAdmin = computed(() => this.session()?.role === 'admin');

  constructor(private http: HttpClient, private router: Router) {}

  login(credentials: LoginRequest): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${environment.apiUrl}/auth/login`, credentials)
      .pipe(
        tap((res) => {
          const session: UserSession = {
            token: res.access_token,
            role: res.role,
            username: res.username,
            fullName: res.full_name,
          };
          sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
          this.session.set(session);
        })
      );
  }

  logout(): void {
    sessionStorage.removeItem(this.STORAGE_KEY);
    this.session.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return this.session()?.token ?? null;
  }

  private loadSession(): UserSession | null {
    const raw = sessionStorage.getItem(this.STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
