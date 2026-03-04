import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import {
  EvaluationService,
  Evaluation,
} from '../../core/services/evaluation.service';
import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { ScoreRadarComponent } from '../../shared/components/score-radar.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatToolbarModule,
    MatDividerModule,
    MatListModule,
    AvatarComponent,
    ScoreRadarComponent,
  ],
  template: `
    <div class="dashboard-layout">
      <mat-toolbar color="primary" class="toolbar">
        <app-avatar [size]="36" mood="happy"></app-avatar>
        <span class="toolbar-title">Mon Espace</span>
        <span class="spacer"></span>
        <span class="user-name">{{ userName }}</span>
        <button mat-icon-button (click)="logout()">
          <mat-icon>logout</mat-icon>
        </button>
      </mat-toolbar>

      <div class="content">
        <!-- Quick actions -->
        <div class="actions-row">
          <button
            *ngIf="hasInProgress()"
            mat-raised-button
            color="accent"
            (click)="resumeEvaluation()"
            class="action-btn resume-btn"
          >
            <mat-icon>play_arrow</mat-icon>
            Reprendre l'évaluation en cours
          </button>
          <button
            mat-raised-button
            color="primary"
            (click)="startNewEvaluation()"
            class="action-btn"
          >
            <mat-icon>play_circle</mat-icon>
            Nouvelle évaluation
          </button>
        </div>

        <!-- Latest evaluation results -->
        <div *ngIf="latestCompleted() as latest" class="results-section">
          <h2>Dernière évaluation</h2>
          <div class="results-grid">
            <mat-card class="score-card main-score">
              <div class="score-value">{{ latest.scores?.score_global | number:'1.0-0' }}</div>
              <div class="score-label">Score global</div>
              <mat-chip [color]="getLevelColor(latest.detected_level)" highlighted>
                {{ getLevelLabel(latest.detected_level) }}
              </mat-chip>
            </mat-card>

            <mat-card class="radar-card">
              <mat-card-header>
                <mat-card-title>Détail par domaine</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <app-score-radar [scores]="$any(latest.scores) || {}"></app-score-radar>
              </mat-card-content>
            </mat-card>
          </div>

          <!-- Domain scores list -->
          <mat-card class="domains-card">
            <mat-card-header>
              <mat-card-title>Scores par domaine</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="domain-row" *ngFor="let d of getDomainScores(latest)">
                <span class="domain-name">{{ d.label }}</span>
                <div class="domain-bar-bg">
                  <div
                    class="domain-bar"
                    [style.width.%]="d.score"
                    [style.background]="getScoreColor(d.score)"
                  ></div>
                </div>
                <span class="domain-score">{{ d.score }}/100</span>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Feedback -->
          <mat-card class="feedback-card" *ngIf="latest.feedback_collaborator">
            <mat-card-header>
              <mat-card-title>
                <mat-icon>chat_bubble</mat-icon>
                Le mot d'Aria
              </mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="feedback-text" [innerHTML]="formatFeedback(latest.feedback_collaborator!)"></div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- No evaluations state -->
        <div *ngIf="!latestCompleted() && loaded()" class="empty-state">
          <app-avatar [size]="100" mood="encouraging"></app-avatar>
          <h2>Pas encore d'évaluation</h2>
          <p>Lance ta première évaluation pour découvrir ton niveau en IA !</p>
        </div>

        <!-- History -->
        <div *ngIf="evaluations().length > 0" class="history-section">
          <h2>Historique</h2>
          <mat-card>
            <mat-list>
              <mat-list-item *ngFor="let ev of evaluations()">
                <mat-icon matListItemIcon>
                  {{ ev.status === 'completed' ? 'check_circle' : 'hourglass_top' }}
                </mat-icon>
                <div matListItemTitle>
                  Évaluation #{{ ev.id }} — {{ ev.started_at | date:'dd/MM/yyyy HH:mm' }}
                </div>
                <div matListItemLine>
                  <mat-chip [class]="'status-' + ev.status" size="small">
                    {{ ev.status === 'completed' ? 'Terminée' : ev.status === 'in_progress' ? 'En cours' : 'Abandonnée' }}
                  </mat-chip>
                  <span *ngIf="ev.scores?.score_global" class="history-score">
                    Score: {{ ev.scores!.score_global | number:'1.0-0' }}/100
                  </span>
                </div>
              </mat-list-item>
            </mat-list>
          </mat-card>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-layout { min-height: 100vh; background: #f5f5f5; }

    .toolbar {
      gap: 12px;
      .toolbar-title { font-size: 18px; font-weight: 500; }
      .spacer { flex: 1; }
      .user-name { font-size: 14px; opacity: 0.9; }
    }

    .content {
      max-width: 960px;
      margin: 0 auto;
      padding: 24px;
    }

    .actions-row {
      display: flex;
      gap: 12px;
      margin-bottom: 24px;
      flex-wrap: wrap;
      .action-btn { height: 48px; font-size: 15px; }
      .resume-btn { animation: pulse-resume 2s infinite; }
    }

    @keyframes pulse-resume {
      0%, 100% { box-shadow: 0 0 0 0 rgba(108, 99, 255, 0.4); }
      50% { box-shadow: 0 0 0 8px rgba(108, 99, 255, 0); }
    }

    .results-section h2, .history-section h2 {
      color: #333;
      margin-bottom: 16px;
    }

    .results-grid {
      display: grid;
      grid-template-columns: 200px 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }

    .score-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;

      .score-value {
        font-size: 56px;
        font-weight: 700;
        color: #6C63FF;
        line-height: 1;
      }
      .score-label {
        color: #666;
        margin: 8px 0 12px;
        font-size: 14px;
      }
    }

    .radar-card { padding: 16px; }

    .domains-card {
      margin-bottom: 16px;
      padding: 16px;
    }

    .domain-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 0;
    }

    .domain-name {
      width: 200px;
      font-size: 13px;
      color: #555;
      flex-shrink: 0;
    }

    .domain-bar-bg {
      flex: 1;
      height: 10px;
      background: #eee;
      border-radius: 5px;
      overflow: hidden;
    }

    .domain-bar {
      height: 100%;
      border-radius: 5px;
      transition: width 1s ease;
    }

    .domain-score {
      width: 60px;
      text-align: right;
      font-size: 13px;
      font-weight: 500;
      color: #333;
    }

    .feedback-card {
      margin-bottom: 24px;
      mat-card-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 16px;
      }
      .feedback-text {
        font-size: 15px;
        line-height: 1.8;
        color: #444;

        ::ng-deep {
          strong { color: #6C63FF; font-weight: 600; }
          em { font-style: italic; }
          ul, ol {
            margin: 8px 0;
            padding-left: 20px;
          }
          li {
            margin: 4px 0;
            line-height: 1.6;
          }
          p { margin: 8px 0; }
        }
      }
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 60px 20px;
      text-align: center;
      h2 { color: #333; }
      p { color: #666; }
    }

    .history-section {
      margin-top: 24px;
    }

    .history-score {
      margin-left: 12px;
      font-weight: 500;
      color: #6C63FF;
    }

    @media (max-width: 768px) {
      .results-grid { grid-template-columns: 1fr; }
      .domain-name { width: 120px; }
    }
  `],
})
export class DashboardComponent implements OnInit {
  evaluations = signal<Evaluation[]>([]);
  latestCompleted = signal<Evaluation | null>(null);
  hasInProgress = signal(false);
  loaded = signal(false);
  userName = '';

