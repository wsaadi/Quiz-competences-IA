import {
  Component,
  signal,
  computed,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  OnInit,
  OnDestroy,
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

        <div class="tts-toggle" *ngIf="ttsSupported">
          <button
            mat-stroked-button
            (click)="toggleAutoTTS()"
            [class.active]="autoTTS()"
            class="auto-tts-btn"
          >
            <mat-icon>{{ autoTTS() ? 'record_voice_over' : 'voice_over_off' }}</mat-icon>
            {{ autoTTS() ? 'Lecture auto ON' : 'Lecture auto OFF' }}
          </button>
        </div>

        <button
          mat-stroked-button
          class="pause-btn"
          (click)="pauseEvaluation()"
          [disabled]="!evaluationId() || isComplete() || sending()"
          matTooltip="Quitter et reprendre plus tard"
        >
          <mat-icon>pause_circle</mat-icon>
          Quitter (reprendre plus tard)
        </button>

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
              <div class="msg-footer">
                <span class="msg-time">{{ msg.timestamp | date:'HH:mm' }}</span>
                <button
                  *ngIf="msg.role === 'assistant'"
                  mat-icon-button
                  class="tts-btn"
                  (click)="speakMessage(msg.content)"
                  [matTooltip]="isSpeaking() ? 'Arrêter la lecture' : 'Écouter'"
                >
                  <mat-icon>{{ isSpeaking() ? 'volume_off' : 'volume_up' }}</mat-icon>
                </button>
              </div>
            </div>
          </div>

          <!-- Streaming response (displayed progressively) -->
          <div class="message ai-msg" *ngIf="streamingResponse()">
            <app-avatar [size]="36" mood="thinking" class="msg-avatar"></app-avatar>
            <div class="msg-bubble">
              <div class="msg-content" [innerHTML]="formatMessage(streamingResponse())"></div>
            </div>
          </div>

          <!-- Typing indicator (only when sending and no streaming text yet) -->
          <div class="message ai-msg" *ngIf="sending() && !streamingResponse()">
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
          <button
            mat-icon-button
            (click)="toggleRecording()"
            [class.recording]="isRecording()"
            [class.transcribing]="isTranscribing()"
            [disabled]="sending() || isTranscribing() || !speechSupported"
            class="mic-btn"
            [matTooltip]="isTranscribing() ? 'Transcription...' : isRecording() ? 'Arrêter la dictée' : 'Dicter (micro)'"
          >
            <mat-icon>{{ isTranscribing() ? 'hourglass_top' : isRecording() ? 'mic_off' : 'mic' }}</mat-icon>
          </button>
          <mat-form-field appearance="outline" class="msg-input">
            <input
              matInput
              [(ngModel)]="userMessage"
              [placeholder]="isTranscribing() ? 'Transcription en cours...' : isRecording() ? 'Dictée en cours...' : 'Tape ta réponse ici...'"
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

    .pause-btn {
      width: 100%;
      font-size: 12px;
      margin-top: auto;
    }

    .end-btn {
      width: 100%;
      margin-top: 8px;
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

    .msg-footer {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
    }

    .msg-time {
      font-size: 11px;
      opacity: 0.6;
    }

    .tts-btn {
      width: 24px;
      height: 24px;
      line-height: 24px;
      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        opacity: 0.5;
      }
      &:hover mat-icon { opacity: 1; }
    }

    .msg-content { white-space: pre-wrap; word-break: break-word; }

    .mic-btn {
      flex-shrink: 0;
      transition: all 0.3s;
      &.recording {
        color: #f44336;
        animation: pulse-mic 1.5s infinite;
      }
      &.transcribing {
        color: #FF9800;
      }
    }

    .tts-toggle { margin-bottom: 8px; }
    .auto-tts-btn {
      width: 100%;
      font-size: 12px;
      &.active { color: #6C63FF; border-color: #6C63FF; }
    }

    @keyframes pulse-mic {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }

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
export class ChatComponent implements AfterViewChecked, OnInit, OnDestroy {
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

  // Speech features
  isRecording = signal(false);
  isTranscribing = signal(false);
  isSpeaking = signal(false);
  autoTTS = signal(false);
  speechSupported = false;
  ttsSupported = true;
  private recognition: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private ttsAbortController: AbortController | null = null;

  // Real-time ElevenLabs STT WebSocket
  private sttWebSocket: WebSocket | null = null;
  private sttAudioContext: AudioContext | null = null;
  private sttProcessor: ScriptProcessorNode | null = null;
  private sttStream: MediaStream | null = null;
  private sttCommittedText = '';  // Accumulated committed transcript

  // Streaming response displayed progressively in the UI
  streamingResponse = signal('');

  // TTS sentence queue for streaming pipeline
  private ttsSentenceQueue: string[] = [];
  private ttsPlaying = false;
  private streamAbortController: AbortController | null = null;

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
  ) {
    if (navigator.mediaDevices && typeof MediaRecorder !== 'undefined') {
      this.speechSupported = true;
    }
  }

  ngOnInit(): void {
    this.tryResumeExisting();
  }

  ngOnDestroy(): void {
    this.stopSpeaking();
    this.stopRecordingCleanup();
    this.cleanupRealtimeSTT();
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
        this.autoSpeakIfEnabled(res.response);
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

  /**
   * Send message using streaming SSE endpoint.
   * Mistral streams text sentence-by-sentence → each sentence is immediately
   * sent to ElevenLabs TTS for parallel audio playback.
   * Falls back to non-streaming endpoint on error.
   */
  sendMessage(): void {
    const text = this.userMessage.trim();
    if (!text || !this.evaluationId() || this.sending()) return;

    this.stopRecordingCleanup();
    this.errorMessage.set(null);
    this.messages.update((m) => [
      ...m,
      { role: 'user', content: text, timestamp: new Date() },
    ]);
    this.userMessage = '';
    this.sending.set(true);
    this.avatarMood.set('thinking');
    this.shouldScroll = true;

    // Always use streaming for progressive display; fallback to classic on error
    this.sendMessageStreaming(text);
  }

  /** Streaming path: SSE for text + parallel TTS per sentence */
  private async sendMessageStreaming(text: string): Promise<void> {
    const { token } = this.evaluationService.getTTSStreamInfo();
    const url = `${this.evaluationService.getApiUrl()}/evaluations/${this.evaluationId()}/chat-stream`;
    this.streamAbortController = new AbortController();
    this.ttsSentenceQueue = [];
    this.ttsPlaying = false;
    this.streamingResponse.set('');
    let fullResponse = '';

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text }),
        signal: this.streamAbortController.signal,
      });

      if (!response.ok || !response.body) {
        if (response.status === 401) {
          this.authService.logout();
          return;
        }
        throw new Error(`Stream failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ') && eventType) {
            const data = line.slice(6);
            try {
              const parsed = JSON.parse(data);

              if (eventType === 'sentence') {
                // Display sentence progressively + optionally queue for TTS
                const sentenceText = parsed.text;
                if (sentenceText) {
                  fullResponse += (fullResponse ? ' ' : '') + sentenceText;
                  this.streamingResponse.set(fullResponse);
                  this.shouldScroll = true;
                  if (this.autoTTS()) {
                    this.enqueueTTSSentence(sentenceText);
                  }
                }
              } else if (eventType === 'done') {
                const finalResponse = parsed.response || fullResponse;
                this.streamingResponse.set('');
                this.sending.set(false);
                this.lastFailedMessage = '';
                this.messages.update((m) => [
                  ...m,
                  { role: 'assistant', content: finalResponse, timestamp: new Date() },
                ]);
                this.progress.set(parsed.progress_percent || 50);
                this.currentPhase.set(parsed.phase || 'EXPLORATION');
                this.isComplete.set(parsed.is_complete || false);
                this.avatarMood.set(parsed.is_complete ? 'happy' : 'encouraging');
                this.shouldScroll = true;
              }
            } catch {
              // Skip malformed JSON
            }
            eventType = '';
          }
        }
      }
    } catch (err: any) {
      this.streamingResponse.set('');
      if (err?.name === 'AbortError') return;
      // Fallback to classic non-streaming endpoint
      this.sendMessageClassic(text);
    }
  }

  /** Classic non-streaming path (fallback) */
  private sendMessageClassic(text: string): void {
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
        this.autoSpeakIfEnabled(res.response);
      },
      error: () => {
        this.sending.set(false);
        this.avatarMood.set('neutral');
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

  pauseEvaluation(): void {
    this.stopSpeaking();
    this.stopRecordingCleanup();
    this.router.navigate(['/dashboard']);
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

  // ── Speech-to-Text (manual stop via mic button) ──

  toggleRecording(): void {
    if (this.isRecording()) {
      this.stopRecording();
    } else {
      this.startRecording();
    }
  }

  private async startRecording(): Promise<void> {
    if (!navigator.mediaDevices) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.sttStream = stream;
      this.audioChunks = [];
      this.sttCommittedText = '';
      this.userMessage = '';
      this.isRecording.set(true);

      // Start MediaRecorder as backup (for non-realtime fallback)
      this.mediaRecorder = new MediaRecorder(stream, { mimeType: this.getRecordingMimeType() });
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) this.audioChunks.push(event.data);
      };
      this.mediaRecorder.start(250);

      // Try to start ElevenLabs realtime STT WebSocket
      await this.startRealtimeSTT(stream);
    } catch {
      // Mic access denied or error
      this.isRecording.set(false);
    }
  }

  /**
   * Connect to ElevenLabs Realtime STT via WebSocket.
   * Streams 16kHz mono PCM audio chunks and receives partial/committed
   * transcripts displayed in the input field as the user speaks.
   */
  private async startRealtimeSTT(stream: MediaStream): Promise<void> {
    try {
      // Get a single-use token from our backend
      const { token: authToken } = this.evaluationService.getTTSStreamInfo();
      const tokenRes = await fetch(`${this.evaluationService.getApiUrl()}/tts/stt-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
      });

      if (!tokenRes.ok) return; // Fallback to batch transcription on stop

      const { token: sttToken } = await tokenRes.json();
      if (!sttToken) return;

      // Connect WebSocket to ElevenLabs realtime STT
      const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?token=${sttToken}&language_code=fra&model_id=scribe_v2_realtime&sample_rate=16000&encoding=pcm_s16le`;
      this.sttWebSocket = new WebSocket(wsUrl);

      this.sttWebSocket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.message_type === 'partial_transcript' && msg.text) {
            // Show committed text + live partial
            this.userMessage = (this.sttCommittedText + ' ' + msg.text).trim();
          } else if (msg.message_type === 'committed_transcript' && msg.text) {
            this.sttCommittedText = (this.sttCommittedText + ' ' + msg.text).trim();
            this.userMessage = this.sttCommittedText;
          }
        } catch {}
      };

      this.sttWebSocket.onerror = () => {
        this.cleanupRealtimeSTT();
      };

      // Wait for WebSocket to open before streaming audio
      await new Promise<void>((resolve, reject) => {
        this.sttWebSocket!.onopen = () => resolve();
        this.sttWebSocket!.onerror = () => reject();
        setTimeout(() => reject(), 5000);
      });

      // Set up AudioContext to capture 16kHz mono PCM and send via WebSocket
      this.sttAudioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.sttAudioContext.createMediaStreamSource(stream);
      // ScriptProcessorNode with 4096 buffer, 1 input channel, 1 output channel
      this.sttProcessor = this.sttAudioContext.createScriptProcessor(4096, 1, 1);

      this.sttProcessor.onaudioprocess = (e) => {
        if (!this.sttWebSocket || this.sttWebSocket.readyState !== WebSocket.OPEN) return;

        const float32 = e.inputBuffer.getChannelData(0);
        // Convert Float32 [-1,1] to Int16 PCM
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        // Base64 encode the PCM data
        const bytes = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        this.sttWebSocket!.send(JSON.stringify({
          message_type: 'input_audio_chunk',
          audio_base_64: base64,
        }));
      };

      source.connect(this.sttProcessor);
      this.sttProcessor.connect(this.sttAudioContext.destination);
    } catch {
      // WebSocket setup failed — will fall back to batch transcription
      this.cleanupRealtimeSTT();
    }
  }

  private cleanupRealtimeSTT(): void {
    if (this.sttProcessor) {
      this.sttProcessor.disconnect();
      this.sttProcessor = null;
    }
    if (this.sttAudioContext) {
      this.sttAudioContext.close().catch(() => {});
      this.sttAudioContext = null;
    }
    if (this.sttWebSocket) {
      if (this.sttWebSocket.readyState === WebSocket.OPEN) {
        this.sttWebSocket.close();
      }
      this.sttWebSocket = null;
    }
  }

  private stopRecording(): void {
    const hadRealtimeSTT = !!this.sttWebSocket;
    this.cleanupRealtimeSTT();
    this.isRecording.set(false);

    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      // If realtime STT produced text, use it immediately (skip batch transcription)
      if (hadRealtimeSTT && this.userMessage.trim()) {
        this.mediaRecorder.stop();
        this.sttStream?.getTracks().forEach((t) => t.stop());
        this.sttStream = null;
        this.sendMessage();
      } else {
        // Fallback: batch transcribe via ElevenLabs Scribe
        this.mediaRecorder.onstop = () => {
          this.sttStream?.getTracks().forEach((t) => t.stop());
          this.sttStream = null;
          const audioBlob = new Blob(this.audioChunks, { type: this.getRecordingMimeType() });
          if (audioBlob.size > 0) {
            this.transcribeAndAutoSend(audioBlob);
          }
        };
        this.mediaRecorder.stop();
      }
    }
  }

  private stopRecordingCleanup(): void {
    if (this.isRecording()) {
      this.cleanupRealtimeSTT();
      this.isRecording.set(false);
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
      this.sttStream?.getTracks().forEach((t) => t.stop());
      this.sttStream = null;
    }
  }

  private getRecordingMimeType(): string {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
    if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm';
    if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
    return 'audio/webm';
  }

  /**
   * Transcribe audio via ElevenLabs Scribe, then automatically send the
   * transcribed text as a chat message for maximum reactivity.
   */
  private transcribeAndAutoSend(audioBlob: Blob): void {
    this.isTranscribing.set(true);
    const mimeType = this.getRecordingMimeType();
    const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
    this.evaluationService.transcribeAudio(audioBlob, `audio.${ext}`).subscribe({
      next: (result) => {
        this.isTranscribing.set(false);
        if (result.text && result.text.trim()) {
          this.userMessage = this.userMessage
            ? this.userMessage + ' ' + result.text.trim()
            : result.text.trim();
          // Auto-send: if currently sending, wait for it to finish then send
          if (this.sending()) {
            const waitAndSend = setInterval(() => {
              if (!this.sending()) {
                clearInterval(waitAndSend);
                this.sendMessage();
              }
            }, 200);
          } else {
            this.sendMessage();
          }
        }
      },
      error: () => {
        this.isTranscribing.set(false);
        this.errorMessage.set('Erreur de transcription. Réessaie ou tape ton message.');
      },
    });
  }

  // ── TTS Sentence Queue (streaming pipeline: Mistral → sentence → ElevenLabs) ──

  /**
   * Queue a sentence for TTS playback. Sentences are played in order,
   * each one starting ElevenLabs streaming as soon as the previous finishes.
   */
  private enqueueTTSSentence(sentence: string): void {
    this.ttsSentenceQueue.push(sentence);
    if (!this.ttsPlaying) {
      this.playNextSentence();
    }
  }

  private async playNextSentence(): Promise<void> {
    if (this.ttsSentenceQueue.length === 0) {
      this.ttsPlaying = false;
      this.isSpeaking.set(false);
      return;
    }

    this.ttsPlaying = true;
    this.isSpeaking.set(true);
    const sentence = this.ttsSentenceQueue.shift()!;

    try {
      await this.speakWithStreaming(sentence);
    } catch (err: any) {
      if (err?.message === 'Autoplay blocked') {
        // Browser blocked autoplay — try blob fallback for remaining sentences
        console.warn('TTS autoplay blocked, switching to blob fallback');
        await this.tryBlobFallbackForQueue(sentence);
        return;
      }
      // Other error — continue with next sentence
    }

    // Play next sentence in queue
    this.playNextSentence();
  }

  /** When streaming audio is blocked by autoplay, try the blob path */
  private async tryBlobFallbackForQueue(currentSentence: string): Promise<void> {
    const allSentences = [currentSentence, ...this.ttsSentenceQueue];
    this.ttsSentenceQueue = [];

    for (const sentence of allSentences) {
      try {
        const { url, token } = this.evaluationService.getTTSStreamInfo();
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ text: sentence }),
        });
        if (response.ok) {
          const blob = await response.blob();
          await this.playBlobAudio(blob);
        }
      } catch {
        // Skip sentence on error
      }
    }

    this.ttsPlaying = false;
    this.isSpeaking.set(false);
  }

  // ── Text-to-Speech (streaming ElevenLabs) ──

  speakMessage(text: string): void {
    if (this.isSpeaking()) {
      this.stopSpeaking();
      return;
    }

    this.isSpeaking.set(true);
    this.speakWithStreaming(text).catch(() => {
      this.isSpeaking.set(false);
    });
  }

  private async speakWithStreaming(text: string): Promise<void> {
    const { url, token } = this.evaluationService.getTTSStreamInfo();
    this.ttsAbortController = new AbortController();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ text }),
        signal: this.ttsAbortController.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`TTS request failed: ${response.status}`);
      }

      if (this.supportsStreamingAudio()) {
        await this.playStreamingAudio(response.body);
      } else {
        const blob = await response.blob();
        await this.playBlobAudio(blob);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      // Re-throw so playNextSentence can handle (e.g. autoplay blocked)
      throw err;
    }
  }

  private supportsStreamingAudio(): boolean {
    return 'MediaSource' in window && MediaSource.isTypeSupported('audio/mpeg');
  }

  private playStreamingAudio(body: ReadableStream<Uint8Array>): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const mediaSource = new MediaSource();
      const audio = new Audio();
      audio.src = URL.createObjectURL(mediaSource);
      this.currentAudio = audio;

      const cleanup = () => {
        URL.revokeObjectURL(audio.src);
        this.currentAudio = null;
      };

      audio.onended = () => {
        this.isSpeaking.set(false);
        cleanup();
        resolve();
      };

      audio.onerror = () => {
        cleanup();
        reject(new Error('Audio playback error'));
      };

      mediaSource.addEventListener('sourceopen', async () => {
        const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
        const reader = body.getReader();
        const pendingChunks: Uint8Array[] = [];
        let streamDone = false;

        const tryEndOfStream = () => {
          if (streamDone && pendingChunks.length === 0 && !sourceBuffer.updating && mediaSource.readyState === 'open') {
            try { mediaSource.endOfStream(); } catch {}
          }
        };

        const appendNext = () => {
          if (sourceBuffer.updating || pendingChunks.length === 0) return;
          const chunk = pendingChunks.shift()!;
          try {
            sourceBuffer.appendBuffer(chunk);
          } catch {
            // SourceBuffer might be removed if audio was stopped
          }
        };

        sourceBuffer.addEventListener('updateend', () => {
          appendNext();
          tryEndOfStream();
        });

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              streamDone = true;
              tryEndOfStream();
              break;
            }
            pendingChunks.push(value);
            appendNext();

            if (audio.paused) {
              try {
                await audio.play();
              } catch {
                // Autoplay blocked — abort streaming and reject
                cleanup();
                reject(new Error('Autoplay blocked'));
                return;
              }
            }
          }
        } catch (err) {
          reject(err);
          return;
        }

        // Safety: if stream is done but audio duration is 0 or very short,
        // onended might not fire. Set a timeout fallback.
        setTimeout(() => {
          if (this.currentAudio === audio) {
            cleanup();
            resolve();
          }
        }, 30000); // 30s max per sentence
      });
    });
  }

  private playBlobAudio(blob: Blob): Promise<void> {
    return new Promise<void>((resolve) => {
      const url = URL.createObjectURL(blob);
      this.currentAudio = new Audio(url);
      this.currentAudio.onended = () => {
        this.isSpeaking.set(false);
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        resolve();
      };
      this.currentAudio.onerror = () => {
        URL.revokeObjectURL(url);
        this.currentAudio = null;
        this.isSpeaking.set(false);
        resolve();
      };
      this.currentAudio.play().catch(() => {
        this.isSpeaking.set(false);
        resolve();
      });
    });
  }

  private stopSpeaking(): void {
    // Cancel ongoing stream
    if (this.streamAbortController) {
      this.streamAbortController.abort();
      this.streamAbortController = null;
    }
    if (this.ttsAbortController) {
      this.ttsAbortController.abort();
      this.ttsAbortController = null;
    }
    // Clear sentence queue
    this.ttsSentenceQueue = [];
    this.ttsPlaying = false;

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.isSpeaking.set(false);
  }

  toggleAutoTTS(): void {
    this.autoTTS.update((v) => !v);
  }

  private autoSpeakIfEnabled(text: string): void {
    if (this.autoTTS()) {
      this.speakMessage(text);
    }
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
