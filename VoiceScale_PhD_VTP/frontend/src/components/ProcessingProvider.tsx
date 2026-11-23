import { useState, useCallback, createContext, useContext, useEffect, useRef } from 'react';

interface ProcState { open: boolean; label: string; steps: string[]; step: number; done: Set<number>; }
interface ProcCtx { showProcessing: (steps: string[], label: string, onDone?: () => void) => void; }
const ProcContext = createContext<ProcCtx | null>(null);
export const useProcessing = () => { const c = useContext(ProcContext); if (!c) throw new Error(); return c; };

export function ProcessingProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<ProcState>({ open: false, label: '', steps: [], step: -1, done: new Set() });
  const doneRef = useRef<(() => void) | undefined>();

  const showProcessing = useCallback((steps: string[], label: string, onDone?: () => void) => {
    doneRef.current = onDone;
    setS({ open: true, label, steps, step: 0, done: new Set() });
  }, []);

  useEffect(() => {
    if (!s.open || s.step < 0) return;
    if (s.step >= s.steps.length) {
      const t = setTimeout(() => { setS(p => ({ ...p, open: false })); doneRef.current?.(); }, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setS(p => ({ ...p, done: new Set([...p.done, p.step - 1]), step: p.step + 1 })), 900);
    return () => clearTimeout(t);
  }, [s.open, s.step, s.steps.length]);

  return (
    <ProcContext.Provider value={{ showProcessing }}>
      {children}
      {s.open && (
        <div className="vc-proc-overlay">
          <div className="vc-spinner" />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>{s.label}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360, width: '100%' }}>
            {s.steps.map((step, i) => {
              const isDone = s.done.has(i);
              const isActive = i === s.step - 1;
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: isDone ? 'var(--green-a)' : isActive ? 'var(--bg3)' : 'transparent', border: `1px solid ${isDone ? 'rgba(62,232,160,.2)' : isActive ? 'var(--border)' : 'transparent'}`, opacity: i > s.step - 1 && !isDone ? 0.35 : 1, transition: 'all .3s' }}>
                  <i className={isDone ? 'bi-check-circle-fill' : isActive ? 'bi-circle-fill' : 'bi-circle'} style={{ color: isDone ? 'var(--green)' : isActive ? 'var(--teal)' : 'var(--text4)', fontSize: 14, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, color: isDone ? 'var(--green)' : isActive ? 'var(--text)' : 'var(--text3)' }}>{step}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </ProcContext.Provider>
  );
}
