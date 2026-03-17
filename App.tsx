
import React, { useState, useEffect, useMemo } from 'react';
import { 
  onAuthStateChanged, 
  User, 
  getRedirectResult 
} from 'firebase/auth';
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
  FileText,
  LogOut
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Imports internos
import { auth, signInWithGoogle, logOut, db } from './firebase';
import { Transaction, Worker, CurrencyPair, Currency } from './types';
import { INITIAL_CURRENCY_PAIRS, ALL_CURRENCIES } from './constants';

const App: React.FC = () => {
  // --- ESTADOS DE AUTENTICACIÓN ---
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // --- ESTADOS DE LA APLICACIÓN ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'workers' | 'caja' | 'settings'>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [pairs, setPairs] = useState<CurrencyPair[]>(INITIAL_CURRENCY_PAIRS);
  const [funds, setFunds] = useState<Record<string, number>>({});
  const [referenceRates, setReferenceRates] = useState<Record<string, number>>({ 'CUP': 1, 'USD': 320, 'EUR': 330, 'MLC': 275 });

  // Modales y UI
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- EFECTO DE AUTENTICACIÓN (Optimizado para móvil) ---
  useEffect(() => {
    // Escuchar cambios de sesión
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });

    // Detectar si volvemos de un login por redirección (Crucial para móvil)
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) setUser(result.user);
      })
      .catch((error) => console.error("Error en redirección:", error));

    return () => unsubscribe();
  }, []);

  // --- EFECTO DE CARGA DE DATOS DESDE FIRESTORE ---
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

  // --- LÓGICA DE NEGOCIO ---
  const updateSettings = async (newSettings: Partial<{ funds: Record<string, number>, referenceRates: Record<string, number>, pairs: CurrencyPair[] }>) => {
    if (!user) return;
    await setDoc(doc(db, 'settings', user.uid), newSettings, { merge: true });
  };

  const updateReferenceRate = (currency: string, value: number) => {
    const newRates = { ...referenceRates, [currency]: value };
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

  const profits = useMemo(() => {
    let totalCUP = 0;
    transactions.forEach(tx => {
      const receivedValueCUP = tx.amount * (referenceRates[tx.currency] || 0);
      const deliveredValueCUP = tx.totalCUP * (referenceRates[tx.targetCurrency] || 0);
      totalCUP += (receivedValueCUP - deliveredValueCUP);
    });
    return {
      cup: totalCUP,
      usd: totalCUP / (referenceRates['USD'] || 1),
      eur: totalCUP / (referenceRates['EUR'] || 1)
    };
  }, [transactions, referenceRates]);

  // --- RENDERIZADO DE CARGA ---
  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-blue-600 font-black animate-pulse">Cargando Sistema...</p>
      </div>
    );
  }

  // --- PANTALLA DE LOGIN ---
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Banknote size={32} />
          </div>
          <h1 className="text-2xl font-black text-gray-900">RemesaControl</h1>
          <p className="text-gray-500">Gestiona tus remesas y sincroniza tus datos en la nube.</p>
          <button 
            onClick={signInWithGoogle}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            Iniciar sesión con Google
          </button>
        </div>
      </div>
    );
  }

  // --- PANTALLA PRINCIPAL ---
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50 text-gray-900">
      {/* Header Móvil */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 h-16 flex justify-between items-center sticky top-0 z-40">
        <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
          <Banknote className="text-blue-500" /> RemesaControl
        </h1>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-600 p-1">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Menú Lateral (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 h-screen sticky top-0">
        <div className="p-6 border-b border-gray-100">
           <h1 className="text-xl font-bold text-blue-600 flex items-center gap-2">
            <Banknote size={24} /> RemesaControl
          </h1>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
          <NavItem icon={<ArrowLeftRight size={20} />} label="Remesas" active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} />
          <NavItem icon={<Wallet size={20} />} label="Mi Caja" active={activeTab === 'caja'} onClick={() => setActiveTab('caja')} />
          <NavItem icon={<Users size={20} />} label="Trabajadores" active={activeTab === 'workers'} onClick={() => setActiveTab('workers')} />
          <NavItem icon={<Settings size={20} />} label="Configuración" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
        <div className="p-4 border-t border-gray-100">
          <button onClick={logOut} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-red-500 hover:bg-red-50 border border-red-100 text-sm font-bold transition-colors">
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <h2 className="text-2xl font-black text-gray-800 uppercase tracking-tight">
            {activeTab}
          </h2>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={() => setShowTransactionModal(true)} className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-100">
              <Plus size={20} /> Nueva Remesa
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <DashboardView 
            referenceRates={referenceRates} 
            onUpdateRate={updateReferenceRate} 
            profits={profits}
            funds={funds}
            transactionsCount={transactions.length}
          />
        )}

        {/* Renderiza aquí el resto de tus vistas (TransactionsView, etc.) llamándolas igual que antes */}
        <p className="text-xs text-gray-400 mt-20 text-center">RemesaControl Pro v1.0 - Sincronizado con Firebase</p>
      </main>

      {/* Modales */}
      {showTransactionModal && (
        <TransactionModal 
          workers={workers} 
          getSuggestedRate={getSuggestedRate} 
          onClose={() => setShowTransactionModal(false)} 
          onSubmit={addTransaction} 
        />
      )}
    </div>
  );
};

