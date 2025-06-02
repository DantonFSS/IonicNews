import { Injectable } from '@angular/core';
import { Platform } from '@ionic/angular';
import { LocalNotifications } from '@capacitor/local-notifications';
import { SettingsStateService } from '../../state/settings.state';
import { CurrencyStateService } from '../../state/currency.state';
import { Currency } from '../../models/currency.model';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private previousRates: { [key: string]: number } = {};
  private notificationId = 1;

  constructor(
    private platform: Platform,
    private settingsState: SettingsStateService,
    private currencyState: CurrencyStateService
  ) {
    this.initializeNotifications();
  }

  private async initializeNotifications() {
    if (this.platform.is('capacitor')) {
      try {
        const permissionStatus = await LocalNotifications.checkPermissions();
        if (permissionStatus.display !== 'granted') {
          const request = await LocalNotifications.requestPermissions();
          if (request.display !== 'granted') {
            console.warn('Notification permissions not granted');
            await this.settingsState.setNotifications(false);
            return;
          }
        }
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
        await this.settingsState.setNotifications(false);
      }
    }
  }

  async checkRateChanges(
    baseCurrency: Currency,
    targetCurrency: Currency,
    currentRate: number
  ): Promise<void> {
    const settings = await firstValueFrom(this.settingsState.settings$);
    
    if (!settings.enableNotifications) {
      return;
    }

    const rateKey = `${baseCurrency.code}-${targetCurrency.code}`;
    const previousRate = this.previousRates[rateKey];

    if (previousRate) {
      const changePercentage = Math.abs(((currentRate - previousRate) / previousRate) * 100);

      if (changePercentage >= settings.rateAlertThreshold) {
        await this.sendRateChangeNotification(
          baseCurrency,
          targetCurrency,
          changePercentage,
          currentRate > previousRate
        );
      }
    }

    this.previousRates[rateKey] = currentRate;
  }

  private async sendRateChangeNotification(
    baseCurrency: Currency,
    targetCurrency: Currency,
    changePercentage: number,
    isIncrease: boolean
  ): Promise<void> {
    if (!this.platform.is('capacitor')) {
      return;
    }

    const direction = isIncrease ? 'increased' : 'decreased';
    const title = 'Exchange Rate Alert';
    const body = `${baseCurrency.code}/${targetCurrency.code} has ${direction} by ${changePercentage.toFixed(2)}%`;

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationId++,
            title,
            body,
            schedule: { at: new Date() },
            sound: 'default',
            actionTypeId: 'RATE_CHANGE',
            extra: {
              baseCurrency: baseCurrency.code,
              targetCurrency: targetCurrency.code,
              changePercentage,
              isIncrease
            }
          }
        ]
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  async sendCustomNotification(title: string, body: string): Promise<void> {
    if (!this.platform.is('capacitor')) {
      return;
    }

    const settings = await firstValueFrom(this.settingsState.settings$);
    if (!settings.enableNotifications) {
      return;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: this.notificationId++,
            title,
            body,
            schedule: { at: new Date() },
            sound: 'default'
          }
        ]
      });
    } catch (error) {
      console.error('Failed to send custom notification:', error);
    }
  }

  async clearAllNotifications(): Promise<void> {
    if (!this.platform.is('capacitor')) {
      return;
    }

    try {
      const pendingNotifications = await LocalNotifications.getPending();
      if (pendingNotifications.notifications.length > 0) {
        const ids = pendingNotifications.notifications.map(n => n.id);
        await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
      }
    } catch (error) {
      console.error('Failed to clear notifications:', error);
    }
  }
} 