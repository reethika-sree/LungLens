import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { toggleTheme as toggleThemeAction, type Theme } from '../store/slices/themeSlice';

interface ThemeCtx {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx | null>(null);

export function useTheme() {
  const c = useContext(ThemeContext);
  if (!c) throw new Error('useTheme must be used within ThemeProvider');
  return c;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const theme = useAppSelector(state => state.theme.theme);

  const toggleTheme = useCallback(() => {
    dispatch(toggleThemeAction());
  }, [dispatch]);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function ThemeToggleBtn({ style }: { style?: React.CSSProperties }) {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      className="vc-theme-btn"
      onClick={toggleTheme}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      style={style}
    >
      <i className={theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-fill'} />
    </button>
  );
}
