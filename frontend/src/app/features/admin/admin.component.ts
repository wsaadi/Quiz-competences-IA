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
  AppConfigMap,
  CostConfigItem,
  UsageStats,
} from '../../core/services/admin.service';
import { EvaluationDetail } from '../../core/services/evaluation.service';
import { AuthService } from '../../core/services/auth.service';
import { AvatarComponent } from '../../shared/components/avatar.component';
import { ScoreRadarComponent } from '../../shared/components/score-radar.component';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { environment } from '../../../environments/environment';

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
    MatDatepickerModule,
    MatNativeDateModule,
    MatSlideToggleModule,
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
                              <div class="collab-feedback" [innerHTML]="formatFeedback(ev.feedback_collaborator || 'Pas de feedback')"></div>
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

                        <div class="fiche-feedback" *ngIf="ev.feedback_collaborateur">
                          <h4><mat-icon>auto_awesome</mat-icon> Le mot d'Aria</h4>
                          <div class="collab-feedback" [innerHTML]="formatFeedback(ev.feedback_collaborateur)"></div>
                        </div>

                        <div class="fiche-feedback" *ngIf="ev.feedback_admin">
                          <h4><mat-icon>admin_panel_settings</mat-icon> Feedback admin</h4>
                          <p>{{ ev.feedback_admin }}</p>
                        </div>

                        <div class="fiche-conversation-actions">
                          <button mat-stroked-button (click)="loadFicheConversation(ev.id)" *ngIf="!ficheMessages()[ev.id]">
                            <mat-icon>chat</mat-icon> Voir la conversation
                          </button>
                          <button mat-stroked-button (click)="hideFicheConversation(ev.id)" *ngIf="ficheMessages()[ev.id]">
                            <mat-icon>visibility_off</mat-icon> Masquer la conversation
                          </button>
                        </div>

                        <div class="conversation" *ngIf="ficheMessages()[ev.id] as msgs">
                          <h4>Conversation ({{ msgs.length }} messages)</h4>
                          <div
                            *ngFor="let msg of msgs"
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
          <!-- ═══════════════ CONFIGURATION ═══════════════ -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>settings</mat-icon>&nbsp;Configuration
            </ng-template>
            <ng-template matTabContent>
              <div class="tab-content">
                <!-- Branding -->
                <mat-card class="config-card">
                  <mat-card-header>
                    <mat-card-title><mat-icon>palette</mat-icon> Apparence & Marque</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <div class="config-form">
                      <mat-form-field appearance="outline" class="config-field-wide">
                        <mat-label>Nom du logiciel / Titre</mat-label>
                        <input matInput [(ngModel)]="configAppName" placeholder="Quiz Compétences IA" />
                      </mat-form-field>
                      <button mat-raised-button color="primary" (click)="saveAppName()">
                        <mat-icon>save</mat-icon> Enregistrer
                      </button>
                    </div>

                    <div class="upload-row">
                      <div class="upload-block">
                        <h4>Logo</h4>
                        <div class="upload-preview" *ngIf="configHasLogo">
                          <img [src]="logoUrl" alt="Logo" class="preview-img" />
                        </div>
                        <button mat-stroked-button (click)="logoInput.click()">
                          <mat-icon>upload</mat-icon> {{ configHasLogo ? 'Changer' : 'Uploader' }} le logo
                        </button>
                        <input #logoInput type="file" accept="image/*" hidden (change)="uploadFile('logo', $event)" />
                      </div>
                      <div class="upload-block">
                        <h4>Favicon</h4>
                        <div class="upload-preview" *ngIf="configHasFavicon">
                          <img [src]="faviconUrl" alt="Favicon" class="preview-img preview-favicon" />
                        </div>
                        <button mat-stroked-button (click)="faviconInput.click()">
                          <mat-icon>upload</mat-icon> {{ configHasFavicon ? 'Changer' : 'Uploader' }} le favicon
                        </button>
                        <input #faviconInput type="file" accept="image/*" hidden (change)="uploadFile('favicon', $event)" />
                      </div>
                    </div>
                  </mat-card-content>
                </mat-card>

                <!-- Voice Config -->
                <mat-card class="config-card">
                  <mat-card-header>
                    <mat-card-title><mat-icon>record_voice_over</mat-icon> Voix ElevenLabs</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <div class="config-form">
                      <mat-form-field appearance="outline" class="config-field-wide">
                        <mat-label>Voice ID ElevenLabs</mat-label>
                        <input matInput [(ngModel)]="configVoiceId" placeholder="21m00Tcm4TlvDq8ikWAM" />
                        <mat-hint>Trouvez votre Voice ID dans le dashboard ElevenLabs</mat-hint>
                      </mat-form-field>
                      <button mat-raised-button color="primary" (click)="saveVoiceId()">
                        <mat-icon>save</mat-icon> Enregistrer
                      </button>
                    </div>
                  </mat-card-content>
                </mat-card>
              </div>
            </ng-template>
          </mat-tab>

          <!-- ═══════════════ COUTS API ═══════════════ -->
          <mat-tab>
            <ng-template mat-tab-label>
              <mat-icon>payments</mat-icon>&nbsp;Coûts API
            </ng-template>
            <ng-template matTabContent>
              <div class="tab-content">
                <!-- Cost config -->
                <mat-card class="config-card">
                  <mat-card-header>
                    <mat-card-title><mat-icon>tune</mat-icon> Tarification</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <div class="cost-config-grid">
                      <div *ngFor="let c of costConfig()" class="cost-config-row">
                        <span class="cost-label">{{ c.label }}</span>
                        <mat-form-field appearance="outline" class="cost-field">
                          <input matInput type="number" step="0.001" [ngModel]="c.value"
                                 (ngModelChange)="onCostChange(c.key, $event)" />
                          <span matSuffix>&euro;</span>
                        </mat-form-field>
                      </div>
                    </div>
                  </mat-card-content>
                </mat-card>

                <!-- Date range filter -->
                <mat-card class="config-card">
                  <mat-card-header>
                    <mat-card-title><mat-icon>date_range</mat-icon> Période</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <div class="date-row">
                      <mat-form-field appearance="outline">
                        <mat-label>Début</mat-label>
                        <input matInput [matDatepicker]="startPicker" [(ngModel)]="usageStartDate"
                               (dateChange)="loadUsage()" />
                        <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
                        <mat-datepicker #startPicker></mat-datepicker>
                      </mat-form-field>
                      <mat-form-field appearance="outline">
                        <mat-label>Fin</mat-label>
                        <input matInput [matDatepicker]="endPicker" [(ngModel)]="usageEndDate"
                               (dateChange)="loadUsage()" />
                        <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
                        <mat-datepicker #endPicker></mat-datepicker>
                      </mat-form-field>
                      <button mat-stroked-button (click)="resetDateRange()">
                        <mat-icon>clear_all</mat-icon> Tout afficher
                      </button>
                    </div>
                  </mat-card-content>
                </mat-card>

                <!-- Global totals -->
                <div class="cost-totals" *ngIf="usageStats() as u">
                  <mat-card class="stat-card accent-purple">
                    <div class="stat-value">{{ u.totals.mistral_tokens_in | number }}</div>
                    <div class="stat-label">Tokens IN (Mistral)</div>
                    <div class="stat-cost">{{ computeMistralCostIn(u.totals.mistral_tokens_in) | number:'1.2-4' }} &euro;</div>
                  </mat-card>
                  <mat-card class="stat-card accent-blue">
                    <div class="stat-value">{{ u.totals.mistral_tokens_out | number }}</div>
                    <div class="stat-label">Tokens OUT (Mistral)</div>
                    <div class="stat-cost">{{ computeMistralCostOut(u.totals.mistral_tokens_out) | number:'1.2-4' }} &euro;</div>
                  </mat-card>
                  <mat-card class="stat-card accent-green">
                    <div class="stat-value">{{ u.totals.elevenlabs_chars | number }}</div>
                    <div class="stat-label">Caractères (ElevenLabs)</div>
                    <div class="stat-cost">{{ computeElevenlabsCost(u.totals.elevenlabs_chars) | number:'1.2-4' }} &euro;</div>
                  </mat-card>
                  <mat-card class="stat-card accent-orange">
                    <div class="stat-value">{{ computeTotalCost(u.totals) | number:'1.2-2' }} &euro;</div>
                    <div class="stat-label">Coût total estimé</div>
                    <div class="stat-cost">{{ u.totals.mistral_calls + u.totals.elevenlabs_calls }} appels API</div>
                  </mat-card>
                </div>

                <!-- Per-evaluation table -->
                <mat-card class="config-card" *ngIf="usageStats() as u">
                  <mat-card-header>
                    <mat-card-title><mat-icon>table_chart</mat-icon> Détail par session</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <div class="usage-table-wrapper">
                      <table class="usage-table">
                        <thead>
                          <tr>
                            <th>Eval #</th>
                            <th>Utilisateur</th>
                            <th>Statut</th>
                            <th>Tokens IN</th>
                            <th>Tokens OUT</th>
                            <th>Caractères TTS</th>
                            <th>Coût Mistral</th>
                            <th>Coût ElevenLabs</th>
                            <th>Coût Total</th>
                            <th>Dernière activité</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr *ngFor="let row of u.per_evaluation">
                            <td>{{ row.evaluation_id || '-' }}</td>
                            <td>{{ row.user_name }}</td>
                            <td>
                              <mat-chip *ngIf="row.eval_status" [class]="'mini-chip status-' + row.eval_status">
                                {{ row.eval_status }}
                              </mat-chip>
                            </td>
                            <td class="num">{{ row.mistral_tokens_in | number }}</td>
                            <td class="num">{{ row.mistral_tokens_out | number }}</td>
                            <td class="num">{{ row.elevenlabs_chars | number }}</td>
                            <td class="num cost">{{ computeMistralCostIn(row.mistral_tokens_in) + computeMistralCostOut(row.mistral_tokens_out) | number:'1.2-4' }} &euro;</td>
                            <td class="num cost">{{ computeElevenlabsCost(row.elevenlabs_chars) | number:'1.2-4' }} &euro;</td>
                            <td class="num cost total-cost">{{ computeRowTotal(row) | number:'1.2-4' }} &euro;</td>
                            <td>{{ row.last_call | date:'dd/MM/yyyy HH:mm' }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div class="empty-state-inline" *ngIf="u.per_evaluation.length === 0">
                      <mat-icon>analytics</mat-icon>
                      <span>Aucune donnée d'utilisation pour cette période.</span>
                    </div>
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
    .collab-feedback {
      background: #e8f5e9; padding: 14px; border-radius: 10px; line-height: 1.6; font-size: 14px;
      ::ng-deep {
        strong { color: #2E7D32; font-weight: 600; }
        ul { margin: 6px 0; padding-left: 18px; }
        li { margin: 3px 0; }
      }
    }

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

    /* ── Config tab ── */
    .config-card { border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    .config-form {
      display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap;
      button { height: 56px; margin-top: 4px; }
    }
    .config-field-wide { flex: 1; min-width: 280px; }
    .upload-row { display: flex; gap: 32px; margin-top: 16px; flex-wrap: wrap; }
    .upload-block {
      h4 { margin: 0 0 8px; color: #555; }
    }
    .upload-preview { margin-bottom: 8px; }
    .preview-img { max-height: 80px; max-width: 200px; border-radius: 8px; border: 1px solid #eee; }
    .preview-favicon { max-height: 48px; max-width: 48px; }

    /* ── Cost tab ── */
    .cost-config-grid { display: flex; flex-direction: column; gap: 8px; }
    .cost-config-row {
      display: flex; align-items: center; gap: 12px;
      .cost-label { flex: 1; min-width: 200px; font-size: 14px; color: #555; }
    }
    .cost-field { width: 160px; }
    .date-row { display: flex; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
    .cost-totals {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;
    }
    .stat-cost { font-size: 13px; color: #666; margin-top: 4px; }

    .usage-table-wrapper { overflow-x: auto; }
    .usage-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
      th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #eee; }
      th { background: #f8f9fa; font-weight: 600; color: #555; position: sticky; top: 0; }
      .num { text-align: right; font-family: monospace; }
      .cost { color: #6C63FF; }
      .total-cost { font-weight: 600; color: #333; }
    }
    .mini-chip { font-size: 10px !important; height: 20px !important; min-height: 20px !important; }

    @media (max-width: 768px) {
      .stats-grid, .cost-totals { grid-template-columns: repeat(2, 1fr); }
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
  ficheMessages = signal<Record<number, any[]>>({});
  creatingUser = signal(false);

  // Config
  configAppName = '';
  configVoiceId = '';
  configHasLogo = false;
  configHasFavicon = false;
  logoUrl = '';
  faviconUrl = '';

  // Cost
  costConfig = signal<CostConfigItem[]>([]);
  usageStats = signal<UsageStats | null>(null);
  usageStartDate: Date | null = null;
  usageEndDate: Date | null = null;

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
    this.loadConfig();
    this.loadCostConfig();
    this.loadUsage();
  }

  loadData(): void {
    this.adminService.getUsers().subscribe((u) => this.users.set(u));
    this.adminService.getAllEvaluations().subscribe((e) => this.evaluations.set(e));
    this.adminService.getStats().subscribe((s) => this.stats.set(s));
  }

  loadConfig(): void {
    this.adminService.getConfig().subscribe((cfg) => {
      this.configAppName = cfg['app_name'] || '';
      this.configVoiceId = cfg['elevenlabs_voice_id'] || '';
      this.configHasLogo = !!cfg['logo_path'];
      this.configHasFavicon = !!cfg['favicon_path'];
      const base = environment.apiUrl;
      this.logoUrl = `${base}/admin/config/asset/logo?t=${Date.now()}`;
      this.faviconUrl = `${base}/admin/config/asset/favicon?t=${Date.now()}`;
    });
  }

  loadCostConfig(): void {
    this.adminService.getCostConfig().subscribe((c) => this.costConfig.set(c));
  }

  loadUsage(): void {
    const fmt = (d: Date | null) => d ? d.toISOString().slice(0, 10) : undefined;
    this.adminService.getUsageStats(fmt(this.usageStartDate), fmt(this.usageEndDate))
      .subscribe((u) => this.usageStats.set(u));
  }

  saveAppName(): void {
    this.adminService.updateConfig('app_name', this.configAppName).subscribe(() => {
      this.snackBar.open('Nom enregistré', 'OK', { duration: 3000 });
      // Update page title dynamically
      document.title = this.configAppName;
    });
  }

  saveVoiceId(): void {
    this.adminService.updateConfig('elevenlabs_voice_id', this.configVoiceId).subscribe(() => {
      this.snackBar.open('Voice ID enregistré', 'OK', { duration: 3000 });
    });
  }

  uploadFile(type: 'logo' | 'favicon', event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    this.adminService.uploadAsset(type, file).subscribe({
      next: () => {
        this.snackBar.open(`${type === 'logo' ? 'Logo' : 'Favicon'} mis à jour`, 'OK', { duration: 3000 });
        this.loadConfig();
        if (type === 'favicon') {
          this.updateFavicon();
        }
      },
      error: (err) => {
        this.snackBar.open(err.error?.detail || 'Erreur upload', 'OK', { duration: 4000 });
      },
    });
  }

  updateFavicon(): void {
    const link = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
    if (link) {
      link.href = `${environment.apiUrl}/admin/config/asset/favicon?t=${Date.now()}`;
    }
  }

  onCostChange(key: string, value: number): void {
    this.adminService.updateCostConfig(key, value).subscribe(() => {
      // Update local state for immediate recalculation
      this.costConfig.update((configs) =>
        configs.map((c) => c.key === key ? { ...c, value } : c)
      );
    });
  }

  resetDateRange(): void {
    this.usageStartDate = null;
    this.usageEndDate = null;
    this.loadUsage();
  }

  getCostValue(key: string): number {
    return this.costConfig().find((c) => c.key === key)?.value || 0;
  }

  computeMistralCostIn(tokens: number): number {
    return (tokens / 1_000_000) * this.getCostValue('mistral_cost_per_1m_tokens_in');
  }

  computeMistralCostOut(tokens: number): number {
    return (tokens / 1_000_000) * this.getCostValue('mistral_cost_per_1m_tokens_out');
  }

  computeElevenlabsCost(chars: number): number {
    return (chars / 1000) * this.getCostValue('elevenlabs_cost_per_1k_chars');
  }

  computeTotalCost(totals: UsageStats['totals']): number {
    return this.computeMistralCostIn(totals.mistral_tokens_in)
      + this.computeMistralCostOut(totals.mistral_tokens_out)
      + this.computeElevenlabsCost(totals.elevenlabs_chars);
  }

  computeRowTotal(row: any): number {
    return this.computeMistralCostIn(row.mistral_tokens_in)
      + this.computeMistralCostOut(row.mistral_tokens_out)
      + this.computeElevenlabsCost(row.elevenlabs_chars);
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
    this.adminService.getCollaborateurFiche(user.id).subscribe({
      next: (fiche) => {
        this.selectedFiche.set(fiche);
      },
      error: (err) => {
        console.error('Erreur chargement fiche:', err);
        // Fallback: build a minimal fiche from locally available data
        const userEvals = this.evaluations()
          .filter((e) => e.user_id === user.id && e.status === 'completed');
        const fallbackFiche: CollaborateurFiche = {
          collaborateur: {
            id: user.id,
            nom: user.full_name,
            email: user.email,
            username: user.username,
            role: user.role,
          },
          evaluations: userEvals.map((ev) => ({
            id: ev.id,
            date: ev.completed_at,
            job_role: ev.job_role ?? null,
            job_domain: ev.job_domain ?? null,
            detected_level: ev.detected_level ?? null,
            score_global: ev.scores?.score_global ?? null,
            scores: ev.scores ? {
              'Connaissance du marché': ev.scores.score_market_knowledge ?? null,
              'Terminologie': ev.scores.score_terminology ?? null,
              'Intérêt & curiosité': ev.scores.score_interest_curiosity ?? null,
              'Veille personnelle': ev.scores.score_personal_watch ?? null,
              'Niveau technique': ev.scores.score_technical_level ?? null,
              'Utilisation IA': ev.scores.score_ai_usage ?? null,
              'Intégration & déploiement': ev.scores.score_integration_deployment ?? null,
              'Conception & dev': ev.scores.score_conception_dev ?? null,
            } as Record<string, number | null> : {} as Record<string, number | null>,
            feedback_collaborateur: ev.feedback_collaborator ?? null,
            feedback_admin: ev.feedback_admin ?? null,
          })),
        };
        this.selectedFiche.set(fallbackFiche);
        this.snackBar.open(
          'Fiche chargée depuis les données locales (le serveur a renvoyé une erreur)',
          'OK',
          { duration: 4000 }
        );
      },
    });
  }

  closeFiche(): void {
    this.selectedFiche.set(null);
    this.ficheMessages.set({});
  }

  loadFicheConversation(evalId: number): void {
    this.adminService.getEvaluationDetail(evalId).subscribe({
      next: (detail) => {
        this.ficheMessages.update((map) => ({
          ...map,
          [evalId]: detail.messages || [],
        }));
      },
    });
  }

  hideFicheConversation(evalId: number): void {
    this.ficheMessages.update((map) => {
      const copy = { ...map };
      delete copy[evalId];
      return copy;
    });
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

  formatFeedback(text: string): string {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>')
      .replace(/\n(?!<)/g, '<br>');
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
