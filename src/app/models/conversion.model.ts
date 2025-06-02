import { ConversionResult } from './currency.model';

export interface ConversionHistory extends ConversionResult {
  id: string;
  timestamp: number;
}

export interface HistoryState {
  conversions: ConversionHistory[];
  lastSync: number;
} 