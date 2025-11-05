
import { useState, useEffect, useCallback, Fragment } from 'react';
import * as XLSX from 'xlsx';
import './App.css';

// --- Constants and Types ---
const TAX_BRACKETS = [
    { upTo: 158000, rate: 0.15 },
    { upTo: 330000, rate: 0.20 },
    { upTo: 1200000, rate: 0.27 },
    { upTo: 4300000, rate: 0.35 },
    { upTo: Infinity, rate: 0.40 }
];

const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

interface CalculationParams {
    [key: string]: number | string;
    monthlySalary: number;
    monthlyPremiumUsd: number;
    annualSalaryGrowth: number;
    annualPremiumGrowth: number;
    annualUsdGrowth: number;
    usdTry: number;
    annualProfitRate: number;
    annualProfitRateGrowth: number;
    annualExpenseRate: number;
    annualTaxBracketGrowth: number;
}

// --- Helper Functions ---
const fmtTL = (n: number) => `${Math.round(n).toLocaleString('tr-TR')} ₺`;
const fmtUSD = (n: number) => `${Math.round(n).toLocaleString('tr-TR')} $`;

const formatNumber = (value: string | number): string => {
    if (!value) return '';
    const numberString = String(value).replace(/[^\d]/g, '');
    if (numberString === '') return '';
    return new Intl.NumberFormat('tr-TR').format(parseInt(numberString, 10));
};

const parseFormattedNumber = (value: string): number => {
    if (!value) return 0;
    return parseInt(String(value).replace(/[^\d]/g, ''), 10) || 0;
};

const parseFloatWithComma = (value: string): number => {
    if (!value) return 0;
    const sanitized = String(value).replace(/\./g, '').replace(',', '.');
    return parseFloat(sanitized) || 0;
};

// --- Calculation Logic ---
const getTaxRateForAnnualIncome = (cumulativeIncome: number, brackets = TAX_BRACKETS) => {
    for (const b of brackets) if (cumulativeIncome <= b.upTo) return b.rate;
    return brackets[brackets.length - 1].rate;
};

const compute1YearProjection = (params: CalculationParams) => {
    const { monthlySalary, monthlyPremiumUsd, usdTry, annualExpenseRate, annualProfitRate } = params;

    const annualProfitRateDecimal = annualProfitRate / 100;
    const dailyProfitRate = annualProfitRateDecimal / 365;
    const avgDaysInMonth = 365.2425 / 12;

    let fundUsd = 0, policyAmount = 0, totalPremiumTl = 0, totalRebateTl = 0;
    let totalProfitTl = 0, totalExpenseTl = 0, cumulativeIncome = 0;
    let totalProfitUsd = 0, totalExpenseUsd = 0;
    const monthlyDetails: any[] = [];

    for (let i = 0; i < 12; i++) {
        const monthName = MONTHS[i];
        const fundBeforeProfit = fundUsd;
        const fundAfterDailyCompounding = fundBeforeProfit * Math.pow(1 + dailyProfitRate, avgDaysInMonth);
        const profitThisMonthUsd = fundAfterDailyCompounding - fundBeforeProfit;
        const expenseThisMonthUsd = monthlyPremiumUsd * (annualExpenseRate / 100);
        const monthlyPremiumTl = monthlyPremiumUsd * usdTry;

        cumulativeIncome += monthlySalary;
        const taxRate = getTaxRateForAnnualIncome(cumulativeIncome);
        const maxRefundable = monthlySalary * 0.15;
        const actualRefundable = Math.min(monthlyPremiumTl, maxRefundable);
        const rebateTl = actualRefundable * taxRate;
        const rebateUsd = rebateTl / usdTry;

        fundUsd += profitThisMonthUsd + monthlyPremiumUsd + rebateUsd - expenseThisMonthUsd;
        policyAmount += profitThisMonthUsd + monthlyPremiumUsd - expenseThisMonthUsd;

        totalPremiumTl += monthlyPremiumTl;
        totalRebateTl += rebateTl;
        totalProfitTl += profitThisMonthUsd * usdTry;
        totalExpenseTl += expenseThisMonthUsd * usdTry;
        totalProfitUsd += profitThisMonthUsd;
        totalExpenseUsd += expenseThisMonthUsd;

        monthlyDetails.push({
            'Ay': monthName, 'Ödenen Prim': monthlyPremiumUsd, 'Vergi Dilimi': taxRate * 100,
            'Vergi İadesi': rebateUsd, 'Kâr Payı': profitThisMonthUsd, 'Gider Payı': expenseThisMonthUsd,
            'Poliçe Tutarı': policyAmount,
        });
    }

    const totalPremiumUsd = monthlyPremiumUsd * 12;
    const totalRebateUsd = totalRebateTl / usdTry;

    const totalRow = {
        'Ay': 'Top.', 'Ödenen Prim': totalPremiumUsd, 'Vergi Dilimi': null,
        'Vergi İadesi': totalRebateUsd, 'Kâr Payı': totalProfitUsd, 'Gider Payı': totalExpenseUsd,
        'Poliçe Tutarı': policyAmount,
    };
    monthlyDetails.push(totalRow);

    return {
        monthlyDetails,
        yearlyTl: totalPremiumTl, totalRebateTl, yearlyProfitTl: totalProfitTl, yearlyExpenseTl: totalExpenseTl,
        yearEndTl: fundUsd * usdTry, yearEndPolicyAmountTl: policyAmount * usdTry,
        yearlyPremiumUsd: totalPremiumUsd, totalRebateUsd, yearlyProfitUsd: totalProfitUsd,
        yearlyExpenseUsd: totalExpenseUsd, yearEndUsd: fundUsd, yearEndPolicyAmountUsd: policyAmount,
    };
};


