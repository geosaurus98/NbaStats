// Auto / light / dark switch. "Auto" follows the device; a choice is kept on
// this device and applied as data-theme on <html>.
import { useState } from 'react';

const KEY = 'nba-hub-theme';
type Theme = 'auto' | 'light' | 'dark';
const NEXT: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };
const ICON: Record<Theme, string> = { auto: '🌓', light: '☀️', dark: '🌙' };
const WORD: Record<Theme, string> = { auto: 'Auto', light: 'Light', dark: 'Dark' };

export function storedTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(t: Theme) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  // Canvas charts read colours once; tell them to redraw.
  window.dispatchEvent(new Event('themechange'));
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(storedTheme);
  const change = () => {
    const t = NEXT[theme];
    setTheme(t);
    applyTheme(t);
    try {
      if (t === 'auto') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, t);
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <button className="theme-toggle" onClick={change} title="Switch light/dark" aria-label={`Theme: ${theme}. Click to change.`}>
      <span>{ICON[theme]}</span> <span className="theme-word">{WORD[theme]}</span>
    </button>
  );
}
