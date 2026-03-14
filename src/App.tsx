/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  collection, query, where, onSnapshot, addDoc, deleteDoc, doc, setDoc, getDoc,
  OperationType, handleFirestoreError, User
} from './firebase';
import { 
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, 
  parseISO, addMonths, subMonths, getDay, isToday
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Users, Calendar, Plus, LogOut, ChevronLeft, ChevronRight, 
  CheckCircle2, Clock, XCircle, Trash2, UserPlus, BarChart3,
  Menu, X, LogIn, Pencil, FileText, Settings, Download, Upload, Save,
  Sun, Moon, AlertTriangle, Lock, ShieldCheck, Fingerprint, CreditCard, Banknote,
  LayoutDashboard, UserCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Ocorreu um erro inesperado.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = `Erro de Permissão: ${parsed.error}`;
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-600">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Ops! Algo deu errado</h2>
            <p className="text-slate-500 text-sm">{errorMessage}</p>
            <Button onClick={() => window.location.reload()} className="w-full">
              Recarregar Aplicativo
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Components ---

const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 50, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, scale: 0.9 }}
    className={cn(
      "fixed bottom-6 right-6 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border",
      type === 'success' ? "bg-emerald-500 text-white border-emerald-400" : "bg-rose-500 text-white border-rose-400"
    )}
  >
    {type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
    <span className="text-sm font-bold tracking-tight">{message}</span>
    <button onClick={onClose} className="ml-2 hover:opacity-70 transition-opacity">
      <X size={16} />
    </button>
  </motion.div>
);

const Sidebar = ({ 
  activeView, 
  setActiveView, 
  user, 
  onLogout, 
  onOpenSettings 
}: { 
  activeView: string; 
  setActiveView: (view: any) => void; 
  user: User; 
  onLogout: () => void;
  onOpenSettings: () => void;
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'team', label: 'Equipe', icon: Users },
    { id: 'calendar', label: 'Calendário', icon: Calendar },
  ];

  return (
    <div className="w-64 h-full flex flex-col glass border-r border-[var(--color-line)]">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-slate-900 dark:bg-slate-100 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-900/10 dark:shadow-none">
          <Calendar className="text-white dark:text-slate-900 w-5 h-5" />
        </div>
        <span className="font-bold text-slate-900 dark:text-slate-100 text-xl tracking-tight">PontoFácil</span>
      </div>

      <nav className="flex-1 px-4 py-6 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={cn(
              "sidebar-item w-full",
              activeView === item.id 
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-md" 
                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <item.icon size={20} />
            <span className="font-bold tracking-tight">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-[var(--color-line)] space-y-2">
        <button 
          onClick={onOpenSettings}
          className="sidebar-item w-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Settings size={20} />
          <span className="font-bold tracking-tight">Configurações</span>
        </button>
        <button 
          onClick={onLogout}
          className="sidebar-item w-full text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
        >
          <LogOut size={20} />
          <span className="font-bold tracking-tight">Sair</span>
        </button>
      </div>
    </div>
  );
};

// --- Types ---

interface Employee {
  id: string;
  name: string;
  role: string;
  dailyRate?: number;
  pixKey?: string;
  bankName?: string;
  bankAgency?: string;
  bankAccount?: string;
  ownerId: string;
  createdAt: any;
}

interface UserConfig {
  pin?: string;
  ownerId: string;
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  type: 'D' | 'M' | 'F'; // D: Diária, M: Meia, F: Falta
  monthYear: string; // YYYY-MM
  ownerId: string;
}

// --- Components ---

const LockScreen = ({ onUnlock, userPin }: { onUnlock: () => void; userPin: string }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleKeyPress = (num: string) => {
    if (pin.length < 6) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === userPin.length) {
        if (newPin === userPin) {
          onUnlock();
        } else {
          setError(true);
          setTimeout(() => {
            setPin('');
            setError(false);
          }, 500);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-xs space-y-8 text-center">
        <div className="space-y-2">
          <div className="mx-auto w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center text-slate-100 shadow-xl border border-slate-700">
            <Lock size={32} className={cn(error && "text-rose-500 animate-shake")} />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Bloqueio Digital</h2>
          <p className="text-slate-300 text-sm">Insira seu PIN para acessar</p>
        </div>

        <div className="flex justify-center gap-4">
          {Array.from({ length: userPin.length }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-4 h-4 rounded-full border-2 transition-all duration-200",
                pin.length > i ? "bg-white border-white scale-110" : "border-slate-700",
                error && "border-rose-500 bg-rose-500"
              )}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
            <button
              key={num}
              onClick={() => handleKeyPress(num.toString())}
              className="w-16 h-16 mx-auto rounded-full bg-slate-800 text-white text-2xl font-bold hover:bg-slate-700 active:scale-90 transition-all border border-slate-700/50"
            >
              {num}
            </button>
          ))}
          <div />
          <button
            onClick={() => handleKeyPress('0')}
            className="w-16 h-16 mx-auto rounded-full bg-slate-800 text-white text-2xl font-bold hover:bg-slate-700 active:scale-90 transition-all border border-slate-700/50"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="w-16 h-16 mx-auto rounded-full flex items-center justify-center text-slate-400 hover:text-white active:scale-90 transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <div className="pt-4">
          <button 
            onClick={() => signOut(auth)}
            className="text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors"
          >
            Sair da Conta
          </button>
        </div>
      </div>
    </div>
  );
};

