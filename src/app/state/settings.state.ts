import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StorageService } from '../core/storage/storage.service';

export interface AppSettings {
  syncInterval: number;  // in milliseconds
  enableNotifications: boolean;
  darkMode: boolean;
  defaultBaseCurrency: string;
  defaultTargetCurrency: string;
  autoRefresh: boolean;
  maxHistoryItems: number;
  rateAlertThreshold: number;  // percentage change to trigger notification
  offlineMode: boolean;
}

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({
  providedIn: 'root'
})
export class SettingsStateService {
  private readonly STORAGE_KEY = 'app_settings';
  
  private readonly DEFAULT_SETTINGS: AppSettings = {
    syncInterval: 5 * 60 * 1000, // 5 minutes
    enableNotifications: true,
    darkMode: false,
    defaultBaseCurrency: 'USD',
    defaultTargetCurrency: 'EUR',
    autoRefresh: true,
    maxHistoryItems: 50,
    rateAlertThreshold: 5, // 5% change
    offlineMode: false
  };

  private settings = new BehaviorSubject<AppSettings>(this.DEFAULT_SETTINGS);

  constructor(private storage: StorageService) {
    this.loadSettings();
  }

  // Expose settings as observables
  readonly settings$ = this.settings.asObservable();
  
  readonly syncInterval$ = this.settings.pipe(
    map(settings => settings.syncInterval)
  );

  readonly notifications$ = this.settings.pipe(
    map(settings => settings.enableNotifications)
  );

  readonly darkMode$ = this.settings.pipe(
    map(settings => settings.darkMode)
  );

  readonly defaultCurrencies$ = this.settings.pipe(
    map(settings => ({
      base: settings.defaultBaseCurrency,
      target: settings.defaultTargetCurrency
    }))
  );

  readonly autoRefresh$ = this.settings.pipe(
    map(settings => settings.autoRefresh)
  );

  readonly offlineMode$ = this.settings.pipe(
    map(settings => settings.offlineMode)
  );

  // Settings update methods
  async updateSettings(partialSettings: Partial<AppSettings>): Promise<void> {
    const newSettings = {
      ...this.settings.value,
      ...partialSettings
    };
    
    await this.saveSettings(newSettings);
    this.settings.next(newSettings);
  }

  async setSyncInterval(interval: number): Promise<void> {
    await this.updateSettings({ syncInterval: interval });
  }

  async setNotifications(enabled: boolean): Promise<void> {
    await this.updateSettings({ enableNotifications: enabled });
  }

  async setDarkMode(enabled: boolean): Promise<void> {
    await this.updateSettings({ darkMode: enabled });
  }

  async setDefaultCurrencies(base: string, target: string): Promise<void> {
    await this.updateSettings({
      defaultBaseCurrency: base,
      defaultTargetCurrency: target
    });
  }

  async setAutoRefresh(enabled: boolean): Promise<void> {
    await this.updateSettings({ autoRefresh: enabled });
  }

  async setOfflineMode(enabled: boolean): Promise<void> {
    await this.updateSettings({ offlineMode: enabled });
  }

  async setRateAlertThreshold(threshold: number): Promise<void> {
    await this.updateSettings({ rateAlertThreshold: threshold });
  }

  async setMaxHistoryItems(max: number): Promise<void> {
    await this.updateSettings({ maxHistoryItems: max });
  }

  // Reset settings to defaults
  async resetSettings(): Promise<void> {
    await this.saveSettings(this.DEFAULT_SETTINGS);
    this.settings.next(this.DEFAULT_SETTINGS);
  }

  // Get current settings snapshot
  getSettingsSnapshot(): AppSettings {
    return this.settings.value;
  }

  private async loadSettings(): Promise<void> {
    try {
      const stored = await this.storage.get<AppSettings>(this.STORAGE_KEY);
      if (stored) {
        // Merge stored settings with defaults to handle new settings properties
        const mergedSettings = {
          ...this.DEFAULT_SETTINGS,
          ...stored
        };
        this.settings.next(mergedSettings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Fallback to defaults if loading fails
      this.settings.next(this.DEFAULT_SETTINGS);
    }
  }

  private async saveSettings(settings: AppSettings): Promise<void> {
    try {
      await this.storage.set(this.STORAGE_KEY, settings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw new Error('Failed to save settings');
    }
  }

  // Clear all application data
  async clearAllData(): Promise<void> {
    try {
      // Clear all data from storage
      await this.storage.clear();
      
      // Reset settings to defaults
      await this.resetSettings();
      
      // Emit success event or handle additional cleanup if needed
      console.log('All data cleared successfully');
    } catch (error) {
      console.error('Failed to clear data:', error);
      throw new Error('Failed to clear application data');
    }
  }
} 