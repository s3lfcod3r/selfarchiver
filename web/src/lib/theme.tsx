import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Light/dark theme. The actual colours are CSS variables overridden under
 * `html[data-theme="dark"]` in index.css, so every Tailwind utility adapts
 * automatically. Choice is persisted; first visit follows the OS preference.
 */

export type Theme = 'light' | 'dark';

export function detectTheme(): Theme {
    try {
        const saved = localStorage.getItem('sa_theme');
        if (saved === 'light' || saved === 'dark') return saved;
    } catch {
        // localStorage may be unavailable
    }
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

interface ThemeContextValue {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(detectTheme);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    const setTheme = (next: Theme) => {
        try {
            localStorage.setItem('sa_theme', next);
        } catch {
            // ignore persistence failures
        }
        setThemeState(next);
    };

    const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');

    return <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
    return ctx;
}
