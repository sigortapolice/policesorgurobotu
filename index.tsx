document.addEventListener('DOMContentLoaded', () => {

  // --- COMMON INITIALIZATION ---
  window.scrollTo(0, 0);
  // FIX: Convert year number to string for textContent property.
  document.getElementById('copyright-year').textContent = new Date().getFullYear().toString();

  // --- THEME TOGGLE ---
  const themeToggleCheckbox = document.getElementById('themeToggleCheckbox') as HTMLInputElement;
  const themeToggleLabel = document.querySelector('label[for="themeToggleCheckbox"]');
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  const lightThemeColor = '#ebedee';
  const darkThemeColor = '#242424';

  function applyTheme(theme) {
    const isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    themeToggleCheckbox.checked = isDark;
    if (themeToggleLabel) {
      themeToggleLabel.setAttribute('aria-checked', String(isDark));
    }
    if(themeMeta) {
      themeMeta.setAttribute('content', isDark ? darkThemeColor : lightThemeColor);
    }
  }

  function handleThemeChange() {
    const newTheme = themeToggleCheckbox.checked ? 'dark' : 'light';
    try {
      localStorage.setItem('theme', newTheme);
    } catch (e) {
      console.error("Could not save theme to localStorage:", e);
    }
    applyTheme(newTheme);
  }
  
  themeToggleCheckbox.addEventListener('change', handleThemeChange);
  const initialTheme = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(initialTheme);


  // --- CALCULATOR PAGE LOGIC ---
  function initializeCalculator() {
    const resultsDiv = document.getElementById('results');
    let lastCalculationResults = null;
    let isResetting = false;

    // Gelir vergisi dilimleri
    const TAX_BRACKETS = [
      { upTo: 158000, rate: 0.15 },
      { upTo: 330000, rate: 0.20 },
      { upTo: 1200000, rate: 0.27 },
      { upTo: 4300000, rate: 0.35 },
      { upTo: Infinity, rate: 0.40 }
    ];

    const fmtTL = n => (Math.round(n)).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' ₺';
    const fmtUSD = n => (Math.round(n)).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' $';
    const months = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];

    function formatNumber(value) {
      if (!value) return '';
      const numberString = String(value).replace(/[^\d]/g, '');
      if (numberString === '') return '';
      return new Intl.NumberFormat('tr-TR').format(parseInt(numberString, 10));
    }

    function parseFormattedNumber(value) {
      if (!value) return 0;
      return parseInt(String(value).replace(/[^\d]/g, ''), 10) || 0;
    }

    function parseFloatWithComma(value) {
      if (!value) return 0;
      // For Turkish locale, '.' is thousands separator, ',' is decimal.
      // Remove all '.' and replace ',' with '.' for parsing.
      const sanitized = String(value).replace(/\./g, '').replace(',', '.');
      return parseFloat(sanitized) || 0;
    }

    async function safeFetchUsdTry(){
      const FALLBACK = 41.98;
      try{
        const res = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=TRY',{cache:"no-store"});
        const j = await res.json();
        const rate = j?.rates?.TRY;
        if(typeof rate === 'number') return { rate, source: 'live' };
        throw new Error();
      }catch{ return { rate: FALLBACK, source: 'fallback' }; }
    }

    function getTaxRateForAnnualIncome(cumulativeIncome, brackets = TAX_BRACKETS){
      for(const b of brackets) if(cumulativeIncome <= b.upTo) return b.rate;
      return brackets[brackets.length-1].rate;
    }
    
    function compute1YearProjection(params) {
      let {
          monthlySalary, monthlyPremiumUsd, usdTry,
          expenseRatePct, profitRatePct
      } = params;
      
      const annualProfitRate = profitRatePct / 100;
      const dailyProfitRate = annualProfitRate / 365;
      const avgDaysInMonth = 365.2425 / 12;

      let fundUsd = 0;
      let policyAmount = 0; // Poliçe tutarı (vergi iadesi hariç)
      let totalPremiumTl = 0;
      let totalRebateTl = 0;
      let totalProfitTl = 0;
      let totalExpenseTl = 0;
      let cumulativeIncome = 0;
      let tableRows = "";
      const monthlyDetails = [];
      
      let totalProfitUsd = 0;
      let totalExpenseUsd = 0;
      
      for (let i = 0; i < 12; i++) {
          const monthName = months[i];
          
          const fundBeforeProfit = fundUsd;
          const fundAfterDailyCompounding = fundBeforeProfit * Math.pow(1 + dailyProfitRate, avgDaysInMonth);
          const profitThisMonthUsd = fundAfterDailyCompounding - fundBeforeProfit;
          const expenseThisMonthUsd = monthlyPremiumUsd * (expenseRatePct / 100);

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
              Ay: monthName,
              'Ödenen Prim': monthlyPremiumUsd,
              'Vergi Dilimi': taxRate * 100,
              'Vergi İadesi': rebateUsd,
              'Kâr Payı': profitThisMonthUsd,
              'Gider Payı': expenseThisMonthUsd,
              'Poliçe Tutarı': policyAmount,
          });
          
          tableRows += `<tr>
            <td>${monthName}</td>
            <td>${fmtUSD(monthlyPremiumUsd)}</td>
            <td>${(taxRate*100).toFixed(0)}%</td>
            <td>${fmtUSD(rebateUsd)}</td>
            <td>${fmtUSD(profitThisMonthUsd)}</td>
            <td>${fmtUSD(expenseThisMonthUsd)}</td>
            <td>${fmtUSD(policyAmount)}</td>
          </tr>`;
      }

      const totalPremiumUsd = monthlyPremiumUsd * 12;
      const totalRebateUsd = totalRebateTl / usdTry;
      const yearEndTl = fundUsd * usdTry;
      const yearEndPolicyAmountTl = policyAmount * usdTry;
      
      const totalRow = {
          Ay: `Top.`,
          'Ödenen Prim': totalPremiumUsd,
          'Vergi Dilimi': null,
          'Vergi İadesi': totalRebateUsd,
          'Kâr Payı': totalProfitUsd,
          'Gider Payı': totalExpenseUsd,
          'Poliçe Tutarı': policyAmount,
      };
      
      tableRows += `<tr class="total-row">
          <td>Top.</td>
          <td>${fmtUSD(totalPremiumUsd)}</td>
          <td>-</td>
          <td>${fmtUSD(totalRebateUsd)}</td>
          <td>${fmtUSD(totalProfitUsd)}</td>
          <td>${fmtUSD(totalExpenseUsd)}</td>
          <td>${fmtUSD(policyAmount)}</td>
        </tr>`;

      return {
          tableRowsHTML: tableRows,
          monthlyDetails: [...monthlyDetails, totalRow],
          yearlyTl: totalPremiumTl,
          totalRebateTl: totalRebateTl,
          yearlyProfitTl: totalProfitTl,
          yearlyExpenseTl: totalExpenseUsd * usdTry,
          yearEndTl: yearEndTl,
          yearEndPolicyAmountTl: yearEndPolicyAmountTl,
          yearlyPremiumUsd: totalPremiumUsd,
          totalRebateUsd: totalRebateUsd,
          yearlyProfitUsd: totalProfitUsd,
          yearlyExpenseUsd: totalExpenseUsd,
          yearEndUsd: fundUsd,
          yearEndPolicyAmountUsd: policyAmount,
      };
    }

    function compute10YearProjection(params) {
      const years = 10;
      let {
          monthlySalary, monthlyPremiumUsd, usdTryBase,
          expenseRatePct, profitRatePct, premiumGrowthPct,
          salaryGrowthPct, usdGrowthPct, taxBracketGrowthPct,
          profitRateGrowthPct
      } = params;

      const premiumGrowth = premiumGrowthPct / 100;
      const salaryGrowth = salaryGrowthPct / 100;
      const usdGrowth = usdGrowthPct / 100;
      const taxBracketGrowth = taxBracketGrowthPct / 100;

      const yearlyData = [];
      let cumulativePremiumTl = 0;
      let cumulativeRebateTl = 0;
      let cumulativeFundUsd = 0;
      let cumulativePolicyAmountUsd = 0;
      let cumulativeProfitTl = 0;
      let cumulativeExpenseTl = 0;

      let cumulativePremiumUsd = 0;
      let cumulativeRebateUsd = 0;
      let cumulativeProfitUsd = 0;
      let cumulativeExpenseUsd = 0;
      let cumulativePremiumUsdForChart = 0;

      for (let y = 1; y <= years; y++) {
          const yearProfitRatePct = profitRatePct * Math.pow(1 + profitRateGrowthPct / 100, y - 1);
          const annualProfitRate = yearProfitRatePct / 100;
          const dailyProfitRate = annualProfitRate / 365;
          const avgDaysInMonth = 365.2425 / 12;

          const yearMonthlySalary = monthlySalary * Math.pow(1 + salaryGrowth, y - 1);
          const yearUsdRate = usdTryBase * Math.pow(1 + usdGrowth, y - 1);
          const yearMonthlyPremiumUsd = monthlyPremiumUsd * Math.pow(1 + premiumGrowth, y - 1);
          
          const adjustedBrackets = TAX_BRACKETS.map(b => ({
            ...b,
            upTo: b.upTo === Infinity ? Infinity : b.upTo * Math.pow(1 + taxBracketGrowth, y - 1)
          }));

          let cumulativeIncomeForYear = 0;
          let rebateAnnualTl = 0;
          let annualPremiumTlForYear = 0;
          let annualProfitTlForYear = 0;
          let annualExpenseTlForYear = 0;
          let annualProfitUsdForYear = 0;
          let annualExpenseUsdForYear = 0;

          let rebateAnnualUsd = 0;

          for (let m = 1; m <= 12; m++) {
              const fundBeforeProfit = cumulativeFundUsd;
              const fundAfterDailyCompounding = fundBeforeProfit * Math.pow(1 + dailyProfitRate, avgDaysInMonth);
              const profitThisMonthUsd = fundAfterDailyCompounding - fundBeforeProfit;
              const expenseThisMonthUsd = yearMonthlyPremiumUsd * (expenseRatePct / 100);

              const monthlyPremiumTl = yearMonthlyPremiumUsd * yearUsdRate;

              cumulativeIncomeForYear += yearMonthlySalary;
              const taxRateForMonth = getTaxRateForAnnualIncome(cumulativeIncomeForYear, adjustedBrackets);
              const maxRefundablePremiumTlForMonth = yearMonthlySalary * 0.15;
              const actualRefundablePremiumTlForMonth = Math.min(monthlyPremiumTl, maxRefundablePremiumTlForMonth);
              const rebateTlForMonth = actualRefundablePremiumTlForMonth * taxRateForMonth;
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
          
          const endOfYearFundTl = cumulativeFundUsd * yearUsdRate;

          yearlyData.push({
              year: y,
              annualPremiumTl: annualPremiumTlForYear,
              annualRebateTl: rebateAnnualTl,
              endOfYearFundTl: endOfYearFundTl,
              annualPremiumUsd: annualPremiumUsdForYear,
              annualRebateUsd: rebateAnnualUsd,
              annualProfitUsd: annualProfitUsdForYear,
              annualExpenseUsd: annualExpenseUsdForYear,
              endOfYearFundUsd: cumulativeFundUsd,
              endOfYearPolicyAmountUsd: cumulativePolicyAmountUsd,
              totalPremiumUsd: cumulativePremiumUsdForChart,
              accWithRebateUsd: cumulativeFundUsd,
              totalPremiumTl: cumulativePremiumTl,
              accWithRebateTl: endOfYearFundTl,
          });
      }

      const finalYearUsdRate = usdTryBase * Math.pow(1 + usdGrowth, years - 1);
      const accWithRebateTl = cumulativeFundUsd * finalYearUsdRate;
      const totalPolicyAmountTl = cumulativePolicyAmountUsd * finalYearUsdRate;

      const totals = {
          totalPremiumTl: cumulativePremiumTl,
          totalRebateTl: cumulativeRebateTl,
          totalProfitTl: cumulativeProfitTl,
          totalExpenseTl: cumulativeExpenseTl,
          accWithRebateTl: accWithRebateTl,
          totalPolicyAmountTl: totalPolicyAmountTl,
          totalPremiumUsd: cumulativePremiumUsd,
          totalRebateUsd: cumulativeRebateUsd,
          totalProfitUsd: cumulativeProfitUsd,
          totalExpenseUsd: cumulativeExpenseUsd,
          accWithRebateUsd: cumulativeFundUsd,
          totalPolicyAmountUsd: cumulativePolicyAmountUsd,
      };

      return { totals, yearlyData };
    }


    async function updateRateAndShow(autoCompute = false, isManualRefresh = false){
      const rt = document.getElementById('rateText');
      if (!rt) return;
      rt.innerHTML = '<span class="spinner"></span> Bekleyin..';
      const { rate, source } = await safeFetchUsdTry();
      const usdInput = document.getElementById('usdTry') as HTMLInputElement;
      if(isManualRefresh || !usdInput.value) {
          usdInput.value = rate.toFixed(2).replace('.', ',');
      }
      rt.textContent = `1$ = ${rate.toFixed(2).replace('.', ',')}₺`;
      if(autoCompute) computeAndRender();
    }
    
    function getParamsFromForm() {
      return {
        monthlySalary: parseFormattedNumber((document.getElementById('monthlySalary') as HTMLInputElement).value),
        monthlyPremiumUsd: parseFloatWithComma((document.getElementById('monthlyPremiumUsd') as HTMLInputElement).value),
        annualSalaryGrowth: parseFloatWithComma((document.getElementById('annualSalaryGrowth') as HTMLInputElement).value),
        annualPremiumGrowth: parseFloatWithComma((document.getElementById('annualPremiumGrowth') as HTMLInputElement).value),
        annualUsdGrowth: parseFloatWithComma((document.getElementById('annualUsdGrowth') as HTMLInputElement).value),
        usdTry: parseFloatWithComma((document.getElementById('usdTry') as HTMLInputElement).value),
        usdTryBase: parseFloatWithComma((document.getElementById('usdTry') as HTMLInputElement).value),
        annualProfitRate: parseFloatWithComma((document.getElementById('annualProfitRate') as HTMLInputElement).value),
        profitRatePct: parseFloatWithComma((document.getElementById('annualProfitRate') as HTMLInputElement).value),
        annualProfitRateGrowth: parseFloatWithComma((document.getElementById('annualProfitRateGrowth') as HTMLInputElement).value),
        profitRateGrowthPct: parseFloatWithComma((document.getElementById('annualProfitRateGrowth') as HTMLInputElement).value),
        annualExpenseRate: parseFloatWithComma((document.getElementById('annualExpenseRate') as HTMLInputElement).value),
        expenseRatePct: parseFloatWithComma((document.getElementById('annualExpenseRate') as HTMLInputElement).value),
        annualTaxBracketGrowth: parseFloatWithComma((document.getElementById('annualTaxBracketGrowth') as HTMLInputElement).value),
        premiumGrowthPct: parseFloatWithComma((document.getElementById('annualPremiumGrowth') as HTMLInputElement).value),
        salaryGrowthPct: parseFloatWithComma((document.getElementById('annualSalaryGrowth') as HTMLInputElement).value),
        usdGrowthPct: parseFloatWithComma((document.getElementById('annualUsdGrowth') as HTMLInputElement).value),
        taxBracketGrowthPct: parseFloatWithComma((document.getElementById('annualTaxBracketGrowth') as HTMLInputElement).value),
      };
    }
    
    function computeAndRender() {
      if (isResetting) return;
      const params = getParamsFromForm();
      
      if (!params.usdTry || !params.monthlySalary || !params.monthlyPremiumUsd) {
          resultsDiv.innerHTML = `<div class="results-card"><p>Lütfen tüm gerekli alanları (maaş, prim, USD kuru) doldurarak tekrar deneyin.</p></div>`;
          resultsDiv.style.display = 'grid';
          return;
      }

      const proj1 = compute1YearProjection(params);
      const proj10 = compute10YearProjection(params);
      
      lastCalculationResults = { proj1, proj10, params };

      const tenYearSummaryParts = [
        `Başlangıç: ${formatNumber(params.monthlySalary)}₺ maaş, ${params.monthlyPremiumUsd}$ prim`,
        `Yıllık %${params.annualSalaryGrowth} maaş artışı`,
        `Yıllık %${params.annualUsdGrowth} kur artışı`,
        `Yıllık %${params.annualTaxBracketGrowth} vergi matrahı artışı`
      ];
      if (params.annualPremiumGrowth > 0) tenYearSummaryParts.splice(2, 0, `Yıllık %${params.annualPremiumGrowth} prim artışı`);
      if (params.annualProfitRateGrowth > 0) tenYearSummaryParts.splice(3, 0, `Yıllık %${params.annualProfitRateGrowth} kâr payı artışı`);
      const tenYearSummaryText = tenYearSummaryParts.join(', ');

      resultsDiv.innerHTML = `
        <div class="results-card">
          <h3>
            1 Yıllık Projeksiyon Özeti
          </h3>
          <div class="calculation-context-note">
            <span>${formatNumber(params.monthlySalary)}₺ Brüt maaş ve ${params.monthlyPremiumUsd}$ Prim ödemesi için</span>
          </div>
          <div class="table-wrapper">
            <div class="summary-list">
              <div class="summary-item">
                <div>Yıl boyunca ödenen prim</div><div>${fmtTL(proj1.yearlyTl)}</div><div>${fmtUSD(proj1.yearlyPremiumUsd)}</div>
              </div>
              <div class="summary-item">
                <div class="highlight-label">Yılda alınan vergi iadesi</div><div>${fmtTL(proj1.totalRebateTl)}</div><div>${fmtUSD(proj1.totalRebateUsd)}</div>
              </div>
              <div class="summary-item">
                <div>Poliçeye eklenen kar payı</div><div>${fmtTL(proj1.yearlyProfitTl)}</div><div>${fmtUSD(proj1.yearlyProfitUsd)}</div>
              </div>
              <div class="summary-item">
                <div>Ödenen gider payı</div><div>${fmtTL(proj1.yearlyExpenseTl)}</div><div>${fmtUSD(proj1.yearlyExpenseUsd)}</div>
              </div>
              <div class="summary-item">
                <div class="highlight-label">Poliçe tutarı</div><div>${fmtTL(proj1.yearEndPolicyAmountTl)}</div><div>${fmtUSD(proj1.yearEndPolicyAmountUsd)}</div>
              </div>
              <div class="summary-item">
                <div class="highlight-label">Vergi iadesi eklendiğinde</div><div>${fmtTL(proj1.yearEndTl)}</div><div>${fmtUSD(proj1.yearEndUsd)}</div>
              </div>
            </div>
          </div>
          <div class="collapsible-section">
              <div class="collapsible-header">
                  <div class="collapsible-header-title">1 Yıllık Tablo</div>
                  <div class="arrow-container">
                    <svg class="arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                  </div>
              </div>
              <div class="collapsible-content">
                  <div class="table-wrapper">
                      <table class="projection-details-table one-year-table">
                          <thead><tr>
                              <th>Ay</th><th>Ödenen<br>Prim</th><th>Vergi<br>Dilimi</th><th>Vergi<br>İadesi</th><th>Kâr<br>Payı</th><th>Gider<br>Payı</th><th>Poliçe<br>Tutarı</th>
                          </tr></thead>
                          <tbody>${proj1.tableRowsHTML}</tbody>
                      </table>
                  </div>
              </div>
          </div>
        </div>
        <div class="results-card">
          <h3>
            10 Yıllık Projeksiyon Özeti
          </h3>
          <div class="calculation-context-wrapper">
            <div class="calculation-context-note growth-rate-note">
              <span>${tenYearSummaryText}</span>
            </div>
          </div>
          <div class="table-wrapper">
            <div class="summary-list">
              <div class="summary-item">
                <div>10 yıl boyunca ödenen prim</div><div>${fmtTL(proj10.totals.totalPremiumTl)}</div><div>${fmtUSD(proj10.totals.totalPremiumUsd)}</div>
              </div>
              <div class="summary-item">
                <div class="highlight-label">10 yılda alınan vergi iadesi</div><div>${fmtTL(proj10.totals.totalRebateTl)}</div><div>${fmtUSD(proj10.totals.totalRebateUsd)}</div>
              </div>
              <div class="summary-item">
                <div>Poliçeye eklenen kar payı</div><div>${fmtTL(proj10.totals.totalProfitTl)}</div><div>${fmtUSD(proj10.totals.totalProfitUsd)}</div>
              </div>
              <div class="summary-item">
                <div>Ödenen gider payı</div><div>${fmtTL(proj10.totals.totalExpenseTl)}</div><div>${fmtUSD(proj10.totals.totalExpenseUsd)}</div>
              </div>
              <div class="summary-item">
                <div class="highlight-label">Poliçe tutarı</div><div>${fmtTL(proj10.totals.totalPolicyAmountTl)}</div><div>${fmtUSD(proj10.totals.totalPolicyAmountUsd)}</div>
              </div>
              <div class="summary-item">
                <div class="highlight-label">Vergi iadesi eklendiğinde</div><div>${fmtTL(proj10.totals.accWithRebateTl)}</div><div>${fmtUSD(proj10.totals.accWithRebateUsd)}</div>
              </div>
            </div>
          </div>
          <div class="collapsible-section">
              <div class="collapsible-header">
                  <div class="collapsible-header-title">10 Yıllık Tablo</div>
                  <div class="arrow-container">
                    <svg class="arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                  </div>
              </div>
              <div class="collapsible-content">
                  <div class="table-wrapper">
                    <table class="projection-details-table ten-year-table">
                      <thead><tr>
                        <th>Yıl</th>
                        <th>Ödenen<br>Prim</th>
                        <th>Vergi<br>İadesi</th>
                        <th>Kâr<br>Payı</th>
                        <th>Gider<br>Payı</th>
                        <th>Poliçe<br>Tutarı</th>
                      </tr></thead>
                      <tbody>
                        ${proj10.yearlyData.map(d => `
                          <tr>
                            <td>${d.year}. Yıl</td>
                            <td>${fmtUSD(d.annualPremiumUsd)}</td>
                            <td>${fmtUSD(d.annualRebateUsd)}</td>
                            <td>${fmtUSD(d.annualProfitUsd)}</td>
                            <td>${fmtUSD(d.annualExpenseUsd)}</td>
                            <td>${fmtUSD(d.endOfYearPolicyAmountUsd)}</td>
                          </tr>
                        `).join('')}
                        <tr class="total-row">
                           <td>Top.</td>
                           <td>${fmtUSD(proj10.totals.totalPremiumUsd)}</td>
                           <td>${fmtUSD(proj10.totals.totalRebateUsd)}</td>
                           <td>${fmtUSD(proj10.totals.totalProfitUsd)}</td>
                           <td>${fmtUSD(proj10.totals.totalExpenseUsd)}</td>
                           <td>${fmtUSD(proj10.totals.totalPolicyAmountUsd)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
              </div>
          </div>
        </div>
        <div class="results-card">
          <h3>
            Hesaplama Metodolojisi
          </h3>
          <div class="methodology-text">
            <p>Bu simülasyon, girdiğiniz verilere dayanarak potansiyel birikim ve vergi iadesi projeksiyonu sunar. Temel varsayımlar şunlardır:</p>
            <ul>
              <li><strong>Başlangıç Yılı:</strong> Tüm hesaplamalar <strong>2025</strong> yılı baz alınarak başlar ve ilk yıl için 2025 gelir vergisi dilimleri kullanılır.</li>
              <li><strong>Vergi İadesi:</strong> Vergi iadesi, aylık brüt maaşınızın <strong>%15'ini aşmayacak</strong> şekilde ödediğiniz prim tutarı üzerinden, o an içinde bulunduğunuz gelir vergisi dilimi oranına göre hesaplanır.</li>
              <li><strong>Dinamik Projeksiyon:</strong> 10 yıllık projeksiyonda maaş, prim, kur ve vergi dilimlerinin matrahları (üst limitleri), girdiğiniz yıllık artış oranlarına göre her yıl bileşik olarak artırılır. Bu, daha gerçekçi bir senaryo sunar.</li>
              <li><strong>Kâr Payı:</strong> Kâr payı, günlük bileşik getiri varsayımıyla hesaplanır ve fonunuza eklenir.</li>
            </ul>
          </div>
        </div>
      `;

      resultsDiv.style.display = 'grid';
    }
    
    function exportToExcel() {
      if (!lastCalculationResults) {
          alert("Lütfen önce bir hesaplama yapın.");
          return;
      }

      const { proj1, proj10, params } = lastCalculationResults;
      const wb = (window as any).XLSX.utils.book_new();

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
      const oneYearRows = proj1.monthlyDetails.map(d => [
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
      const tenYearRows = proj10.yearlyData.map(d => [
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

      const ws = (window as any).XLSX.utils.aoa_to_sheet(allData);

      const colWidths = Array(Math.max(paramsData[0].length, oneYearHeaders.length, tenYearHeaders.length)).fill({ wch: 19 });
      ws['!cols'] = colWidths;

      const borderStyle = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      const headerStyle = {
          font: { color: { rgb: "FFFFFF" }, bold: true },
          fill: { fgColor: { rgb: "4A5568" } }
      };
      const totalStyle = { font: { bold: true } };
      const leftAlign = { alignment: { horizontal: "left" } };
      const rightAlign = { alignment: { horizontal: "right" } };

      const paramsStartRow = 0;
      const paramsEndRow = paramsData.length - 1;
      const oneYearHeaderRow = paramsEndRow + 2;
      const oneYearEndRow = oneYearHeaderRow + oneYearRows.length;
      const oneYearTotalRow = oneYearEndRow;
      const tenYearHeaderRow = oneYearEndRow + 2;
      const tenYearEndRow = tenYearHeaderRow + tenYearRows.length;
      const tenYearTotalRow = tenYearEndRow;

      const tableBlocks = [
          { startRow: paramsStartRow, endRow: paramsEndRow, numCols: paramsData[0].length, headerRow: paramsStartRow, totalRow: -1 },
          { startRow: oneYearHeaderRow, endRow: oneYearEndRow, numCols: oneYearHeaders.length, headerRow: oneYearHeaderRow, totalRow: oneYearTotalRow },
          { startRow: tenYearHeaderRow, endRow: tenYearEndRow, numCols: tenYearHeaders.length, headerRow: tenYearHeaderRow, totalRow: tenYearTotalRow }
      ];

      tableBlocks.forEach(block => {
          for (let R = block.startRow; R <= block.endRow; ++R) {
              for (let C = 0; C < block.numCols; ++C) {
                  const cell_address = (window as any).XLSX.utils.encode_cell({ c: C, r: R });
                  const cell = ws[cell_address] = ws[cell_address] || {};
                  
                  let alignment;
                  if (block.startRow === paramsStartRow) {
                      alignment = (C < 2) ? leftAlign.alignment : rightAlign.alignment;
                  } else {
                      alignment = (C === 0) ? leftAlign.alignment : rightAlign.alignment;
                  }

                  // FIX: Changed type of currentStyle to `any` to allow adding `font` and `fill` properties dynamically.
                  // This resolves multiple TypeScript errors below.
                  const currentStyle: any = {
                      border: borderStyle,
                      alignment: alignment
                  };

                  if (R === block.headerRow) {
                      currentStyle.font = headerStyle.font;
                      currentStyle.fill = headerStyle.fill;
                  } else if (R === block.totalRow) {
                      // FIX: The original code `currentStyle.font = { ...currentStyle.font, ...totalStyle.font };`
                      // would cause a runtime error because `currentStyle.font` is undefined at this point.
                      // The intent is to apply the total row's font style, so we assign it directly.
                      currentStyle.font = totalStyle.font;
                  }

                  const cellValue = cell.v;
                  if (typeof cellValue === 'number') {
                      cell.t = 'n';
                      const isOneYearPercentageColumn = block.startRow === oneYearHeaderRow && C === 2;
                      if (cellValue > 0 && C > 0 && !isOneYearPercentageColumn) {
                           cell.z = '#,##0.00" $"';
                      }
                  }
                  
                  if (typeof cellValue === 'string' && cellValue.includes('%')) {
                      currentStyle.alignment = rightAlign.alignment;
                  }
                  
                  cell.s = currentStyle;
              }
          }
      });
      
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const filename = `Police-simulasyonu-${year}${month}${day}-${hours}${minutes}.xlsx`;
      
      (window as any).XLSX.utils.book_append_sheet(wb, ws, "Police_Bilanco_Simulasyonu");
      (window as any).XLSX.writeFile(wb, filename);
    }
    
    function resetForm() {
      isResetting = true;
      (document.getElementById('calcForm') as HTMLFormElement).reset();
      resultsDiv.style.display = 'none';
      resultsDiv.innerHTML = '';
      lastCalculationResults = null;
      (document.getElementById('usdTry') as HTMLInputElement).value = '';

      updateRateAndShow(false, true).then(() => {
          isResetting = false;
          computeAndRender();
      });
    }

    // Event Listeners
    document.getElementById('calcForm').addEventListener('submit', (e) => {
      e.preventDefault();
      computeAndRender();
    });

    const inputs = document.querySelectorAll('#calcForm input');
    inputs.forEach(input => {
      input.addEventListener('input', computeAndRender);
      
      // FIX: The thousand-separator formatting should only apply to the integer-based salary input.
      // It was previously also applied to the monthly premium input, which accepts decimals,
      // causing it to strip out commas and prevent users from entering decimal values.
      if (input.id === 'monthlySalary') {
        input.addEventListener('keyup', (e) => {
          const target = e.target as HTMLInputElement;
          const formattedValue = formatNumber(target.value);
          if (target.value !== formattedValue) {
            target.value = formattedValue;
          }
        });
      }
    });

    document.getElementById('refreshBtn').addEventListener('click', () => updateRateAndShow(true, true));
    document.getElementById('resetFormBtn').addEventListener('click', resetForm);
    document.getElementById('exportBtn').addEventListener('click', exportToExcel);
    
    updateRateAndShow(true);

    resultsDiv.addEventListener('click', (e) => {
      const header = (e.target as HTMLElement).closest('.collapsible-header');
      if (header) {
        e.preventDefault();
        const collapsible = header.closest('.collapsible-section');
        if (collapsible) {
          collapsible.classList.toggle('is-open');
        }
      }
    });
  }
  
  // --- INITIALIZE ALL ---
  initializeCalculator();

});