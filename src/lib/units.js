// Unità di misura supportate, con passo per i pulsanti +/- e valore minimo
export const UNITS = [
  { id: 'pz', label: 'pz', long: 'pezzi', step: 1, min: 1, def: 1 },
  { id: 'conf', label: 'conf', long: 'confezioni', step: 1, min: 1, def: 1 },
  { id: 'kg', label: 'kg', long: 'chili', step: 0.5, min: 0.1, def: 1 },
  { id: 'g', label: 'g', long: 'grammi', step: 100, min: 10, def: 500 },
  { id: 'l', label: 'l', long: 'litri', step: 0.5, min: 0.1, def: 1 },
  { id: 'ml', label: 'ml', long: 'millilitri', step: 250, min: 10, def: 500 }
];

export const DEFAULT_UNIT = 'pz';

const UNIT_MAP = Object.fromEntries(UNITS.map(u => [u.id, u]));

export function getUnit(id) {
  return UNIT_MAP[id] || UNIT_MAP[DEFAULT_UNIT];
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

export function stepUp(quantity, unitId) {
  const unit = getUnit(unitId);
  const q = Number(quantity) || 0;
  // Se il valore non è allineato al passo, arrotonda al passo successivo
  const next = Math.floor(round(q / unit.step) + 1e-9) * unit.step + unit.step;
  return round(Math.max(next, unit.min));
}

export function stepDown(quantity, unitId) {
  const unit = getUnit(unitId);
  const q = Number(quantity) || 0;
  const prev = Math.ceil(round(q / unit.step) - 1e-9) * unit.step - unit.step;
  return round(Math.max(prev, unit.min));
}

export function canStepDown(quantity, unitId) {
  return (Number(quantity) || 0) > getUnit(unitId).min;
}

const numberFormat = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

export function formatNumber(value) {
  return numberFormat.format(Number(value) || 0);
}

export function formatQuantity(quantity, unitId) {
  const unit = getUnit(unitId);
  return `${formatNumber(quantity)} ${unit.label}`;
}

/** Converte una quantità in unità base (kg o l) per confronti/stime prezzo */
export function toBase(quantity, unitId) {
  const q = Number(quantity) || 0;
  if (unitId === 'g') return { value: q / 1000, base: 'kg' };
  if (unitId === 'ml') return { value: q / 1000, base: 'l' };
  return { value: q, base: unitId || DEFAULT_UNIT };
}

const currencyFormat = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });

export function formatPrice(value) {
  if (value === null || value === undefined || value === '' || Number.isNaN(Number(value))) return '';
  return currencyFormat.format(Number(value));
}

/** Stima il prezzo di una riga partendo dall'ultimo acquisto noto */
export function estimatePrice(product, quantity, unitId) {
  if (!product || product.lastPrice == null || !product.lastQuantity) return null;
  const last = toBase(product.lastQuantity, product.unit);
  const now = toBase(quantity, unitId);
  if (last.base !== now.base || !last.value) return null;
  return Math.round((product.lastPrice / last.value) * now.value * 100) / 100;
}