const compute10YearProjection = (params: CalculationParams) => {
    const {
        monthlySalary, monthlyPremiumUsd, usdTry, annualExpenseRate, annualProfitRate,
        annualPremiumGrowth, annualSalaryGrowth, annualUsdGrowth, annualTaxBracketGrowth, annualProfitRateGrowth
    } = params;

    const years = 10;
    const yearlyData: any[] = [];
    let cumulativePremiumTl = 0, cumulativeRebateTl = 0, cumulativeFundUsd = 0,
        cumulativePolicyAmountUsd = 0, cumulativeProfitTl = 0, cumulativeExpenseTl = 0,
        cumulativePremiumUsd = 0, cumulativeRebateUsd = 0, cumulativeProfitUsd = 0,
        cumulativeExpenseUsd = 0, cumulativePremiumUsdForChart = 0;

    for (let y = 1; y <= years; y++) {
        const yearProfitRatePct = annualProfitRate * Math.pow(1 + annualProfitRateGrowth / 100, y - 1);
        const dailyProfitRate = (yearProfitRatePct / 100) / 365;
        const avgDaysInMonth = 365.2425 / 12;

        const yearMonthlySalary = monthlySalary * Math.pow(1 + annualSalaryGrowth / 100, y - 1);
        const yearUsdRate = usdTry * Math.pow(1 + annualUsdGrowth / 100, y - 1);
        const yearMonthlyPremiumUsd = monthlyPremiumUsd * Math.pow(1 + annualPremiumGrowth / 100, y - 1);

        const adjustedBrackets = TAX_BRACKETS.map(b => ({
            ...b, upTo: b.upTo === Infinity ? Infinity : b.upTo * Math.pow(1 + annualTaxBracketGrowth / 100, y - 1)
        }));

        let cumulativeIncomeForYear = 0, rebateAnnualTl = 0, annualPremiumTlForYear = 0,
            annualProfitTlForYear = 0, annualExpenseTlForYear = 0, annualProfitUsdForYear = 0,
            annualExpenseUsdForYear = 0, rebateAnnualUsd = 0;

        for (let m = 1; m <= 12; m++) {
            const fundBeforeProfit = cumulativeFundUsd;
            const fundAfterDailyCompounding = fundBeforeProfit * Math.pow(1 + dailyProfitRate, avgDaysInMonth);
            const profitThisMonthUsd = fundAfterDailyCompounding - fundBeforeProfit;
            const expenseThisMonthUsd = yearMonthlyPremiumUsd * (annualExpenseRate / 100);
            const monthlyPremiumTl = yearMonthlyPremiumUsd * yearUsdRate;

            cumulativeIncomeForYear += yearMonthlySalary;
            const taxRateForMonth = getTaxRateForAnnualIncome(cumulativeIncomeForYear, adjustedBrackets);
            const maxRefundable = yearMonthlySalary * 0.15;
            const actualRefundable = Math.min(monthlyPremiumTl, maxRefundable);
            const rebateTlForMonth = actualRefundable * taxRateForMonth;
            const rebateUsdForMonth = rebateTlForMonth / yearUsdRate;

            cumulativeFundUsd += profitThisMonthUsd + yearMonthlyPremiumUsd + rebateUsdForMonth - expenseThisMonthUsd;
            cumulativePolicyAmountUsd += profitThisMonthUsd + yearMonthlyPremiumUsd - expenseThisMonthUsd;

            annualPremiumTlForYear += monthlyPremiumTl;
            rebateAnnualTl += rebateTlForMonth;
            rebateAnnualUsd += rebateUsdForMonth;
            annualProfitTlForYear += profitThisMonthUsd * yearUsdRate;
            annualExpenseTlForYear += expenseThisMonthUsd * yearUsdRate;
            annualProfitUsdForYear += profitThisMonthUsd;
            annualExpenseUsdForYear += expenseThisMonthUsd;

            cumulativePremiumUsd += yearMonthlyPremiumUsd;
            cumulativeRebateUsd += rebateUsdForMonth;
            cumulativeProfitUsd += profitThisMonthUsd;
            cumulativeExpenseUsd += expenseThisMonthUsd;
        }

        const annualPremiumUsdForYear = yearMonthlyPremiumUsd * 12;
        cumulativePremiumUsdForChart += annualPremiumUsdForYear;
        cumulativePremiumTl += annualPremiumTlForYear;
        cumulativeRebateTl += rebateAnnualTl;
        cumulativeProfitTl += annualProfitTlForYear;
        cumulativeExpenseTl += annualExpenseTlForYear;

        yearlyData.push({
            year: y,
            annualPremiumUsd: annualPremiumUsdForYear,
            annualRebateUsd: rebateAnnualUsd,
            annualProfitUsd: annualProfitUsdForYear,
            annualExpenseUsd: annualExpenseUsdForYear,
            endOfYearPolicyAmountUsd: cumulativePolicyAmountUsd,
        });
    }

    const finalYearUsdRate = usdTry * Math.pow(1 + annualUsdGrowth / 100, years - 1);
    const totals = {
        totalPremiumTl: cumulativePremiumTl, totalRebateTl: cumulativeRebateTl,
        totalProfitTl: cumulativeProfitTl, totalExpenseTl: cumulativeExpenseTl,
        accWithRebateTl: cumulativeFundUsd * finalYearUsdRate,
        totalPolicyAmountTl: cumulativePolicyAmountUsd * finalYearUsdRate,
        totalPremiumUsd: cumulativePremiumUsd, totalRebateUsd: cumulativeRebateUsd,
        totalProfitUsd: cumulativeProfitUsd, totalExpenseUsd: cumulativeExpenseUsd,
        accWithRebateUsd: cumulativeFundUsd, totalPolicyAmountUsd: cumulativePolicyAmountUsd,
    };

    return { totals, yearlyData };
};


