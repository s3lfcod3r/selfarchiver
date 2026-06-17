import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * Theme: dark is the default; an optional light theme (white surfaces, dark
 * accents) is available via the toggle. Colours are CSS variables overridden
 * under `html[data-theme="light"]` in index.css, so every utility adapts.
 */

export type Theme = 'light' | 'dark';

export function detectTheme(): Theme {
    try {
        const saved = localStorage.getItem('sa_theme');
        if (saved === 'light' || saved === 'dark') return saved;
    } catch {
        // localStorage may be unavailable
    }
    return 'dark';
}

interface ThemeContextValue {
    theme: Theme;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>(detectTheme);

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'light') root.setAttribute('data-theme', 'light');
        else root.removeAttribute('data-theme');
    }, [theme]);

    const setTheme = (next: Theme) => {
        try {
            localStorage.setItem('sa_theme', next);
        } catch {
            // ignore persistence failures
        }
        setThemeState(next);
    };

    return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
    return ctx;
}
