
import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, Worker, CurrencyPair, Currency } from './types';
import { INITIAL_CURRENCY_PAIRS, ALL_CURRENCIES } from './constants';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Users, 
  Settings, 
  Plus, 
  TrendingUp, 
  Star, 
  Wallet, 
  ArrowRight, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Banknote, 
  Coins, 
  Trash2,
  Edit3,
  Menu,
  X,
  Download,
  Upload,
  FileText
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'workers' | 'caja' | 'settings'>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [pairs, setPairs] = useState<CurrencyPair[]>(INITIAL_CURRENCY_PAIRS);
  const [funds, setFunds] = useState<Record<string, number>>({});
  
  // Base rates are now manually defined by the user as "Market/Reference" prices
  const [referenceRates, setReferenceRates] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('referenceRates');
    return saved ? JSON.parse(saved) : { 'CUP': 1, 'USD': 320, 'EUR': 330, 'MLC': 275 };
  });

  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const saved = (key: string) => localStorage.getItem(key);
    if (saved('transactions')) setTransactions(JSON.parse(saved('transactions')!));
    if (saved('workers')) setWorkers(JSON.parse(saved('workers')!));
    if (saved('pairs')) setPairs(JSON.parse(saved('pairs')!));
    if (saved('funds')) setFunds(JSON.parse(saved('funds')!));
  }, []);

  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('workers', JSON.stringify(workers));
    localStorage.setItem('pairs', JSON.stringify(pairs));
    localStorage.setItem('funds', JSON.stringify(funds));
    localStorage.setItem('referenceRates', JSON.stringify(referenceRates));
  }, [transactions, workers, pairs, funds, referenceRates]);

  const updateReferenceRate = (currency: string, value: number) => {
    setReferenceRates(prev => ({ ...prev, [currency]: value }));
  };

  const addReferenceRate = (currency: string) => {
    if (!referenceRates[currency]) {
      setReferenceRates(prev => ({ ...prev, [currency]: 0 }));
    }
  };

  const removeReferenceRate = (currency: string) => {
    setReferenceRates(prev => {
      const next = { ...prev };
      delete next[currency];
      return next;
    });
  };

  const getSuggestedRate = (from: Currency, to: Currency) => {
    const fromInCUP = referenceRates[from] || 0;
    const toInCUP = referenceRates[to] || 1;
    if (toInCUP === 0) return 0;
    return Number((fromInCUP / toInCUP).toFixed(4));
  };

  const addTransaction = (t: Omit<Transaction, 'id' | 'date'>) => {
    const newTx: Transaction = {
      ...t,
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString()
    };
    
    setFunds(prev => ({
      ...prev,
      [t.currency]: (prev[t.currency] || 0) + t.amount,
      [t.targetCurrency]: (prev[t.targetCurrency] || 0) - t.totalCUP
    }));

    setTransactions([newTx, ...transactions]);
    setShowTransactionModal(false);
  };

  const adjustFunds = (currency: Currency, amount: number, type: 'ingreso' | 'egreso') => {
    setFunds(prev => ({
      ...prev,
      [currency]: (prev[currency] || 0) + (type === 'ingreso' ? amount : -amount)
    }));
    setShowFundModal(false);
  };

  const deleteTransaction = (id: string) => {
    const tx = transactions.find(t => t.id === id);
    if (tx) {
      setFunds(prev => ({
        ...prev,
        [tx.currency]: (prev[tx.currency] || 0) - tx.amount,
        [tx.targetCurrency]: (prev[tx.targetCurrency] || 0) + tx.totalCUP
      }));
    }
    setTransactions(transactions.filter(t => t.id !== id));
  };

  const resetToFactory = () => {
    localStorage.clear();
    setTransactions([]);
    setWorkers([]);
    setPairs(INITIAL_CURRENCY_PAIRS);
    setFunds({});
    setReferenceRates({ 'CUP': 1, 'USD': 320, 'EUR': 330, 'MLC': 275 });
    setShowResetConfirm(false);
  };

  const handleRestoreData = (data: any) => {
    if (data.transactions) setTransactions(data.transactions);
    if (data.workers) setWorkers(data.workers);
    if (data.pairs) setPairs(data.pairs);
    if (data.funds) setFunds(data.funds);
    if (data.referenceRates) setReferenceRates(data.referenceRates);
    alert("Datos restaurados correctamente");
  };

  const profits = useMemo(() => {
    let totalCUP = 0;
    transactions.forEach(tx => {
      // Market value of what we RECEIVED (using our manual reference rate)
      const receivedValueCUP = tx.amount * (referenceRates[tx.currency] || 0);
      // Market value of what we DELIVERED (using our manual reference rate for the target)
      const deliveredValueCUP = tx.totalCUP * (referenceRates[tx.targetCurrency] || 0);
      
      // Profit is the difference
      totalCUP += (receivedValueCUP - deliveredValueCUP);
    });

    const totalUSD = totalCUP / (referenceRates['USD'] || 1);
    const totalEUR = totalCUP / (referenceRates['EUR'] || 1);

    return { cup: totalCUP, usd: totalUSD, eur: totalEUR };
  }, [transactions, referenceRates]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 text-gray-900">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 h-16 flex justify-between items-center sticky top-0 z-40">
        <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
          <Banknote className="text-blue-500" />
          RemesaControl
        </h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-600 p-1">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 bg-white z-40 p-4 space-y-2 overflow-y-auto">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<ArrowLeftRight size={20} />} label="Remesas" active={activeTab === 'transactions'} onClick={() => { setActiveTab('transactions'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<Wallet size={20} />} label="Mi Caja" active={activeTab === 'caja'} onClick={() => { setActiveTab('caja'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<Users size={20} />} label="Trabajadores" active={activeTab === 'workers'} onClick={() => { setActiveTab('workers'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<Settings size={20} />} label="Configuración" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} />
        </div>
      )}

      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 h-screen sticky top-0">
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
            <Banknote className="text-blue-500" />
            RemesaControl
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<ArrowLeftRight size={20} />} label="Remesas" active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />
          <NavItem icon={<Wallet size={20} />} label="Mi Caja" active={activeTab === 'caja'} onClick={() => setActiveTab('caja')} />
          <NavItem icon={<Users size={20} />} label="Trabajadores" active={activeTab === 'workers'} onClick={() => setActiveTab('workers')} />
          <NavItem icon={<Settings size={20} />} label="Configuración" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
      </aside>

      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 capitalize">
              {activeTab === 'dashboard' ? 'Control de Tasas' : activeTab === 'transactions' ? 'Movimientos' : activeTab === 'workers' ? 'Trabajadores' : activeTab === 'caja' ? 'Balance de Caja' : 'Configuración'}
            </h2>
            <p className="text-sm text-gray-500">Sistema 100% Manual</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowFundModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-emerald-100 transition-all active:scale-95">
              <Wallet size={20} />
              <span>Ajustar Caja</span>
            </button>
            <button onClick={() => setShowTransactionModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-lg shadow-blue-100 transition-all active:scale-95">
              <Plus size={20} />
              <span>Nueva Remesa</span>
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <DashboardView 
            transactions={transactions} 
            referenceRates={referenceRates}
            onUpdateRate={updateReferenceRate}
            onAddRate={addReferenceRate}
            onRemoveRate={removeReferenceRate}
            profits={profits}
            funds={funds}
          />
        )}
        {activeTab === 'transactions' && (
          <TransactionsView transactions={transactions} workers={workers} onDelete={deleteTransaction} />
        )}
        {activeTab === 'caja' && (
          <CajaView funds={funds} referenceRates={referenceRates} />
        )}
        {activeTab === 'workers' && (
          <WorkersView workers={workers} onAdd={(n, a) => setWorkers([...workers, { id: Math.random().toString(36).substr(2, 9), name: n, accountInfo: a }])} onDelete={(id) => setWorkers(workers.filter(w => w.id !== id))} />
        )}
        {activeTab === 'settings' && (
          <SettingsView 
            pairs={pairs} 
            onToggleFavorite={(id) => setPairs(pairs.map(p => p.id === id ? { ...p, isFavorite: !p.isFavorite } : p))} 
            onAddPair={(b, t) => setPairs([...pairs, { id: `${b}-${t}`, base: b, target: t, isFavorite: true }])} 
            onResetRequest={() => setShowResetConfirm(true)}
            onRestoreData={handleRestoreData}
            fullState={{ transactions, workers, pairs, funds, referenceRates }}
          />
        )}
      </main>

      {showTransactionModal && (
        <TransactionModal 
          onClose={() => setShowTransactionModal(false)}
          onSubmit={addTransaction}
          workers={workers}
          getSuggestedRate={getSuggestedRate}
        />
      )}

      {showFundModal && (
        <FundAdjustmentModal 
          onClose={() => setShowFundModal(false)}
          onSubmit={adjustFunds}
        />
      )}

      {showResetConfirm && (
        <ConfirmModal
          title="Restablecer Configuración de Fábrica"
          message="¿Estás seguro de que deseas restablecer la aplicación? Esto eliminará todas las transacciones, trabajadores, fondos y configuraciones. Esta acción no se puede deshacer."
          onConfirm={resetToFactory}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </div>
  );
};

const NavItem: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>
    {icon}
    <span>{label}</span>
  </button>
);

