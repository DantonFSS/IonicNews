import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConversionHistory } from '../models/currency.model';

export interface HistoryState {
  conversions: ConversionHistory[];
  lastSync: number;
  filter?: string;
  sortOrder: 'asc' | 'desc';
}

@Injectable({
  providedIn: 'root'
})
export class HistoryStateService {
  private readonly INITIAL_STATE: HistoryState = {
    conversions: [],
    lastSync: 0,
    sortOrder: 'desc'
  };

  private state = new BehaviorSubject<HistoryState>(this.INITIAL_STATE);

  // Expose state observables
  readonly conversions$ = this.state.pipe(
    map(state => this.sortConversions(state.conversions, state.sortOrder))
  );

  readonly lastSync$ = this.state.pipe(
    map(state => state.lastSync)
  );

  readonly filter$ = this.state.pipe(
    map(state => state.filter)
  );

  readonly filteredConversions$ = this.state.pipe(
    map(state => {
      let filtered = state.conversions;
      if (state.filter) {
        filtered = this.filterConversions(filtered, state.filter);
      }
      return this.sortConversions(filtered, state.sortOrder);
    })
  );

  // State update methods
  addConversion(conversion: ConversionHistory): void {
    const currentState = this.state.value;
    this.updateState({
      conversions: [conversion, ...currentState.conversions],
      lastSync: Date.now()
    });
  }

  addConversions(conversions: ConversionHistory[]): void {
    this.updateState({
      conversions: [...conversions, ...this.state.value.conversions],
      lastSync: Date.now()
    });
  }

  removeConversion(id: string): void {
    const currentState = this.state.value;
    this.updateState({
      conversions: currentState.conversions.filter(conv => conv.id !== id)
    });
  }

  clearHistory(): void {
    this.updateState({
      conversions: [],
      lastSync: Date.now()
    });
  }

  setFilter(filter: string | undefined): void {
    this.updateState({ filter });
  }

  setSortOrder(sortOrder: 'asc' | 'desc'): void {
    this.updateState({ sortOrder });
  }

  // Helper methods
  private updateState(partialState: Partial<HistoryState>): void {
    this.state.next({
      ...this.state.value,
      ...partialState
    });
  }

  private sortConversions(conversions: ConversionHistory[], order: 'asc' | 'desc'): ConversionHistory[] {
    return [...conversions].sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return order === 'asc' ? timeA - timeB : timeB - timeA;
    });
  }

  private filterConversions(conversions: ConversionHistory[], filter: string): ConversionHistory[] {
    const lowercaseFilter = filter.toLowerCase();
    return conversions.filter(conv => 
      conv.fromCurrency.code.toLowerCase().includes(lowercaseFilter) ||
      conv.toCurrency.code.toLowerCase().includes(lowercaseFilter) ||
      conv.fromCurrency.name.toLowerCase().includes(lowercaseFilter) ||
      conv.toCurrency.name.toLowerCase().includes(lowercaseFilter)
    );
  }

  // Analytics methods
  getMostUsedCurrencies(): Observable<{ code: string; count: number }[]> {
    return this.state.pipe(
      map(state => {
        const currencyCounts = new Map<string, number>();
        
        state.conversions.forEach(conv => {
          currencyCounts.set(conv.fromCurrency.code, 
            (currencyCounts.get(conv.fromCurrency.code) || 0) + 1);
          currencyCounts.set(conv.toCurrency.code, 
            (currencyCounts.get(conv.toCurrency.code) || 0) + 1);
        });

        return Array.from(currencyCounts.entries())
          .map(([code, count]) => ({ code, count }))
          .sort((a, b) => b.count - a.count);
      })
    );
  }

  getRecentConversions(limit: number = 5): Observable<ConversionHistory[]> {
    return this.state.pipe(
      map(state => this.sortConversions(state.conversions, 'desc').slice(0, limit))
    );
  }

  // Get current state snapshot
  getStateSnapshot(): HistoryState {
    return this.state.value;
  }
} 