import { useState, useCallback, createContext, useContext } from 'react';

interface Toast { id: number; message: string; color: string; icon: string; }
interface ToastCtx { showToast: (message: string, color?: string, icon?: string) => void; }
const ToastContext = createContext<ToastCtx | null>(null);
export const useToast = () => { const c = useContext(ToastContext); if (!c) throw new Error(); return c; };

let _id = 0;
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = useCallback((message: string, color = '#00e8b5', icon = 'bi-check-circle-fill') => {
    const id = ++_id;
    setToasts(p => [...p, { id, message, color, icon }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000);
  }, []);
  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="vc-toast-wrap">
        {toasts.map(t => (
          <div key={t.id} className="vc-toast">
            <div className="vc-toast-dot" style={{ background: t.color }} />
            <i className={t.icon} style={{ color: t.color, fontSize: 14 }} />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