// --- React Components ---

const App = () => {
    const [params, setParams] = useState<CalculationParams>({
        monthlySalary: 100000,
        monthlyPremiumUsd: 100,
        annualSalaryGrowth: 15,
        annualPremiumGrowth: 0,
        annualUsdGrowth: 15,
        usdTry: 0,
        annualProfitRate: 6.24,
        annualProfitRateGrowth: 0,
        annualExpenseRate: 5,
        annualTaxBracketGrowth: 15,
    });
    const [displayValues, setDisplayValues] = useState({
        monthlySalary: '100.000',
        monthlyPremiumUsd: '100',
        annualSalaryGrowth: '15',
        annualPremiumGrowth: '0',
        annualUsdGrowth: '15',
        usdTry: '',
        annualProfitRate: '6,24',
        annualProfitRateGrowth: '0',
        annualExpenseRate: '5',
        annualTaxBracketGrowth: '15',
    });

    const [results, setResults] = useState<any>(null);
    const [rateStatus, setRateStatus] = useState({ message: '1$ = ..,..₺', loading: true, isFallback: false });
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    const [openCollapsibles, setOpenCollapsibles] = useState<{ [key: string]: boolean }>({});

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;

        if (id === 'monthlySalary') {
            setDisplayValues(prev => ({ ...prev, [id]: formatNumber(value) }));
            setParams(prev => ({ ...prev, [id]: parseFormattedNumber(value) }));
        } else {
            setDisplayValues(prev => ({ ...prev, [id]: value }));
            setParams(prev => ({ ...prev, [id]: parseFloatWithComma(value) }));
        }
    };

    const safeFetchUsdTry = useCallback(async () => {
        setRateStatus({ message: 'Bekleyin..', loading: true, isFallback: false });
        const FALLBACK = 33.05;
        try {
            const res = await fetch('https://latest.currency-api.pages.dev/v1/currencies/usd.json', { cache: "no-store" });
            const j = await res.json();
            const rate = j?.usd?.try;
            if (typeof rate === 'number') return { rate, source: 'live' };
            throw new Error('Primary API failed');
        } catch (e) {
            console.error("Failed to fetch live currency rate, using fallback.", e);
            return { rate: FALLBACK, source: 'fallback' };
        }
    }, []);

    const updateRate = useCallback(async (isManualRefresh = false) => {
        const { rate, source } = await safeFetchUsdTry();
        const rateStr = rate.toFixed(2).replace('.', ',');
        setRateStatus({ message: `1$ = ${rateStr}₺`, loading: false, isFallback: source === 'fallback' });

        if (isManualRefresh || !params.usdTry) {
            setParams(prev => ({ ...prev, usdTry: rate }));
            setDisplayValues(prev => ({ ...prev, usdTry: rateStr }));
        }
    }, [safeFetchUsdTry, params.usdTry]);

    useEffect(() => {
        updateRate();
    }, [updateRate]);

    useEffect(() => {
        if (params.usdTry > 0 && params.monthlySalary > 0 && params.monthlyPremiumUsd > 0) {
            const proj1 = compute1YearProjection(params);
            const proj10 = compute10YearProjection(params);
            setResults({ proj1, proj10, params });
        } else {
            setResults(null);
        }
    }, [params]);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        const themeMeta = document.querySelector('meta[name="theme-color"]');
        if(themeMeta) {
            themeMeta.setAttribute('content', theme === 'dark' ? '#242424' : '#ebedee');
        }
    }, [theme]);

    const handleReset = () => {
        const initialParams = {
            monthlySalary: 100000, monthlyPremiumUsd: 100, annualSalaryGrowth: 15, annualPremiumGrowth: 0,
            annualUsdGrowth: 15, usdTry: 0, annualProfitRate: 6.24, annualProfitRateGrowth: 0,
            annualExpenseRate: 5, annualTaxBracketGrowth: 15,
        };
        const initialDisplay = {
             monthlySalary: '100.000', monthlyPremiumUsd: '100', annualSalaryGrowth: '15', annualPremiumGrowth: '0',
            annualUsdGrowth: '15', usdTry: '', annualProfitRate: '6,24', annualProfitRateGrowth: '0',
            annualExpenseRate: '5', annualTaxBracketGrowth: '15',
        };
        setParams(initialParams);
        setDisplayValues(initialDisplay);
        setResults(null);
        updateRate(true);
    };

    const handleExport = () => {
      if (!results) {
          alert("Lütfen önce bir hesaplama yapın.");
          return;
      }

      const { proj1, proj10, params } = results;
      const wb = XLSX.utils.book_new();

      const paramsData = [
          ["Parametre", "Değer"],
          ["Aylık Brüt Maaş", `${formatNumber(params.monthlySalary)} ₺`],
          ["Aylık Prim (USD)", `${params.monthlyPremiumUsd} $`],
          ["Başlangıç USD/TRY Kuru", String(params.usdTry).replace('.', ',')],
          ["Yıllık Maaş Artışı %", String(params.annualSalaryGrowth)],
          ["Yıllık Prim Artışı %", String(params.annualPremiumGrowth)],
          ["Yıllık Kur Artışı %", String(params.annualUsdGrowth)],
          ["Yıllık Kâr Payı %", String(params.annualProfitRate).replace('.', ',')],
          ["Yıllık Kâr Payı Artışı %", String(params.annualProfitRateGrowth)],
          ["Gider Kesintisi %", String(params.annualExpenseRate)],
          ["Vergi Matrahı Artışı Yıl/%", String(params.annualTaxBracketGrowth)]
      ];

      const oneYearHeaders = ["Ay", "Ödenen Prim ($)", "Vergi Dilimi (%)", "Vergi İadesi ($)", "Kâr Payı ($)", "Gider Payı ($)", "Poliçe Tutarı ($)"];
      const oneYearRows = proj1.monthlyDetails.map((d: any) => [
          d.Ay,
          d['Ödenen Prim'],
          d['Vergi Dilimi'] !== null ? `${(d['Vergi Dilimi']).toFixed(0)}%` : '-',
          d['Vergi İadesi'],
          d['Kâr Payı'],
          d['Gider Payı'],
          d['Poliçe Tutarı'],
      ]);
      const oneYearFullData = [oneYearHeaders, ...oneYearRows];

      const tenYearHeaders = ["Yıl", "Yıllık Ödenen Prim ($)", "Yıllık Vergi İadesi ($)", "Yıllık Kâr Payı ($)", "Yıllık Gider Payı ($)", "Poliçe Tutarı ($)"];
      const tenYearRows = proj10.yearlyData.map((d: any) => [
          `${d.year}. Yıl`,
          d.annualPremiumUsd,
          d.annualRebateUsd,
          d.annualProfitUsd,
          d.annualExpenseUsd,
          d.endOfYearPolicyAmountUsd,
      ]);
      const tenYearTotals = [
          "Top.",
          proj10.totals.totalPremiumUsd,
          proj10.totals.totalRebateUsd,
          proj10.totals.totalProfitUsd,
          proj10.totals.totalExpenseUsd,
          proj10.totals.totalPolicyAmountUsd,
      ];
      const tenYearFullData = [tenYearHeaders, ...tenYearRows, tenYearTotals];

      const allData = [
          ...paramsData,
          [],
          ...oneYearFullData,
          [],
          ...tenYearFullData
      ];

      const ws = XLSX.utils.aoa_to_sheet(allData);

      const colWidths = Array(Math.max(paramsData[0].length, oneYearHeaders.length, tenYearHeaders.length)).fill({ wch: 19 });
      ws['!cols'] = colWidths;

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const filename = `Police-simulasyonu-${year}${month}${day}-${hours}${minutes}.xlsx`;

      XLSX.utils.book_append_sheet(wb, ws, "Police_Bilanco_Simulasyonu");
      XLSX.writeFile(wb, filename);
    };

    const toggleCollapsible = (id: string) => {
        setOpenCollapsibles(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div id="calculator-page">
            <div className="main-wrapper">
                <div className="form-column">
                    <div className="card-wrapper">
                        {/* Intro and Form */}
                        <div className="intro-header">
                            <h1>Poliçe Asistanı</h1>
                            <p>Brüt maaş ve prim bilgilerinizi girerek 1 ve 10 yıllık potansiyel vergi iadesi ve birikim projeksiyonunuzu anında hesaplayın.</p>
                        </div>
                        <div className="card" role="region" aria-label="Poliçe Asistanı">
                            <div className="card-main-content">
                                <form id="calcForm" onSubmit={(e) => e.preventDefault()}>
                                    {/* Form sections */}
                                    <div id="form-context-note-wrapper" style={{ marginTop: 'var(--form-v-gap)' }}>
                                        <div className="calculation-context-note warning" style={{ margin: 0 }}>
                                            <span>Sorumluluk reddi: Uygulama girdiğiniz verilere göre varsayımsal sonuçlar vermektedir.</span>
                                        </div>
                                    </div>
                                    <div className="form-divider"></div>

                                    {/* Input Fields */}
                                    <InputField label="Aylık brüt maaş" id="monthlySalary" value={displayValues.monthlySalary} onChange={handleInputChange} tooltip="..."/>
                                    <InputField label="Aylık Prim (USD)" id="monthlyPremiumUsd" value={displayValues.monthlyPremiumUsd} onChange={handleInputChange} tooltip="..." />
                                    <InputField label="Yıllık maaş artışı %" id="annualSalaryGrowth" value={displayValues.annualSalaryGrowth} onChange={handleInputChange} tooltip="Gelecek yıllardaki brüt maaşınızın yıllık yüzde kaç artacağını belirtir." />
                                    <InputField label="Yıllık prim artışı %" id="annualPremiumGrowth" value={displayValues.annualPremiumGrowth} onChange={handleInputChange} tooltip="USD cinsinden ödediğiniz aylık prim tutarının yıllık yüzde kaç artacağını belirtir." />
                                    <InputField label="USD/TRY kuru" id="usdTry" value={displayValues.usdTry} onChange={handleInputChange} placeholder="Otomatik çekilecek" />
                                    <InputField label="Yıllık kur artışı %" id="annualUsdGrowth" value={displayValues.annualUsdGrowth} onChange={handleInputChange} tooltip="USD/TRY kurunun gelecek yıllarda yıllık ortalama yüzde kaç artacağını öngördüğünüzü belirtir." />
                                    <InputField label="Yıllık kâr payı %" id="annualProfitRate" value={displayValues.annualProfitRate} onChange={handleInputChange} tooltip="Poliçenize yıllık olarak eklenecek tahmini kâr payı oranıdır." />
                                    <InputField label="Yıllık kâr payı artışı %" id="annualProfitRateGrowth" value={displayValues.annualProfitRateGrowth} onChange={handleInputChange} tooltip="Yıllık kâr payı oranının gelecek yıllarda yüzde kaç artacağını belirtir." />
                                    <InputField label="Gider kesintisi %" id="annualExpenseRate" value={displayValues.annualExpenseRate} onChange={handleInputChange} tooltip="Ödediğiniz primlerden yıllık olarak kesilecek olan yönetim gideri oranıdır." />
                                    <InputField label="Vergi matrahı artışı Yıl/%" id="annualTaxBracketGrowth" value={displayValues.annualTaxBracketGrowth} onChange={handleInputChange} tooltip="Gelir vergisi dilimi tavanlarının her yıl yüzde kaç artacağını öngördüğünüzü belirtir." />

                                    {/* Action Row */}
                                    <div className="action-row">
                                        <div className="rate">
                                            <div className="rate-text">{rateStatus.loading ? <span className="spinner"></span> : rateStatus.message} {rateStatus.isFallback && <span className="fallback-rate-indicator">(tahmini)</span>}</div>
                                            <button className="refresh" onClick={() => updateRate(true)} title="Kur yenile">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M17.65 6.35A7.958 7.958 0 0 0 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                                            </button>
                                        </div>
                                        <div className="button-group-wrapper">
                                            <button type="button" onClick={handleReset} className="button">Sıfırla</button>
                                            <button type="button" onClick={handleExport} className="button button-icon export-button has-tooltip" data-tooltip="Sonuçları Excel olarak indir">
                                            <svg id="katman_2" data-name="katman 2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800.8">
                                                <g id="Capa_1" data-name="Capa 1">
                                                  <g>
                                                    <path className="cls-1" d="M774.19,92.81h-282.19v92h94v62h-94l1,61h92v62h-92v61h92v62h-92l-1,61h93v62h-93v92h282.19c14.2,0,25.81-12.02,25.81-26.75V119.56c0-14.73-11.61-26.75-25.81-26.75ZM739,615.81h-123v-62h123v62ZM739,492.81h-123v-62h123v62ZM739,369.81h-123v-62h123v62ZM739,246.81h-123v-62h123v62Z"/>
                                                    <path className="cls-1" d="M0,88.98v622.87l462,88.95V0L0,88.98ZM291.99,556.81l-53.53-101.2c-2.02-3.77-4.11-10.71-6.29-20.8h-.83c-1.01,4.75-3.41,11.99-7.18,21.69l-53.71,100.31h-83.9l99.43-155.98-90.96-156.02h85.4l44.66,93.66c3.48,7.4,6.6,16.19,9.38,26.34h.74c1.76-6.1,5.03-15.17,9.8-27.23l49.64-92.77h78.06l-93.25,154.2,95.86,156.8-83.13,1h-.18Z"/>
                                                  </g>
                                                </g>
                                              </svg>
                                            </button>
                                            {/* Theme Toggle */}
                                            <input type="checkbox" id="themeToggleCheckbox" className="theme-toggle-checkbox" checked={theme === 'dark'} onChange={() => setTheme(theme === 'light' ? 'dark' : 'light')} />
                                            <label htmlFor="themeToggleCheckbox" className="theme-toggle">
                                                <span className="toggle-thumb"><span className="toggle-icon toggle-light-text">A</span><span className="toggle-icon toggle-dark-text">K</span></span>
                                            </label>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results Column */}
                <div id="results" className="results" style={{ display: results ? 'grid' : 'none' }}>
                    {results && (
                        <>
                           {/* 1 Year Projection Card */}
                            <ResultsCard title="1 Yıllık Projeksiyon Özeti">
                                 <div className="summary-list">
                                    <SummaryItem label="Yıl boyunca ödenen prim" valueTl={fmtTL(results.proj1.yearlyTl)} valueUsd={fmtUSD(results.proj1.yearlyPremiumUsd)} />
                                    <SummaryItem label="Yılda alınan vergi iadesi" valueTl={fmtTL(results.proj1.totalRebateTl)} valueUsd={fmtUSD(results.proj1.totalRebateUsd)} highlight />
                                    <SummaryItem label="Poliçeye eklenen kar payı" valueTl={fmtTL(results.proj1.yearlyProfitTl)} valueUsd={fmtUSD(results.proj1.yearlyProfitUsd)} />
                                    <SummaryItem label="Ödenen gider payı" valueTl={fmtTL(results.proj1.yearlyExpenseTl)} valueUsd={fmtUSD(results.proj1.yearlyExpenseUsd)} />
                                    <SummaryItem label="Poliçe tutarı" valueTl={fmtTL(results.proj1.yearEndPolicyAmountTl)} valueUsd={fmtUSD(results.proj1.yearEndPolicyAmountUsd)} highlight />
                                    <SummaryItem label="Vergi iadesi eklendiğinde" valueTl={fmtTL(results.proj1.yearEndTl)} valueUsd={fmtUSD(results.proj1.yearEndUsd)} highlight />
                                </div>
                                <CollapsibleSection title="1 Yıllık Tablo" id="1-year-table" isOpen={openCollapsibles['1-year-table']} toggle={() => toggleCollapsible('1-year-table')}>
                                    <ProjectionTable data={results.proj1.monthlyDetails} type="1-year" />
                                </CollapsibleSection>
                            </ResultsCard>

                            {/* 10 Year Projection Card */}
                             <ResultsCard title="10 Yıllık Projeksiyon Özeti">
                                <div className="summary-list">
                                    <SummaryItem label="10 yıl boyunca ödenen prim" valueTl={fmtTL(results.proj10.totals.totalPremiumTl)} valueUsd={fmtUSD(results.proj10.totals.totalPremiumUsd)} />
                                    <SummaryItem label="10 yılda alınan vergi iadesi" valueTl={fmtTL(results.proj10.totals.totalRebateTl)} valueUsd={fmtUSD(results.proj10.totals.totalRebateUsd)} highlight />
                                    <SummaryItem label="Poliçeye eklenen kar payı" valueTl={fmtTL(results.proj10.totals.totalProfitTl)} valueUsd={fmtUSD(results.proj10.totals.totalProfitUsd)} />
                                    <SummaryItem label="Ödenen gider payı" valueTl={fmtTL(results.proj10.totals.totalExpenseTl)} valueUsd={fmtUSD(results.proj10.totals.totalExpenseUsd)} />
                                    <SummaryItem label="Poliçe tutarı" valueTl={fmtTL(results.proj10.totals.totalPolicyAmountTl)} valueUsd={fmtUSD(results.proj10.totals.totalPolicyAmountUsd)} highlight />
                                    <SummaryItem label="Vergi iadesi eklendiğinde" valueTl={fmtTL(results.proj10.totals.accWithRebateTl)} valueUsd={fmtUSD(results.proj10.totals.accWithRebateUsd)} highlight />
                                </div>
                                 <CollapsibleSection title="10 Yıllık Tablo" id="10-year-table" isOpen={openCollapsibles['10-year-table']} toggle={() => toggleCollapsible('10-year-table')}>
                                    <ProjectionTable data={results.proj10.yearlyData} type="10-year" />
                                </CollapsibleSection>
                            </ResultsCard>

                            <ResultsCard title="Hesaplama Metodolojisi">
                            <div className="methodology-text">
                                <p>Bu simülasyon, girdiğiniz verilere dayanarak potansiyel birikim ve vergi iadesi projeksiyonu sunar. Temel varsayımlar şunlardır:</p>
                                <ul>
                                  <li><strong>Başlangıç Yılı:</strong> Tüm hesaplamalar <strong>2025</strong> yılı baz alınarak başlar ve ilk yıl için 2025 gelir vergisi dilimleri kullanılır.</li>
                                  <li><strong>Vergi İadesi:</strong> Vergi iadesi, aylık brüt maaşınızın <strong>%15'ini aşmayacak</strong> şekilde ödediğiniz prim tutarı üzerinden, o an içinde bulunduğunuz gelir vergisi dilimi oranına göre hesaplanır.</li>
                                  <li><strong>Dinamik Projeksiyon:</strong> 10 yıllık projeksiyonda maaş, prim, kur ve vergi dilimlerinin matrahları (üst limitleri), girdiğiniz yıllık artış oranlarına göre her yıl bileşik olarak artırılır. Bu, daha gerçekçi bir senaryo sunar.</li>
                                  <li><strong>Kâr Payı:</strong> Kâr payı, günlük bileşik getiri varsayımıyla hesaplanır ve fonunuza eklenir.</li>
                                </ul>
                              </div>
                            </ResultsCard>
                        </>
                    )}
                </div>
            </div>
            <footer>
                Tüm hakları saklıdır © {new Date().getFullYear()} Poliçe Asistanı
            </footer>
        </div>
    );
};