  constructor(
    private evalService: EvaluationService,
    private authService: AuthService,
    private router: Router
  ) {
    this.userName = this.authService.currentUser()?.fullName ?? '';
  }

  ngOnInit(): void {
    this.evalService.getMyEvaluations().subscribe((evals) => {
      this.evaluations.set(evals);
      const completed = evals.find((e) => e.status === 'completed');
      if (completed) this.latestCompleted.set(completed);
      this.hasInProgress.set(evals.some((e) => e.status === 'in_progress'));
      this.loaded.set(true);
    });
  }

  resumeEvaluation(): void {
    this.router.navigate(['/evaluation']);
  }

  startNewEvaluation(): void {
    this.router.navigate(['/evaluation']);
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
    return level ? map[level] || level : '';
  }

  getLevelColor(level: string | null | undefined): string {
    return 'primary';
  }

  getScoreColor(score: number): string {
    if (score >= 75) return '#4CAF50';
    if (score >= 50) return '#FF9800';
    if (score >= 25) return '#FF5722';
    return '#f44336';
  }

  formatFeedback(text: string): string {
    let html = text
      // Bold: **text**
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic: *text*
      .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
      // List items starting with - at the beginning of a line
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      // Wrap consecutive <li> in <ul>
      .replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>')
      // Line breaks (but not inside lists)
      .replace(/\n(?!<)/g, '<br>');
    return html;
  }

  getDomainScores(ev: Evaluation): { label: string; score: number }[] {
    const s = ev.scores;
    if (!s) return [];
    return [
      { label: 'Connaissance du marché', score: s.score_market_knowledge ?? 0 },
      { label: 'Terminologie', score: s.score_terminology ?? 0 },
      { label: 'Intérêt & curiosité', score: s.score_interest_curiosity ?? 0 },
      { label: 'Veille personnelle', score: s.score_personal_watch ?? 0 },
      { label: 'Niveau technique', score: s.score_technical_level ?? 0 },
      { label: 'Utilisation IA', score: s.score_ai_usage ?? 0 },
      { label: 'Intégration & déploiement', score: s.score_integration_deployment ?? 0 },
      { label: 'Conception & dev', score: s.score_conception_dev ?? 0 },
    ];
  }
}
