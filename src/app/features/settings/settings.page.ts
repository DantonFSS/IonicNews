import { Component, OnInit, OnDestroy } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsStateService } from '../../state/settings.state';
import { CurrencyService } from '../../core/services/currency.service';
import { Currency } from '../../models/currency.model';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule, FormsModule]
})
export class SettingsPage implements OnInit, OnDestroy {
  syncIntervals = [
    { value: 30000, label: '30 seconds' },
    { value: 60000, label: '1 minute' },
    { value: 300000, label: '5 minutes' },
    { value: 600000, label: '10 minutes' },
    { value: 1800000, label: '30 minutes' },
    { value: 3600000, label: '1 hour' }
  ];

  currencies: Currency[] = [];
  settings = {
    syncInterval: 60000,
    enableNotifications: false,
    darkMode: false,
    defaultBaseCurrency: 'USD',
    defaultTargetCurrency: 'EUR',
    autoRefresh: true,
    maxHistoryItems: 50,
    rateAlertThreshold: 5,
    offlineMode: false
  };

  private destroy$ = new Subject<void>();

  constructor(
    private settingsState: SettingsStateService,
    private currencyService: CurrencyService
  ) {}

  ngOnInit() {
    this.currencies = this.currencyService.getAvailableCurrencies();
    this.loadSettings();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadSettings() {
    this.settingsState.settings$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(settings => {
      this.settings = { ...settings };
    });
  }

  async onSyncIntervalChange(event: CustomEvent) {
    const value = event.detail.value;
    await this.settingsState.updateSettings({ syncInterval: value });
  }

  async onNotificationsChange(event: CustomEvent) {
    const value = event.detail.checked;
    await this.settingsState.updateSettings({ enableNotifications: value });
  }

  async onDarkModeChange(event: CustomEvent) {
    const value = event.detail.checked;
    await this.settingsState.updateSettings({ darkMode: value });
    document.body.classList.toggle('dark', value);
  }

  async onBaseCurrencyChange(event: CustomEvent) {
    const value = event.detail.value;
    await this.settingsState.updateSettings({ defaultBaseCurrency: value });
  }

  async onTargetCurrencyChange(event: CustomEvent) {
    const value = event.detail.value;
    await this.settingsState.updateSettings({ defaultTargetCurrency: value });
  }

  async onAutoRefreshChange(event: CustomEvent) {
    const value = event.detail.checked;
    await this.settingsState.updateSettings({ autoRefresh: value });
  }

  async onMaxHistoryItemsChange(event: CustomEvent) {
    const value = parseInt(event.detail.value, 10);
    if (!isNaN(value) && value > 0) {
      await this.settingsState.updateSettings({ maxHistoryItems: value });
    }
  }

  async onRateAlertThresholdChange(event: CustomEvent) {
    const value = parseInt(event.detail.value, 10);
    if (!isNaN(value) && value > 0) {
      await this.settingsState.updateSettings({ rateAlertThreshold: value });
    }
  }

  async onOfflineModeChange(event: CustomEvent) {
    const value = event.detail.checked;
    await this.settingsState.updateSettings({ offlineMode: value });
  }

  async clearAllData() {
    const alert = document.createElement('ion-alert');
    alert.header = 'Clear All Data';
    alert.message = 'Are you sure you want to clear all app data? This action cannot be undone.';
    alert.buttons = [
      {
        text: 'Cancel',
        role: 'cancel'
      },
      {
        text: 'Clear',
        role: 'destructive',
        handler: async () => {
          await this.settingsState.clearAllData();
        }
      }
    ];

    document.body.appendChild(alert);
    await alert.present();
  }
} 