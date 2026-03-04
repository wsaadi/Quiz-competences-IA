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
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import {
  AdminService,
  UserOut,
  GlobalStats,
  CollaborateurFiche,
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
    MatTooltipModule,
    MatMenuModule,
    AvatarComponent,
    ScoreRadarComponent,
  ],
  template: `
    <div class="admin-layout">
      <mat-toolbar color="primary" class="toolbar">
        <app-avatar [size]="36" mood="neutral"></app-avatar>
        <span class="toolbar-title">Administration</span>
        <span class="spacer"></span>
        <button mat-icon-button (click)="loadData()" matTooltip="Rafraîchir">
          <mat-icon>refresh</mat-icon>
        </button>
        <button mat-icon-button (click)="logout()" matTooltip="Déconnexion">
          <mat-icon>logout</mat-icon>
        </button>
      </mat-toolbar>

      <div class="content">
        <mat-tab-group animationDuration="200ms">
          <!-- ═══════════════ STATISTIQUES ═══════════════ -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>analytics</mat-icon>&nbsp;Statistiques
            </ng-template>
            <ng-template matTabContent>
              <div class="tab-content" *ngIf="stats() as s">
                <!-- KPI cards -->
                <div class="stats-grid">
                  <mat-card class="stat-card accent-purple">
                    <mat-icon class="stat-icon">people</mat-icon>
                    <div class="stat-value">{{ s.total_users }}</div>
                    <div class="stat-label">Collaborateurs</div>
                  </mat-card>
                  <mat-card class="stat-card accent-blue">
                    <mat-icon class="stat-icon">assignment</mat-icon>
                    <div class="stat-value">{{ s.total_evaluations }}</div>
                    <div class="stat-label">Evaluations totales</div>
                  </mat-card>
                  <mat-card class="stat-card accent-green">
                    <mat-icon class="stat-icon">check_circle</mat-icon>
                    <div class="stat-value">{{ s.completed_evaluations }}</div>
                    <div class="stat-label">Terminées</div>
                  </mat-card>
                  <mat-card class="stat-card accent-orange">
                    <mat-icon class="stat-icon">speed</mat-icon>
                    <div class="stat-value">{{ (s.average_score ?? 0) | number:'1.0-0' }}<small>/100</small></div>
                    <div class="stat-label">Score moyen</div>
                  </mat-card>
                </div>

                <!-- Charts row -->
                <div class="charts-row">
                  <mat-card class="chart-card">
                    <mat-card-header>
                      <mat-card-title>Distribution des scores</mat-card-title>
                    </mat-card-header>
                    <mat-card-content>
                      <div class="distribution-bars">
                        <div *ngFor="let item of scoreDistItems()" class="dist-item">
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
                      <div class="level-grid">
                        <div *ngFor="let lvl of levelItems()" class="level-card" [class]="'level-' + lvl.key">
                          <div class="level-count-big">{{ lvl.count }}</div>
                          <div class="level-label-text">{{ lvl.label }}</div>
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
                      <span class="domain-score" [style.color]="getScoreColor(d.score)">
                        {{ d.score | number:'1.0-0' }}/100
                      </span>
                    </div>
                  </mat-card-content>
                </mat-card>

                <!-- Export button -->
                <div class="export-section">
                  <button mat-raised-button color="primary" (click)="exportCSV()">
                    <mat-icon>download</mat-icon>
                    Exporter toutes les évaluations (CSV/Excel)
                  </button>
                </div>
              </div>
            </ng-template>
          </mat-tab>

          <!-- ═══════════════ EVALUATIONS ═══════════════ -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>quiz</mat-icon>&nbsp;Evaluations
            </ng-template>
            <ng-template matTabContent>
              <div class="tab-content">
                <!-- Filters -->
                <div class="filters-row">
                  <mat-form-field appearance="outline" class="filter-field">
                    <mat-label>Rechercher</mat-label>
                    <input matInput [(ngModel)]="evalSearchQuery" placeholder="Nom, poste..." />
                    <mat-icon matSuffix>search</mat-icon>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="filter-field-small">
                    <mat-label>Statut</mat-label>
                    <mat-select [(ngModel)]="evalStatusFilter">
                      <mat-option value="all">Tous</mat-option>
                      <mat-option value="completed">Terminées</mat-option>
                      <mat-option value="in_progress">En cours</mat-option>
                      <mat-option value="abandoned">Abandonnées</mat-option>
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="filter-field-small">
                    <mat-label>Niveau</mat-label>
                    <mat-select [(ngModel)]="evalLevelFilter">
                      <mat-option value="all">Tous</mat-option>
                      <mat-option value="debutant">Débutant</mat-option>
                      <mat-option value="intermediaire">Intermédiaire</mat-option>
                      <mat-option value="avance">Avancé</mat-option>
                      <mat-option value="expert">Expert</mat-option>
                    </mat-select>
                  </mat-form-field>
                </div>

                <mat-accordion multi>
                  <mat-expansion-panel *ngFor="let ev of filteredEvaluations()">
                    <mat-expansion-panel-header>
                      <mat-panel-title class="eval-panel-title">
                        <mat-icon [class]="'status-icon status-' + ev.status">
                          {{ ev.status === 'completed' ? 'check_circle' : ev.status === 'in_progress' ? 'pending' : 'cancel' }}
                        </mat-icon>
                        <span class="eval-name">{{ ev.user?.full_name || 'Utilisateur #' + ev.user_id }}</span>
                        <mat-chip *ngIf="ev.job_role" class="job-chip">{{ ev.job_role }}</mat-chip>
                      </mat-panel-title>
                      <mat-panel-description>
                        {{ ev.started_at | date:'dd/MM/yyyy HH:mm' }}
                        <span *ngIf="ev.scores?.score_global != null" class="panel-score"
                              [style.color]="getScoreColor(ev.scores!.score_global || 0)">
                          {{ ev.scores!.score_global | number:'1.0-0' }}/100
                        </span>
                        <mat-chip *ngIf="ev.detected_level" [class]="'level-chip level-' + ev.detected_level">
                          {{ getLevelLabel(ev.detected_level) }}
                        </mat-chip>
                      </mat-panel-description>
                    </mat-expansion-panel-header>

                    <ng-template matExpansionPanelContent>
                      <div class="eval-detail">
                        <!-- Info header -->
                        <div class="eval-info-bar" *ngIf="ev.job_role || ev.job_domain">
                          <span *ngIf="ev.job_role"><mat-icon>work</mat-icon> {{ ev.job_role }}</span>
                          <span *ngIf="ev.job_domain"><mat-icon>business</mat-icon> {{ ev.job_domain }}</span>
                          <span><mat-icon>chat</mat-icon> {{ ev.total_messages }} messages</span>
                        </div>

                        <div class="detail-grid" *ngIf="ev.scores">
                          <div class="detail-left">
                            <app-score-radar [scores]="ev.scores"></app-score-radar>
                            <div class="level-badge" [class]="'level-bg-' + ev.detected_level">
                              {{ getLevelLabel(ev.detected_level) }}
                              <span class="level-score">{{ ev.scores.score_global | number:'1.0-0' }}/100</span>
                            </div>

                            <!-- Domain breakdown -->
                            <div class="domain-mini">
                              <div *ngFor="let d of getEvalDomainScores(ev)" class="domain-mini-row">
                                <span class="dm-label">{{ d.label }}</span>
                                <div class="dm-bar-bg">
                                  <div class="dm-bar" [style.width.%]="d.score" [style.background]="getScoreColor(d.score)"></div>
                                </div>
                                <span class="dm-score">{{ d.score }}</span>
                              </div>
                            </div>
                          </div>
                          <div class="detail-right">
                            <div class="feedback-block">
                              <h4><mat-icon>admin_panel_settings</mat-icon> Feedback Admin</h4>
                              <p class="admin-feedback">{{ ev.feedback_admin || 'Pas de feedback' }}</p>
                            </div>

                            <div class="feedback-block">
                              <h4><mat-icon>sentiment_satisfied</mat-icon> Feedback Collaborateur</h4>
                              <p class="collab-feedback">{{ ev.feedback_collaborator || 'Pas de feedback' }}</p>
                            </div>
                          </div>
                        </div>

                        <div *ngIf="!ev.scores" class="no-scores">
                          <mat-icon>hourglass_empty</mat-icon>
                          <span>Evaluation {{ ev.status === 'abandoned' ? 'abandonnée' : 'en cours' }} — pas encore de scores.</span>
                        </div>

                        <div class="eval-actions">
                          <button
                            mat-stroked-button
                            (click)="loadConversation(ev)"
                            *ngIf="!ev.messages?.length"
                          >
                            <mat-icon>chat</mat-icon> Voir la conversation
                          </button>
                        </div>

                        <div class="conversation" *ngIf="ev.messages?.length">
                          <h4>Conversation ({{ ev.messages.length }} messages)</h4>
                          <div
                            *ngFor="let msg of ev.messages"
                            class="conv-msg"
                            [class.conv-user]="msg.role === 'user'"
                            [class.conv-ai]="msg.role === 'assistant'"
                          >
                            <div class="conv-header">
                              <strong>{{ msg.role === 'user' ? 'Collaborateur' : 'Aria' }}</strong>
                              <span class="conv-phase" *ngIf="msg.phase">{{ msg.phase }}</span>
                            </div>
                            {{ msg.content }}
                          </div>
                        </div>
                      </div>
                    </ng-template>
                  </mat-expansion-panel>
                </mat-accordion>

                <div class="empty-state-inline" *ngIf="filteredEvaluations().length === 0">
                  <mat-icon>search_off</mat-icon>
                  <span>Aucune évaluation trouvée pour ces filtres.</span>
                </div>
              </div>
            </ng-template>
          </mat-tab>

          <!-- ═══════════════ COLLABORATEURS ═══════════════ -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>group</mat-icon>&nbsp;Collaborateurs
            </ng-template>
            <ng-template matTabContent>
              <div class="tab-content">
                <!-- User search -->
                <mat-form-field appearance="outline" class="user-search">
                  <mat-label>Rechercher un collaborateur</mat-label>
                  <input matInput [(ngModel)]="userSearchQuery" placeholder="Nom, email..." />
                  <mat-icon matSuffix>search</mat-icon>
                </mat-form-field>

                <!-- Collaborateur cards -->
                <div class="collab-grid">
                  <mat-card *ngFor="let u of filteredUsers()" class="collab-card" [class.inactive]="!u.is_active">
                    <div class="collab-header">
                      <div class="collab-avatar">{{ getInitials(u.full_name) }}</div>
                      <div class="collab-info">
                        <h3>{{ u.full_name }}</h3>
                        <span class="collab-username">{{ u.username }}</span>
                        <span class="collab-email">{{ u.email }}</span>
                      </div>
                      <mat-chip [class]="'role-chip role-' + u.role">
                        {{ u.role === 'admin' ? 'Admin' : 'Collaborateur' }}
                      </mat-chip>
                    </div>

                    <div class="collab-stats">
                      <div class="collab-stat" *ngIf="getUserEvalCount(u.id) as count">
                        <mat-icon>quiz</mat-icon>
                        <span>{{ count }} éval{{ count > 1 ? 's' : '' }}</span>
                      </div>
                      <div class="collab-stat" *ngIf="getUserBestScore(u.id) as score">
                        <mat-icon>emoji_events</mat-icon>
                        <span [style.color]="getScoreColor(score)">Meilleur: {{ score }}/100</span>
                      </div>
                      <div class="collab-stat" *ngIf="getUserLatestLevel(u.id) as level">
                        <mat-icon>trending_up</mat-icon>
                        <span>{{ getLevelLabel(level) }}</span>
                      </div>
                    </div>

                    <div class="collab-actions">
                      <button mat-stroked-button (click)="viewCollabFiche(u)" matTooltip="Voir la fiche détaillée">
                        <mat-icon>description</mat-icon> Fiche
                      </button>
                      <button
                        mat-icon-button
                        color="warn"
                        (click)="deactivateUser(u.id)"
                        *ngIf="u.is_active && u.role !== 'admin'"
                        matTooltip="Désactiver"
                      >
                        <mat-icon>block</mat-icon>
                      </button>
                    </div>

                    <div class="inactive-badge" *ngIf="!u.is_active">Désactivé</div>
                  </mat-card>
                </div>

                <!-- Fiche collaborateur overlay -->
                <div class="fiche-overlay" *ngIf="selectedFiche()" (click)="closeFiche()">
                  <div class="fiche-panel" (click)="$event.stopPropagation()">
                    <div class="fiche-header">
                      <div>
                        <h2>{{ selectedFiche()!.collaborateur.nom }}</h2>
                        <span class="fiche-email">{{ selectedFiche()!.collaborateur.email }}</span>
                      </div>
                      <button mat-icon-button (click)="closeFiche()">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>

                    <div class="fiche-body" *ngIf="selectedFiche()!.evaluations.length > 0; else noEvals">
                      <div class="fiche-eval" *ngFor="let ev of selectedFiche()!.evaluations; let i = index">
                        <div class="fiche-eval-header">
                          <h3>Evaluation #{{ ev.id }} — {{ ev.date | date:'dd/MM/yyyy' }}</h3>
                          <div class="fiche-meta">
                            <mat-chip *ngIf="ev.job_role">{{ ev.job_role }}</mat-chip>
                            <mat-chip *ngIf="ev.detected_level" [class]="'level-chip level-' + ev.detected_level">
                              {{ getLevelLabel(ev.detected_level) }}
                            </mat-chip>
                            <span class="fiche-score" *ngIf="ev.score_global != null"
                                  [style.color]="getScoreColor(ev.score_global || 0)">
                              {{ ev.score_global | number:'1.0-0' }}/100
                            </span>
                          </div>
                        </div>

                        <div class="fiche-scores">
                          <div *ngFor="let s of getObjectEntries(ev.scores)" class="fiche-score-row">
                            <span>{{ s[0] }}</span>
                            <div class="fiche-bar-bg">
                              <div class="fiche-bar" [style.width.%]="s[1] || 0" [style.background]="getScoreColor(s[1] || 0)"></div>
                            </div>
                            <span class="fiche-bar-val">{{ s[1] || 0 }}</span>
                          </div>
                        </div>

                        <div class="fiche-feedback" *ngIf="ev.feedback_admin">
                          <h4>Feedback admin</h4>
                          <p>{{ ev.feedback_admin }}</p>
                        </div>
                        <mat-divider *ngIf="i < selectedFiche()!.evaluations.length - 1"></mat-divider>
                      </div>
                    </div>
                    <ng-template #noEvals>
                      <p class="no-evals-msg">Aucune évaluation terminée pour ce collaborateur.</p>
                    </ng-template>

                    <div class="fiche-actions">
                      <button mat-raised-button color="primary" (click)="printFiche()">
                        <mat-icon>print</mat-icon> Imprimer / PDF
                      </button>
                    </div>
                  </div>
                </div>

                <!-- New user form -->
                <mat-card class="new-user-card">
                  <mat-card-header>
                    <mat-card-title><mat-icon>person_add</mat-icon> Créer un utilisateur</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <form (ngSubmit)="createUser()" class="user-form" #userForm="ngForm">
                      <mat-form-field appearance="outline">
                        <mat-label>Nom complet</mat-label>
                        <input matInput [(ngModel)]="newUser.full_name" name="full_name" required minlength="1" />
                        <mat-error>Requis</mat-error>
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Username</mat-label>
                        <input matInput [(ngModel)]="newUser.username" name="username" required minlength="3" />
                        <mat-error>Min. 3 caractères</mat-error>
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Email</mat-label>
                        <input matInput [(ngModel)]="newUser.email" name="email" required type="email" email />
                        <mat-error>Email invalide</mat-error>
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Mot de passe</mat-label>
                        <input matInput [(ngModel)]="newUser.password" name="password" required type="password" minlength="8" />
                        <mat-hint>8+ car., majuscule, minuscule, chiffre, spécial</mat-hint>
                        <mat-error>Min. 8 caractères</mat-error>
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Rôle</mat-label>
                        <mat-select [(ngModel)]="newUser.role" name="role">
                          <mat-option value="collaborator">Collaborateur</mat-option>
                          <mat-option value="admin">Administrateur</mat-option>
                        </mat-select>
                      </mat-form-field>
                      <button mat-raised-button color="primary" type="submit" [disabled]="!userForm.valid || creatingUser()">
                        <mat-icon>{{ creatingUser() ? 'hourglass_empty' : 'person_add' }}</mat-icon>
                        {{ creatingUser() ? 'Création...' : 'Créer' }}
                      </button>
                    </form>
                  </mat-card-content>
                </mat-card>
              </div>
            </ng-template>
          </mat-tab>
        </mat-tab-group>
      </div>
    </div>
  `,
  styles: [`
    .admin-layout { min-height: 100vh; background: #f0f2f5; }
    .toolbar {
      gap: 12px;
      .toolbar-title { font-size: 18px; font-weight: 500; }
      .spacer { flex: 1; }
    }
    .content { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .tab-content { padding: 24px 0; }

    /* ── KPI Stats ── */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-card {
      padding: 24px;
      text-align: center;
      position: relative;
      overflow: hidden;
      border-radius: 12px;

      .stat-icon {
        font-size: 40px;
        width: 40px;
        height: 40px;
        opacity: 0.15;
        position: absolute;
        top: 12px;
        right: 12px;
      }
      .stat-value {
        font-size: 36px;
        font-weight: 700;
        small { font-size: 16px; opacity: 0.7; }
      }
      .stat-label { color: #666; font-size: 13px; margin-top: 4px; }
    }
    .accent-purple { border-left: 4px solid #6C63FF; .stat-value { color: #6C63FF; } }
    .accent-blue { border-left: 4px solid #2196F3; .stat-value { color: #2196F3; } }
    .accent-green { border-left: 4px solid #4CAF50; .stat-value { color: #4CAF50; } }
    .accent-orange { border-left: 4px solid #FF9800; .stat-value { color: #FF9800; } }

    /* ── Charts ── */
    .charts-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    .chart-card { padding: 16px; border-radius: 12px; }

    .distribution-bars {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px 0;
    }
    .dist-item { display: flex; align-items: center; gap: 10px; }
    .dist-label { width: 60px; font-size: 13px; color: #666; }
    .dist-bar-bg {
      flex: 1; height: 24px; background: #f0f0f0; border-radius: 12px; overflow: hidden;
    }
    .dist-bar { height: 100%; border-radius: 12px; transition: width 0.6s; }
    .dist-count { width: 30px; font-weight: 600; color: #333; }

    .level-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      padding: 16px 0;
    }
    .level-card {
      padding: 16px;
      border-radius: 10px;
      text-align: center;
      .level-count-big { font-size: 28px; font-weight: 700; }
      .level-label-text { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }
    }
    .level-debutant { background: #ffebee; .level-count-big { color: #f44336; } }
    .level-intermediaire { background: #fff3e0; .level-count-big { color: #FF9800; } }
    .level-avance { background: #e8f5e9; .level-count-big { color: #4CAF50; } }
    .level-expert { background: #e3f2fd; .level-count-big { color: #2196F3; } }

    /* ── Domain averages ── */
    .domain-avg-card { padding: 16px; margin-bottom: 24px; border-radius: 12px; }
    .domain-row {
      display: flex; align-items: center; gap: 12px; padding: 10px 0;
    }
    .domain-name { width: 200px; font-size: 13px; color: #555; flex-shrink: 0; }
    .domain-bar-bg {
      flex: 1; height: 12px; background: #f0f0f0; border-radius: 6px; overflow: hidden;
    }
    .domain-bar { height: 100%; border-radius: 6px; transition: width 1s ease; }
    .domain-score { width: 70px; text-align: right; font-size: 13px; font-weight: 600; }

    .export-section { text-align: center; margin-top: 8px; }

    /* ── Evaluations tab ── */
    .filters-row {
      display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: flex-start;
    }
    .filter-field { flex: 1; min-width: 200px; }
    .filter-field-small { width: 160px; }

    .eval-panel-title {
      display: flex; align-items: center; gap: 8px;
    }
    .status-icon { font-size: 20px; width: 20px; height: 20px; }
    .status-completed { color: #4CAF50; }
    .status-in_progress { color: #FF9800; }
    .status-abandoned { color: #999; }
    .eval-name { font-weight: 500; }
    .job-chip { font-size: 11px; height: 24px; }

    .panel-score { margin-left: 12px; font-weight: 600; font-size: 15px; }
    .level-chip { font-size: 11px; height: 24px; }
    .level-debutant { background: #ffebee !important; color: #c62828 !important; }
    .level-intermediaire { background: #fff3e0 !important; color: #E65100 !important; }
    .level-avance { background: #e8f5e9 !important; color: #2E7D32 !important; }
    .level-expert { background: #e3f2fd !important; color: #1565C0 !important; }

    .eval-detail { padding: 16px 0; }
    .eval-info-bar {
      display: flex; gap: 20px; padding: 12px 16px; background: #f8f9fa;
      border-radius: 8px; margin-bottom: 16px; font-size: 13px; color: #555;
      span { display: flex; align-items: center; gap: 4px; }
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 16px; }

    .level-badge {
      text-align: center; margin-top: 16px; padding: 12px; border-radius: 10px; font-weight: 600; font-size: 16px;
      .level-score { display: block; font-size: 24px; margin-top: 4px; }
    }
    .level-bg-debutant { background: #ffebee; color: #c62828; }
    .level-bg-intermediaire { background: #fff3e0; color: #E65100; }
    .level-bg-avance { background: #e8f5e9; color: #2E7D32; }
    .level-bg-expert { background: #e3f2fd; color: #1565C0; }

    .domain-mini { margin-top: 16px; }
    .domain-mini-row { display: flex; align-items: center; gap: 8px; padding: 3px 0; font-size: 12px; }
    .dm-label { width: 140px; color: #666; flex-shrink: 0; }
    .dm-bar-bg { flex: 1; height: 6px; background: #eee; border-radius: 3px; overflow: hidden; }
    .dm-bar { height: 100%; border-radius: 3px; }
    .dm-score { width: 25px; text-align: right; font-weight: 500; color: #555; }

    .feedback-block {
      margin-bottom: 16px;
      h4 { display: flex; align-items: center; gap: 8px; color: #555; margin-bottom: 8px; }
    }
    .admin-feedback { background: #fff3e0; padding: 14px; border-radius: 10px; line-height: 1.6; font-size: 14px; }
    .collab-feedback { background: #e8f5e9; padding: 14px; border-radius: 10px; line-height: 1.6; font-size: 14px; }

    .no-scores {
      display: flex; align-items: center; gap: 8px; color: #999; padding: 16px;
      font-style: italic;
    }

    .eval-actions { margin: 12px 0; }

    .conversation { margin-top: 16px; max-height: 500px; overflow-y: auto; padding-right: 8px; }
    .conv-msg { padding: 10px 14px; margin: 6px 0; border-radius: 10px; font-size: 13px; line-height: 1.6; }
    .conv-user { background: #e3f2fd; }
    .conv-ai { background: #f3e5f5; }
    .conv-header { margin-bottom: 4px; display: flex; align-items: center; gap: 8px; }
    .conv-phase { font-size: 10px; background: rgba(0,0,0,0.08); padding: 2px 6px; border-radius: 4px; }

    .empty-state-inline {
      display: flex; align-items: center; gap: 8px; justify-content: center;
      padding: 40px; color: #999; font-size: 14px;
    }

    /* ── Collaborateurs tab ── */
    .user-search { width: 100%; margin-bottom: 16px; }
    .collab-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .collab-card {
      padding: 20px;
      border-radius: 12px;
      position: relative;
      transition: box-shadow 0.2s;
      &:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
      &.inactive { opacity: 0.6; }
    }
    .collab-header { display: flex; align-items: center; gap: 14px; margin-bottom: 12px; }
    .collab-avatar {
      width: 48px; height: 48px; border-radius: 50%; background: #6C63FF;
      color: white; display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: 16px; flex-shrink: 0;
    }
    .collab-info {
      flex: 1; min-width: 0;
      h3 { margin: 0; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .collab-username { display: block; font-size: 12px; color: #999; }
      .collab-email { display: block; font-size: 12px; color: #999; }
    }
    .role-chip { font-size: 11px; height: 24px; }
    .role-admin { background: #e3f2fd !important; color: #1565C0 !important; }
    .role-collaborator { background: #f3e5f5 !important; color: #7B1FA2 !important; }

    .collab-stats {
      display: flex; gap: 16px; margin-bottom: 12px; flex-wrap: wrap;
    }
    .collab-stat {
      display: flex; align-items: center; gap: 4px; font-size: 13px; color: #555;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #999; }
    }
    .collab-actions { display: flex; gap: 8px; align-items: center; }
    .inactive-badge {
      position: absolute; top: 12px; right: 12px;
      background: #f44336; color: white; font-size: 11px;
      padding: 2px 8px; border-radius: 4px;
    }

    /* ── Fiche overlay ── */
    .fiche-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); z-index: 1000;
      display: flex; align-items: center; justify-content: center;
      padding: 24px;
    }
    .fiche-panel {
      background: white; border-radius: 16px; max-width: 700px; width: 100%;
      max-height: 85vh; overflow-y: auto; padding: 28px;
    }
    .fiche-header {
      display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;
      h2 { margin: 0; }
      .fiche-email { color: #999; font-size: 13px; }
    }
    .fiche-eval { padding: 16px 0; }
    .fiche-eval-header {
      display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;
      margin-bottom: 12px;
      h3 { margin: 0; font-size: 15px; }
    }
    .fiche-meta { display: flex; gap: 8px; align-items: center; }
    .fiche-score { font-size: 18px; font-weight: 700; }
    .fiche-scores { margin-bottom: 12px; }
    .fiche-score-row {
      display: flex; align-items: center; gap: 8px; padding: 4px 0; font-size: 13px;
      span:first-child { width: 180px; color: #555; flex-shrink: 0; }
    }
    .fiche-bar-bg { flex: 1; height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
    .fiche-bar { height: 100%; border-radius: 4px; }
    .fiche-bar-val { width: 30px; text-align: right; font-weight: 500; }
    .fiche-feedback {
      h4 { color: #555; margin-bottom: 6px; font-size: 13px; }
      p { background: #f8f9fa; padding: 12px; border-radius: 8px; font-size: 13px; line-height: 1.6; }
    }
    .no-evals-msg { text-align: center; color: #999; padding: 32px; }
    .fiche-actions { text-align: center; margin-top: 16px; }

    /* ── New user form ── */
    .new-user-card {
      margin-top: 8px; border-radius: 12px;
      mat-card-title { display: flex; align-items: center; gap: 8px; }
    }
    .user-form {
      display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; margin-top: 12px;
      mat-form-field { flex: 1; min-width: 180px; }
      button { height: 56px; margin-top: 4px; }
    }

    @media (max-width: 768px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .charts-row { grid-template-columns: 1fr; }
      .detail-grid { grid-template-columns: 1fr; }
      .collab-grid { grid-template-columns: 1fr; }
      .level-grid { grid-template-columns: 1fr 1fr; }
    }

    @media print {
      .admin-layout, .toolbar, .content, mat-tab-group { display: none !important; }
      .fiche-overlay { position: static; background: none; padding: 0; }
      .fiche-panel { max-height: none; box-shadow: none; border-radius: 0; max-width: 100%; }
      .fiche-actions { display: none; }
    }
  `],
})
export class AdminComponent implements OnInit {
  users = signal<UserOut[]>([]);
  evaluations = signal<EvaluationDetail[]>([]);
  stats = signal<GlobalStats | null>(null);
  selectedFiche = signal<CollaborateurFiche | null>(null);
  creatingUser = signal(false);

