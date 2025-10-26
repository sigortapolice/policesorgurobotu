

import React, { useState, useCallback } from 'react';
import { INITIAL_FORM_DATA, MONTHS, TAX_BRACKETS_2023 } from './constants';
import type { FormData, MonthlyResult, Totals } from './types';

const formatCurrency = (value: number, currency: 'TRY' | 'USD') => {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency,
        minimumFractionDigits: currency === 'TRY' ? 0 : 2,
        maximumFractionDigits: currency === 'TRY' ? 0 : 2,
    }).format(value).replace('₺', '₺ ').replace('$', '$ ');
};


const App: React.FC = () => {
    const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
    const [results, setResults] = useState<MonthlyResult[]>([]);
    const [totals, setTotals] = useState<Totals | null>(null);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleReset = useCallback(() => {
        setFormData(INITIAL_FORM_DATA);
        setResults([]);
        setTotals(null);
    }, []);
    
    const getTaxBracket = (cumulativeGross: number): number => {
        let cumulativeLimit = 0;
        for (const bracket of TAX_BRACKETS_2023) {
            if (cumulativeGross <= bracket.limit) {
                return bracket.rate;
            }
        }
        return TAX_BRACKETS_2023[TAX_BRACKETS_2023.length - 1].rate; // fallback to highest rate
    };

    const handleCalculate = useCallback(() => {
        const monthlyGross = parseFloat(formData.monthlyGrossSalary) || 0;
        const monthlyPremium = parseFloat(formData.monthlyPremiumUSD) || 0;
        const rate = parseFloat(formData.usdTryRate) || 0;
        
        if (monthlyGross <= 0 || monthlyPremium <= 0 || rate <= 0) {
            alert('Lütfen geçerli değerler giriniz.');
            return;
        }

        const newResults: MonthlyResult[] = [];
        let cumulativeGross = 0;

        MONTHS.forEach((month, index) => {
            cumulativeGross += monthlyGross;
            const taxBracket = getTaxBracket(cumulativeGross);
            
            const premiumInTRY = monthlyPremium * rate;
            const maxRefundablePremiumTRY = monthlyGross * 0.15;
            const actualRefundablePremiumTRY = Math.min(premiumInTRY, maxRefundablePremiumTRY);
            
            const refundInTRY = actualRefundablePremiumTRY * taxBracket;
            const refundInUSD = refundInTRY / rate;

            newResults.push({
                month,
                grossSalary: monthlyGross,
                taxBracket: taxBracket * 100,
                premiumUSD: monthlyPremium,
                refundUSD: refundInUSD
            });
        });

        const newTotals: Totals = {
            grossSalary: newResults.reduce((acc, r) => acc + r.grossSalary, 0),
            premiumUSD: newResults.reduce((acc, r) => acc + r.premiumUSD, 0),
            refundUSD: newResults.reduce((acc, r) => acc + r.refundUSD, 0)
        };

        setResults(newResults);
        setTotals(newTotals);

    }, [formData]);
    
    return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
            <div className="w-full max-w-3xl mx-auto">
                 <h1 className="text-2xl md:text-3xl font-bold text-slate-800 text-center mb-6">
                    Vergi İadeli Hayat Sigortası Hesaplayıcı
                </h1>
                <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
                    <div className="mb-6">
                        <div className="flex justify-between items-center bg-red-50 text-red-700 p-3 rounded-md">
                            <span className="font-semibold">1 USD = {parseFloat(formData.usdTryRate).toFixed(4)} ₺ (fallback)</span>
                            <button className="p-1 rounded-full hover:bg-red-100 transition-colors">
                                Yenile
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6">
                        <InputGroup label="Aylık Brüt Maaş (₺)" name="monthlyGrossSalary" value={formData.monthlyGrossSalary} onChange={handleInputChange} type="number" />
                        <InputGroup label="Aylık Ödenen Prim (USD)" name="monthlyPremiumUSD" value={formData.monthlyPremiumUSD} onChange={handleInputChange} type="number" />
                        <InputGroup label="Yıllık Prim Artışı (%)" name="annualPremiumIncrease" value={formData.annualPremiumIncrease} onChange={handleInputChange} type="number" />
                        <InputGroup label="USD/TRY" name="usdTryRate" value={formData.usdTryRate} onChange={handleInputChange} type="number" />
                        <InputGroup label="Yıllık Kâr Payı (%)" name="annualProfitShare" value={formData.annualProfitShare} onChange={handleInputChange} type="number" />
                        <InputGroup label="Yıllık Gider Payı (%)" name="annualExpenseShare" value={formData.annualExpenseShare} onChange={handleInputChange} type="number" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button onClick={handleCalculate} className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200">
                            Hesapla
                        </button>
                        <button onClick={handleReset} className="w-full bg-slate-100 text-slate-700 font-semibold py-3 rounded-lg hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-300 transition-all duration-200">
                            Sıfırla
                        </button>
                    </div>

                    {results.length > 0 && totals && (
                        <div className="mt-8 overflow-x-auto">
                            <table className="w-full text-sm text-left text-slate-600">
                                <thead className="text-xs text-slate-700 uppercase bg-slate-50">
                                    <tr>
                                        <th scope="col" className="px-4 py-3">Ay</th>
                                        <th scope="col" className="px-4 py-3 text-right">Brüt Maaş (TL)</th>
                                        <th scope="col" className="px-4 py-3 text-right">Vergi Dilimi</th>
                                        <th scope="col" className="px-4 py-3 text-right">Prim ($)</th>
                                        <th scope="col" className="px-4 py-3 text-right">İade ($)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((row, index) => (
                                        <tr key={index} className="bg-white border-b hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-900">{row.month}</td>
                                            <td className="px-4 py-3 text-right">{formatCurrency(row.grossSalary, 'TRY')}</td>
                                            <td className="px-4 py-3 text-right">{row.taxBracket}%</td>
                                            <td className="px-4 py-3 text-right">{formatCurrency(row.premiumUSD, 'USD')}</td>
                                            <td className="px-4 py-3 text-right font-semibold text-indigo-600">{formatCurrency(row.refundUSD, 'USD')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="font-semibold text-slate-800 bg-slate-100">
                                        <th scope="row" className="px-4 py-3 text-base">Yıllık Toplam</th>
                                        <td className="px-4 py-3 text-right">{formatCurrency(totals.grossSalary, 'TRY')}</td>
                                        <td className="px-4 py-3 text-right">-</td>
                                        <td className="px-4 py-3 text-right">{formatCurrency(totals.premiumUSD, 'USD')}</td>
                                        <td className="px-4 py-3 text-right text-indigo-600">{formatCurrency(totals.refundUSD, 'USD')}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

interface InputGroupProps {
    label: string;
    name: keyof FormData;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    type?: string;
}

const InputGroup: React.FC<InputGroupProps> = ({ label, name, value, onChange, type = 'text' }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
        <input
            type={type}
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            step={type === 'number' ? 'any' : undefined}
            className="w-full px-3 py-2 text-slate-900 bg-slate-50 border border-slate-200 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
        />
    </div>
);


export default App;