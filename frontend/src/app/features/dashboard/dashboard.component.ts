import { Component, OnInit, signal, computed } from '@angular/core';
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
  ChatMessageRecord,
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

        <!-- Selected evaluation detail overlay -->
        <div class="eval-overlay" *ngIf="selectedEval()" (click)="closeDetail()">
          <div class="eval-detail-panel" (click)="$event.stopPropagation()">
            <div class="detail-header">
              <h2>Évaluation #{{ selectedEval()!.id }}</h2>
              <span class="detail-date">{{ selectedEval()!.started_at | date:'dd/MM/yyyy HH:mm' }}</span>
              <button mat-icon-button (click)="closeDetail()">
                <mat-icon>close</mat-icon>
              </button>
            </div>

            <div *ngIf="selectedEval()!.scores as scores" class="detail-scores-section">
              <div class="detail-score-header">
                <div class="detail-main-score" [style.color]="getScoreColor(scores.score_global || 0)">
                  {{ scores.score_global | number:'1.0-0' }}<small>/100</small>
                </div>
                <mat-chip [class]="'level-chip level-' + selectedEval()!.detected_level">
                  {{ getLevelLabel(selectedEval()!.detected_level) }}
                </mat-chip>
                <span class="detail-job" *ngIf="selectedEval()!.job_role">{{ selectedEval()!.job_role }}</span>
              </div>

              <app-score-radar [scores]="$any(scores)"></app-score-radar>

              <div class="detail-domains">
                <div class="domain-row" *ngFor="let d of getDomainScores(selectedEval()!)">
                  <span class="domain-name">{{ d.label }}</span>
                  <div class="domain-bar-bg">
                    <div class="domain-bar" [style.width.%]="d.score" [style.background]="getScoreColor(d.score)"></div>
                  </div>
                  <span class="domain-score">{{ d.score }}/100</span>
                </div>
              </div>
            </div>

            <!-- Feedback -->
            <div class="detail-feedback" *ngIf="selectedEval()!.feedback_collaborator">
              <h3><mat-icon>chat_bubble</mat-icon> Le mot d'Aria</h3>
              <div class="feedback-text" [innerHTML]="formatFeedback(selectedEval()!.feedback_collaborator!)"></div>
            </div>

            <!-- Conversation -->
            <div class="detail-conversation" *ngIf="selectedMessages().length > 0">
              <h3><mat-icon>forum</mat-icon> Conversation ({{ selectedMessages().length }} messages)</h3>
              <div class="conv-scroll">
                <div
                  *ngFor="let msg of selectedMessages()"
                  class="conv-msg"
                  [class.conv-user]="msg.role === 'user'"
                  [class.conv-ai]="msg.role === 'assistant'"
                >
                  <div class="conv-header">
                    <strong>{{ msg.role === 'user' ? userName : 'Aria' }}</strong>
                    <span class="conv-time">{{ msg.created_at | date:'HH:mm' }}</span>
                    <span class="conv-phase" *ngIf="msg.phase">{{ msg.phase }}</span>
                  </div>
                  <div class="conv-content">{{ msg.content }}</div>
                </div>
              </div>
            </div>

            <div class="loading-messages" *ngIf="loadingMessages()">
              <mat-icon>hourglass_top</mat-icon> Chargement de la conversation...
            </div>
          </div>
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
          <div class="history-list">
            <div
              *ngFor="let ev of evaluations()"
              class="history-item"
              [class.clickable]="ev.status === 'completed'"
              (click)="ev.status === 'completed' ? viewEvalDetail(ev) : null"
            >
              <div class="history-icon">
                <mat-icon [class]="'status-icon-' + ev.status">
                  {{ ev.status === 'completed' ? 'check_circle' : ev.status === 'in_progress' ? 'hourglass_top' : 'cancel' }}
                </mat-icon>
              </div>
              <div class="history-info">
                <div class="history-title">
                  Évaluation #{{ ev.id }} — {{ ev.started_at | date:'dd/MM/yyyy HH:mm' }}
                </div>
                <div class="history-meta">
                  <mat-chip [class]="'status-chip status-' + ev.status">
                    {{ ev.status === 'completed' ? 'Terminée' : ev.status === 'in_progress' ? 'En cours' : 'Abandonnée' }}
                  </mat-chip>
                  <span *ngIf="ev.scores?.score_global != null" class="history-score"
                        [style.color]="getScoreColor(ev.scores!.score_global || 0)">
                    Score: {{ ev.scores!.score_global | number:'1.0-0' }}/100
                  </span>
                  <mat-chip *ngIf="ev.detected_level" [class]="'level-chip level-' + ev.detected_level">
                    {{ getLevelLabel(ev.detected_level) }}
                  </mat-chip>
                </div>
              </div>
              <mat-icon *ngIf="ev.status === 'completed'" class="history-arrow">chevron_right</mat-icon>
            </div>
          </div>
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

    /* ── History ── */
    .history-section {
      margin-top: 24px;
    }
    .history-list {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }
    .history-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      border-bottom: 1px solid #f0f0f0;
      transition: background 0.15s;
      &:last-child { border-bottom: none; }
      &.clickable {
        cursor: pointer;
        &:hover { background: #f8f6ff; }
      }
    }
    .history-icon {
      flex-shrink: 0;
    }
    .status-icon-completed { color: #4CAF50; }
    .status-icon-in_progress { color: #FF9800; }
    .status-icon-abandoned { color: #999; }
    .history-info { flex: 1; min-width: 0; }
    .history-title {
      font-size: 15px;
      font-weight: 500;
      color: #333;
      margin-bottom: 6px;
    }
    .history-meta {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .status-chip {
      font-size: 11px !important;
      height: 24px !important;
      min-height: 24px !important;
    }
    .status-completed { background: #e8f5e9 !important; color: #2E7D32 !important; }
    .status-in_progress { background: #fff3e0 !important; color: #E65100 !important; }
    .status-abandoned { background: #f5f5f5 !important; color: #999 !important; }
    .history-score {
      font-weight: 600;
      font-size: 14px;
    }
    .level-chip {
      font-size: 11px !important;
      height: 24px !important;
      min-height: 24px !important;
    }
    .level-debutant { background: #ffebee !important; color: #c62828 !important; }
    .level-intermediaire { background: #fff3e0 !important; color: #E65100 !important; }
    .level-avance { background: #e8f5e9 !important; color: #2E7D32 !important; }
    .level-expert { background: #e3f2fd !important; color: #1565C0 !important; }
    .history-arrow { color: #ccc; }

    /* ── Evaluation Detail Overlay ── */
    .eval-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); z-index: 1000;
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
    }
    .eval-detail-panel {
      background: white; border-radius: 16px; max-width: 800px; width: 100%;
      max-height: 90vh; overflow-y: auto; padding: 28px;
    }
    .detail-header {
      display: flex; align-items: center; gap: 12px; margin-bottom: 20px;
      h2 { margin: 0; flex: 1; }
      .detail-date { color: #999; font-size: 13px; }
    }
    .detail-score-header {
      display: flex; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap;
    }
    .detail-main-score {
      font-size: 48px; font-weight: 700; line-height: 1;
      small { font-size: 18px; opacity: 0.6; }
    }
    .detail-job { color: #666; font-size: 14px; }
    .detail-domains { margin: 16px 0; }
    .detail-feedback {
      margin-top: 20px;
      h3 { display: flex; align-items: center; gap: 8px; color: #555; margin-bottom: 8px; font-size: 16px; }
      .feedback-text {
        background: #f8f6ff; padding: 16px; border-radius: 12px;
        font-size: 14px; line-height: 1.7; color: #444;
        ::ng-deep {
          strong { color: #6C63FF; }
          ul { margin: 6px 0; padding-left: 18px; }
          li { margin: 3px 0; }
        }
      }
    }
    .detail-conversation {
      margin-top: 20px;
      h3 { display: flex; align-items: center; gap: 8px; color: #555; margin-bottom: 12px; font-size: 16px; }
    }
    .conv-scroll { max-height: 400px; overflow-y: auto; }
    .conv-msg {
      padding: 10px 14px; margin: 6px 0; border-radius: 10px;
      font-size: 13px; line-height: 1.6;
    }
    .conv-user { background: #e3f2fd; }
    .conv-ai { background: #f3e5f5; }
    .conv-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 12px;
      strong { font-size: 13px; }
    }
    .conv-time { color: #999; font-size: 11px; }
    .conv-phase { font-size: 10px; background: rgba(0,0,0,0.08); padding: 2px 6px; border-radius: 4px; }
    .conv-content { white-space: pre-wrap; }
    .loading-messages {
      display: flex; align-items: center; gap: 8px; color: #999; padding: 20px;
      justify-content: center; font-size: 14px;
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

  // Evaluation detail view
  selectedEval = signal<Evaluation | null>(null);
  selectedMessages = signal<ChatMessageRecord[]>([]);
  loadingMessages = signal(false);

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
    const inProgress = this.evaluations().find((e) => e.status === 'in_progress');
    if (inProgress) {
      // Abandon the in-progress evaluation, then navigate to start fresh
      this.evalService.abandonEvaluation(inProgress.id).subscribe({
        next: () => this.router.navigate(['/evaluation']),
        error: () => this.router.navigate(['/evaluation']),
      });
    } else {
      this.router.navigate(['/evaluation']);
    }
  }

  viewEvalDetail(ev: Evaluation): void {
    this.selectedEval.set(ev);
    this.selectedMessages.set([]);
    this.loadingMessages.set(true);
    this.evalService.getMessages(ev.id).subscribe({
      next: (msgs) => {
        this.selectedMessages.set(msgs);
        this.loadingMessages.set(false);
      },
      error: () => this.loadingMessages.set(false),
    });
  }

  closeDetail(): void {
    this.selectedEval.set(null);
    this.selectedMessages.set([]);
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
    if (score >= 75) return '#2196F3';
    if (score >= 50) return '#4CAF50';
    if (score >= 25) return '#FF9800';
    return '#f44336';
  }

  formatFeedback(text: string): string {
    let html = text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>')
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