const InputField = ({ label, id, value, onChange, tooltip, placeholder }: any) => (
    <div className="form-section">
        <div className="input-group">
            <label htmlFor={id}>{label}</label>
            <div className="input-wrapper has-tooltip" data-tooltip={tooltip}>
                <input id={id} type="text" value={value} onChange={onChange} placeholder={placeholder} inputMode={id === 'monthlySalary' ? 'numeric' : 'decimal'} />
                {tooltip && <button type="button" className="info-tooltip" aria-label="Daha fazla bilgi"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg></button>}
            </div>
        </div>
    </div>
);

const ResultsCard = ({ title, children }: any) => (
    <div className="results-card">
        <h3>{title}</h3>
        {children}
    </div>
);

const SummaryItem = ({ label, valueTl, valueUsd, highlight = false }: any) => (
    <div className="summary-item">
        <div className={highlight ? 'highlight-label' : ''}>{label}</div>
        <div>{valueTl}</div>
        <div>{valueUsd}</div>
    </div>
);

const CollapsibleSection = ({ title, id, isOpen, toggle, children }: any) => (
     <div className={`collapsible-section ${isOpen ? 'is-open' : ''}`}>
        <div className="collapsible-header" onClick={toggle} aria-expanded={isOpen} aria-controls={id}>
            <div className="collapsible-header-title">{title}</div>
            <div className="arrow-container"><svg className="arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg></div>
        </div>
        <div className="collapsible-content" id={id}>
            {children}
        </div>
    </div>
);

