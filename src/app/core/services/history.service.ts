import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StorageService } from '../storage/storage.service';
import { ConversionHistory, HistoryState } from '../../models/conversion.model';
import { ConversionResult } from '../../models/currency.model';

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private readonly STORAGE_KEY = 'conversion_history';
  private readonly MAX_HISTORY_ITEMS = 50;

  private historyState = new BehaviorSubject<HistoryState>({
    conversions: [],
    lastSync: 0
  });

  constructor(private storage: StorageService) {
    this.loadHistory();
  }

  private async loadHistory() {
    const stored = await this.storage.get(this.STORAGE_KEY);
    if (stored) {
      this.historyState.next(stored);
    }
  }

  private async saveHistory(state: HistoryState) {
    await this.storage.set(this.STORAGE_KEY, state);
    this.historyState.next(state);
  }

  getHistory(): Observable<ConversionHistory[]> {
    return this.historyState.pipe(
      map(state => state.conversions)
    );
  }

  async addConversion(conversion: ConversionResult): Promise<void> {
    const currentState = this.historyState.value;
    const newConversion: ConversionHistory = {
      ...conversion,
      id: Date.now().toString(),
      timestamp: Date.now()
    };

    const newConversions = [
      newConversion,
      ...currentState.conversions
    ].slice(0, this.MAX_HISTORY_ITEMS);

    await this.saveHistory({
      conversions: newConversions,
      lastSync: Date.now()
    });
  }

  async clearHistory(): Promise<void> {
    await this.saveHistory({
      conversions: [],
      lastSync: Date.now()
    });
  }

  async deleteConversion(id: string): Promise<void> {
    const currentState = this.historyState.value;
    const newConversions = currentState.conversions.filter(
      conversion => conversion.id !== id
    );

    await this.saveHistory({
      conversions: newConversions,
      lastSync: Date.now()
    });
  }

  getRecentConversions(limit: number = 5): Observable<ConversionHistory[]> {
    return this.historyState.pipe(
      map(state => state.conversions.slice(0, limit))
    );
  }

  getMostUsedCurrencies(): Observable<{ from: string; to: string; count: number }[]> {
    return this.historyState.pipe(
      map(state => {
        const pairs = new Map<string, number>();
        
        state.conversions.forEach(conversion => {
          const key = `${conversion.from.code}-${conversion.to.code}`;
          pairs.set(key, (pairs.get(key) || 0) + 1);
        });

        return Array.from(pairs.entries())
          .map(([key, count]) => {
            const [from, to] = key.split('-');
            return { from, to, count };
          })
          .sort((a, b) => b.count - a.count);
      })
    );
  }
} 