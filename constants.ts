
import type { FormData } from './types';

export const MONTHS: string[] = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

// Using 2023 tax brackets to match the provided screenshot's calculation logic.
export const TAX_BRACKETS_2023 = [
  { limit: 70000, rate: 0.15 },
  { limit: 150000, rate: 0.20 },
  { limit: 550000, rate: 0.27 },
  { limit: 1900000, rate: 0.35 },
  { limit: Infinity, rate: 0.40 },
];

export const INITIAL_FORM_DATA: FormData = {
  monthlyGrossSalary: '130000',
  monthlyPremiumUSD: '100',
  annualPremiumIncrease: '5',
  usdTryRate: '41.9500',
  annualProfitShare: '6.24',
  annualExpenseShare: '5',
};
