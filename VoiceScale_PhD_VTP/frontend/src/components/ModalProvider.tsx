import { useState, useCallback, createContext, useContext } from 'react';

interface ModalState { open: boolean; title: string; sub: string; body: React.ReactNode; footer: React.ReactNode; }
interface ModalCtx { openModal: (title: string, sub: string, body: React.ReactNode, footer: React.ReactNode) => void; closeModal: () => void; }
const ModalContext = createContext<ModalCtx | null>(null);
export const useModal = () => { const c = useContext(ModalContext); if (!c) throw new Error(); return c; };

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [m, setM] = useState<ModalState>({ open: false, title: '', sub: '', body: null, footer: null });
  const openModal  = useCallback((title: string, sub: string, body: React.ReactNode, footer: React.ReactNode) => setM({ open: true, title, sub, body, footer }), []);
  const closeModal = useCallback(() => setM(p => ({ ...p, open: false })), []);
  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      {m.open && (
        <div className="vc-modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="vc-modal">
            <div className="vc-modal-header">
              <div><div className="vc-modal-title">{m.title}</div><div className="vc-modal-sub">{m.sub}</div></div>
              <button className="vc-modal-close" onClick={closeModal}><i className="bi-x" /></button>
            </div>
            <div>{m.body}</div>
            <div className="vc-modal-footer">{m.footer}</div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}
