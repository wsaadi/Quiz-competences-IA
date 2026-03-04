import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EvaluationDetail } from './evaluation.service';

export interface UserOut {
  id: number;
  email: string;
  username: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface UserCreate {
  email: string;
  username: string;
  full_name: string;
  password: string;
  role: string;
}

export interface GlobalStats {
  total_evaluations: number;
  completed_evaluations: number;
  average_score: number | null;
  score_distribution: Record<string, number>;
  level_distribution: Record<string, number>;
  domain_averages: Record<string, number>;
  total_users: number;
}

export interface CollaborateurFiche {
  collaborateur: {
    id: number;
    nom: string;
    email: string;
    username: string;
    role: string;
  };
  evaluations: Array<{
    id: number;
    date: string | null;
    job_role: string | null;
    job_domain: string | null;
    detected_level: string | null;
    score_global: number | null;
    scores: Record<string, number | null>;
    feedback_collaborateur: string | null;
    feedback_admin: string | null;
  }>;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  constructor(private http: HttpClient) {}

  getUsers(): Observable<UserOut[]> {
    return this.http.get<UserOut[]>(`${environment.apiUrl}/admin/users`);
  }

  createUser(user: UserCreate): Observable<UserOut> {
    return this.http.post<UserOut>(`${environment.apiUrl}/admin/users`, user);
  }

  deactivateUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/admin/users/${userId}`);
  }

  getAllEvaluations(): Observable<EvaluationDetail[]> {
    return this.http.get<EvaluationDetail[]>(
      `${environment.apiUrl}/admin/evaluations`
    );
  }

  getEvaluationDetail(id: number): Observable<EvaluationDetail> {
    return this.http.get<EvaluationDetail>(
      `${environment.apiUrl}/admin/evaluations/${id}`
    );
  }

  getStats(): Observable<GlobalStats> {
    return this.http.get<GlobalStats>(`${environment.apiUrl}/admin/stats`);
  }

  exportEvaluationsCSV(): void {
    this.http.get(`${environment.apiUrl}/admin/export/evaluations/csv`, {
      responseType: 'blob',
    }).subscribe((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `evaluations_ia_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    });
  }

  getCollaborateurFiche(userId: number): Observable<CollaborateurFiche> {
    return this.http.get<CollaborateurFiche>(
      `${environment.apiUrl}/admin/export/collaborateur/${userId}`
    );
  }
}
