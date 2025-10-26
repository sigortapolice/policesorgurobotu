
export interface FormData {
  monthlyGrossSalary: string;
  monthlyPremiumUSD: string;
  annualPremiumIncrease: string;
  usdTryRate: string;
  annualProfitShare: string;
  annualExpenseShare: string;
}

export interface MonthlyResult {
  month: string;
  grossSalary: number;
  taxBracket: number;
  premiumUSD: number;
  refundUSD: number;
}

export interface Totals {
    grossSalary: number;
    premiumUSD: number;
    refundUSD: number;
}
