export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export interface ExchangeRates {
  base: string;
  date: string;
  rates: { [key: string]: number };
}

export interface ConversionHistory {
  id: string;
  timestamp: string;
  fromCurrency: Currency;
  toCurrency: Currency;
  amount: number;
  convertedAmount: number;
  rate: number;
}

export interface ConversionResult {
  from: Currency;
  to: Currency;
  amount: number;
  result: number;
  rate: number;
  date: string;
} 