const DashboardView: React.FC<{ 
  transactions: Transaction[], 
  referenceRates: Record<string, number>,
  onUpdateRate: (curr: string, val: number) => void,
  onAddRate: (curr: string) => void,
  onRemoveRate: (curr: string) => void,
  profits: { cup: number, usd: number, eur: number },
  funds: Record<string, number>
}> = ({ transactions, referenceRates, onUpdateRate, onAddRate, onRemoveRate, profits, funds }) => {
  const [newRateCurrency, setNewRateCurrency] = useState<string>('');
  const activeRates = Object.keys(referenceRates).filter(c => c !== 'CUP');
  const availableToAdd = ALL_CURRENCIES.filter(c => c !== 'CUP' && !activeRates.includes(c));

  return (
    <div className="space-y-8">
      {/* Profits Section */}
      <section className="space-y-4">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Coins size={14} className="text-emerald-500" /> Ganancias Estimadas (Cálculo Manual)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-emerald-600 p-6 rounded-3xl shadow-lg shadow-emerald-100 text-white">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100">Margen en CUP</p>
            <p className="text-3xl font-black">{Math.round(profits.cup).toLocaleString()}</p>
          </div>
          <div className="bg-blue-600 p-6 rounded-3xl shadow-lg shadow-blue-100 text-white">
            <p className="text-[10px] font-black uppercase tracking-widest text-blue-100">Margen en USD</p>
            <p className="text-3xl font-black">{profits.usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-slate-800 p-6 rounded-3xl shadow-lg shadow-slate-100 text-white">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Margen en EUR</p>
            <p className="text-3xl font-black">{profits.eur.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </section>

      {/* Manual Reference Rates Management */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
            <Edit3 size={14} className="text-blue-500" /> Definir Tasas de Referencia (CUP)
          </h3>
          <div className="flex gap-2 w-full sm:w-auto">
            <select 
              value={newRateCurrency} 
              onChange={e => setNewRateCurrency(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold flex-1 sm:flex-none"
            >
              <option value="">Añadir divisa...</option>
              {availableToAdd.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button 
              onClick={() => { if (newRateCurrency) { onAddRate(newRateCurrency); setNewRateCurrency(''); } }}
              disabled={!newRateCurrency}
              className="bg-blue-600 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 bg-blue-50 p-3 rounded-xl border border-blue-100">
          Define aquí el valor real/mercado de cada divisa. Esto servirá como base para calcular tus ganancias y sugerir tasas en las remesas.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {activeRates.map(curr => (
            <div key={curr} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-2 relative group">
              <button 
                onClick={() => onRemoveRate(curr)}
                className="absolute top-2 right-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
              <label className="text-[10px] font-black text-gray-400 uppercase">{curr} vs CUP</label>
              <input 
                type="number" 
                value={referenceRates[curr] || 0}
                onChange={e => onUpdateRate(curr, Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 font-black text-blue-600 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Funds Summary */}
      <section className="space-y-4">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Wallet size={14} className="text-gray-400" /> Estados de Cuenta
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Efectivo CUP</p>
            <p className="text-2xl font-black text-emerald-600">{(funds['CUP'] || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Saldo USD</p>
            <p className="text-2xl font-black text-amber-600">{(funds['USD'] || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Saldo EUR</p>
            <p className="text-2xl font-black text-indigo-600">{(funds['EUR'] || 0).toLocaleString()}</p>
          </div>
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Volumen Operaciones</p>
            <p className="text-2xl font-black text-gray-800">{transactions.length}</p>
          </div>
        </div>
      </section>
    </div>
  );
};

const TransactionsView: React.FC<{ transactions: Transaction[], workers: Worker[], onDelete: (id: string) => void }> = ({ transactions, workers, onDelete }) => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (!startDate && !endDate) return true;
      const txDate = new Date(tx.date).getTime();
      const start = startDate ? new Date(startDate).getTime() : 0;
      const end = endDate ? new Date(endDate).getTime() + 86400000 : Infinity; // Include the whole end day
      return txDate >= start && txDate <= end;
    });
  }, [transactions, startDate, endDate]);

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Historial de Remesas", 14, 15);
    doc.setFontSize(10);
    doc.text(`Desde: ${startDate ? new Date(startDate).toLocaleDateString() : 'Inicio'} Hasta: ${endDate ? new Date(endDate).toLocaleDateString() : 'Hoy'}`, 14, 22);

    const tableData = filteredTransactions.map(tx => [
      new Date(tx.date).toLocaleDateString(),
      tx.clientName || 'Sin nombre',
      workers.find(w => w.id === tx.workerId)?.name || 'Sin nombre',
      `${tx.amount} ${tx.currency}`,
      `${tx.totalCUP} ${tx.targetCurrency}`,
      `1:${tx.rate}`
    ]);

    autoTable(doc, {
      startY: 28,
      head: [['Fecha', 'Cliente', 'Trabajador', 'Recibo', 'Entrega', 'Tasa']],
      body: tableData,
    });

    doc.save(`remesas_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-end justify-between">
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="space-y-1 flex-1 sm:flex-none">
            <label className="text-[10px] font-black text-gray-400 uppercase">Desde</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none" />
          </div>
          <div className="space-y-1 flex-1 sm:flex-none">
            <label className="text-[10px] font-black text-gray-400 uppercase">Hasta</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold outline-none" />
          </div>
        </div>
        <button onClick={exportPDF} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-colors w-full sm:w-auto justify-center">
          <FileText size={18} /> Exportar PDF
        </button>
      </div>
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Fecha / Destino</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Recibo</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Entrega</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Tasa</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTransactions.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50 group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-800">{tx.clientName || 'Cliente sin nombre'}</div>
                    <div className="text-[10px] text-gray-400">Trabajador: {workers.find(w => w.id === tx.workerId)?.name || 'Sin nombre'}</div>
                    <div className="text-[10px] text-gray-400">{new Date(tx.date).toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <ArrowDownLeft size={12} className="text-emerald-500" />
                      <span className="font-black">{tx.amount.toLocaleString()}</span>
                      <span className="text-[10px] text-gray-400">{tx.currency}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <ArrowUpRight size={12} className="text-rose-500" />
                      <span className="font-black text-blue-600">{tx.totalCUP.toLocaleString()}</span>
                      <span className="text-[10px] text-blue-300">{tx.targetCurrency}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs">1:{tx.rate}</td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => onDelete(tx.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"><Trash2 size={16}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const CajaView: React.FC<{ funds: Record<string, number>, referenceRates: Record<string, number> }> = ({ funds, referenceRates }) => {
  const activeCurrencies = ALL_CURRENCIES.filter(c => (funds[c] || 0) !== 0);
  const totalInUSD = activeCurrencies.reduce((acc, c) => {
    const valInCUP = (funds[c] || 0) * (referenceRates[c] || 0);
    return acc + (valInCUP / (referenceRates['USD'] || 1));
  }, 0);

  return (
    <div className="space-y-8">
      <div className="bg-emerald-600 p-8 rounded-3xl text-white flex justify-between items-center shadow-xl shadow-emerald-50">
        <div>
          <p className="text-xs font-bold uppercase text-emerald-100">Capital Estimado (USD)</p>
          <p className="text-4xl font-black">${totalInUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
        </div>
        <Banknote size={48} className="opacity-20" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {activeCurrencies.map(c => (
          <div key={c} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p className="text-[10px] font-black text-gray-400 uppercase">{c}</p>
            <p className={`text-2xl font-black ${(funds[c] || 0) >= 0 ? 'text-gray-800' : 'text-red-500'}`}>{(funds[c] || 0).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const WorkersView: React.FC<{ workers: Worker[], onAdd: (n: string, a: string) => void, onDelete: (id: string) => void }> = ({ workers, onAdd, onDelete }) => {
  const [n, setN] = useState('');
  const [a, setA] = useState('');
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4 h-fit">
        <h3 className="font-bold">Nuevo Trabajador</h3>
        <input placeholder="Nombre" value={n} onChange={e => setN(e.target.value)} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none" />
        <textarea placeholder="Datos de Cuenta" value={a} onChange={e => setA(e.target.value)} rows={3} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none" />
        <button onClick={() => { onAdd(n, a); setN(''); setA(''); }} className="w-full bg-blue-600 text-white py-2 rounded-xl font-bold">Guardar</button>
      </div>
      <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {workers.map(w => (
          <div key={w.id} className="bg-white p-5 rounded-2xl border border-gray-100 flex justify-between items-start">
            <div>
              <p className="font-bold">{w.name}</p>
              <p className="text-xs text-gray-400 mt-2">{w.accountInfo}</p>
            </div>
            <button onClick={() => onDelete(w.id)} className="text-gray-200 hover:text-red-500"><Trash2 size={16}/></button>
          </div>
        ))}
      </div>
    </div>
  );
};

const SettingsView: React.FC<{ 
  pairs: CurrencyPair[], 
  onToggleFavorite: (id: string) => void, 
  onAddPair: (f: Currency, t: Currency) => void,
  onResetRequest: () => void,
  onRestoreData: (data: any) => void,
  fullState: any
}> = ({ pairs, onToggleFavorite, onAddPair, onResetRequest, onRestoreData, fullState }) => {
  const [from, setFrom] = useState<Currency>('USD');
  const [to, setTo] = useState<Currency>('CUP');

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(fullState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `remesacontrol_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.transactions) {
          onRestoreData(data);
        } else {
          alert("El archivo no tiene el formato correcto.");
        }
      } catch (err) {
        alert("Archivo inválido o corrupto.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-2xl bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
      <h3 className="font-bold mb-6">Gestionar Pares de Divisas</h3>
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="flex flex-1 gap-2 items-center w-full">
          <select value={from} onChange={e => setFrom(e.target.value as Currency)} className="flex-1 min-w-0 px-4 py-2 bg-gray-50 rounded-xl font-bold">
            {ALL_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <ArrowRight className="text-gray-300 shrink-0" />
          <select value={to} onChange={e => setTo(e.target.value as Currency)} className="flex-1 min-w-0 px-4 py-2 bg-gray-50 rounded-xl font-bold">
            {ALL_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={() => onAddPair(from, to)} className="bg-blue-600 text-white p-2 rounded-xl w-full sm:w-auto flex justify-center items-center"><Plus/></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {pairs.map(p => (
          <div key={p.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
            <span className="font-bold text-sm">{p.base} → {p.target}</span>
            <button onClick={() => onToggleFavorite(p.id)} className={p.isFavorite ? 'text-amber-500' : 'text-gray-300'}><Star fill={p.isFavorite ? 'currentColor' : 'none'} size={18}/></button>
          </div>
        ))}
      </div>

      <div className="mt-12 pt-8 border-t border-gray-100">
        <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Download size={20} className="text-blue-500" /> Copias de Seguridad
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Exporta todos tus datos para guardarlos de forma segura, o importa un archivo de respaldo anterior.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button 
            onClick={handleExport}
            className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
          >
            <Download size={18} /> Exportar Datos
          </button>
          <label className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-600 px-4 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer">
            <Upload size={18} /> Importar Datos
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-gray-100">
        <h3 className="font-bold text-red-600 mb-4 flex items-center gap-2">
          <Trash2 size={20} /> Zona de Peligro
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Restablecer la aplicación eliminará todos los datos guardados: transacciones, trabajadores, fondos y tasas de referencia. Esta acción no se puede deshacer.
        </p>
        <button 
          onClick={onResetRequest} 
          className="bg-red-50 hover:bg-red-100 text-red-600 px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2 w-full sm:w-auto justify-center"
        >
          <Trash2 size={18} /> Restablecer Configuración de Fábrica
        </button>
      </div>
    </div>
  );
};

const TransactionModal: React.FC<{ 
  onClose: () => void, 
  onSubmit: (t: Omit<Transaction, 'id' | 'date'>) => void,
  workers: Worker[],
  getSuggestedRate: (f: Currency, t: Currency) => number
}> = ({ onClose, onSubmit, workers, getSuggestedRate }) => {
  const [clientName, setClientName] = useState('');
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState<Currency>('USD');
  const [to, setTo] = useState<Currency>('CUP');
  const [workerId, setWorkerId] = useState(workers[0]?.id || '');
  const [rate, setRate] = useState<number>(0);

  useEffect(() => {
    setRate(getSuggestedRate(from, to));
  }, [from, to]);

  const total = Number(amount) * rate;

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-8 bg-blue-600 text-white flex justify-between">
          <h3 className="text-2xl font-black">Registrar Remesa</h3>
          <button onClick={onClose}><Plus className="rotate-45" size={24}/></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSubmit({ clientName, workerId, amount: Number(amount), currency: from, targetCurrency: to, rate, totalCUP: total, description: '', status: 'completado' }); }} className="p-8 space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-400 uppercase">Nombre del Cliente</label>
            <input type="text" required value={clientName} onChange={e => setClientName(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold outline-none" placeholder="Ej. Juan Pérez" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase">Recibes</label>
              <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-xl font-black outline-none" placeholder="0.00" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase">Divisa</label>
              <select value={from} onChange={e => setFrom(e.target.value as Currency)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold">
                {ALL_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase">Beneficiario</label>
              <select value={workerId} onChange={e => setWorkerId(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold">
                {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase">Divisa Entrega</label>
              <select value={to} onChange={e => setTo(e.target.value as Currency)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-bold">
                {ALL_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="bg-blue-50 p-6 rounded-2xl flex justify-between items-center border border-blue-100">
            <div>
              <label className="text-[10px] font-black text-blue-400 uppercase block mb-1">Tasa de Operación</label>
              <input type="number" step="0.01" value={rate} onChange={e => setRate(Number(e.target.value))} className="w-24 bg-white border border-blue-200 rounded-lg px-2 py-1 text-blue-600 font-black outline-none" />
            </div>
            <div className="text-right">
              <label className="text-[10px] font-black text-blue-400 uppercase block mb-1">Total a Entregar</label>
              <p className="text-2xl font-black text-blue-700">{total.toLocaleString()} <span className="text-xs">{to}</span></p>
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xl shadow-lg">REGISTRAR</button>
        </form>
      </div>
    </div>
  );
};

const FundAdjustmentModal: React.FC<{
  onClose: () => void,
  onSubmit: (currency: Currency, amount: number, type: 'ingreso' | 'egreso') => void
}> = ({ onClose, onSubmit }) => {
  const [currency, setCurrency] = useState<Currency>('USD');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'ingreso' | 'egreso'>('ingreso');

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
        <div className={`p-6 text-white flex justify-between ${type === 'ingreso' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          <h3 className="font-black">Ajustar Saldo de Caja</h3>
          <button onClick={onClose}><Plus className="rotate-45"/></button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSubmit(currency, Number(amount), type); }} className="p-6 space-y-4">
          <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
            <button type="button" onClick={() => setType('ingreso')} className={`flex-1 py-2 rounded-lg font-bold text-xs ${type === 'ingreso' ? 'bg-white shadow text-emerald-600' : 'text-gray-400'}`}>INGRESO</button>
            <button type="button" onClick={() => setType('egreso')} className={`flex-1 py-2 rounded-lg font-bold text-xs ${type === 'egreso' ? 'bg-white shadow text-rose-600' : 'text-gray-400'}`}>EGRESO</button>
          </div>
          <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className="w-full px-4 py-3 bg-gray-50 border rounded-xl font-bold">
            {ALL_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="number" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="Monto" className="w-full px-4 py-3 bg-gray-50 border rounded-xl text-xl font-black outline-none" />
          <button type="submit" className={`w-full py-4 rounded-2xl font-black text-white ${type === 'ingreso' ? 'bg-emerald-600' : 'bg-rose-600'}`}>CONFIRMAR</button>
        </form>
      </div>
    </div>
  );
};

const ConfirmModal: React.FC<{
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-6">
      <h3 className="text-xl font-black text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-6">{message}</p>
      <div className="flex gap-3">
        <button 
          onClick={onCancel} 
          className="flex-1 py-3 rounded-xl font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          Cancelar
        </button>
        <button 
          onClick={onConfirm} 
          className="flex-1 py-3 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
        >
          Sí, Restablecer
        </button>
      </div>
    </div>
  </div>
);

export default App;
