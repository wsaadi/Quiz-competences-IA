import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, retry, timer } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChatResponse {
  response: string;
  phase: string;
  is_complete: boolean;
  progress_percent: number;
}

export interface EvaluationScores {
  score_market_knowledge: number | null;
  score_terminology: number | null;
  score_interest_curiosity: number | null;
  score_personal_watch: number | null;
  score_technical_level: number | null;
  score_ai_usage: number | null;
  score_integration_deployment: number | null;
  score_conception_dev: number | null;
  score_global: number | null;
  detected_level: string | null;
}

export interface Evaluation {
  id: number;
  user_id: number;
  status: string;
  scores: EvaluationScores | null;
  feedback_collaborator: string | null;
  feedback_admin: string | null;
  total_messages: number;
  started_at: string;
  completed_at: string | null;
  detected_level: string | null;
  job_role: string | null;
  job_domain: string | null;
}

export interface EvaluationDetail extends Evaluation {
  messages: ChatMessageRecord[];
  user: { id: number; full_name: string; username: string; email: string } | null;
}

export interface ChatMessageRecord {
  id: number;
  role: string;
  content: string;
  phase: string | null;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class EvaluationService {
  constructor(private http: HttpClient) {}

  private retryConfig = {
    count: 2,
    delay: (error: any, retryCount: number) => {
      // Only retry on network errors and 5xx, not 4xx
      const status = error?.status;
      if (status && status >= 400 && status < 500) {
        throw error;
      }
      return timer(2000 * retryCount);
    },
  };

  startEvaluation(): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(
      `${environment.apiUrl}/evaluations/start`,
      {}
    ).pipe(retry(this.retryConfig));
  }

  sendMessage(evaluationId: number, message: string): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(
      `${environment.apiUrl}/evaluations/${evaluationId}/chat`,
      { message }
    ).pipe(retry(this.retryConfig));
  }

  completeEvaluation(evaluationId: number): Observable<Evaluation> {
    return this.http.post<Evaluation>(
      `${environment.apiUrl}/evaluations/${evaluationId}/complete`,
      {}
    ).pipe(retry(this.retryConfig));
  }

  getMyEvaluations(): Observable<Evaluation[]> {
    return this.http.get<Evaluation[]>(`${environment.apiUrl}/evaluations/my`);
  }

  getEvaluation(id: number): Observable<Evaluation> {
    return this.http.get<Evaluation>(`${environment.apiUrl}/evaluations/${id}`);
  }

  getMessages(evaluationId: number): Observable<ChatMessageRecord[]> {
    return this.http.get<ChatMessageRecord[]>(
      `${environment.apiUrl}/evaluations/${evaluationId}/messages`
    );
  }

  abandonEvaluation(evaluationId: number): Observable<any> {
    return this.http.post(
      `${environment.apiUrl}/evaluations/${evaluationId}/abandon`,
      {}
    );
  }

  textToSpeech(text: string): Observable<Blob> {
    return this.http.post(
      `${environment.apiUrl}/tts/speak`,
      { text },
      { responseType: 'blob' }
    );
  }

  /** Returns TTS endpoint URL and current auth token for direct fetch() streaming. */
  getTTSStreamInfo(): { url: string; token: string | null } {
    const session = sessionStorage.getItem('quiz_ia_session');
    let token: string | null = null;
    if (session) {
      try { token = JSON.parse(session).token; } catch {}
    }
    return { url: `${environment.apiUrl}/tts/speak`, token };
  }

  /** Transcribe audio via ElevenLabs Scribe (server-side STT). */
  transcribeAudio(audioBlob: Blob, filename: string = 'audio.webm'): Observable<{ text: string }> {
    const formData = new FormData();
    formData.append('file', audioBlob, filename);
    return this.http.post<{ text: string }>(
      `${environment.apiUrl}/tts/transcribe`,
      formData
    );
  }
}
