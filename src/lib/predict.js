// Analisi dello storico: frequenze, intervalli medi di acquisto e previsioni
import { normalize } from './categories';

const DAY = 24 * 60 * 60 * 1000;

function dayKey(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Raggruppa lo storico per prodotto.
 * @param {Array} history voci dello storico (qualsiasi ordine)
 */
export function buildProductStats(history) {
  const map = new Map();
  for (const entry of history) {
    const key = entry.nameKey || normalize(entry.itemName);
    if (!key) continue;
    let stat = map.get(key);
    if (!stat) {
      stat = {
        nameKey: key,
        name: entry.itemName,
        count: 0,
        days: new Set(),
        last: null,
        lastQuantity: entry.quantity,
        unit: entry.unit || 'pz',
        category: entry.category,
        totalSpent: 0
      };
      map.set(key, stat);
    }
    stat.count += 1;
    stat.days.add(dayKey(entry.purchasedAt));
    if (entry.price != null) stat.totalSpent += Number(entry.price) || 0;
    const time = new Date(entry.purchasedAt).getTime();
    if (stat.last === null || time > stat.last) {
      stat.last = time;
      stat.name = entry.itemName;
      stat.lastQuantity = entry.quantity;
      stat.unit = entry.unit || 'pz';
      if (entry.category) stat.category = entry.category;
    }
  }

  return Array.from(map.values()).map(stat => {
    const days = Array.from(stat.days).sort((a, b) => a - b);
    let avgInterval = null;
    if (days.length >= 2) {
      avgInterval = (days[days.length - 1] - days[0]) / DAY / (days.length - 1);
    }
    return { ...stat, days: days.length, avgInterval };
  });
}

/**
 * Prodotti che probabilmente stanno per finire, in base alla cadenza
 * con cui vengono acquistati.
 */
export function getDueProducts(history, { exclude = new Set(), now = Date.now(), threshold = 0.8, limit = 12 } = {}) {
  return buildProductStats(history)
    .filter(s => !exclude.has(s.nameKey) && s.avgInterval && s.avgInterval >= 1)
    .map(s => {
      const daysSince = (dayKey(now) - dayKey(s.last)) / DAY;
      return { ...s, daysSince, ratio: daysSince / s.avgInterval };
    })
    .filter(s => s.ratio >= threshold)
    .sort((a, b) => b.ratio - a.ratio || b.count - a.count)
    .slice(0, limit);
}

/**
 * Proposta di lista generata dallo storico: tutti i prodotti acquistati,
 * ordinati per "urgenza" e frequenza, con preselezione di quelli in scadenza.
 */
export function buildGeneratedList(history, { exclude = new Set(), now = Date.now() } = {}) {
  return buildProductStats(history)
    .filter(s => !exclude.has(s.nameKey))
    .map(s => {
      const daysSince = (dayKey(now) - dayKey(s.last)) / DAY;
      const ratio = s.avgInterval ? daysSince / s.avgInterval : null;
      // punteggio: urgenza se nota, altrimenti frequenza relativa
      const score = ratio !== null ? ratio + Math.min(s.count, 10) / 20 : Math.min(s.count, 10) / 20;
      return {
        name: s.name,
        nameKey: s.nameKey,
        quantity: s.lastQuantity || 1,
        unit: s.unit,
        category: s.category,
        count: s.count,
        avgInterval: s.avgInterval,
        daysSince,
        ratio,
        score,
        selected: ratio !== null ? ratio >= 0.8 : false
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function describeInterval(days) {
  if (!days) return '';
  const d = Math.round(days);
  if (d <= 1) return 'ogni giorno';
  if (d < 7) return `ogni ${d} giorni`;
  const weeks = Math.round(d / 7);
  if (d < 30) return weeks === 1 ? 'ogni settimana' : `ogni ${weeks} settimane`;
  const months = Math.round(d / 30);
  return months === 1 ? 'ogni mese' : `ogni ${months} mesi`;
}

export function describeDaysAgo(days) {
  const d = Math.round(days);
  if (d <= 0) return 'oggi';
  if (d === 1) return 'ieri';
  if (d < 7) return `${d} giorni fa`;
  const weeks = Math.round(d / 7);
  if (d < 30) return weeks === 1 ? '1 settimana fa' : `${weeks} settimane fa`;
  const months = Math.round(d / 30);
  return months === 1 ? '1 mese fa' : `${months} mesi fa`;
}
