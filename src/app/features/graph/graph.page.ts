import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { CurrencyStateService } from '../../state/currency.state';
import { CurrencyService } from '../../core/services/currency.service';
import { Currency } from '../../models/currency.model';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Register all Chart.js components
Chart.register(...registerables);

type TimeRange = '1W' | '1M' | '3M' | '6M' | '1Y';

@Component({
  selector: 'app-graph',
  templateUrl: './graph.page.html',
  styleUrls: ['./graph.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class GraphPage implements OnInit, OnDestroy {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef;
  
  selectedBaseCurrency: string = 'USD';
  selectedTargetCurrency: string = 'EUR';
  timeRange: TimeRange = '1M';
  currencies: Currency[] = [];
  chart: Chart | null = null;
  isLoading = false;
  errorMessage: string | null = null;
  
  private destroy$ = new Subject<void>();

  constructor(
    private currencyService: CurrencyService,
    private currencyState: CurrencyStateService
  ) {}

  ngOnInit() {
    this.currencies = this.currencyService.getAvailableCurrencies();
    this.setupStateSubscriptions();
    this.loadInitialData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.chart) {
      this.chart.destroy();
    }
  }

  private setupStateSubscriptions() {
    this.currencyState.selectedBaseCurrency$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(currency => {
      this.selectedBaseCurrency = currency.code;
      this.updateChart();
    });

    this.currencyState.selectedTargetCurrency$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(currency => {
      this.selectedTargetCurrency = currency.code;
      this.updateChart();
    });
  }

  private async loadInitialData() {
    await this.updateChart();
  }

  async onBaseCurrencyChange(event: any) {
    const currencyCode = event.detail.value;
    const currency = this.currencies.find(c => c.code === currencyCode);
    if (currency) {
      this.currencyState.setBaseCurrency(currency);
    }
  }

  async onTargetCurrencyChange(event: any) {
    const currencyCode = event.detail.value;
    const currency = this.currencies.find(c => c.code === currencyCode);
    if (currency) {
      this.currencyState.setTargetCurrency(currency);
    }
  }

  onTimeRangeChange(event: CustomEvent) {
    const value = event.detail.value;
    if (this.isValidTimeRange(value)) {
      this.timeRange = value;
      this.updateChart();
    }
  }

  private isValidTimeRange(value: any): value is TimeRange {
    return ['1W', '1M', '3M', '6M', '1Y'].includes(value);
  }

  private async updateChart() {
    if (!this.chartCanvas) return;

    this.isLoading = true;
    this.errorMessage = null;

    try {
      // Get historical data from service
      const endDate = new Date();
      const startDate = this.calculateStartDate(this.timeRange);
      
      const data = await firstValueFrom(this.currencyService.getHistoricalRates(
        this.selectedBaseCurrency,
        this.selectedTargetCurrency,
        startDate,
        endDate
      ));

      if (data && data.rates) {
        this.createOrUpdateChart(data.rates);
      }
    } catch (error) {
      this.errorMessage = 'Failed to load historical data';
      console.error('Chart update error:', error);
    } finally {
      this.isLoading = false;
    }
  }

  private calculateStartDate(range: TimeRange): Date {
    const date = new Date();
    switch (range) {
      case '1W':
        date.setDate(date.getDate() - 7);
        break;
      case '1M':
        date.setMonth(date.getMonth() - 1);
        break;
      case '3M':
        date.setMonth(date.getMonth() - 3);
        break;
      case '6M':
        date.setMonth(date.getMonth() - 6);
        break;
      case '1Y':
        date.setFullYear(date.getFullYear() - 1);
        break;
    }
    return date;
  }

  private createOrUpdateChart(rates: { [date: string]: number }) {
    const dates = Object.keys(rates).sort();
    const values = dates.map(date => rates[date]);

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: dates.map(date => new Date(date).toLocaleDateString()),
        datasets: [{
          label: `${this.selectedBaseCurrency}/${this.selectedTargetCurrency} Exchange Rate`,
          data: values,
          fill: false,
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: true,
            text: 'Currency Exchange Rate Trend'
          }
        },
        scales: {
          y: {
            beginAtZero: false
          }
        }
      }
    };

    if (this.chart) {
      this.chart.data = config.data;
      this.chart.update();
    } else {
      this.chart = new Chart(this.chartCanvas.nativeElement, config);
    }
  }
} 