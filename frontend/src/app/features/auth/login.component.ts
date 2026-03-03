import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    AvatarComponent,
  ],
  template: `
    <div class="login-container">
      <mat-card class="login-card">
        <div class="avatar-section">
          <app-avatar [size]="100" [mood]="avatarMood()" label="Aria"></app-avatar>
          <h1>Quiz Compétences IA</h1>
          <p class="subtitle">Évalue tes compétences en Intelligence Artificielle</p>
        </div>

        <mat-card-content>
          <form (ngSubmit)="onLogin()" class="login-form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nom d'utilisateur</mat-label>
              <input
                matInput
                [(ngModel)]="username"
                name="username"
                required
                autocomplete="username"
              />
              <mat-icon matPrefix>person</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Mot de passe</mat-label>
              <input
                matInput
                [type]="hidePassword() ? 'password' : 'text'"
                [(ngModel)]="password"
                name="password"
                required
                autocomplete="current-password"
              />
              <mat-icon matPrefix>lock</mat-icon>
              <button
                mat-icon-button
                matSuffix
                type="button"
                (click)="hidePassword.set(!hidePassword())"
              >
                <mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
            </mat-form-field>

            <div class="error-message" *ngIf="error()">
              {{ error() }}
            </div>

            <button
              mat-raised-button
              color="primary"
              type="submit"
              class="full-width login-btn"
              [disabled]="loading()"
            >
              <mat-spinner *ngIf="loading()" diameter="20"></mat-spinner>
              <span *ngIf="!loading()">Se connecter</span>
            </button>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }

    .login-card {
      width: 100%;
      max-width: 420px;
      padding: 40px 32px;
      border-radius: 16px;
    }

    .avatar-section {
      text-align: center;
      margin-bottom: 24px;
    }

    .avatar-section h1 {
      margin: 16px 0 4px;
      font-size: 24px;
      color: #333;
    }

    .subtitle {
      color: #666;
      font-size: 14px;
      margin: 0;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .full-width { width: 100%; }

    .login-btn {
      height: 48px;
      font-size: 16px;
      margin-top: 8px;
      border-radius: 8px;
    }

    .error-message {
      color: #f44336;
      font-size: 13px;
      text-align: center;
      padding: 8px;
      background: #ffeaea;
      border-radius: 8px;
      margin-bottom: 8px;
    }
  `],
})
export class LoginComponent {
  username = '';
  password = '';
  hidePassword = signal(true);
  loading = signal(false);
  error = signal('');
  avatarMood = signal<'neutral' | 'happy' | 'thinking'>('neutral');

  constructor(private authService: AuthService, private router: Router) {}

  onLogin(): void {
    if (!this.username || !this.password) {
      this.error.set('Remplis tous les champs !');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.avatarMood.set('thinking');

    this.authService.login({ username: this.username, password: this.password }).subscribe({
      next: (res) => {
        this.avatarMood.set('happy');
        setTimeout(() => {
          this.loading.set(false);
          if (res.role === 'admin') {
            this.router.navigate(['/admin']);
          } else {
            this.router.navigate(['/dashboard']);
          }
        }, 500);
      },
      error: (err) => {
        this.loading.set(false);
        this.avatarMood.set('neutral');
        const detail = err.error?.detail;
        this.error.set(typeof detail === 'string' ? detail : 'Erreur de connexion');
      },
    });
  }
}
