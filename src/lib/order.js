// Ordinamento della lista in base al negozio: reparti nell'ordine del
// percorso (personalizzato o appreso) e articoli nell'ordine in cui
// vengono di solito presi.
import { DEFAULT_CATEGORY_ORDER, getCategory } from './categories';

/**
 * @param {object|null} store supermercato selezionato
 * @param {Map<string, number>} ranks nameKey -> posizione appresa (0..1)
 * @param {Map<string, object>} products nameKey -> prodotto
 * @returns {{ order: string[], learned: boolean, custom: boolean }}
 */
export function getCategoryOrder(store, ranks = new Map(), products = new Map()) {
  if (store?.categoryOrder?.length) {
    const custom = store.categoryOrder.filter(id => DEFAULT_CATEGORY_ORDER.includes(id));
    const missing = DEFAULT_CATEGORY_ORDER.filter(id => !custom.includes(id));
    return { order: [...custom, ...missing], learned: false, custom: true };
  }

  if (store && ranks.size > 0) {
    const sums = new Map();
    ranks.forEach((rank, nameKey) => {
      const category = products.get(nameKey)?.category;
      if (!category) return;
      const s = sums.get(category) || { total: 0, n: 0 };
      s.total += rank;
      s.n += 1;
      sums.set(category, s);
    });
    if (sums.size > 0) {
      const count = DEFAULT_CATEGORY_ORDER.length;
      const position = (id, idx) => {
        const s = sums.get(id);
        return s ? s.total / s.n : idx / (count - 1);
      };
      const order = DEFAULT_CATEGORY_ORDER
        .map((id, idx) => ({ id, pos: position(id, idx), idx }))
        .sort((a, b) => a.pos - b.pos || a.idx - b.idx)
        .map(x => x.id);
      return { order, learned: true, custom: false };
    }
  }

  return { order: DEFAULT_CATEGORY_ORDER, learned: false, custom: false };
}

const collator = new Intl.Collator('it', { sensitivity: 'base' });

function compareWithinGroup(ranks) {
  return (a, b) => {
    const ra = ranks.get(a.nameKey);
    const rb = ranks.get(b.nameKey);
    if (ra != null && rb != null && ra !== rb) return ra - rb;
    if (ra != null && rb == null) return -1;
    if (ra == null && rb != null) return 1;
    return collator.compare(a.name, b.name);
  };
}

/**
 * Raggruppa e ordina gli articoli da comprare.
 * @returns {Array<{ category: object|null, items: object[] }>}
 */
export function arrangeItems(items, { groupByCategory, categoryOrder, ranks = new Map() }) {
  const compare = compareWithinGroup(ranks);
  if (!groupByCategory) {
    const position = new Map(categoryOrder.map((id, i) => [id, i / Math.max(1, categoryOrder.length - 1)]));
    const sorted = [...items].sort((a, b) => {
      const ra = ranks.get(a.nameKey) ?? position.get(a.category) ?? 1;
      const rb = ranks.get(b.nameKey) ?? position.get(b.category) ?? 1;
      return ra - rb || collator.compare(a.name, b.name);
    });
    return [{ category: null, items: sorted }];
  }

  const groups = new Map();
  for (const item of items) {
    const cat = getCategory(item.category).id;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat).push(item);
  }
  return categoryOrder
    .filter(id => groups.has(id))
    .map(id => ({ category: getCategory(id), items: groups.get(id).sort(compare) }));
}
