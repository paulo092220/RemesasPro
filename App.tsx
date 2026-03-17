import React, { useState, useEffect, useMemo } from 'react';
// Tipos y Constantes
import { Transaction, Worker, CurrencyPair, Currency } from './types';
import { INITIAL_CURRENCY_PAIRS, ALL_CURRENCIES } from './constants';
// Firebase
import { auth, signInWithGoogle, logOut, db } from './firebase';
import { onAuthStateChanged, User, getRedirectResult } from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  writeBatch 
} from 'firebase/firestore';
// Iconos y PDF
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Users, 
  Settings, 
  Plus, 
  Wallet, 
  Banknote, 
  Trash2,
  Menu,
  X,
  FileText,
  LogOut
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'workers' | 'caja' | 'settings'>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [pairs, setPairs] = useState<CurrencyPair[]>(INITIAL_CURRENCY_PAIRS);
  const [funds, setFunds] = useState<Record<string, number>>({});
  const [referenceRates, setReferenceRates] = useState<Record<string, number>>({ 'CUP': 1, 'USD': 320, 'EUR': 330, 'MLC': 275 });

  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- EFECTOS DE AUTENTICACIÓN (CORREGIDO) ---
  useEffect(() => {
    let unsubscribe: () => void;

    const initAuth = async () => {
      try {
        // 1. Primero esperamos a ver si venimos de una redirección de Google
        // Esto evita que React se adelante y muestre la pantalla de Login
        await getRedirectResult(auth);
      } catch (error) {
        console.error("Error procesando redirección de Firebase:", error);
      }

      // 2. Una vez resuelta la redirección, encendemos el listener normal
      unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
        setIsAuthReady(true); // Solo aquí quitamos la pantalla de carga
      });
    };

    initAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // --- EFECTOS DE DATOS (FIRESTORE) ---
  useEffect(() => {
    if (!user) return;

    const qTx = query(collection(db, 'transactions'), where('ownerId', '==', user.uid));
    const unsubTx = onSnapshot(qTx, snap => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    });

    const qWk = query(collection(db, 'workers'), where('ownerId', '==', user.uid));
    const unsubWk = onSnapshot(qWk, snap => {
      setWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() } as Worker)));
    });

    const unsubSet = onSnapshot(doc(db, 'settings', user.uid), snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.funds) setFunds(data.funds);
        if (data.referenceRates) setReferenceRates(data.referenceRates);
        if (data.pairs) setPairs(data.pairs);
      } else {
        setDoc(doc(db, 'settings', user.uid), {
          funds: {},
          referenceRates: { 'CUP': 1, 'USD': 320, 'EUR': 330, 'MLC': 275 },
          pairs: INITIAL_CURRENCY_PAIRS
        });
      }
    });

    return () => { unsubTx(); unsubWk(); unsubSet(); };
  }, [user]);

  // --- FUNCIONES DE LÓGICA ---
  const updateSettings = async (newSettings: Partial<{ funds: Record<string, number>, referenceRates: Record<string, number>, pairs: CurrencyPair[] }>) => {
    if (!user) return;
    await setDoc(doc(db, 'settings', user.uid), newSettings, { merge: true });
  };

  const updateReferenceRate = (currency: string, value: number) => {
    const newRates = { ...referenceRates, [currency]: value };
    setReferenceRates(newRates);
    updateSettings({ referenceRates: newRates });
  };

  const addReferenceRate = (currency: string) => {
    if (!referenceRates[currency]) {
      const newRates = { ...referenceRates, [currency]: 0 };
      setReferenceRates(newRates);
      updateSettings({ referenceRates: newRates });
    }
  };

  const removeReferenceRate = (currency: string) => {
    const newRates = { ...referenceRates };
    delete newRates[currency];
    setReferenceRates(newRates);
    updateSettings({ referenceRates: newRates });
  };

  const getSuggestedRate = (from: Currency, to: Currency) => {
    const fromInCUP = referenceRates[from] || 0;
    const toInCUP = referenceRates[to] || 1;
    if (toInCUP === 0) return 0;
    return Number((fromInCUP / toInCUP).toFixed(4));
  };

  const addTransaction = async (t: Omit<Transaction, 'id' | 'date'>) => {
    if (!user) return;
    const newFunds = {
      ...funds,
      [t.currency]: (funds[t.currency] || 0) + t.amount,
      [t.targetCurrency]: (funds[t.targetCurrency] || 0) - t.totalCUP
    };
    
    const batch = writeBatch(db);
    const txRef = doc(collection(db, 'transactions'));
    batch.set(txRef, { ...t, date: new Date().toISOString(), ownerId: user.uid });
    batch.set(doc(db, 'settings', user.uid), { funds: newFunds }, { merge: true });
    await batch.commit();
    setShowTransactionModal(false);
  };

  const adjustFunds = async (currency: Currency, amount: number, type: 'ingreso' | 'egreso') => {
    const newFunds = {
      ...funds,
      [currency]: (funds[currency] || 0) + (type === 'ingreso' ? amount : -amount)
    };
    setFunds(newFunds);
    await updateSettings({ funds: newFunds });
    setShowFundModal(false);
  };

  const deleteTransaction = async (id: string) => {
    if (!user) return;
    const tx = transactions.find(t => t.id === id);
    if (tx) {
      const newFunds = {
        ...funds,
        [tx.currency]: (funds[tx.currency] || 0) - tx.amount,
        [tx.targetCurrency]: (funds[tx.targetCurrency] || 0) + tx.totalCUP
      };
      const batch = writeBatch(db);
      batch.delete(doc(db, 'transactions', id));
      batch.set(doc(db, 'settings', user.uid), { funds: newFunds }, { merge: true });
      await batch.commit();
    }
  };

  const resetToFactory = async () => {
    if (!user) return;
    const batch = writeBatch(db);
    transactions.forEach(tx => batch.delete(doc(db, 'transactions', tx.id)));
    workers.forEach(w => batch.delete(doc(db, 'workers', w.id)));
    batch.set(doc(db, 'settings', user.uid), {
      funds: {},
      referenceRates: { 'CUP': 1, 'USD': 320, 'EUR': 330, 'MLC': 275 },
      pairs: INITIAL_CURRENCY_PAIRS
    });
    await batch.commit();
    setShowResetConfirm(false);
  };

  const handleRestoreData = async (data: any) => {
    if (!user) return;
    const batch = writeBatch(db);
    if (data.transactions) {
      data.transactions.forEach((tx: any) => {
        batch.set(doc(db, 'transactions', tx.id), { ...tx, ownerId: user.uid });
      });
    }
    if (data.workers) {
      data.workers.forEach((w: any) => {
        batch.set(doc(db, 'workers', w.id), { ...w, ownerId: user.uid });
      });
    }
    const newSettings: any = {};
    if (data.funds) newSettings.funds = data.funds;
    if (data.referenceRates) newSettings.referenceRates = data.referenceRates;
    if (data.pairs) newSettings.pairs = data.pairs;
    if (Object.keys(newSettings).length > 0) {
      batch.set(doc(db, 'settings', user.uid), newSettings, { merge: true });
    }
    await batch.commit();
    alert("Datos restaurados correctamente");
  };

  const profits = useMemo(() => {
    let totalCUP = 0;
    transactions.forEach(tx => {
      const receivedValueCUP = tx.amount * (referenceRates[tx.currency] || 0);
      const deliveredValueCUP = tx.totalCUP * (referenceRates[tx.targetCurrency] || 0);
      totalCUP += (receivedValueCUP - deliveredValueCUP);
    });
    const totalUSD = totalCUP / (referenceRates['USD'] || 1);
    const totalEUR = totalCUP / (referenceRates['EUR'] || 1);
    return { cup: totalCUP, usd: totalUSD, eur: totalEUR };
  }, [transactions, referenceRates]);

  // --- RENDERIZADO DE CARGA Y LOGIN ---
  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><p className="text-gray-500 font-bold">Cargando...</p></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Banknote size={32} />
          </div>
          <h1 className="text-2xl font-black text-gray-900">RemesaControl</h1>
          <p className="text-gray-500">Inicia sesión para gestionar tus remesas y sincronizar tus datos en la nube.</p>
          <button 
            onClick={signInWithGoogle}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
          >
            Iniciar sesión con Google
          </button>
        </div>
      </div>
    );
  }

  // --- RENDERIZADO PRINCIPAL ---
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

      {/* Sidebar Desktop y Mobile Menu */}
      <aside className={`${isMobileMenuOpen ? 'fixed inset-0 top-16 z-40 bg-white' : 'hidden'} md:flex flex-col w-64 bg-white border-r border-gray-200 h-screen sticky top-0`}>
        <div className="p-6 border-b border-gray-100 hidden md:block">
          <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
            <Banknote className="text-blue-500" />
            RemesaControl
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<ArrowLeftRight size={20} />} label="Remesas" active={activeTab === 'transactions'} onClick={() => { setActiveTab('transactions'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<Wallet size={20} />} label="Mi Caja" active={activeTab === 'caja'} onClick={() => { setActiveTab('caja'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<Users size={20} />} label="Trabajadores" active={activeTab === 'workers'} onClick={() => { setActiveTab('workers'); setIsMobileMenuOpen(false); }} />
          <NavItem icon={<Settings size={20} />} label="Configuración" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} />
        </nav>
        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-4 px-2">
            <img src={user.photoURL || ""} alt="User" className="w-8 h-8 rounded-full" />
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{user.displayName}</p>
              <p className="text-xs text-gray-500 truncate">{user.email}</p>
            </div>
          </div>
          <button onClick={logOut} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-red-500 hover:bg-red-50 border border-red-100 text-sm font-bold">
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 capitalize">{activeTab}</h2>
            <p className="text-sm text-gray-500">Sistema 100% Manual</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowFundModal(true)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Wallet size={20} /> Ajustar Caja</button>
            <button onClick={() => setShowTransactionModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"><Plus size={20} /> Nueva Remesa</button>
          </div>
        </header>

        {activeTab === 'dashboard' && <DashboardView transactions={transactions} referenceRates={referenceRates} onUpdateRate={updateReferenceRate} onAddRate={addReferenceRate} onRemoveRate={removeReferenceRate} profits={profits} funds={funds} />}
        {activeTab === 'transactions' && <TransactionsView transactions={transactions} workers={workers} onDelete={deleteTransaction} />}
        {activeTab === 'caja' && <CajaView funds={funds} referenceRates={referenceRates} />}
        {activeTab === 'workers' && <WorkersView workers={workers} onAdd={async (n, a) => { if (user) await addDoc(collection(db, 'workers'), { name: n, accountInfo: a, ownerId: user.uid }); }} onDelete={async (id) => await deleteDoc(doc(db, 'workers', id))} />}
        {activeTab === 'settings' && <SettingsView pairs={pairs} onToggleFavorite={(id) => { const newPairs = pairs.map(p => p.id === id ? { ...p, isFavorite: !p.isFavorite } : p); setPairs(newPairs); updateSettings({ pairs: newPairs }); }} onAddPair={(b, t) => { const newPairs = [...pairs, { id: `${b}-${t}`, base: b, target: t, isFavorite: true }]; setPairs(newPairs); updateSettings({ pairs: newPairs }); }} onResetRequest={() => setShowResetConfirm(true)} onRestoreData={handleRestoreData} fullState={{ transactions, workers, pairs, funds, referenceRates }} />}
      </main>

      {showTransactionModal && <TransactionModal onClose={() => setShowTransactionModal(false)} onSubmit={addTransaction} workers={workers} getSuggestedRate={getSuggestedRate} />}
      {showFundModal && <FundAdjustmentModal onClose={() => setShowFundModal(false)} onSubmit={adjustFunds} />}
      {showResetConfirm && <ConfirmModal title="Restablecer Datos" message="¿Estás seguro? Se borrará todo." onConfirm={resetToFactory} onCancel={() => setShowResetConfirm(false)} />}
    </div>
  );
};

// --- SUBCOMPONENTES ---

const NavItem: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-blue-50 text-blue-600 font-bold' : 'text-gray-500 hover:bg-gray-50'}`}>
    {icon} <span>{label}</span>
  </button>
);

const DashboardView: React.FC<{ 
  transactions: Transaction[], referenceRates: Record<string, number>, onUpdateRate: (c: string, v: number) => void, onAddRate: (c: string) => void, onRemoveRate: (c: string) => void, profits: any, funds: any 
}> = ({ transactions, referenceRates, onUpdateRate, onAddRate, onRemoveRate, profits, funds }) => {
  const [newRateCurrency, setNewRateCurrency] = useState('');
  const activeRates = Object.keys(referenceRates).filter(c => c !== 'CUP');
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-emerald-600 p-6 rounded-3xl text-white">
          <p className="text-[10px] font-black uppercase">Margen CUP</p>
          <p className="text-3xl font-black">{Math.round(profits.cup).toLocaleString()}</p>
        </div>
        <div className="bg-blue-600 p-6 rounded-3xl text-white">
          <p className="text-[10px] font-black uppercase">Margen USD</p>
          <p className="text-3xl font-black">{profits.usd.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800 p-6 rounded-3xl text-white">
          <p className="text-[10px] font-black uppercase">Margen EUR</p>
          <p className="text-3xl font-black">{profits.eur.toFixed(2)}</p>
        </div>
      </div>
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-black text-gray-400 uppercase">Tasas de Referencia (CUP)</h3>
          <div className="flex gap-2">
            <select value={newRateCurrency} onChange={e => setNewRateCurrency(e.target.value)} className="text-sm border rounded-lg px-2">
              <option value="">Añadir...</option>
              {ALL_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={() => { onAddRate(newRateCurrency); setNewRateCurrency(''); }} className="bg-blue-600 text-white p-1 rounded-lg"><Plus size={16}/></button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {activeRates.map(curr => (
            <div key={curr} className="bg-white p-4 rounded-2xl border relative group">
              <button onClick={() => onRemoveRate(curr)} className="absolute top-1 right-1 text-gray-300 hover:text-red-500"><Trash2 size={12}/></button>
              <label className="text-[10px] font-bold text-gray-400">{curr}</label>
              <input type="number" value={referenceRates[curr]} onChange={e => onUpdateRate(curr, Number(e.target.value))} className="w-full font-black text-blue-600 outline-none" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const TransactionsView: React.FC<{ transactions: Transaction[], workers: Worker[], onDelete: (id: string) => void }> = ({ transactions, workers, onDelete }) => {
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Historial de Remesas", 14, 15);
    autoTable(doc, {
      startY: 20,
      head: [['Fecha', 'Cliente', 'Recibo', 'Entrega', 'Tasa']],
      body: transactions.map(tx => [new Date(tx.date).toLocaleDateString(), tx.clientName, `${tx.amount} ${tx.currency}`, `${tx.totalCUP} ${tx.targetCurrency}`, tx.rate]),
    });
    doc.save("remesas.pdf");
  };
  return (
    <div className="space-y-4">
      <button onClick={exportPDF} className="bg-indigo-600 text-white px-4 py-2 rounded-xl flex items-center gap-2"><FileText size={18}/> PDF</button>
      <div className="bg-white rounded-3xl border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b">
            <tr><th className="px-6 py-4">Cliente</th><th className="px-6 py-4">Recibo</th><th className="px-6 py-4">Entrega</th><th className="px-6 py-4">Tasa</th><th className="px-6 py-4"></th></tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id} className="border-b hover:bg-gray-50 group">
                <td className="px-6 py-4 font-bold">{tx.clientName}</td>
                <td className="px-6 py-4">{tx.amount} {tx.currency}</td>
                <td className="px-6 py-4 text-blue-600 font-bold">{tx.totalCUP} {tx.targetCurrency}</td>
                <td className="px-6 py-4 font-mono">1:{tx.rate}</td>
                <td className="px-6 py-4 text-right"><button onClick={() => onDelete(tx.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CajaView: React.FC<{ funds: Record<string, number>, referenceRates: Record<string, number> }> = ({ funds, referenceRates }) => {
  const activeCurrencies = ALL_CURRENCIES.filter(c => (funds[c] || 0) !== 0);
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {activeCurrencies.map(c => (
        <div key={c} className="bg-white p-6 rounded-2xl border shadow-sm">
          <p className="text-[10px] font-black text-gray-400 uppercase">{c}</p>
          <p className="text-2xl font-black">{(funds[c] || 0).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
};

const WorkersView: React.FC<{ workers: Worker[], onAdd: (n: string, a: string) => void, onDelete: (id: string) => void }> = ({ workers, onAdd, onDelete }) => {
  const [n, setN] = useState('');
  const [a, setA] = useState('');
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="bg-white p-6 rounded-3xl border space-y-4 h-fit">
        <h3 className="font-bold">Nuevo Trabajador</h3>
        <input placeholder="Nombre" value={n} onChange={e => setN(e.target.value)} className="w-full border p-2 rounded-xl" />
        <textarea placeholder="Datos" value={a} onChange={e => setA(e.target.value)} className="w-full border p-2 rounded-xl" />
        <button onClick={() => { onAdd(n, a); setN(''); setA(''); }} className="w-full bg-blue-600 text-white py-2 rounded-xl">Guardar</button>
      </div>
      <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {workers.map(w => (
          <div key={w.id} className="bg-white p-5 rounded-2xl border flex justify-between">
            <div><p className="font-bold">{w.name}</p><p className="text-xs text-gray-400">{w.accountInfo}</p></div>
            <button onClick={() => onDelete(w.id)} className="text-gray-200 hover:text-red-500"><Trash2 size={16}/></button>
          </div>
        ))}
      </div>
    </div>
  );
};

const SettingsView: React.FC<any> = ({ pairs, onToggleFavorite, onAddPair, onResetRequest, onRestoreData, fullState }) => {
  return (
    <div className="max-w-2xl bg-white p-8 rounded-3xl border space-y-8">
      <h3 className="font-bold">Backup de Datos</h3>
      <div className="flex gap-4">
        <button onClick={() => {
          const blob = new Blob([JSON.stringify(fullState)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = "backup.json"; a.click();
        }} className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl font-bold flex-1">Exportar JSON</button>
        <label className="bg-gray-50 text-gray-600 px-4 py-2 rounded-xl font-bold flex-1 text-center cursor-pointer">
          Importar JSON <input type="file" className="hidden" onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => onRestoreData(JSON.parse(ev.target?.result as string));
              reader.readAsText(file);
            }
          }} />
        </label>
      </div>
      <button onClick={onResetRequest} className="w-full bg-red-50 text-red-600 py-3 rounded-xl font-bold">BORRAR TODO</button>
    </div>
  );
};

const TransactionModal: React.FC<any> = ({ onClose, onSubmit, workers, getSuggestedRate }) => {
  const [clientName, setClientName] = useState('');
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState<Currency>('USD');
  const [to, setTo] = useState<Currency>('CUP');
  const [workerId, setWorkerId] = useState(workers[0]?.id || '');
  const [rate, setRate] = useState(0);

  useEffect(() => { setRate(getSuggestedRate(from, to)); }, [from, to]);
  const total = Number(amount) * rate;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="bg-white w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 bg-blue-600 text-white flex justify-between"><h3 className="text-xl font-bold">Nueva Remesa</h3><button onClick={onClose}><X/></button></div>
        <form className="p-6 space-y-4" onSubmit={e => { e.preventDefault(); onSubmit({ clientName, workerId, amount: Number(amount), currency: from, targetCurrency: to, rate, totalCUP: total }); }}>
          <input placeholder="Nombre Cliente" required value={clientName} onChange={e => setClientName(e.target.value)} className="w-full border p-3 rounded-xl" />
          <div className="grid grid-cols-2 gap-4">
            <input type="number" placeholder="Monto" value={amount} onChange={e => setAmount(e.target.value)} className="border p-3 rounded-xl font-bold" />
            <select value={from} onChange={e => setFrom(e.target.value as Currency)} className="border p-3 rounded-xl">
              {ALL_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <select value={workerId} onChange={e => setWorkerId(e.target.value)} className="w-full border p-3 rounded-xl">
            {workers.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <div className="bg-blue-50 p-4 rounded-xl flex justify-between items-center">
            <input type="number" step="0.01" value={rate} onChange={e => setRate(Number(e.target.value))} className="w-20 p-1 border rounded" />
            <p className="font-black text-blue-700 text-xl">{total.toLocaleString()} {to}</p>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold">REGISTRAR</button>
        </form>
      </div>
    </div>
  );
};

const FundAdjustmentModal: React.FC<any> = ({ onClose, onSubmit }) => {
  const [currency, setCurrency] = useState<Currency>('USD');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'ingreso' | 'egreso'>('ingreso');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[100]">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-4">
        <div className="flex gap-2"><button onClick={() => setType('ingreso')} className={`flex-1 p-2 rounded-xl ${type === 'ingreso' ? 'bg-emerald-600 text-white' : 'bg-gray-100'}`}>Ingreso</button><button onClick={() => setType('egreso')} className={`flex-1 p-2 rounded-xl ${type === 'egreso' ? 'bg-rose-600 text-white' : 'bg-gray-100'}`}>Egreso</button></div>
        <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className="w-full border p-3 rounded-xl">
          {ALL_CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="number" placeholder="Monto" value={amount} onChange={e => setAmount(e.target.value)} className="w-full border p-3 rounded-xl font-bold" />
        <button onClick={() => onSubmit(currency, Number(amount), type)} className="w-full bg-black text-white py-4 rounded-2xl font-bold">CONFIRMAR</button>
        <button onClick={onClose} className="w-full text-gray-400">Cancelar</button>
      </div>
    </div>
  );
};

const ConfirmModal: React.FC<any> = ({ title, message, onConfirm, onCancel }) => (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[200]">
    <div className="bg-white p-8 rounded-3xl max-w-sm w-full text-center">
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-gray-500 mb-6">{message}</p>
      <div className="flex gap-4"><button onClick={onCancel} className="flex-1 p-3 bg-gray-100 rounded-xl">No</button><button onClick={onConfirm} className="flex-1 p-3 bg-red-600 text-white rounded-xl">Sí</button></div>
    </div>
  </div>
);

export default App;