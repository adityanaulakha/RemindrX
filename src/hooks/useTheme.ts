import { useEffect, useState } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'remindrx-theme';

const THEME_COLORS = {
  light: '#F3F2EF',
  dark: '#111111',
} as const;

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference);
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLORS[resolved]);
  return resolved;
}

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    /* private mode */
  }
  return 'dark';
}

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);

  useEffect(() => {
    applyTheme(preference);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* ignore */
    }

    if (preference !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  return { preference, setPreference, resolved: resolveTheme(preference) };
}
