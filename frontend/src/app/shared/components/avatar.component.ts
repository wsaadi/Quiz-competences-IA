import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="avatar-container" [class]="mood">
      <svg viewBox="0 0 120 120" [attr.width]="size" [attr.height]="size">
        <!-- Head -->
        <circle cx="60" cy="50" r="35" fill="#6C63FF" class="head" />

        <!-- Eyes -->
        <ellipse [attr.cx]="45" cy="45" rx="5" ry="6" fill="white" class="eye left-eye" />
        <ellipse [attr.cx]="75" cy="45" rx="5" ry="6" fill="white" class="eye right-eye" />
        <circle [attr.cx]="46" cy="45" r="3" fill="#333" class="pupil left-pupil" />
        <circle [attr.cx]="76" cy="45" r="3" fill="#333" class="pupil right-pupil" />

        <!-- Eyebrows -->
        <path
          [attr.d]="eyebrowPath"
          stroke="#4A45B5"
          stroke-width="2.5"
          fill="none"
          stroke-linecap="round"
          class="eyebrow"
        />

        <!-- Mouth -->
        <path
          [attr.d]="mouthPath"
          stroke="white"
          stroke-width="2.5"
          fill="none"
          stroke-linecap="round"
          class="mouth"
        />

        <!-- Antenna -->
        <line x1="60" y1="15" x2="60" y2="5" stroke="#6C63FF" stroke-width="2" />
        <circle cx="60" cy="3" r="3" class="antenna-dot" />

        <!-- Blush -->
        <circle cx="35" cy="55" r="5" fill="#FF9FF3" opacity="0.4" class="blush" />
        <circle cx="85" cy="55" r="5" fill="#FF9FF3" opacity="0.4" class="blush" />
      </svg>
      <div class="avatar-label" *ngIf="label">{{ label }}</div>
    </div>
  `,
  styles: [`
    :host { display: inline-block; }
    .avatar-container { text-align: center; }

    .head {
      animation: float 3s ease-in-out infinite;
    }

    .eye {
      animation: blink 4s ease-in-out infinite;
    }

    .antenna-dot {
      fill: #FF6B6B;
      animation: pulse 1.5s ease-in-out infinite;
    }

    .thinking .head {
      animation: float 2s ease-in-out infinite, tilt 2s ease-in-out infinite;
    }

    .thinking .pupil {
      animation: look-around 3s ease-in-out infinite;
    }

    .happy .mouth {
      animation: smile-bounce 0.5s ease-out;
    }

    .happy .blush {
      opacity: 0.6 !important;
    }

    .avatar-label {
      margin-top: 4px;
      font-size: 12px;
      font-weight: 500;
      color: #6C63FF;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-3px); }
    }

    @keyframes blink {
      0%, 45%, 55%, 100% { ry: 6; }
      50% { ry: 1; }
    }

    @keyframes pulse {
      0%, 100% { r: 3; opacity: 1; }
      50% { r: 4; opacity: 0.7; }
    }

    @keyframes tilt {
      0%, 100% { transform: rotate(0deg); }
      50% { transform: rotate(5deg); }
    }

    @keyframes look-around {
      0%, 100% { cx: inherit; }
      25% { transform: translateX(-2px); }
      75% { transform: translateX(2px); }
    }

    @keyframes smile-bounce {
      0% { transform: scale(1); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }
  `],
})
export class AvatarComponent implements OnChanges {
  @Input() size = 80;
  @Input() mood: 'neutral' | 'happy' | 'thinking' | 'encouraging' = 'neutral';
  @Input() label = '';

  mouthPath = 'M 45 62 Q 60 72 75 62';
  eyebrowPath = 'M 37 35 Q 45 32 53 35 M 67 35 Q 75 32 83 35';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mood']) {
      this.updateExpression();
    }
  }

  private updateExpression(): void {
    switch (this.mood) {
      case 'happy':
        this.mouthPath = 'M 42 60 Q 60 78 78 60';
        this.eyebrowPath = 'M 37 33 Q 45 28 53 33 M 67 33 Q 75 28 83 33';
        break;
      case 'thinking':
        this.mouthPath = 'M 50 65 Q 60 63 70 65';
        this.eyebrowPath = 'M 37 33 Q 45 30 53 35 M 67 33 Q 75 30 83 35';
        break;
      case 'encouraging':
        this.mouthPath = 'M 43 61 Q 60 75 77 61';
        this.eyebrowPath = 'M 37 34 Q 45 29 53 34 M 67 34 Q 75 29 83 34';
        break;
      default:
        this.mouthPath = 'M 45 62 Q 60 72 75 62';
        this.eyebrowPath = 'M 37 35 Q 45 32 53 35 M 67 35 Q 75 32 83 35';
    }
  }
}