// --- COMPONENTES AUXILIARES ---

const NavItem: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-gray-500 hover:bg-gray-50'}`}>
    {icon}
    <span className="font-bold">{label}</span>
  </button>
);

const DashboardView: React.FC<{ 
  referenceRates: Record<string, number>, 
  onUpdateRate: (c: string, v: number) => void,
  profits: { cup: number, usd: number, eur: number },
  funds: Record<string, number>,
  transactionsCount: number
}> = ({ referenceRates, onUpdateRate, profits, funds, transactionsCount }) => (
  <div className="space-y-8">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-emerald-600 p-6 rounded-3xl text-white">
        <p className="text-[10px] font-black uppercase opacity-70">Ganancia CUP</p>
        <p className="text-2xl font-black">{Math.round(profits.cup).toLocaleString()}</p>
      </div>
      <div className="bg-blue-600 p-6 rounded-3xl text-white">
        <p className="text-[10px] font-black uppercase opacity-70">Ganancia USD</p>
        <p className="text-2xl font-black">{profits.usd.toFixed(2)}</p>
      </div>
      <div className="bg-gray-800 p-6 rounded-3xl text-white">
        <p className="text-[10px] font-black uppercase opacity-70">Operaciones</p>
        <p className="text-2xl font-black">{transactionsCount}</p>
      </div>
    </div>

    <div className="bg-white p-6 rounded-3xl border border-gray-100">
      <h3 className="text-sm font-black uppercase mb-4 text-gray-400">Tasas de Referencia</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(referenceRates).map(([curr, val]) => (
          curr !== 'CUP' && (
            <div key={curr} className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400">{curr} → CUP</label>
              <input 
                type="number" 
                value={val} 
                onChange={(e) => onUpdateRate(curr, Number(e.target.value))}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 font-black text-blue-600 outline-none"
              />
            </div>
          )
        ))}
      </div>
    </div>
  </div>
);

// --- MODAL DE TRANSACCIÓN (Simplificado para el ejemplo) ---
const TransactionModal: React.FC<{ 
  workers: Worker[], 
  getSuggestedRate: (f: Currency, t: Currency) => number,
  onClose: () => void,
  onSubmit: (t: any) => void 
}> = ({ workers, getSuggestedRate, onClose, onSubmit }) => {
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState<Currency>('USD');
  const [to, setTo] = useState<Currency>('CUP');
  const [client, setClient] = useState('');
  const [rate, setRate] = useState(0);

  useEffect(() => {
    setRate(getSuggestedRate(from, to));
  }, [from, to, getSuggestedRate]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-3xl p-6 space-y-4">
        <h2 className="text-xl font-black">Nueva Remesa</h2>
        <input placeholder="Cliente" className="w-full p-3 bg-gray-50 rounded-xl outline-none" onChange={e => setClient(e.target.value)} />
        <div className="flex gap-2">
          <input type="number" placeholder="Monto" className="flex-1 p-3 bg-gray-50 rounded-xl outline-none" onChange={e => setAmount(e.target.value)} />
          <select className="p-3 bg-gray-50 rounded-xl font-bold" onChange={e => setFrom(e.target.value as Currency)}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl">
          <p className="text-xs font-bold text-blue-400">Total en {to}:</p>
          <p className="text-2xl font-black text-blue-600">{(Number(amount) * rate).toLocaleString()}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 font-bold text-gray-400">Cancelar</button>
          <button 
            onClick={() => onSubmit({ clientName: client, amount: Number(amount), currency: from, targetCurrency: to, rate, totalCUP: Number(amount) * rate, workerId: workers[0]?.id || '1', ownerId: '1' })}
            className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;