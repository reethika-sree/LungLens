import { createContext, useContext, useState, useEffect, useCallback } from 'react';
type Theme = 'dark' | 'light';
interface ThemeCtx { theme: Theme; toggleTheme: () => void; }
const ThemeContext = createContext<ThemeCtx | null>(null);
export function useTheme() { const c = useContext(ThemeContext); if (!c) throw new Error(); return c; }
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('vc-theme') as Theme) || 'dark');
  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('vc-theme', theme); }, [theme]);
  const toggleTheme = useCallback(() => setTheme(t => t === 'dark' ? 'light' : 'dark'), []);
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
export function ThemeToggleBtn({ style }: { style?: React.CSSProperties }) {
  const { theme, toggleTheme } = useTheme();
  return <button className="vc-theme-btn" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} style={style}><i className={theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-fill'} /></button>;
}