const ProjectionTable = ({ data, type }: any) => {
    const isOneYear = type === '1-year';
    const headers = isOneYear
        ? ["Ay", "Ödenen Prim", "Vergi Dilimi", "Vergi İadesi", "Kâr Payı", "Gider Payı", "Poliçe Tutarı"]
        : ["Yıl", "Ödenen Prim", "Vergi İadesi", "Kâr Payı", "Gider Payı", "Poliçe Tutarı"];

    return (
        <div className="table-wrapper">
            <table className={`projection-details-table ${isOneYear ? 'one-year-table' : 'ten-year-table'}`}>
                <thead>
                    <tr>{headers.map(h => <th key={h}>{h.split(' ').map((word, i) => <Fragment key={i}>{i > 0 && <br />}{word}</Fragment>)}</th>)}</tr>
                </thead>
                <tbody>
                    {data.map((row: any, index: number) => (
                        <tr key={index} className={row.Ay === 'Top.' || row.year === 'Top.' ? 'total-row' : ''}>
                           {isOneYear ? (
                                <>
                                    <td>{row['Ay']}</td>
                                    <td>{fmtUSD(row['Ödenen Prim'])}</td>
                                    <td>{row['Vergi Dilimi'] ? `${row['Vergi Dilimi'].toFixed(0)}%` : '-'}</td>
                                    <td>{fmtUSD(row['Vergi İadesi'])}</td>
                                    <td>{fmtUSD(row['Kâr Payı'])}</td>
                                    <td>{fmtUSD(row['Gider Payı'])}</td>
                                    <td>{fmtUSD(row['Poliçe Tutarı'])}</td>
                                </>
                           ) : (
                               <>
                                    <td>{row.year}. Yıl</td>
                                    <td>{fmtUSD(row.annualPremiumUsd)}</td>
                                    <td>{fmtUSD(row.annualRebateUsd)}</td>
                                    <td>{fmtUSD(row.annualProfitUsd)}</td>
                                    <td>{fmtUSD(row.annualExpenseUsd)}</td>
                                    <td>{fmtUSD(row.endOfYearPolicyAmountUsd)}</td>
                               </>
                           )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}


export default App;
