
export type Currency = 
  | 'USD' | 'EUR' | 'USDT' | 'PAYPALUSD' | 'PAYPALEUR' 
  | 'IBAN' | 'Tropipay' | 'NOAHSYNC' | 'Zelle' | 'CLASICA' 
  | 'Rublos' | 'Postepey' | 'MXN' | 'MoneyGram' | 'WesternUnion' 
  | 'Real' | 'Bizum' | 'CUP' | 'MLC';

export interface CurrencyPair {
  id: string;
  base: Currency;
  target: Currency;
  isFavorite: boolean;
}

export interface ExchangeRate {
  pairId: string;
  referenceValue: number;
  manualValue: number;
  useManual: boolean;
  lastUpdated: string;
  sources?: { title: string; uri: string }[];
}

export interface Worker {
  id: string;
  name: string;
  accountInfo: string;
}

export interface Transaction {
  id: string;
  date: string;
  workerId: string;
  clientName: string;
  amount: number;
  currency: Currency;
  targetCurrency: Currency;
  rate: number;
  totalCUP: number;
  description: string;
  status: 'completado' | 'pendiente';
}

export interface FundAdjustment {
  id: string;
  date: string;
  currency: Currency;
  amount: number;
  type: 'ingreso' | 'egreso';
  description: string;
}

export interface AppState {
  transactions: Transaction[];
  workers: Worker[];
  rates: ExchangeRate[];
  favoritePairs: string[];
  funds: Record<string, number>;
}
