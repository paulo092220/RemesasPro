
import { CurrencyPair, Currency } from './types';

export const ALL_CURRENCIES: Currency[] = [
  'USD', 'EUR', 'USDT', 'PAYPALUSD', 'PAYPALEUR', 
  'IBAN', 'Tropipay', 'NOAHSYNC', 'Zelle', 'CLASICA', 
  'Rublos', 'Postepey', 'MXN', 'MoneyGram', 'WesternUnion', 
  'Real', 'Bizum', 'MLC', 'CUP'
];

export const INITIAL_CURRENCY_PAIRS: CurrencyPair[] = [
  { id: 'USD-CUP', base: 'USD', target: 'CUP', isFavorite: true },
  { id: 'EUR-CUP', base: 'EUR', target: 'CUP', isFavorite: true },
  { id: 'Zelle-CUP', base: 'Zelle', target: 'CUP', isFavorite: true },
  { id: 'USDT-CUP', base: 'USDT', target: 'CUP', isFavorite: true },
  { id: 'PAYPALUSD-MLC', base: 'PAYPALUSD', target: 'MLC', isFavorite: false },
  { id: 'Zelle-MLC', base: 'Zelle', target: 'MLC', isFavorite: false },
];

export const EL_TOQUE_URL = "https://eltoque.com/tasas-de-cambio-de-divisas-en-cuba-hoy";
