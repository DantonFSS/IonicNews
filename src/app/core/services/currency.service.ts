import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, from, firstValueFrom } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Currency, ExchangeRates, ConversionResult } from '../../models/currency.model';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from './notifications.service';

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  private apiUrl = environment.apiUrl;
  private ratesSubject = new BehaviorSubject<ExchangeRates | null>(null);
  private lastUpdate = new BehaviorSubject<string>('');
  private currentBase = 'USD';
  
  rates$ = this.ratesSubject.asObservable();
  lastUpdate$ = this.lastUpdate.asObservable();

  // Common currencies list
  private currencies: Currency[] = [
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
    { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
    { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
    { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr' },
    { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
    { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
    { code: 'INR', name: 'Indian Rupee', symbol: '₹' }
  ];

  constructor(
    private http: HttpClient,
    private storage: StorageService,
    private notificationsService: NotificationsService
  ) {
    this.loadStoredRates();
  }

  private isExchangeRates(data: any): data is ExchangeRates {
    return (
      data &&
      typeof data === 'object' &&
      'base' in data &&
      'date' in data &&
      'rates' in data &&
      typeof data.base === 'string' &&
      typeof data.date === 'string' &&
      typeof data.rates === 'object'
    );
  }

  private async loadStoredRates() {
    const stored = await this.storage.get<ExchangeRates>('latestRates');
    if (stored && this.isExchangeRates(stored)) {
      this.ratesSubject.next(stored);
      this.lastUpdate.next(stored.date);
      this.currentBase = stored.base;
    }
  }

  getAvailableCurrencies(): Currency[] {
    return this.currencies;
  }

  async refreshRates(): Promise<void> {
    try {
      const rates = await firstValueFrom(this.getLatestRates(this.currentBase));
      this.ratesSubject.next(rates);
      this.lastUpdate.next(rates.date);
      await this.storage.set('latestRates', rates);
    } catch (error) {
      console.error('Failed to refresh rates:', error);
      throw error;
    }
  }

  getLatestRates(base: string = 'USD'): Observable<ExchangeRates> {
    this.currentBase = base;
    return this.http.get<ExchangeRates>(`${this.apiUrl}/latest/${base}`).pipe(
      tap(async (rates) => {
        const previousRates = this.ratesSubject.value;
        this.ratesSubject.next(rates);
        this.lastUpdate.next(rates.date);
        await this.storage.set('latestRates', rates);

        // Check for significant rate changes and notify
        if (previousRates) {
          for (const [code, rate] of Object.entries(rates.rates)) {
            const baseCurrency = this.currencies.find(c => c.code === base);
            const targetCurrency = this.currencies.find(c => c.code === code);
            
            if (baseCurrency && targetCurrency) {
              await this.notificationsService.checkRateChanges(
                baseCurrency,
                targetCurrency,
                rate
              );
            }
          }
        }
      }),
      catchError(() => {
        return from(this.storage.get<ExchangeRates>('latestRates')).pipe(
          map(stored => {
            if (stored && this.isExchangeRates(stored)) return stored;
            throw new Error('No stored rates available');
          })
        );
      })
    );
  }

  getHistoricalRates(
    baseCurrency: string,
    targetCurrency: string,
    startDate: Date,
    endDate: Date
  ): Observable<ExchangeRates> {
    const start = this.formatDate(startDate);
    const end = this.formatDate(endDate);
    
    return this.http.get<ExchangeRates>(
      `${this.apiUrl}/history/${baseCurrency}/${targetCurrency}/${start}/${end}`
    ).pipe(
      catchError(() => {
        return from(this.storage.get<ExchangeRates>(`historical_${baseCurrency}_${targetCurrency}`)).pipe(
          map(stored => {
            if (stored && this.isExchangeRates(stored)) return stored;
            throw new Error('No stored historical data available');
          })
        );
      }),
      tap(async (rates) => {
        await this.storage.set(
          `historical_${baseCurrency}_${targetCurrency}`,
          rates
        );
      })
    );
  }

  convert(amount: number, from: string, to: string): Observable<ConversionResult> {
    return this.getLatestRates(from).pipe(
      map(rates => {
        const rate = rates.rates[to];
        const result: ConversionResult = {
          from: this.currencies.find(c => c.code === from) || { code: from, name: from, symbol: '' },
          to: this.currencies.find(c => c.code === to) || { code: to, name: to, symbol: '' },
          amount,
          result: amount * rate,
          rate,
          date: rates.date
        };
        return result;
      })
    );
  }

  reverseConvert(amount: number, from: string, to: string): Observable<ConversionResult> {
    return this.convert(amount, to, from);
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
} 