import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { RefreshCw, Calculator, ShieldCheck, TrendingUp } from 'lucide-react';

const App = () => {
  // State
  const [exchangeRate, setExchangeRate] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRateEdited, setIsRateEdited] = useState<boolean>(false);

  const [monthlyPremiumUsd, setMonthlyPremiumUsd] = useState<number>(150);
  const [taxBracket, setTaxBracket] = useState<number>(27);

  // Fetch Live Rate
  const fetchRate = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!response.ok) throw new Error('API Hatası');
      
      const data = await response.json();
      const rate = data.rates.TRY;
      
      if (typeof rate === 'number') {
        setExchangeRate(rate);
        setIsRateEdited(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRate();
  }, []);

  const handleRateChange = (val: string) => {
    const num = parseFloat(val);
    setExchangeRate(isNaN(num) ? 0 : num);
    setIsRateEdited(true);
  };

  // Calculations
  const monthlyPremiumTry = monthlyPremiumUsd * exchangeRate;
  const taxAdvantage = monthlyPremiumTry * (taxBracket / 100);
  const netCost = monthlyPremiumTry - taxAdvantage;

  // Yearly
  const yearlyTaxAdvantage = taxAdvantage * 12;
  const yearlyNetCost = netCost * 12;

  // 10 Year Projection
  const tenYearTaxAdvantage = yearlyTaxAdvantage * 10;
  const totalCost10Years = yearlyNetCost * 10;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        
        {/* Header Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-full text-blue-600">
              <ShieldCheck size={28} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Poliçe Asistanı</h1>
              <p className="text-sm text-gray-500">Vergi Avantajlı Sigorta Hesaplayıcı</p>
            </div>
          </div>

          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-md p-1">
            <div className="px-3 py-1 border-r border-gray-200 text-right">
              <span className="text-[10px] text-gray-500 uppercase font-bold block">USD / TRY</span>
              <div className="flex items-center gap-1">
                <input 
                  type="number" 
                  value={exchangeRate || ''}
                  onChange={(e) => handleRateChange(e.target.value)}
                  className="bg-transparent w-16 text-right font-mono font-bold text-gray-800 focus:outline-none focus:text-blue-600"
                />
              </div>
            </div>
            <button 
              onClick={fetchRate} 
              disabled={loading}
              className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Inputs Panel */}
          <div className="md:col-span-5 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4 border-b pb-2 border-gray-100">
                <Calculator size={18} className="text-gray-400" />
                <h2 className="font-semibold text-gray-700">Hesaplama Ayarları</h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Aylık Prim Tutarı (USD)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={monthlyPremiumUsd}
                      onChange={(e) => setMonthlyPremiumUsd(Number(e.target.value))}
                      className="w-full border border-gray-300 rounded-md py-2 pl-3 pr-10 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
                    />
                    <span className="absolute right-3 top-2 text-gray-400 font-bold">$</span>
                  </div>
                  <div className="mt-1 text-right text-xs text-gray-500">
                    = {formatCurrency(monthlyPremiumTry)} / ay
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Gelir Vergisi Dilimi</label>
                  <div className="grid grid-cols-5 gap-1">
                    {[15, 20, 27, 35, 40].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => setTaxBracket(rate)}
                        className={`py-1.5 text-sm font-medium rounded border transition-colors ${
                          taxBracket === rate
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        %{rate}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results Panel */}
          <div className="md:col-span-7 space-y-4">
            
            {/* Summary Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-lg shadow-sm border border-emerald-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-2 opacity-5">
                  <TrendingUp size={48} className="text-emerald-600" />
                </div>
                <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider mb-1">Devlet Katkısı / Vergi İadesi</p>
                <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(taxAdvantage)}</h3>
                <p className="text-xs text-gray-400 mt-1">Aylık Kazanç</p>
              </div>

              <div className="bg-white p-5 rounded-lg shadow-sm border border-blue-100">
                <p className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1">Cebinizden Çıkan Net</p>
                <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(netCost)}</h3>
                <p className="text-xs text-gray-400 mt-1">Aylık Maliyet</p>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50">
                <h3 className="text-sm font-semibold text-gray-700">Kazanç Tablosu</h3>
              </div>
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-100">
                    <th className="px-6 py-3 font-medium">Süre</th>
                    <th className="px-6 py-3 font-medium">Toplam Prim</th>
                    <th className="px-6 py-3 font-medium text-emerald-600">Vergi Avantajı</th>
                    <th className="px-6 py-3 font-medium text-right">Net Maliyet</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <tr>
                    <td className="px-6 py-3 font-medium text-gray-700">1 Ay</td>
                    <td className="px-6 py-3 text-gray-500">{formatCurrency(monthlyPremiumTry)}</td>
                    <td className="px-6 py-3 text-emerald-600 font-bold">+{formatCurrency(taxAdvantage)}</td>
                    <td className="px-6 py-3 text-right font-medium text-gray-800">{formatCurrency(netCost)}</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-3 font-medium text-gray-700">1 Yıl</td>
                    <td className="px-6 py-3 text-gray-500">{formatCurrency(monthlyPremiumTry * 12)}</td>
                    <td className="px-6 py-3 text-emerald-600 font-bold">+{formatCurrency(yearlyTaxAdvantage)}</td>
                    <td className="px-6 py-3 text-right font-medium text-gray-800">{formatCurrency(yearlyNetCost)}</td>
                  </tr>
                  <tr className="bg-blue-50/30">
                    <td className="px-6 py-3 font-medium text-gray-700">10 Yıl</td>
                    <td className="px-6 py-3 text-gray-500">{formatCurrency(monthlyPremiumTry * 120)}</td>
                    <td className="px-6 py-3 text-emerald-600 font-bold">+{formatCurrency(tenYearTaxAdvantage)}</td>
                    <td className="px-6 py-3 text-right font-bold text-blue-900">{formatCurrency(totalCost10Years)}</td>
                  </tr>
                </tbody>
              </table>
              <div className="px-6 py-3 bg-gray-50 text-xs text-gray-400 text-center border-t border-gray-100">
                Vergi dilimi ve kur sabit varsayılarak hesaplanmıştır.
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