  // Filters
  evalSearchQuery = '';
  evalStatusFilter = 'all';
  evalLevelFilter = 'all';
  userSearchQuery = '';

  newUser = {
    full_name: '',
    username: '',
    email: '',
    password: '',
    role: 'collaborator',
  };

  scoreDistItems = computed(() => {
    const s = this.stats();
    if (!s) return [];
    const total = Object.values(s.score_distribution).reduce((a, b) => a + b, 0) || 1;
    const colors: Record<string, string> = {
      '0-25': '#f44336', '26-50': '#FF9800', '51-75': '#66BB6A', '76-100': '#2196F3',
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
      debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé', expert: 'Expert',
    };
    const order = ['debutant', 'intermediaire', 'avance', 'expert'];
    return order.map((key) => ({
      key,
      label: labelMap[key] || key,
      count: s.level_distribution[key] || 0,
    }));
  });

  domainAvgs = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return Object.entries(s.domain_averages).map(([label, score]) => ({ label, score }));
  });

  filteredEvaluations = computed(() => {
    let evals = this.evaluations();
    const q = this.evalSearchQuery.toLowerCase().trim();
    if (q) {
      evals = evals.filter((ev) => {
        const name = (ev.user?.full_name || '').toLowerCase();
        const job = ((ev as any).job_role || '').toLowerCase();
        return name.includes(q) || job.includes(q);
      });
    }
    if (this.evalStatusFilter !== 'all') {
      evals = evals.filter((ev) => ev.status === this.evalStatusFilter);
    }
    if (this.evalLevelFilter !== 'all') {
      evals = evals.filter((ev) => ev.detected_level === this.evalLevelFilter);
    }
    return evals;
  });

  filteredUsers = computed(() => {
    let u = this.users();
    const q = this.userSearchQuery.toLowerCase().trim();
    if (q) {
      u = u.filter((user) =>
        user.full_name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        user.username.toLowerCase().includes(q)
      );
    }
    return u;
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
    this.creatingUser.set(true);
    this.adminService.createUser(this.newUser).subscribe({
      next: () => {
        this.creatingUser.set(false);
        this.snackBar.open('Utilisateur créé avec succès !', 'OK', { duration: 3000 });
        this.newUser = { full_name: '', username: '', email: '', password: '', role: 'collaborator' };
        this.loadData();
      },
      error: (err) => {
        this.creatingUser.set(false);
        const detail = err.error?.detail;
        let msg = 'Erreur lors de la création';
        if (typeof detail === 'string') {
          msg = detail;
        } else if (Array.isArray(detail)) {
          msg = detail.map((d: any) => d.msg || d).join(', ');
        }
        this.snackBar.open(msg, 'OK', { duration: 6000 });
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

  viewCollabFiche(user: UserOut): void {
    this.adminService.getCollaborateurFiche(user.id).subscribe((fiche) => {
      this.selectedFiche.set(fiche);
    });
  }

  closeFiche(): void {
    this.selectedFiche.set(null);
  }

  printFiche(): void {
    window.print();
  }

  exportCSV(): void {
    this.adminService.exportEvaluationsCSV();
    this.snackBar.open('Export CSV en cours...', 'OK', { duration: 2000 });
  }

  logout(): void {
    this.authService.logout();
  }

  // ── Helpers ──

  getUserEvalCount(userId: number): number {
    return this.evaluations().filter((e) => e.user_id === userId && e.status === 'completed').length;
  }

  getUserBestScore(userId: number): number | null {
    const scores = this.evaluations()
      .filter((e) => e.user_id === userId && e.scores?.score_global != null)
      .map((e) => e.scores!.score_global!);
    return scores.length > 0 ? Math.max(...scores) : null;
  }

  getUserLatestLevel(userId: number): string | null {
    const userEvals = this.evaluations()
      .filter((e) => e.user_id === userId && e.detected_level);
    return userEvals.length > 0 ? userEvals[0].detected_level : null;
  }

  getInitials(name: string): string {
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  }

  getLevelLabel(level: string | null | undefined): string {
    const map: Record<string, string> = {
      debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé', expert: 'Expert',
    };
    return level ? map[level] || level : 'N/A';
  }

  getScoreColor(score: number): string {
    if (score >= 75) return '#2196F3';
    if (score >= 50) return '#4CAF50';
    if (score >= 25) return '#FF9800';
    return '#f44336';
  }

  getEvalDomainScores(ev: EvaluationDetail): { label: string; score: number }[] {
    const s = ev.scores;
    if (!s) return [];
    return [
      { label: 'Connaissance marché', score: s.score_market_knowledge ?? 0 },
      { label: 'Terminologie', score: s.score_terminology ?? 0 },
      { label: 'Intérêt & curiosité', score: s.score_interest_curiosity ?? 0 },
      { label: 'Veille personnelle', score: s.score_personal_watch ?? 0 },
      { label: 'Niveau technique', score: s.score_technical_level ?? 0 },
      { label: 'Utilisation IA', score: s.score_ai_usage ?? 0 },
      { label: 'Intégration & dépl.', score: s.score_integration_deployment ?? 0 },
      { label: 'Conception & dev', score: s.score_conception_dev ?? 0 },
    ];
  }

  getObjectEntries(obj: Record<string, any> | null | undefined): [string, any][] {
    return obj ? Object.entries(obj) : [];
  }
}
