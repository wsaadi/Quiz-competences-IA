import { Component, Input, NgZone, ViewChild, ElementRef, AfterViewInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

@Component({
  selector: 'app-score-radar',
  standalone: true,
  imports: [CommonModule],
  template: `<div class="chart-wrapper"><canvas #chartCanvas></canvas></div>`,
  styles: [`.chart-wrapper { position: relative; max-width: 450px; margin: 0 auto; }`],
})
export class ScoreRadarComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Input() scores: any = {};

  private chart: Chart | null = null;

  constructor(private ngZone: NgZone) {}

  private readonly labels = [
    'Connaissance marché',
    'Terminologie',
    'Intérêt & curiosité',
    'Veille perso',
    'Niveau technique',
    'Utilisation IA',
    'Intégration & déploiement',
    'Conception & dev',
  ];

  private readonly keys = [
    'score_market_knowledge',
    'score_terminology',
    'score_interest_curiosity',
    'score_personal_watch',
    'score_technical_level',
    'score_ai_usage',
    'score_integration_deployment',
    'score_conception_dev',
  ];

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => this.createChart());
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['scores'] && this.chart) {
      this.ngZone.runOutsideAngular(() => this.updateChart());
    }
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  private getData(): number[] {
    return this.keys.map((k) => (this.scores as any)[k] ?? 0);
  }

  private createChart(): void {
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: this.labels,
        datasets: [
          {
            label: 'Score',
            data: this.getData(),
            backgroundColor: 'rgba(108, 99, 255, 0.2)',
            borderColor: '#6C63FF',
            borderWidth: 2,
            pointBackgroundColor: '#6C63FF',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        animation: { duration: 400 },
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: { stepSize: 20, font: { size: 10 } },
            pointLabels: { font: { size: 11 } },
          },
        },
        plugins: {
          legend: { display: false },
        },
      },
    });
  }

  private updateChart(): void {
    if (!this.chart) return;
    this.chart.data.datasets[0].data = this.getData();
    this.chart.update();
  }
}
