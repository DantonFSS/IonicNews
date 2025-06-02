import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { Currency, ExchangeRates } from '../models/currency.model';

export interface CurrencyState {
  selectedBaseCurrency: Currency;
  selectedTargetCurrency: Currency;
  amount: number;
  rates: ExchangeRates | null;
  lastUpdate: string;
  isLoading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class CurrencyStateService {
  private readonly DEFAULT_BASE_CURRENCY: Currency = {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$'
  };

  private readonly DEFAULT_TARGET_CURRENCY: Currency = {
    code: 'EUR',
    name: 'Euro',
    symbol: '€'
  };

  private state = new BehaviorSubject<CurrencyState>({
    selectedBaseCurrency: this.DEFAULT_BASE_CURRENCY,
    selectedTargetCurrency: this.DEFAULT_TARGET_CURRENCY,
    amount: 1,
    rates: null,
    lastUpdate: '',
    isLoading: false,
    error: null
  });

  // Expose individual state observables
  readonly selectedBaseCurrency$: Observable<Currency> = this.state.pipe(
    map(state => state.selectedBaseCurrency)
  );

  readonly selectedTargetCurrency$: Observable<Currency> = this.state.pipe(
    map(state => state.selectedTargetCurrency)
  );

  readonly amount$: Observable<number> = this.state.pipe(
    map(state => state.amount)
  );

  readonly rates$: Observable<ExchangeRates | null> = this.state.pipe(
    map(state => state.rates)
  );

  readonly lastUpdate$: Observable<string> = this.state.pipe(
    map(state => state.lastUpdate)
  );

  readonly isLoading$: Observable<boolean> = this.state.pipe(
    map(state => state.isLoading)
  );

  readonly error$: Observable<string | null> = this.state.pipe(
    map(state => state.error)
  );

  // Computed observables
  readonly currentRate$: Observable<number | null> = combineLatest([
    this.rates$,
    this.selectedTargetCurrency$
  ]).pipe(
    map(([rates, target]) => 
      rates ? rates.rates[target.code] : null
    )
  );

  readonly convertedAmount$: Observable<number | null> = combineLatest([
    this.amount$,
    this.currentRate$
  ]).pipe(
    map(([amount, rate]) => 
      rate !== null ? amount * rate : null
    )
  );

  // State update methods
  setBaseCurrency(currency: Currency): void {
    this.updateState({ selectedBaseCurrency: currency });
  }

  setTargetCurrency(currency: Currency): void {
    this.updateState({ selectedTargetCurrency: currency });
  }

  setAmount(amount: number): void {
    this.updateState({ amount });
  }

  setRates(rates: ExchangeRates): void {
    this.updateState({
      rates,
      lastUpdate: new Date().toISOString(),
      error: null
    });
  }

  setLoading(isLoading: boolean): void {
    this.updateState({ isLoading });
  }

  setError(error: string | null): void {
    this.updateState({ error, isLoading: false });
  }

  // Swap base and target currencies
  swapCurrencies(): void {
    const currentState = this.state.value;
    this.updateState({
      selectedBaseCurrency: currentState.selectedTargetCurrency,
      selectedTargetCurrency: currentState.selectedBaseCurrency
    });
  }

  // Reset state to defaults
  resetState(): void {
    this.state.next({
      selectedBaseCurrency: this.DEFAULT_BASE_CURRENCY,
      selectedTargetCurrency: this.DEFAULT_TARGET_CURRENCY,
      amount: 1,
      rates: null,
      lastUpdate: '',
      isLoading: false,
      error: null
    });
  }

  private updateState(partialState: Partial<CurrencyState>): void {
    this.state.next({
      ...this.state.value,
      ...partialState
    });
  }

  // Get current state snapshot
  getStateSnapshot(): CurrencyState {
    return this.state.value;
  }
} 