const AttendanceModal = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  date, 
  currentType 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSelect: (type: 'D' | 'M' | 'F' | null) => void; 
  date: Date;
  currentType: 'D' | 'M' | 'F' | null;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-200">
        <div className="p-6 text-center space-y-1 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {format(date, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-300 uppercase tracking-widest font-bold">Selecionar Status</p>
        </div>
        
        <div className="p-4 grid gap-3">
          <button
            onClick={() => onSelect('D')}
            className={cn(
              "flex items-center justify-between p-4 rounded-2xl border-2 transition-all group",
              currentType === 'D' 
                ? "bg-emerald-50 border-emerald-500 dark:bg-emerald-900/20" 
                : "bg-white dark:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <CheckCircle2 size={20} />
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-900 dark:text-slate-100">Diária</p>
                <p className="text-xs text-slate-500 dark:text-slate-300">Dia completo trabalhado</p>
              </div>
            </div>
            {currentType === 'D' && <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center text-white"><CheckCircle2 size={14} /></div>}
          </button>

          <button
            onClick={() => onSelect('M')}
            className={cn(
              "flex items-center justify-between p-4 rounded-2xl border-2 transition-all group",
              currentType === 'M' 
                ? "bg-orange-50 border-orange-500 dark:bg-orange-900/20" 
                : "bg-white dark:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-lg shadow-orange-500/20">
                <Clock size={20} />
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-900 dark:text-slate-100">Meia Diária</p>
                <p className="text-xs text-slate-500 dark:text-slate-300">Meio período trabalhado</p>
              </div>
            </div>
            {currentType === 'M' && <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white"><CheckCircle2 size={14} /></div>}
          </button>

          <button
            onClick={() => onSelect('F')}
            className={cn(
              "flex items-center justify-between p-4 rounded-2xl border-2 transition-all group",
              currentType === 'F' 
                ? "bg-rose-50 border-rose-500 dark:bg-rose-900/20" 
                : "bg-white dark:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            )}
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
                <XCircle size={20} />
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-900 dark:text-slate-100">Falta</p>
                <p className="text-xs text-slate-500 dark:text-slate-300">Ausência no trabalho</p>
              </div>
            </div>
            {currentType === 'F' && <div className="w-6 h-6 rounded-full bg-rose-500 flex items-center justify-center text-white"><CheckCircle2 size={14} /></div>}
          </button>

          <button
            onClick={() => onSelect(null)}
            className="flex items-center justify-center p-3 text-sm font-bold text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            Limpar Registro
          </button>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/50">
          <Button onClick={onClose} variant="secondary" className="w-full py-4 rounded-2xl">
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
};

const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }>(
  ({ className, variant = 'primary', ...props }, ref) => {
    const variants = {
      primary: 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-white shadow-sm',
      secondary: 'bg-[var(--color-card)] text-[var(--color-ink)] border border-[var(--color-line)] hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm',
      danger: 'bg-[var(--color-card)] text-rose-600 border border-rose-100 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-900/20 shadow-sm',
      ghost: 'bg-transparent text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800',
    };
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-all focus:outline-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

const Card = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('pro-card overflow-hidden', className)}>
    {children}
  </div>
);

// --- Main App ---

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isAddEmployeeOpen, setIsAddEmployeeOpen] = useState(false);
  const [isEditEmployeeOpen, setIsEditEmployeeOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'ponto' | 'resumo'>('ponto');
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  // PIN Lock State
  const [userConfig, setUserConfig] = useState<UserConfig | null>(null);
  const [isLocked, setIsLocked] = useState(true);
  const [newPin, setNewPin] = useState('');
  const [isSettingPin, setIsSettingPin] = useState(false);

  // Attendance Modal State
  const [attendanceModal, setAttendanceModal] = useState<{
    isOpen: boolean;
    date: Date | null;
    employeeId: string | null;
    currentType: 'D' | 'M' | 'F' | null;
  }>({
    isOpen: false,
    date: null,
    employeeId: null,
    currentType: null
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRole, setNewEmployeeRole] = useState('');
  const [newEmployeeDailyRate, setNewEmployeeDailyRate] = useState('');
  const [newEmployeePix, setNewEmployeePix] = useState('');
  const [newEmployeeBankName, setNewEmployeeBankName] = useState('');
  const [newEmployeeBankAgency, setNewEmployeeBankAgency] = useState('');
  const [newEmployeeBankAccount, setNewEmployeeBankAccount] = useState('');

  const [editEmployeeName, setEditEmployeeName] = useState('');
  const [editEmployeeRole, setEditEmployeeRole] = useState('');
  const [editEmployeeDailyRate, setEditEmployeeDailyRate] = useState('');
  const [editEmployeePix, setEditEmployeePix] = useState('');
  const [editEmployeeBankName, setEditEmployeeBankName] = useState('');
  const [editEmployeeBankAgency, setEditEmployeeBankAgency] = useState('');
  const [editEmployeeBankAccount, setEditEmployeeBankAccount] = useState('');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) {
        setLoading(false);
        setIsLocked(true);
      }
    });
    return unsubscribe;
  }, []);

  // User Config Listener
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'userConfigs', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        const config = snapshot.data() as UserConfig;
        setUserConfig(config);
        if (!config.pin) setIsLocked(false);
      } else {
        setUserConfig({ ownerId: user.uid });
        setIsLocked(false);
      }
      setLoading(false);
    }, (err) => {
      console.error("Error loading user config", err);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  // Data Listeners
  useEffect(() => {
    if (!user || isLocked) return;

    const employeesQuery = query(collection(db, 'employees'), where('ownerId', '==', user.uid));
    const unsubscribeEmployees = onSnapshot(employeesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
      setEmployees(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'employees'));

    const monthStr = format(currentMonth, 'yyyy-MM');
    const attendanceQuery = query(
      collection(db, 'attendance'), 
      where('ownerId', '==', user.uid),
      where('monthYear', '==', monthStr)
    );
    const unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
      setAttendance(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'attendance'));

    return () => {
      unsubscribeEmployees();
      unsubscribeAttendance();
    };
  }, [user, currentMonth]);

  // --- Handlers ---

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Login error', err);
    }
  };

  const handleLogout = () => signOut(auth);

  const addEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newEmployeeName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const rate = parseFloat(newEmployeeDailyRate.toString().replace(',', '.'));
      const dailyRate = isNaN(rate) ? 0 : rate;

      await addDoc(collection(db, 'employees'), {
        name: newEmployeeName.trim(),
        role: newEmployeeRole.trim(),
        dailyRate,
        pixKey: newEmployeePix.trim(),
        bankName: newEmployeeBankName.trim(),
        bankAgency: newEmployeeBankAgency.trim(),
        bankAccount: newEmployeeBankAccount.trim(),
        ownerId: user.uid,
        createdAt: new Date().toISOString()
      });
      showToast('Funcionário cadastrado com sucesso!');
      setNewEmployeeName('');
      setNewEmployeeRole('');
      setNewEmployeeDailyRate('');
      setNewEmployeePix('');
      setNewEmployeeBankName('');
      setNewEmployeeBankAgency('');
      setNewEmployeeBankAccount('');
      setIsAddEmployeeOpen(false);
    } catch (err) {
      showToast('Erro ao cadastrar funcionário', 'error');
      handleFirestoreError(err, OperationType.CREATE, 'employees');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = () => {
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;
    setEditEmployeeName(emp.name);
    setEditEmployeeRole(emp.role || '');
    setEditEmployeeDailyRate(emp.dailyRate?.toString() || '');
    setEditEmployeePix(emp.pixKey || '');
    setEditEmployeeBankName(emp.bankName || '');
    setEditEmployeeBankAgency(emp.bankAgency || '');
    setEditEmployeeBankAccount(emp.bankAccount || '');
    setIsEditEmployeeOpen(true);
  };

  const updateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedEmployeeId || !editEmployeeName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const rate = parseFloat(editEmployeeDailyRate.toString().replace(',', '.'));
      const dailyRate = isNaN(rate) ? 0 : rate;

      await setDoc(doc(db, 'employees', selectedEmployeeId), {
        name: editEmployeeName.trim(),
        role: editEmployeeRole.trim(),
        dailyRate,
        pixKey: editEmployeePix.trim(),
        bankName: editEmployeeBankName.trim(),
        bankAgency: editEmployeeBankAgency.trim(),
        bankAccount: editEmployeeBankAccount.trim(),
        ownerId: user.uid,
        createdAt: employees.find(e => e.id === selectedEmployeeId)?.createdAt || new Date().toISOString()
      }, { merge: true });
      showToast('Dados atualizados com sucesso!');
      setIsEditEmployeeOpen(false);
    } catch (err) {
      showToast('Erro ao atualizar dados', 'error');
      handleFirestoreError(err, OperationType.UPDATE, 'employees');
    } finally {
      setIsSubmitting(false);
    }
  };

  const savePin = async () => {
    if (!user || !newPin.match(/^\d{4,6}$/)) {
      alert("O PIN deve ter entre 4 e 6 dígitos numéricos.");
      return;
    }
    try {
      await setDoc(doc(db, 'userConfigs', user.uid), {
        pin: newPin,
        ownerId: user.uid
      }, { merge: true });
      setNewPin('');
      setIsSettingPin(false);
      alert("PIN salvo com sucesso!");
    } catch (err) {
      console.error("Error saving PIN", err);
      alert("Erro ao salvar PIN.");
    }
  };

  const removePin = async () => {
    if (!user) return;
    if (!window.confirm("Tem certeza que deseja remover o bloqueio por PIN?")) return;
    try {
      await setDoc(doc(db, 'userConfigs', user.uid), {
        pin: null,
        ownerId: user.uid
      }, { merge: true });
      alert("PIN removido com sucesso!");
    } catch (err) {
      console.error("Error removing PIN", err);
    }
  };

  const deleteEmployee = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este funcionário?')) return;
    try {
      await deleteDoc(doc(db, 'employees', id));
      if (selectedEmployeeId === id) setSelectedEmployeeId(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'employees');
    }
  };

  const generatePDF = () => {
    const emp = employees.find(e => e.id === selectedEmployeeId);
    if (!emp) return;

    const summary = getSummary(emp.id);
    const rate = emp.dailyRate || 0;
    const totalFinanceiro = (summary.diarias * rate) + (summary.meias * (rate / 2));
    const monthName = format(currentMonth, 'MMMM yyyy', { locale: ptBR });

    const docPdf = new jsPDF();

    // Header
    docPdf.setFontSize(20);
    docPdf.setTextColor(79, 70, 229); // Indigo-600
    docPdf.text('Relatório de Ponto Mensal', 105, 20, { align: 'center' });
    
    docPdf.setFontSize(12);
    docPdf.setTextColor(100, 116, 139); // Slate-500
    docPdf.text(monthName.charAt(0).toUpperCase() + monthName.slice(1), 105, 28, { align: 'center' });

    // Employee Info
    docPdf.setFontSize(14);
    docPdf.setTextColor(15, 23, 42); // Slate-900
    docPdf.text(`Funcionário: ${emp.name}`, 20, 45);
    docPdf.setFontSize(11);
    docPdf.text(`Cargo: ${emp.role || 'Não informado'}`, 20, 52);
    docPdf.text(`Valor da Diária: R$ ${rate.toFixed(2)}`, 20, 59);

    // Summary Box
    docPdf.setDrawColor(226, 232, 240); // Slate-200
    docPdf.setFillColor(248, 250, 252); // Slate-50
    docPdf.roundedRect(20, 65, 170, 25, 3, 3, 'FD');
    
    docPdf.setFontSize(10);
    docPdf.setTextColor(100, 116, 139);
    docPdf.text('RESUMO DO MÊS', 25, 72);
    
    docPdf.setFontSize(12);
    docPdf.setTextColor(15, 23, 42);
    docPdf.text(`Diárias (D): ${summary.diarias}`, 25, 82);
    docPdf.text(`Meias (M): ${summary.meias}`, 75, 82);
    docPdf.text(`Faltas (F): ${summary.faltas}`, 125, 82);

    // Financial Total
    docPdf.setFontSize(14);
    docPdf.setTextColor(79, 70, 229);
    docPdf.text(`TOTAL A PAGAR: R$ ${totalFinanceiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, 105, { align: 'right' });

    // Attendance Table
    const tableData = daysInMonth.map(day => {
      const type = getAttendanceForDay(emp.id, day);
      let typeText = '-';
      let valueText = '-';
      
      if (type === 'D') {
        typeText = 'Diária Completa';
        valueText = `R$ ${rate.toFixed(2)}`;
      } else if (type === 'M') {
        typeText = 'Meia Diária';
        valueText = `R$ ${(rate / 2).toFixed(2)}`;
      } else if (type === 'F') {
        typeText = 'Falta';
        valueText = 'R$ 0,00';
      }

      return [
        format(day, 'dd/MM/yyyy (EEE)', { locale: ptBR }),
        typeText,
        valueText
      ];
    }).filter(row => row[1] !== '-');

    autoTable(docPdf, {
      startY: 115,
      head: [['Data', 'Tipo', 'Valor']],
      body: tableData,
      headStyles: { fillColor: [79, 70, 229] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 20, right: 20 }
    });

    // Footer
    const finalY = (docPdf as any).lastAutoTable.finalY || 150;
    docPdf.setFontSize(10);
    docPdf.setTextColor(148, 163, 184);
    docPdf.text('Assinatura do Funcionário: __________________________________________', 20, finalY + 30);
    docPdf.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 20, finalY + 45);

    docPdf.save(`Relatorio_Ponto_${emp.name.replace(/\s+/g, '_')}_${format(currentMonth, 'MM_yyyy')}.pdf`);
  };

  const exportData = () => {
    const data = {
      employees,
      attendance,
      exportDate: new Date().toISOString(),
      version: '1.0'
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_ponto_${format(new Date(), 'dd_MM_yyyy')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (!data.employees || !Array.isArray(data.employees)) {
          throw new Error('Formato de arquivo inválido');
        }

        if (!window.confirm('Isso irá substituir os dados atuais pelos dados do backup. Continuar?')) return;

        // Import Employees
        for (const emp of data.employees) {
          const { id, ...empData } = emp;
          await setDoc(doc(db, 'employees', id), {
            ...empData,
            ownerId: user.uid
          }, { merge: true });
        }

        // Import Attendance
        if (data.attendance) {
          for (const record of data.attendance) {
            const recordId = `${record.employeeId}_${record.date}`;
            await setDoc(doc(db, 'attendance', recordId), {
              ...record,
              ownerId: user.uid
            }, { merge: true });
          }
        }

        alert('Dados importados com sucesso!');
        setIsSettingsOpen(false);
      } catch (err) {
        console.error('Erro ao importar:', err);
        alert('Erro ao importar arquivo. Verifique se o formato está correto.');
      }
    };
    reader.readAsText(file);
  };

  const toggleAttendance = (employeeId: string, date: Date, currentType: 'D' | 'M' | 'F' | null) => {
    setAttendanceModal({
      isOpen: true,
      date,
      employeeId,
      currentType
    });
  };

  const handleAttendanceSelect = async (type: 'D' | 'M' | 'F' | null) => {
    if (!user || !attendanceModal.employeeId || !attendanceModal.date) return;
    
    const dateStr = format(attendanceModal.date, 'yyyy-MM-dd');
    const monthYear = format(attendanceModal.date, 'yyyy-MM');
    const recordId = `${attendanceModal.employeeId}_${dateStr}`;

    try {
      if (type === null) {
        await deleteDoc(doc(db, 'attendance', recordId));
      } else {
        await setDoc(doc(db, 'attendance', recordId), {
          employeeId: attendanceModal.employeeId,
          date: dateStr,
          type: type,
          monthYear,
          ownerId: user.uid
        });
      }
      setAttendanceModal(prev => ({ ...prev, isOpen: false }));
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'attendance');
    }
  };

  // --- Helpers ---

  const daysInMonth = useMemo(() => {
    return eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth)
    });
  }, [currentMonth]);

  const getAttendanceForDay = (employeeId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return attendance.find(a => a.employeeId === employeeId && a.date === dateStr)?.type || null;
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState<'dashboard' | 'team' | 'calendar'>('dashboard');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const getSummary = (employeeId: string) => {
    const records = attendance.filter(a => a.employeeId === employeeId);
    return {
      diarias: records.filter(r => r.type === 'D').length,
      meias: records.filter(r => r.type === 'M').length,
      faltas: records.filter(r => r.type === 'F').length,
      total: records.filter(r => r.type === 'D').length + (records.filter(r => r.type === 'M').length * 0.5)
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-slate-100"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--color-bg)] flex flex-col items-center justify-center p-4 transition-colors duration-300">
        <div className="w-full max-w-md text-center space-y-8">
          <div className="space-y-2">
            <div className="mx-auto w-16 h-16 bg-slate-900 dark:bg-slate-100 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200 dark:shadow-none">
              <Calendar className="text-white dark:text-slate-900 w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">PontoFácil</h1>
            <p className="text-slate-500 dark:text-slate-300">Controle de ponto simples e eficiente para sua equipe.</p>
          </div>
          
          <Card className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="flex items-start gap-4 text-left">
                <div className="mt-1 bg-slate-50 dark:bg-slate-900 p-2 rounded-lg text-slate-900 dark:text-slate-100">
                  <Users size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">Gestão de Equipe</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-300">Cadastre funcionários e acompanhe o desempenho individual.</p>
                </div>
              </div>
              <div className="flex items-start gap-4 text-left">
                <div className="mt-1 bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100">Resumos Mensais</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-300">Cálculo automático de diárias e faltas por mês.</p>
                </div>
              </div>
            </div>
            
            <Button onClick={handleLogin} className="w-full py-6 text-lg gap-2">
              <LogIn size={20} />
              Entrar com Google
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  if (isLocked && userConfig?.pin) {
    return <LockScreen userPin={userConfig.pin} onUnlock={() => setIsLocked(false)} />;
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] flex overflow-hidden">
      <AnimatePresence>
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        )}
      </AnimatePresence>

      <AttendanceModal 
        isOpen={attendanceModal.isOpen}
        onClose={() => setAttendanceModal(prev => ({ ...prev, isOpen: false }))}
        onSelect={handleAttendanceSelect}
        date={attendanceModal.date || new Date()}
        currentType={attendanceModal.currentType}
      />

      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Sidebar 
          activeView={activeView} 
          setActiveView={setActiveView} 
          user={user} 
          onLogout={handleLogout}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.div 
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 lg:hidden"
            >
              <Sidebar 
                activeView={activeView} 
                setActiveView={(v) => { setActiveView(v); setIsSidebarOpen(false); }} 
                user={user} 
                onLogout={handleLogout}
                onOpenSettings={() => setIsSettingsOpen(true)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 glass border-b border-[var(--color-line)] flex items-center justify-between px-6 shrink-0 z-30">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">
              {activeView === 'dashboard' && 'Dashboard'}
              {activeView === 'team' && 'Gestão de Equipe'}
              {activeView === 'calendar' && 'Folha de Ponto'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-full border border-[var(--color-line)] bg-white/50 dark:bg-slate-900/50">
              <div className="w-6 h-6 rounded-full overflow-hidden border border-[var(--color-line)]">
                <img src={user.photoURL || ''} alt="" className="w-full h-full object-cover" />
              </div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{user.displayName?.split(' ')[0]}</span>
            </div>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
            >
              <Settings size={20} />
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="max-w-6xl mx-auto space-y-8"
          >
            {activeView === 'dashboard' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card className="p-6 flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                      <Users size={28} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Equipe Total</p>
                      <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">{employees.length}</h3>
                    </div>
                  </Card>
                  <Card className="p-6 flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={28} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Presenças Mês</p>
                      <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                        {attendance.filter(a => a.type === 'D' && a.monthYear === format(currentMonth, 'yyyy-MM')).length}
                      </h3>
                    </div>
                  </Card>
                  <Card className="p-6 flex items-center gap-5">
                    <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <BarChart3 size={28} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Total Financeiro</p>
                      <h3 className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                        R$ {employees.reduce((acc, emp) => {
                          const s = getSummary(emp.id);
                          const rate = emp.dailyRate || 0;
                          return acc + (s.diarias * rate) + (s.meias * (rate / 2));
                        }, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </h3>
                    </div>
                  </Card>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Button variant="secondary" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 h-10 w-10">
                      <ChevronLeft size={20} />
                    </Button>
                    <div className="text-center min-w-[140px]">
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 capitalize tracking-tight">
                        {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                      </h2>
                    </div>
                    <Button variant="secondary" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 h-10 w-10">
                      <ChevronRight size={20} />
                    </Button>
                  </div>
                </div>

                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-[var(--color-line)]">
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Funcionário</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Diárias</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-center">Meias</th>
                          <th className="px-6 py-4 text-[10px] font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-line)]">
                        {employees.map(emp => {
                          const summary = getSummary(emp.id);
                          const rate = emp.dailyRate || 0;
                          const total = (summary.diarias * rate) + (summary.meias * (rate / 2));
                          return (
                            <tr key={emp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                              <td className="px-6 py-5">
                                <div className="text-sm font-bold text-slate-900 dark:text-slate-100">{emp.name}</div>
                                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">R$ {rate.toFixed(2)} / dia</div>
                              </td>
                              <td className="px-6 py-5 text-center">
                                <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400">
                                  {summary.diarias}
                                </span>
                              </td>
                              <td className="px-6 py-5 text-center">
                                <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400">
                                  {summary.meias}
                                </span>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                                  R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}

            {activeView === 'team' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Equipe</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Gerencie os funcionários da sua empresa.</p>
                  </div>
                  <Button onClick={() => setIsAddEmployeeOpen(true)} className="gap-2">
                    <Plus size={18} />
                    Novo Funcionário
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {employees.map(emp => (
                    <Card key={emp.id} className="p-6 space-y-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start">
                        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                          <UserCircle size={24} />
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            onClick={() => {
                              setSelectedEmployeeId(emp.id);
                              openEditModal();
                            }} 
                            className="p-2 h-8 w-8 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            onClick={() => deleteEmployee(emp.id)} 
                            className="p-2 h-8 w-8 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-slate-100">{emp.name}</h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold mt-0.5">{emp.role || 'Sem cargo'}</p>
                      </div>
                      <div className="pt-4 border-t border-[var(--color-line)] flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Diária</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">R$ {emp.dailyRate?.toFixed(2) || '0.00'}</p>
                        </div>
                        <Button 
                          variant="secondary" 
                          onClick={() => {
                            setSelectedEmployeeId(emp.id);
                            setActiveView('calendar');
                          }}
                          className="h-8 text-[10px] uppercase tracking-widest font-bold"
                        >
                          Ver Ponto
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeView === 'calendar' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <select 
                      value={selectedEmployeeId || ''} 
                      onChange={(e) => setSelectedEmployeeId(e.target.value)}
                      className="pro-input min-w-[240px]"
                    >
                      <option value="">Selecionar Funcionário</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                    <div className="flex items-center gap-3">
                      <Button variant="secondary" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 h-9 w-9">
                        <ChevronLeft size={18} />
                      </Button>
                      <span className="text-sm font-bold text-slate-900 dark:text-slate-100 capitalize min-w-[120px] text-center">
                        {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
                      </span>
                      <Button variant="secondary" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 h-9 w-9">
                        <ChevronRight size={18} />
                      </Button>
                    </div>
                  </div>
                  {selectedEmployeeId && (
                    <Button variant="secondary" onClick={generatePDF} className="gap-2 h-10">
                      <FileText size={18} />
                      Gerar PDF
                    </Button>
                  )}
                </div>

                {selectedEmployeeId ? (
                  <Card className="p-1 shadow-sm overflow-hidden">
                    <div className="grid grid-cols-7 gap-px bg-[var(--color-line)]">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                        <div key={day} className="bg-slate-50 dark:bg-slate-900/50 py-3 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                          {day}
                        </div>
                      ))}
                      
                      {Array.from({ length: getDay(daysInMonth[0]) }).map((_, i) => (
                        <div key={`empty-${i}`} className="bg-[var(--color-card)] h-24 sm:h-32 opacity-40" />
                      ))}

                      {daysInMonth.map(day => {
                        const attendanceType = getAttendanceForDay(selectedEmployeeId, day);
                        return (
                          <button
                            key={day.toISOString()}
                            onClick={() => toggleAttendance(selectedEmployeeId, day, attendanceType)}
                            className={cn(
                              "bg-[var(--color-card)] h-24 sm:h-32 p-3 flex flex-col items-center justify-between transition-all hover:bg-slate-50 dark:hover:bg-slate-800/50 relative group",
                              isToday(day) && "ring-2 ring-inset ring-slate-900 dark:ring-slate-100 z-10"
                            )}
                          >
                            <span className={cn(
                              "text-xs font-bold",
                              isToday(day) ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"
                            )}>
                              {format(day, 'd')}
                            </span>
                            
                            <div className="flex flex-col items-center gap-1.5">
                              {attendanceType === 'D' && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />}
                              {attendanceType === 'M' && <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />}
                              {attendanceType === 'F' && <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm" />}
                              
                              <span className="text-[8px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                                {attendanceType === 'D' && 'Diária'}
                                {attendanceType === 'M' && 'Meia'}
                                {attendanceType === 'F' && 'Falta'}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                ) : (
                  <div className="h-96 flex flex-col items-center justify-center p-12 text-center space-y-4 bg-white dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-300 dark:text-slate-600">
                      <Calendar size={32} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Selecione um funcionário</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Escolha alguém na lista acima para gerenciar o ponto.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </main>
      </div>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 dark:bg-black/40 backdrop-blur-[2px]">
          <Card className="w-full max-w-md p-6 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                onClick={() => setIsSettingsOpen(false)} 
                className="p-1.5 h-8 w-8 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 -ml-2"
              >
                <ChevronLeft size={20} />
              </Button>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">Configurações</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-medium">Gerenciamento da Conta</p>
              </div>
            </div>
            
            <div className="space-y-6">
            <div className="p-4 bg-[var(--color-bg)] rounded-lg border border-[var(--color-line)]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-md bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900">
                      {darkMode ? <Moon size={16} /> : <Sun size={16} />}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Aparência</h4>
                      <p className="text-[10px] text-slate-400">Alternar entre modo claro e escuro.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                      darkMode ? "bg-slate-700" : "bg-slate-200"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        darkMode ? "translate-x-6" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              </div>

              <div className="p-4 bg-[var(--color-bg)] rounded-lg border border-[var(--color-line)]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-md bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900">
                    <Lock size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Bloqueio Digital (PIN)</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-300">Proteja o acesso ao aplicativo.</p>
                  </div>
                </div>
                
                {userConfig?.pin ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/20">
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">PIN Ativado</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        onClick={removePin}
                        className="h-7 px-2 text-[10px] text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                      >
                        Desativar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {isSettingPin ? (
                      <div className="space-y-2">
                        <input
                          type="password"
                          maxLength={4}
                          value={newPin}
                          onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                          className="w-full px-3 py-2 text-center text-lg tracking-[1em] font-bold rounded-lg bg-white dark:bg-slate-800 border border-[var(--color-line)] focus:ring-2 focus:ring-slate-900 dark:focus:ring-slate-100 outline-none"
                          placeholder="****"
                        />
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            onClick={() => {
                              setIsSettingPin(false);
                              setNewPin('');
                            }}
                            className="flex-1 h-8 text-[10px]"
                          >
                            Cancelar
                          </Button>
                          <Button 
                            onClick={() => savePin()}
                            disabled={newPin.length !== 4}
                            className="flex-1 h-8 text-[10px]"
                          >
                            Confirmar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        variant="secondary" 
                        onClick={() => setIsSettingPin(true)}
                        className="w-full h-9 text-xs gap-2"
                      >
                        <Fingerprint size={14} />
                        Configurar PIN
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="p-4 bg-[var(--color-bg)] rounded-lg border border-[var(--color-line)]">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-md bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900">
                    <Save size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Backup de Dados</h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-300">Exporte ou importe seus dados.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="ghost"
                    onClick={exportData}
                    className="h-9 text-xs gap-2 bg-[var(--color-card)] border border-[var(--color-line)] hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    <Download size={14} />
                    Exportar
                  </Button>
                  <label className="flex items-center justify-center gap-2 h-9 bg-[var(--color-card)] text-[var(--color-ink)] border border-[var(--color-line)] hover:bg-slate-50 dark:hover:bg-slate-800 px-3 rounded-md cursor-pointer font-semibold text-xs transition-all">
                    <Upload size={14} />
                    Importar
                    <input type="file" accept=".json" onChange={importData} className="hidden" />
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Usuário</h4>
                <div className="flex items-center gap-3 p-3 bg-[var(--color-card)] rounded-lg border border-[var(--color-line)]">
                  <img src={user?.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-[var(--color-line)]" />
                  <div className="overflow-hidden">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{user?.displayName}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-300 truncate">{user?.email}</div>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    signOut(auth);
                    setIsSettingsOpen(false);
                  }}
                  className="w-full h-10 text-xs gap-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                >
                  <LogOut size={14} />
                  Sair da Conta
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Employee Modal */}
      {isEditEmployeeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 dark:bg-black/40 backdrop-blur-[2px]">
          <Card className="w-full max-w-md p-6 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">Editar Funcionário</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-medium">Atualizar Cadastro</p>
              </div>
              <Button variant="ghost" onClick={() => setIsEditEmployeeOpen(false)} className="p-1.5 h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
                <X size={18} />
              </Button>
            </div>
            
            <form onSubmit={updateEmployee} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Nome Completo</label>
                  <input
                    autoFocus
                    type="text"
                    value={editEmployeeName}
                    onChange={e => setEditEmployeeName(e.target.value)}
                    className="pro-input"
                    placeholder="Ex: João Silva"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Cargo / Função</label>
                  <input
                    type="text"
                    value={editEmployeeRole}
                    onChange={e => setEditEmployeeRole(e.target.value)}
                    className="pro-input"
                    placeholder="Ex: Pedreiro"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Valor da Diária (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editEmployeeDailyRate}
                  onChange={e => setEditEmployeeDailyRate(e.target.value)}
                  className="pro-input"
                  placeholder="Ex: 150.00"
                />
              </div>

              <div className="pt-4 border-t border-[var(--color-line)] space-y-4">
                <h4 className="text-[10px] font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                  <CreditCard size={14} /> Dados de Pagamento
                </h4>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Chave PIX</label>
                  <input
                    type="text"
                    value={editEmployeePix}
                    onChange={e => setEditEmployeePix(e.target.value)}
                    className="pro-input"
                    placeholder="E-mail, CPF, Celular ou Aleatória"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Banco</label>
                    <input
                      type="text"
                      value={editEmployeeBankName}
                      onChange={e => setEditEmployeeBankName(e.target.value)}
                      className="pro-input"
                      placeholder="Ex: Nubank"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Agência</label>
                      <input
                        type="text"
                        value={editEmployeeBankAgency}
                        onChange={e => setEditEmployeeBankAgency(e.target.value)}
                        className="pro-input"
                        placeholder="0001"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Conta</label>
                      <input
                        type="text"
                        value={editEmployeeBankAccount}
                        onChange={e => setEditEmployeeBankAccount(e.target.value)}
                        className="pro-input"
                        placeholder="12345-6"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsEditEmployeeOpen(false)} className="flex-1 h-10 text-xs">
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 h-10 text-xs">
                  Atualizar
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      {isAddEmployeeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/20 dark:bg-black/40 backdrop-blur-[2px]">
          <Card className="w-full max-w-md p-6 space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">Novo Funcionário</h3>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest font-medium">Cadastrar na Equipe</p>
              </div>
              <Button variant="ghost" onClick={() => setIsAddEmployeeOpen(false)} className="p-1.5 h-8 w-8 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100">
                <X size={18} />
              </Button>
            </div>
            
            <form onSubmit={addEmployee} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Nome Completo</label>
                  <input
                    autoFocus
                    type="text"
                    value={newEmployeeName}
                    onChange={e => setNewEmployeeName(e.target.value)}
                    className="pro-input"
                    placeholder="Ex: João Silva"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Cargo / Função</label>
                  <input
                    type="text"
                    value={newEmployeeRole}
                    onChange={e => setNewEmployeeRole(e.target.value)}
                    className="pro-input"
                    placeholder="Ex: Pedreiro"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Valor da Diária (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newEmployeeDailyRate}
                  onChange={e => setNewEmployeeDailyRate(e.target.value)}
                  className="pro-input"
                  placeholder="Ex: 150.00"
                />
              </div>

              <div className="pt-4 border-t border-[var(--color-line)] space-y-4">
                <h4 className="text-[10px] font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2">
                  <CreditCard size={14} /> Dados de Pagamento
                </h4>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Chave PIX</label>
                  <input
                    type="text"
                    value={newEmployeePix}
                    onChange={e => setNewEmployeePix(e.target.value)}
                    className="pro-input"
                    placeholder="E-mail, CPF, Celular ou Aleatória"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Banco</label>
                    <input
                      type="text"
                      value={newEmployeeBankName}
                      onChange={e => setNewEmployeeBankName(e.target.value)}
                      className="pro-input"
                      placeholder="Ex: Nubank"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Agência</label>
                      <input
                        type="text"
                        value={newEmployeeBankAgency}
                        onChange={e => setNewEmployeeBankAgency(e.target.value)}
                        className="pro-input"
                        placeholder="0001"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-300 uppercase tracking-widest">Conta</label>
                      <input
                        type="text"
                        value={newEmployeeBankAccount}
                        onChange={e => setNewEmployeeBankAccount(e.target.value)}
                        className="pro-input"
                        placeholder="12345-6"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsAddEmployeeOpen(false)} className="flex-1 h-10 text-xs" disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 h-10 text-xs" disabled={isSubmitting}>
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
