// Interpreta l'input rapido: "2 kg mele", "latte x3", "500g farina", "Pane 2"

const UNIT_ALIASES = {
  kg: { unit: 'kg', factor: 1 },
  kilo: { unit: 'kg', factor: 1 },
  chili: { unit: 'kg', factor: 1 },
  hg: { unit: 'g', factor: 100 },
  etti: { unit: 'g', factor: 100 },
  etto: { unit: 'g', factor: 100 },
  g: { unit: 'g', factor: 1 },
  gr: { unit: 'g', factor: 1 },
  grammi: { unit: 'g', factor: 1 },
  l: { unit: 'l', factor: 1 },
  lt: { unit: 'l', factor: 1 },
  litri: { unit: 'l', factor: 1 },
  litro: { unit: 'l', factor: 1 },
  cl: { unit: 'ml', factor: 10 },
  ml: { unit: 'ml', factor: 1 },
  pz: { unit: 'pz', factor: 1 },
  pezzi: { unit: 'pz', factor: 1 },
  pezzo: { unit: 'pz', factor: 1 },
  x: { unit: null, factor: 1 },
  conf: { unit: 'conf', factor: 1 },
  confezioni: { unit: 'conf', factor: 1 },
  confezione: { unit: 'conf', factor: 1 },
  pacchi: { unit: 'conf', factor: 1 },
  pacco: { unit: 'conf', factor: 1 },
  bottiglie: { unit: 'pz', factor: 1 },
  bottiglia: { unit: 'pz', factor: 1 }
};

const UNIT_RE = Object.keys(UNIT_ALIASES).sort((a, b) => b.length - a.length).join('|');
const NUM = '(\\d+(?:[.,]\\d+)?)';

// "2 kg mele", "2kg di mele", "3x latte", "x3 latte"
const LEADING = new RegExp(`^(?:x\\s*)?${NUM}\\s*(${UNIT_RE})?\\.?\\s+(?:di\\s+)?(.+)$`, 'i');
// "mele 2 kg", "latte x3", "pane 2"
const TRAILING = new RegExp(`^(.+?)\\s+(?:x\\s*)?${NUM}\\s*(${UNIT_RE})?\\.?$`, 'i');

export function capitalize(text) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function toNumber(str) {
  return parseFloat(String(str).replace(',', '.'));
}

/**
 * @returns {{ name: string, quantity: number|null, unit: string|null }}
 *   quantity/unit sono null se non specificati nel testo
 */
export function parseItemInput(raw) {
  let text = String(raw || '').trim();
  let note = '';

  // Nota finale tra parentesi: "Banane (mature)"
  const noteMatch = text.match(/\(([^)]*)\)\s*$/);
  if (noteMatch && !/^\s*\d/.test(noteMatch[1])) {
    note = noteMatch[1].trim();
    text = text.slice(0, noteMatch.index).trim();
  }
  // Separatori tra nome e quantità: "Mele – 1 kg", "Mele: 2", "Mele (2 kg)"
  text = text.replace(/[()]/g, ' ').replace(/\s+[-–—:]\s*/g, ' ').replace(/:\s*/g, ' ').trim();

  if (!text) return { name: '', quantity: null, unit: null, note };

  let match = text.match(LEADING);
  if (match) {
    const [, num, unitStr, name] = match;
    return build(name, num, unitStr, note);
  }
  match = text.match(TRAILING);
  if (match) {
    const [, name, num, unitStr] = match;
    return build(name, num, unitStr, note);
  }
  return { name: capitalize(text), quantity: null, unit: null, note };
}

function build(name, num, unitStr, note) {
  const alias = unitStr ? UNIT_ALIASES[unitStr.toLowerCase()] : null;
  let quantity = toNumber(num);
  if (alias) quantity = Math.round(quantity * alias.factor * 1000) / 1000;
  if (!quantity || quantity <= 0) quantity = null;
  return {
    name: capitalize(name),
    quantity,
    unit: alias ? alias.unit : null,
    note
  };
}

/** Interpreta un testo incollato (es. una lista ricevuta su WhatsApp) */
export function parseMultiline(raw) {
  return String(raw || '')
    .split(/\r?\n|;/)
    .map(line => line.trim())
    // salta intestazioni: "🛒 Lista...", "*Frutta e verdura*", "Reparto:"
    .filter(line => line && !/^🛒/u.test(line) && !/^\*.*\*$/.test(line) && !/:$/.test(line))
    .map(line => line
      .replace(/^\s*(?:[-*•·–—+]|\[\s?[xX ]?\s?\]|☐|☑|✅|✔️?|\d+[.)](?!\d))\s*/u, '')
      .trim())
    .filter(Boolean)
    .map(parseItemInput)
    .filter(item => item.name);
}
