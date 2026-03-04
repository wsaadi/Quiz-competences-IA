import {
  Component,
  signal,
  computed,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EvaluationService } from '../../core/services/evaluation.service';
import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar.component';

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatToolbarModule,
    MatChipsModule,
    MatTooltipModule,
    AvatarComponent,
  ],
  template: `
    <div class="chat-layout">
      <!-- Sidebar -->
      <aside class="chat-sidebar">
        <div class="sidebar-header">
          <app-avatar [size]="70" [mood]="avatarMood()" label="Aria"></app-avatar>
          <h3>{{ userName() }}</h3>
        </div>

        <div class="progress-section">
          <div class="progress-label">
            <span>Progression</span>
            <span>{{ progress() }}%</span>
          </div>
          <mat-progress-bar
            mode="determinate"
            [value]="progress()"
            color="primary"
          ></mat-progress-bar>
        </div>

        <div class="phase-section">
          <div class="phase-label">Phase actuelle</div>
          <mat-chip-set>
            <mat-chip [highlighted]="true" color="primary">{{ phaseLabel() }}</mat-chip>
          </mat-chip-set>
        </div>

        <div class="info-section">
          <p><mat-icon>timer</mat-icon> ~30 min</p>
          <p><mat-icon>chat</mat-icon> {{ messages().length }} messages</p>
        </div>

        <button
          mat-stroked-button
          color="warn"
          class="end-btn"
          (click)="endEvaluation()"
          [disabled]="!evaluationId() || isComplete() || sending()"
          matTooltip="Terminer et obtenir les résultats"
        >
          <mat-icon>stop_circle</mat-icon>
          Terminer l'évaluation
        </button>
      </aside>

      <!-- Chat area -->
      <main class="chat-main">
        <div class="messages-container" #scrollContainer>
          <!-- Starting state -->
          <div class="start-screen" *ngIf="!evaluationId() && !starting() && !resuming()">
            <app-avatar [size]="120" mood="happy"></app-avatar>
            <h2>Prêt pour l'évaluation ?</h2>
            <p>
              Salut ! Je suis Aria, ton évaluatrice IA. On va discuter ensemble
              pendant environ 30 minutes pour évaluer tes compétences en IA.
              Pas de stress, c'est une conversation détendue !
            </p>
            <button mat-raised-button color="primary" (click)="startEvaluation()" class="start-btn">
              <mat-icon>play_arrow</mat-icon>
              C'est parti !
            </button>
          </div>

          <div class="loading-start" *ngIf="starting() || resuming()">
            <mat-spinner diameter="40"></mat-spinner>
            <p>{{ resuming() ? 'Reprise de la conversation...' : 'Aria se prépare...' }}</p>
          </div>

          <!-- Messages -->
          <div
            *ngFor="let msg of messages()"
            class="message"
            [class.user-msg]="msg.role === 'user'"
            [class.ai-msg]="msg.role === 'assistant'"
          >
            <app-avatar
              *ngIf="msg.role === 'assistant'"
              [size]="36"
              [mood]="avatarMood()"
              class="msg-avatar"
            ></app-avatar>
            <div class="msg-bubble">
              <div class="msg-content" [innerHTML]="formatMessage(msg.content)"></div>
              <div class="msg-time">{{ msg.timestamp | date:'HH:mm' }}</div>
            </div>
          </div>

          <!-- Typing indicator -->
          <div class="message ai-msg" *ngIf="sending()">
            <app-avatar [size]="36" mood="thinking" class="msg-avatar"></app-avatar>
            <div class="msg-bubble typing">
              <span class="dot"></span>
              <span class="dot"></span>
              <span class="dot"></span>
            </div>
          </div>

          <!-- Error banner with retry -->
          <div class="error-banner" *ngIf="errorMessage()">
            <mat-icon>warning</mat-icon>
            <span>{{ errorMessage() }}</span>
            <button mat-stroked-button (click)="retryLastMessage()">
              <mat-icon>refresh</mat-icon> Réessayer
            </button>
            <button mat-icon-button (click)="dismissError()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
        </div>

        <!-- Input area -->
        <div class="input-area" *ngIf="evaluationId() && !isComplete()">
          <mat-form-field appearance="outline" class="msg-input">
            <input
              matInput
              [(ngModel)]="userMessage"
              placeholder="Tape ta réponse ici..."
              (keydown.enter)="sendMessage()"
              [disabled]="sending()"
              autocomplete="off"
            />
          </mat-form-field>
          <button
            mat-fab
            color="primary"
            (click)="sendMessage()"
            [disabled]="sending() || !userMessage.trim()"
            class="send-btn"
          >
            <mat-icon>send</mat-icon>
          </button>
        </div>

        <!-- Completed banner -->
        <div class="completed-banner" *ngIf="isComplete()">
          <app-avatar [size]="50" mood="happy"></app-avatar>
          <div>
            <h3>Évaluation terminée !</h3>
            <p>Bravo ! Consulte tes résultats sur ton dashboard.</p>
          </div>
          <button mat-raised-button color="primary" (click)="goToDashboard()">
            Voir mes résultats
          </button>
        </div>
      </main>
    </div>
  `,
  styles: [`
    .chat-layout {
      display: flex;
      height: 100vh;
      background: #f5f5f5;
    }

    .chat-sidebar {
      width: 280px;
      background: white;
      border-right: 1px solid #e0e0e0;
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      gap: 24px;
    }

    .sidebar-header {
      text-align: center;
    }

    .sidebar-header h3 {
      margin: 8px 0 0;
      color: #333;
    }

    .progress-section {
      .progress-label {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 13px;
        color: #666;
      }
    }

    .phase-section {
      .phase-label {
        font-size: 12px;
        color: #999;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }

    .info-section {
      p {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #666;
        font-size: 14px;
        margin: 8px 0;
        mat-icon { font-size: 18px; width: 18px; height: 18px; color: #999; }
      }
    }

    .end-btn {
      margin-top: auto;
      width: 100%;
    }

    .chat-main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .start-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      text-align: center;
      max-width: 480px;
      margin: 0 auto;

      h2 { color: #333; margin: 16px 0 8px; }
      p { color: #666; line-height: 1.6; }
    }

    .start-btn { height: 48px; font-size: 16px; padding: 0 32px; margin-top: 16px; }

    .loading-start {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      gap: 16px;
      color: #666;
    }

    .message {
      display: flex;
      gap: 10px;
      max-width: 75%;
      animation: fadeIn 0.3s ease;
    }

    .user-msg {
      align-self: flex-end;
      flex-direction: row-reverse;
    }

    .msg-avatar { flex-shrink: 0; align-self: flex-end; }

    .msg-bubble {
      padding: 12px 16px;
      border-radius: 16px;
      line-height: 1.5;
      font-size: 14px;
    }

    .ai-msg .msg-bubble {
      background: white;
      border: 1px solid #e0e0e0;
      border-bottom-left-radius: 4px;
    }

    .user-msg .msg-bubble {
      background: #6C63FF;
      color: white;
      border-bottom-right-radius: 4px;
    }

    .msg-time {
      font-size: 11px;
      opacity: 0.6;
      margin-top: 4px;
    }

    .msg-content { white-space: pre-wrap; word-break: break-word; }

    .typing {
      display: flex;
      gap: 4px;
      padding: 16px 20px;
    }

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #999;
      animation: bounce 1.4s infinite both;
    }

    .dot:nth-child(2) { animation-delay: 0.16s; }
    .dot:nth-child(3) { animation-delay: 0.32s; }

    .error-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      background: #fff3e0;
      border: 1px solid #FFB74D;
      border-radius: 12px;
      color: #E65100;
      font-size: 13px;

      mat-icon:first-child { color: #FF9800; }
      span { flex: 1; }
      button { flex-shrink: 0; }
    }

    .input-area {
      display: flex;
      gap: 12px;
      padding: 16px 24px;
      background: white;
      border-top: 1px solid #e0e0e0;
      align-items: center;
    }

    .msg-input { flex: 1; margin-bottom: -20px; }

    .send-btn { flex-shrink: 0; }

    .completed-banner {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;

      h3 { margin: 0; }
      p { margin: 4px 0 0; font-size: 14px; opacity: 0.9; }

      button { margin-left: auto; }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes bounce {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
  `],
})
export class ChatComponent implements AfterViewChecked, OnInit {
  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  messages = signal<ChatMsg[]>([]);
  evaluationId = signal<number | null>(null);
  userMessage = '';
  sending = signal(false);
  starting = signal(false);
  resuming = signal(false);
  isComplete = signal(false);
  progress = signal(0);
  currentPhase = signal('ACCUEIL');
  avatarMood = signal<'neutral' | 'happy' | 'thinking' | 'encouraging'>('happy');
  errorMessage = signal<string | null>(null);

