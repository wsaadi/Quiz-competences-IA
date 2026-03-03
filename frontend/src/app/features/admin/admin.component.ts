import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  AdminService,
  UserOut,
  GlobalStats,
} from '../../core/services/admin.service';
import { EvaluationDetail } from '../../core/services/evaluation.service';
import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { ScoreRadarComponent } from '../../shared/components/score-radar.component';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatToolbarModule,
    MatTabsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatExpansionModule,
    MatListModule,
    MatDividerModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    AvatarComponent,
    ScoreRadarComponent,
  ],
  template: `
    <div class="admin-layout">
      <mat-toolbar color="primary" class="toolbar">
        <app-avatar [size]="36" mood="neutral"></app-avatar>
        <span class="toolbar-title">Administration</span>
        <span class="spacer"></span>
        <button mat-icon-button (click)="logout()">
          <mat-icon>logout</mat-icon>
        </button>
      </mat-toolbar>

      <div class="content">
        <mat-tab-group animationDuration="200ms">
          <!-- Stats tab -->
          <mat-tab label="Statistiques">
            <ng-template matTabContent>
              <div class="tab-content" *ngIf="stats() as s">
                <div class="stats-grid">
                  <mat-card class="stat-card">
                    <div class="stat-value">{{ s.total_evaluations }}</div>
                    <div class="stat-label">Evaluations totales</div>
                  </mat-card>
                  <mat-card class="stat-card">
                    <div class="stat-value">{{ s.completed_evaluations }}</div>
                    <div class="stat-label">Terminées</div>
                  </mat-card>
                  <mat-card class="stat-card">
                    <div class="stat-value">{{ (s.average_score ?? 0) | number:'1.0-0' }}</div>
                    <div class="stat-label">Score moyen</div>
                  </mat-card>
                  <mat-card class="stat-card">
                    <div class="stat-value">{{ users().length }}</div>
                    <div class="stat-label">Utilisateurs</div>
                  </mat-card>
                </div>

                <!-- Score distribution -->
                <div class="charts-row">
                  <mat-card class="chart-card">
                    <mat-card-header>
                      <mat-card-title>Distribution des scores</mat-card-title>
                    </mat-card-header>
                    <mat-card-content>
                      <div class="distribution-bars">
                        <div
                          *ngFor="let item of scoreDistItems()"
                          class="dist-item"
                        >
                          <span class="dist-label">{{ item.label }}</span>
                          <div class="dist-bar-bg">
                            <div
                              class="dist-bar"
                              [style.width.%]="item.pct"
                              [style.background]="item.color"
                            ></div>
                          </div>
                          <span class="dist-count">{{ item.count }}</span>
                        </div>
                      </div>
                    </mat-card-content>
                  </mat-card>

                  <mat-card class="chart-card">
                    <mat-card-header>
                      <mat-card-title>Niveaux détectés</mat-card-title>
                    </mat-card-header>
                    <mat-card-content>
                      <div class="level-list">
                        <div *ngFor="let lvl of levelItems()" class="level-item">
                          <mat-chip highlighted>{{ lvl.label }}</mat-chip>
                          <span class="level-count">{{ lvl.count }} collaborateur(s)</span>
                        </div>
                      </div>
                    </mat-card-content>
                  </mat-card>
                </div>

                <!-- Domain averages -->
                <mat-card class="domain-avg-card">
                  <mat-card-header>
                    <mat-card-title>Moyennes par domaine</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <div class="domain-row" *ngFor="let d of domainAvgs()">
                      <span class="domain-name">{{ d.label }}</span>
                      <div class="domain-bar-bg">
                        <div
                          class="domain-bar"
                          [style.width.%]="d.score"
                          [style.background]="getScoreColor(d.score)"
                        ></div>
                      </div>
                      <span class="domain-score">{{ d.score | number:'1.0-0' }}/100</span>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
            </ng-template>
          </mat-tab>

          <!-- Evaluations tab -->
          <mat-tab label="Evaluations">
            <ng-template matTabContent>
              <div class="tab-content">
                <mat-accordion>
                  <mat-expansion-panel *ngFor="let ev of evaluations()">
                    <mat-expansion-panel-header>
                      <mat-panel-title>
                        {{ ev.user?.full_name || 'Utilisateur #' + ev.user_id }}
                      </mat-panel-title>
                      <mat-panel-description>
                        {{ ev.started_at | date:'dd/MM/yyyy HH:mm' }}
                        —
                        <mat-chip [class]="'status-' + ev.status" size="small">
                          {{ ev.status === 'completed' ? 'Terminée' : 'En cours' }}
                        </mat-chip>
                        <span *ngIf="ev.scores?.score_global != null" class="panel-score">
                          {{ ev.scores!.score_global | number:'1.0-0' }}/100
                        </span>
                      </mat-panel-description>
                    </mat-expansion-panel-header>

                    <ng-template matExpansionPanelContent>
                      <div class="eval-detail" *ngIf="ev.scores">
                        <div class="detail-grid">
                          <div class="detail-left">
                            <h4>Scores</h4>
                            <app-score-radar [scores]="ev.scores"></app-score-radar>

                            <div class="level-badge">
                              Niveau : <strong>{{ getLevelLabel(ev.detected_level) }}</strong>
                            </div>
                          </div>
                          <div class="detail-right">
                            <h4>Feedback Admin</h4>
                            <p class="admin-feedback">{{ ev.feedback_admin || 'Pas de feedback' }}</p>

                            <h4>Feedback Collaborateur</h4>
                            <p class="collab-feedback">{{ ev.feedback_collaborator || 'Pas de feedback' }}</p>
                          </div>
                        </div>

                        <button
                          mat-stroked-button
                          (click)="loadConversation(ev)"
                          *ngIf="!ev.messages?.length"
                        >
                          <mat-icon>chat</mat-icon> Voir la conversation
                        </button>

                        <div class="conversation" *ngIf="ev.messages?.length">
                          <h4>Conversation ({{ ev.messages.length }} messages)</h4>
                          <div
                            *ngFor="let msg of ev.messages"
                            class="conv-msg"
                            [class.conv-user]="msg.role === 'user'"
                            [class.conv-ai]="msg.role === 'assistant'"
                          >
                            <strong>{{ msg.role === 'user' ? 'Collaborateur' : 'Aria' }} :</strong>
                            {{ msg.content }}
                          </div>
                        </div>
                      </div>

                      <div class="eval-detail" *ngIf="!ev.scores">
                        <p>Evaluation en cours — pas encore de scores.</p>
                        <button
                          mat-stroked-button
                          (click)="loadConversation(ev)"
                          *ngIf="!ev.messages?.length"
                        >
                          <mat-icon>chat</mat-icon> Voir la conversation
                        </button>

                        <div class="conversation" *ngIf="ev.messages?.length">
                          <h4>Conversation ({{ ev.messages.length }} messages)</h4>
                          <div
                            *ngFor="let msg of ev.messages"
                            class="conv-msg"
                            [class.conv-user]="msg.role === 'user'"
                            [class.conv-ai]="msg.role === 'assistant'"
                          >
                            <strong>{{ msg.role === 'user' ? 'Collaborateur' : 'Aria' }} :</strong>
                            {{ msg.content }}
                          </div>
                        </div>
                      </div>
                    </ng-template>
                  </mat-expansion-panel>
                </mat-accordion>
              </div>
            </ng-template>
          </mat-tab>

          <!-- Users tab -->
          <mat-tab label="Utilisateurs">
            <ng-template matTabContent>
              <div class="tab-content">
                <mat-card class="new-user-card">
                  <mat-card-header>
                    <mat-card-title>Créer un utilisateur</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <form (ngSubmit)="createUser()" class="user-form">
                      <mat-form-field appearance="outline">
                        <mat-label>Nom complet</mat-label>
                        <input matInput [(ngModel)]="newUser.full_name" name="full_name" required />
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Username</mat-label>
                        <input matInput [(ngModel)]="newUser.username" name="username" required />
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Email</mat-label>
                        <input matInput [(ngModel)]="newUser.email" name="email" required type="email" />
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Mot de passe</mat-label>
                        <input matInput [(ngModel)]="newUser.password" name="password" required type="password" />
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Rôle</mat-label>
                        <mat-select [(ngModel)]="newUser.role" name="role">
                          <mat-option value="collaborator">Collaborateur</mat-option>
                          <mat-option value="admin">Administrateur</mat-option>
                        </mat-select>
                      </mat-form-field>
                      <button mat-raised-button color="primary" type="submit">
                        <mat-icon>person_add</mat-icon> Créer
                      </button>
                    </form>
                  </mat-card-content>
                </mat-card>

                <mat-card class="users-table-card">
                  <table mat-table [dataSource]="users()" class="full-width">
                    <ng-container matColumnDef="full_name">
                      <th mat-header-cell *matHeaderCellDef>Nom</th>
                      <td mat-cell *matCellDef="let u">{{ u.full_name }}</td>
                    </ng-container>
                    <ng-container matColumnDef="username">
                      <th mat-header-cell *matHeaderCellDef>Username</th>
                      <td mat-cell *matCellDef="let u">{{ u.username }}</td>
                    </ng-container>
                    <ng-container matColumnDef="email">
                      <th mat-header-cell *matHeaderCellDef>Email</th>
                      <td mat-cell *matCellDef="let u">{{ u.email }}</td>
                    </ng-container>
                    <ng-container matColumnDef="role">
                      <th mat-header-cell *matHeaderCellDef>Rôle</th>
                      <td mat-cell *matCellDef="let u">
                        <mat-chip [color]="u.role === 'admin' ? 'accent' : 'primary'" highlighted>
                          {{ u.role }}
                        </mat-chip>
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="status">
                      <th mat-header-cell *matHeaderCellDef>Statut</th>
                      <td mat-cell *matCellDef="let u">
                        {{ u.is_active ? 'Actif' : 'Désactivé' }}
                      </td>
                    </ng-container>
                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef></th>
                      <td mat-cell *matCellDef="let u">
                        <button
                          mat-icon-button
                          color="warn"
                          (click)="deactivateUser(u.id)"
                          *ngIf="u.is_active"
                        >
                          <mat-icon>block</mat-icon>
                        </button>
                      </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
                  </table>
                </mat-card>
              </div>
            </ng-template>
          </mat-tab>
        </mat-tab-group>
      </div>
    </div>
  `,
  styles: [`
    .admin-layout { min-height: 100vh; background: #f5f5f5; }
    .toolbar {
      gap: 12px;
      .toolbar-title { font-size: 18px; font-weight: 500; }
      .spacer { flex: 1; }
    }
    .content { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .tab-content { padding: 24px 0; }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      text-align: center;
      padding: 24px;
      .stat-value { font-size: 36px; font-weight: 700; color: #6C63FF; }
      .stat-label { color: #666; font-size: 13px; margin-top: 4px; }
    }

    .charts-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    .chart-card { padding: 16px; }

    .distribution-bars {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 0;
    }
    .dist-item { display: flex; align-items: center; gap: 10px; }
    .dist-label { width: 60px; font-size: 13px; color: #666; }
    .dist-bar-bg {
      flex: 1; height: 20px; background: #eee; border-radius: 10px; overflow: hidden;
    }
    .dist-bar { height: 100%; border-radius: 10px; transition: width 0.6s; }
    .dist-count { width: 30px; font-weight: 600; color: #333; }

    .level-list { padding: 16px 0; display: flex; flex-direction: column; gap: 12px; }
    .level-item { display: flex; align-items: center; gap: 12px; }
    .level-count { color: #666; font-size: 14px; }

    .domain-avg-card { padding: 16px; margin-bottom: 24px; }
    .domain-row {
      display: flex; align-items: center; gap: 12px; padding: 8px 0;
    }
    .domain-name { width: 200px; font-size: 13px; color: #555; flex-shrink: 0; }
    .domain-bar-bg {
      flex: 1; height: 10px; background: #eee; border-radius: 5px; overflow: hidden;
    }
    .domain-bar { height: 100%; border-radius: 5px; transition: width 1s ease; }
    .domain-score { width: 60px; text-align: right; font-size: 13px; font-weight: 500; }

    .eval-detail { padding: 16px 0; }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 16px; }
    .level-badge { text-align: center; margin-top: 16px; font-size: 15px; color: #555; }
    .admin-feedback { background: #fff3e0; padding: 12px; border-radius: 8px; line-height: 1.6; font-size: 14px; }
    .collab-feedback { background: #e8f5e9; padding: 12px; border-radius: 8px; line-height: 1.6; font-size: 14px; }
    .panel-score { margin-left: 12px; font-weight: 600; color: #6C63FF; }

    .conversation { margin-top: 16px; max-height: 400px; overflow-y: auto; }
    .conv-msg { padding: 8px 12px; margin: 4px 0; border-radius: 8px; font-size: 13px; line-height: 1.5; }
    .conv-user { background: #e3f2fd; }
    .conv-ai { background: #f3e5f5; }

    .new-user-card { margin-bottom: 16px; }
    .user-form {
      display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start;
      mat-form-field { flex: 1; min-width: 180px; }
      button { height: 56px; margin-top: 4px; }
    }
    .users-table-card { overflow-x: auto; }
    .full-width { width: 100%; }

    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .charts-row { grid-template-columns: 1fr; }
      .detail-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class AdminComponent implements OnInit {
  users = signal<UserOut[]>([]);
  evaluations = signal<EvaluationDetail[]>([]);
  stats = signal<GlobalStats | null>(null);

  displayedColumns = ['full_name', 'username', 'email', 'role', 'status', 'actions'];

  newUser = {
    full_name: '',
    username: '',
    email: '',
    password: '',
    role: 'collaborator',
  };

  // Cached computed values — avoids creating new arrays on every change detection cycle
  scoreDistItems = computed(() => {
    const s = this.stats();
    if (!s) return [];
    const total = Object.values(s.score_distribution).reduce((a, b) => a + b, 0) || 1;
    const colors: Record<string, string> = {
      '0-25': '#f44336', '26-50': '#FF5722', '51-75': '#FF9800', '76-100': '#4CAF50',
    };
    return Object.entries(s.score_distribution).map(([label, count]) => ({
      label,
      count,
      pct: (count / total) * 100,
      color: colors[label] || '#999',
    }));
  });

  levelItems = computed(() => {
    const s = this.stats();
    if (!s) return [];
    const labelMap: Record<string, string> = {
      debutant: 'Débutant',
      intermediaire: 'Intermédiaire',
      avance: 'Avancé',
      expert: 'Expert',
    };
    return Object.entries(s.level_distribution).map(([key, count]) => ({
      label: labelMap[key] || key,
      count,
    }));
  });

  domainAvgs = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return Object.entries(s.domain_averages).map(([label, score]) => ({
      label,
      score,
    }));
  });

  constructor(
    private adminService: AdminService,
    private authService: AuthService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.adminService.getUsers().subscribe((u) => this.users.set(u));
    this.adminService.getAllEvaluations().subscribe((e) => this.evaluations.set(e));
    this.adminService.getStats().subscribe((s) => this.stats.set(s));
  }

  createUser(): void {
    this.adminService.createUser(this.newUser).subscribe({
      next: () => {
        this.snackBar.open('Utilisateur créé !', 'OK', { duration: 3000 });
        this.newUser = { full_name: '', username: '', email: '', password: '', role: 'collaborator' };
        this.loadData();
      },
      error: (err) => {
        this.snackBar.open(err.error?.detail || 'Erreur', 'OK', { duration: 5000 });
      },
    });
  }

  deactivateUser(id: number): void {
    this.adminService.deactivateUser(id).subscribe(() => {
      this.snackBar.open('Utilisateur désactivé', 'OK', { duration: 3000 });
      this.loadData();
    });
  }

  loadConversation(ev: EvaluationDetail): void {
    this.adminService.getEvaluationDetail(ev.id).subscribe((detail) => {
      const idx = this.evaluations().findIndex((e) => e.id === ev.id);
      if (idx >= 0) {
        this.evaluations.update((list) => {
          const copy = [...list];
          copy[idx] = detail;
          return copy;
        });
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }

  getLevelLabel(level: string | null | undefined): string {
    const map: Record<string, string> = {
      debutant: 'Débutant',
      intermediaire: 'Intermédiaire',
      avance: 'Avancé',
      expert: 'Expert',
    };
    return level ? map[level] || level : 'N/A';
  }

  getScoreColor(score: number): string {
    if (score >= 75) return '#4CAF50';
    if (score >= 50) return '#FF9800';
    if (score >= 25) return '#FF5722';
    return '#f44336';
  }
}
