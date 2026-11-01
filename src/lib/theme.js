// Colori d'accento selezionabili nelle impostazioni
export const ACCENTS = [
  { id: 'basilico', name: 'Basilico', color: '#1f8a4c' },
  { id: 'oceano', name: 'Oceano', color: '#1f6fd1' },
  { id: 'mirtillo', name: 'Mirtillo', color: '#5b4fd6' },
  { id: 'arancia', name: 'Arancia', color: '#d9601a' },
  { id: 'lampone', name: 'Lampone', color: '#cc2f63' },
  { id: 'menta', name: 'Menta', color: '#0f8a84' }
];

function hexToRgb(hex) {
  const v = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16));
}

function mix(hex, target, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

export function resolveDark(theme) {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

/** Applica tema chiaro/scuro e colore d'accento al documento */
export function applyTheme({ theme, accent }) {
  const dark = resolveDark(theme);
  const root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';

  const base = (ACCENTS.find(a => a.id === accent) || ACCENTS[0]).color;
  const primary = dark ? mix(base, '#ffffff', 0.28) : base;
  const [r, g, b] = hexToRgb(primary);
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--primary-strong', dark ? mix(base, '#ffffff', 0.45) : mix(base, '#000000', 0.18));
  root.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
  root.style.setProperty('--on-primary', dark ? '#0d130f' : '#ffffff');

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#111613' : '#f5f6f2');
  return dark;
}