  private lastFailedMessage = '';

  userName = computed(() => this.authService.currentUser()?.fullName ?? 'Collaborateur');

  phaseLabel = computed(() => {
    const map: Record<string, string> = {
      ACCUEIL: 'Accueil',
      CALIBRAGE: 'Calibrage',
      EXPLORATION: 'Exploration',
      APPROFONDISSEMENT: 'Approfondissement',
      CONCLUSION: 'Conclusion',
      SCORING: 'Résultats',
    };
    return map[this.currentPhase()] || this.currentPhase();
  });

  private shouldScroll = false;

  constructor(
    private evaluationService: EvaluationService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Auto-resume any in-progress evaluation
    this.tryResumeExisting();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll) {
      this.scrollToBottom();
      this.shouldScroll = false;
    }
  }

  private tryResumeExisting(): void {
    this.resuming.set(true);
    this.evaluationService.getMyEvaluations().subscribe({
      next: (evals) => {
        const active = evals.find((e) => e.status === 'in_progress');
        if (active) {
          this.evaluationId.set(active.id);
          this.evaluationService.getMessages(active.id).subscribe({
            next: (msgs) => {
              this.resuming.set(false);
              if (msgs.length > 0) {
                this.messages.set(
                  msgs.map((m) => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                    timestamp: new Date(m.created_at),
                  }))
                );
                this.shouldScroll = true;
              }
            },
            error: () => this.resuming.set(false),
          });
        } else {
          this.resuming.set(false);
        }
      },
      error: () => this.resuming.set(false),
    });
  }

  startEvaluation(): void {
    this.starting.set(true);
    this.errorMessage.set(null);
    this.evaluationService.startEvaluation().subscribe({
      next: (res) => {
        this.starting.set(false);
        this.evaluationService.getMyEvaluations().subscribe((evals) => {
          const active = evals.find((e) => e.status === 'in_progress');
          if (active) {
            this.evaluationId.set(active.id);
          }
        });

        this.messages.update((m) => [
          ...m,
          { role: 'assistant', content: res.response, timestamp: new Date() },
        ]);
        this.progress.set(res.progress_percent);
        this.currentPhase.set(res.phase);
        this.avatarMood.set('happy');
        this.shouldScroll = true;
      },
      error: (err) => {
        this.starting.set(false);
        const detail = err.error?.detail;
        if (typeof detail === 'string' && detail.includes('déjà en cours')) {
          this.tryResumeExisting();
        } else {
          this.errorMessage.set('Impossible de démarrer l\'évaluation. Vérifie ta connexion.');
        }
      },
    });
  }

  sendMessage(): void {
    const text = this.userMessage.trim();
    if (!text || !this.evaluationId() || this.sending()) return;

    this.errorMessage.set(null);
    this.messages.update((m) => [
      ...m,
      { role: 'user', content: text, timestamp: new Date() },
    ]);
    this.userMessage = '';
    this.sending.set(true);
    this.avatarMood.set('thinking');
    this.shouldScroll = true;

    this.evaluationService.sendMessage(this.evaluationId()!, text).subscribe({
      next: (res) => {
        this.sending.set(false);
        this.lastFailedMessage = '';
        this.messages.update((m) => [
          ...m,
          { role: 'assistant', content: res.response, timestamp: new Date() },
        ]);
        this.progress.set(res.progress_percent);
        this.currentPhase.set(res.phase);
        this.isComplete.set(res.is_complete);
        this.avatarMood.set(res.is_complete ? 'happy' : 'encouraging');
        this.shouldScroll = true;
      },
      error: () => {
        this.sending.set(false);
        this.avatarMood.set('neutral');
        // Save failed message for retry and remove user bubble
        this.lastFailedMessage = text;
        this.messages.update((m) => m.slice(0, -1));
        this.errorMessage.set('Erreur de connexion. Clique sur Réessayer ou renvoie ton message.');
        this.shouldScroll = true;
      },
    });
  }

  retryLastMessage(): void {
    if (this.lastFailedMessage) {
      this.errorMessage.set(null);
      this.userMessage = this.lastFailedMessage;
      this.lastFailedMessage = '';
      this.sendMessage();
    }
  }

  dismissError(): void {
    this.errorMessage.set(null);
    if (this.lastFailedMessage) {
      this.userMessage = this.lastFailedMessage;
      this.lastFailedMessage = '';
    }
  }

  endEvaluation(): void {
    if (!this.evaluationId()) return;
    this.sending.set(true);
    this.avatarMood.set('thinking');

    this.evaluationService.completeEvaluation(this.evaluationId()!).subscribe({
      next: () => {
        this.sending.set(false);
        this.isComplete.set(true);
        this.progress.set(100);
        this.avatarMood.set('happy');
      },
      error: () => {
        this.sending.set(false);
        this.avatarMood.set('neutral');
        this.errorMessage.set('Impossible de terminer l\'évaluation. Réessaye.');
      },
    });
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  formatMessage(content: string): string {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  private scrollToBottom(): void {
    try {
      const el = this.scrollContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    } catch {}
  }
}
