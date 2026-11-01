import Dexie from 'dexie';
import { guessCategory, normalize, DEFAULT_CATEGORY } from './lib/categories';
import { DEFAULT_UNIT, estimatePrice } from './lib/units';
import { capitalize } from './lib/parse';

const db = new Dexie('ListaSpesaDB');

// ---------------------------------------------------------------------------
// Schema (le versioni 1-3 sono mantenute per la migrazione dei dati esistenti)
// ---------------------------------------------------------------------------

db.version(1).stores({
  items: '++id, name, quantity, completed, createdAt, updatedAt',
  history: '++id, itemName, quantity, purchasedAt',
  suggestions: '++id, name, frequency, lastUsed'
});

db.version(2).stores({
  items: '++id, name, quantity, completed, createdAt, updatedAt, supermarket',
  history: '++id, itemName, quantity, purchasedAt',
  suggestions: '++id, name, frequency, lastUsed',
  supermarketOrder: '++id, supermarket, itemIndex'
}).upgrade(tx => tx.table('items').toCollection().modify(item => {
  if (!item.supermarket) item.supermarket = null;
}));

db.version(3).stores({
  items: '++id, name, quantity, completed, createdAt, updatedAt, supermarket',
  history: '++id, itemName, quantity, purchasedAt',
  suggestions: '++id, name, frequency, lastUsed',
  supermarketOrder: '++id, supermarket, itemIndex',
  supermarkets: '++id, name'
}).upgrade(tx => {
  const defaults = ['Conad', 'Esselunga', 'Coop', 'Auchan', 'Lidl', 'Euronics', 'MediaWorld', 'Altro'];
  return tx.table('supermarkets').bulkAdd(defaults.map(name => ({ name })));
});

// v4: reparti, unità, prezzi, catalogo prodotti, ordine appreso per negozio, spese concluse
db.version(4).stores({
  items: '++id, name, nameKey, completed, category, createdAt, updatedAt',
  history: '++id, itemName, nameKey, purchasedAt, storeId, tripId',
  suggestions: '++id, name, frequency, lastUsed',
  supermarketOrder: '++id, supermarket, itemIndex',
  supermarkets: '++id, name',
  products: '++id, &nameKey, name, category, count, lastPurchased, favorite',
  storeRanks: '++id, &[storeId+nameKey], storeId',
  trips: '++id, endedAt, storeId',
  settings: '&key'
}).upgrade(async tx => {
  const [items, history, suggestions, order, supermarkets] = await Promise.all([
    tx.table('items').toArray(),
    tx.table('history').toArray(),
    tx.table('suggestions').toArray(),
    tx.table('supermarketOrder').toArray(),
    tx.table('supermarkets').toArray()
  ]);
  const converted = convertLegacy({ items, history, suggestions, supermarketOrder: order, supermarkets });

  await tx.table('items').clear();
  await tx.table('items').bulkAdd(converted.items);
  await tx.table('history').clear();
  await tx.table('history').bulkAdd(converted.history);
  await tx.table('supermarkets').clear();
  await tx.table('supermarkets').bulkAdd(converted.supermarkets);
  await tx.table('products').bulkAdd(converted.products);
  await tx.table('storeRanks').bulkAdd(converted.storeRanks);
});

// v5: rimozione delle tabelle sostituite
db.version(5).stores({
  suggestions: null,
  supermarketOrder: null
});

// Prima installazione: qualche supermercato di partenza
db.on('populate', () => {
  db.supermarkets.bulkAdd(
    ['Conad', 'Esselunga', 'Coop', 'Lidl', 'Carrefour', 'Eurospin'].map(name => ({ name, categoryOrder: null }))
  );
});

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Conversione dati dal formato precedente (usata da migrazione e import)
// ---------------------------------------------------------------------------

function toQuantity(value) {
  const q = Number(value);
  return Number.isFinite(q) && q > 0 ? q : 1;
}

export function convertLegacy({ items = [], history = [], suggestions = [], supermarketOrder = [], supermarkets = [] }) {
  const storeList = [];
  const storeIds = new Map();
  supermarkets.forEach((s, i) => {
    const name = String(s.name || '').trim();
    if (!name || storeIds.has(name)) return;
    const id = s.id || i + 1;
    storeIds.set(name, id);
    storeList.push({ id, name, categoryOrder: null });
  });

  const newItems = items.map(item => {
    const name = capitalize(item.name);
    return {
      id: item.id,
      name,
      nameKey: normalize(name),
      quantity: toQuantity(item.quantity),
      unit: DEFAULT_UNIT,
      category: guessCategory(name),
      note: '',
      price: null,
      completed: item.completed ? 1 : 0,
      createdAt: item.createdAt || now(),
      updatedAt: item.updatedAt || now(),
      completedAt: item.completed ? (item.updatedAt || now()) : null,
      historyId: null
    };
  }).filter(i => i.nameKey);

  const newHistory = history.map(entry => {
    const name = capitalize(entry.itemName);
    return {
      id: entry.id,
      itemName: name,
      nameKey: normalize(name),
      quantity: toQuantity(entry.quantity),
      unit: DEFAULT_UNIT,
      category: guessCategory(name),
      price: null,
      storeId: null,
      storeName: null,
      tripId: null,
      purchasedAt: entry.purchasedAt || now()
    };
  }).filter(h => h.nameKey);

  // Catalogo prodotti da storico, suggerimenti e lista
  const products = new Map();
  const touch = (name) => {
    const key = normalize(name);
    if (!key) return null;
    if (!products.has(key)) {
      const display = capitalize(name);
      products.set(key, {
        name: display,
        nameKey: key,
        category: guessCategory(display),
        unit: DEFAULT_UNIT,
        count: 0,
        lastPurchased: null,
        lastQuantity: 1,
        lastPrice: null,
        favorite: 0
      });
    }
    return products.get(key);
  };
  [...newHistory].sort((a, b) => a.purchasedAt.localeCompare(b.purchasedAt)).forEach(h => {
    const p = touch(h.itemName);
    p.count += 1;
    p.lastPurchased = h.purchasedAt;
    p.lastQuantity = h.quantity;
  });
  suggestions.forEach(s => {
    const p = touch(s.name);
    if (p && (s.frequency || 0) > p.count) p.count = s.frequency;
  });
  newItems.forEach(i => touch(i.name));

  // Ordine manuale per supermercato -> ranghi appresi (0..1)
  const ranks = [];
  const bySupermarket = new Map();
  supermarketOrder.forEach(o => {
    if (!bySupermarket.has(o.supermarket)) bySupermarket.set(o.supermarket, []);
    bySupermarket.get(o.supermarket).push(o);
  });
  bySupermarket.forEach((entries, storeName) => {
    const storeId = storeIds.get(storeName);
    if (!storeId) return;
    entries.sort((a, b) => a.itemIndex - b.itemIndex);
    const seen = new Set();
    entries.forEach((o, idx) => {
      const nameKey = normalize(o.itemName);
      if (!nameKey || seen.has(nameKey)) return;
      seen.add(nameKey);
      ranks.push({ storeId, nameKey, rank: entries.length > 1 ? idx / (entries.length - 1) : 0 });
    });
  });

  return {
    items: newItems,
    history: newHistory,
    supermarkets: storeList,
    products: Array.from(products.values()),
    storeRanks: ranks
  };
}

// ---------------------------------------------------------------------------
// Impostazioni
// ---------------------------------------------------------------------------

export const DEFAULT_SETTINGS = {
  theme: 'system', // system | light | dark
  accent: 'basilico',
  showPrices: true,
  groupByCategory: true,
  keepAwake: true,
  haptics: true,
  smartSuggestions: true,
  selectedStoreId: null,
  onboarded: false
};

export const settingsActions = {
  set: (key, value) => db.settings.put({ key, value }),
  toObject: (rows) => rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), { ...DEFAULT_SETTINGS })
};

// ---------------------------------------------------------------------------
// Prodotti (catalogo con memoria di reparto, unità, prezzo)
// ---------------------------------------------------------------------------

export const productActions = {
  getByKey: (nameKey) => db.products.where('nameKey').equals(nameKey).first(),

  async ensure({ name, category, unit }) {
    const nameKey = normalize(name);
    const existing = await db.products.where('nameKey').equals(nameKey).first();
    if (existing) return existing;
    const product = {
      name, nameKey,
      category: category || guessCategory(name),
      unit: unit || DEFAULT_UNIT,
      count: 0,
      lastPurchased: null,
      lastQuantity: 1,
      lastPrice: null,
      favorite: 0
    };
    product.id = await db.products.add(product);
    return product;
  },

  async update(nameKey, changes) {
    const existing = await db.products.where('nameKey').equals(nameKey).first();
    if (existing) await db.products.update(existing.id, changes);
  },

  async toggleFavorite(name) {
    const product = await productActions.ensure({ name });
    await db.products.update(product.id, { favorite: product.favorite ? 0 : 1 });
    return !product.favorite;
  },

  delete: (id) => db.products.delete(id)
};

// ---------------------------------------------------------------------------
// Articoli della lista
// ---------------------------------------------------------------------------

export const itemActions = {
  /**
   * Aggiunge un articolo; se è già in lista (non comprato) ne somma la quantità.
   * @returns {Promise<{ id: number, merged: boolean, item: object }>}
   */
  async add({ name, quantity = null, unit = null, category = null, note = '', price = null }) {
    const cleanName = capitalize(name);
    const nameKey = normalize(cleanName);
    if (!nameKey) throw new Error('Nome mancante');

    return db.transaction('rw', db.items, db.products, async () => {
      const product = await db.products.where('nameKey').equals(nameKey).first();
      const finalUnit = unit || product?.unit || DEFAULT_UNIT;
      const finalQty = quantity || (product && product.unit === finalUnit ? product.lastQuantity : null) || 1;

      const existing = await db.items
        .where('nameKey').equals(nameKey)
        .filter(i => !i.completed)
        .first();

      if (existing) {
        const changes = { updatedAt: now() };
        if (existing.unit === finalUnit) {
          changes.quantity = Math.round((existing.quantity + (quantity || 1)) * 1000) / 1000;
        } else {
          changes.quantity = finalQty;
          changes.unit = finalUnit;
        }
        if (note) changes.note = note;
        await db.items.update(existing.id, changes);
        return { id: existing.id, merged: true, item: { ...existing, ...changes } };
      }

      const finalCategory = category || product?.category || guessCategory(cleanName);
      const item = {
        name: product?.name && normalize(product.name) === nameKey ? product.name : cleanName,
        nameKey,
        quantity: finalQty,
        unit: finalUnit,
        category: finalCategory,
        note: note || '',
        price: price ?? estimatePrice(product, finalQty, finalUnit),
        completed: 0,
        createdAt: now(),
        updatedAt: now(),
        completedAt: null,
        historyId: null
      };
      const id = await db.items.add(item);

      if (!product) {
        await db.products.add({
          name: item.name, nameKey, category: finalCategory, unit: finalUnit,
          count: 0, lastPurchased: null, lastQuantity: finalQty, lastPrice: null, favorite: 0
        });
      }
      return { id, merged: false, item: { ...item, id } };
    });
  },

  async addMany(list) {
    let added = 0;
    let merged = 0;
    for (const entry of list) {
      if (!entry.name) continue;
      const res = await itemActions.add(entry);
      if (res.merged) merged++; else added++;
    }
    return { added, merged };
  },

  async update(id, changes) {
    const item = await db.items.get(id);
    if (!item) return;
    const next = { ...changes, updatedAt: now() };
    if (changes.name !== undefined) {
      next.name = capitalize(changes.name);
      next.nameKey = normalize(next.name);
    }
    await db.transaction('rw', db.items, db.products, db.history, async () => {
      await db.items.update(id, next);
      const nameKey = next.nameKey || item.nameKey;
      // Il catalogo impara le correzioni di reparto e unità
      const productChanges = {};
      if (changes.category && changes.category !== item.category) productChanges.category = changes.category;
      if (changes.unit && changes.unit !== item.unit) productChanges.unit = changes.unit;
      if (Object.keys(productChanges).length) {
        const product = await productActions.ensure({ name: next.name || item.name, ...productChanges });
        await db.products.update(product.id, productChanges);
      }
      // Mantiene allineata la voce di storico se l'articolo è già stato preso
      if (item.historyId) {
        const h = {};
        if (next.name) { h.itemName = next.name; h.nameKey = nameKey; }
        if (changes.quantity !== undefined) h.quantity = changes.quantity;
        if (changes.unit !== undefined) h.unit = changes.unit;
        if (changes.price !== undefined) h.price = changes.price;
        if (changes.category !== undefined) h.category = changes.category;
        if (Object.keys(h).length) await db.history.update(item.historyId, h);
      }
    });
  },

  /** Elimina dalla lista (un articolo già preso resta comunque nello storico) */
  async remove(id) {
    const item = await db.items.get(id);
    if (!item) return null;
    await db.items.delete(id);
    return item;
  },

  /** Ripristina un articolo eliminato (annulla) */
  restore: (item) => db.items.put(item),

  restoreMany: (items) => db.items.bulkPut(items),

  /** Segna come preso / riporta in lista */
  async setCompleted(id, completed, store = null) {
    return db.transaction('rw', [db.items, db.history, db.products, db.storeRanks], async () => {
      const item = await db.items.get(id);
      if (!item || Boolean(item.completed) === Boolean(completed)) return;

      if (!completed) {
        await undoPurchase(item);
        await db.items.update(id, { completed: 0, completedAt: null, historyId: null, updatedAt: now() });
        return;
      }

      const purchasedAt = now();
      const historyId = await db.history.add({
        itemName: item.name,
        nameKey: item.nameKey,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        price: item.price ?? null,
        storeId: store?.id ?? null,
        storeName: store?.name ?? null,
        tripId: null,
        purchasedAt
      });
      await db.items.update(id, { completed: 1, completedAt: purchasedAt, historyId, updatedAt: purchasedAt });

      // Aggiorna il catalogo
      const product = await productActions.ensure({ name: item.name, category: item.category, unit: item.unit });
      const productChanges = {
        count: (product.count || 0) + 1,
        lastPurchased: purchasedAt,
        lastQuantity: item.quantity,
        unit: item.unit,
        category: item.category
      };
      if (item.price != null) productChanges.lastPrice = item.price;
      await db.products.update(product.id, productChanges);

      // Impara il percorso nel negozio: posizione relativa in cui l'articolo è stato preso
      if (store?.id) {
        const all = await db.items.toArray();
        const alreadyTaken = all.filter(i => i.completed && i.id !== id).length;
        const position = all.length > 1 ? alreadyTaken / (all.length - 1) : 0;
        const existing = await db.storeRanks.where('[storeId+nameKey]').equals([store.id, item.nameKey]).first();
        if (existing) {
          await db.storeRanks.update(existing.id, { rank: existing.rank * 0.6 + position * 0.4 });
        } else {
          await db.storeRanks.add({ storeId: store.id, nameKey: item.nameKey, rank: position });
        }
      }
    });
  },

  /** Svuota la lista (gli articoli già presi restano nello storico); restituisce gli articoli per l'annulla */
  async clearAll() {
    const items = await db.items.toArray();
    await db.items.clear();
    return items;
  },

  /**
   * Conclude la spesa: gli articoli presi escono dalla lista e vengono
   * raggruppati in una "spesa" nello storico.
   */
  async finishShopping(store = null) {
    return db.transaction('rw', db.items, db.history, db.trips, async () => {
      const completed = await db.items.where('completed').equals(1).toArray();
      if (completed.length === 0) return null;
      const total = completed.reduce((sum, i) => sum + (Number(i.price) || 0), 0);
      const trip = {
        storeId: store?.id ?? null,
        storeName: store?.name ?? null,
        endedAt: now(),
        itemCount: completed.length,
        total: Math.round(total * 100) / 100,
        pricedCount: completed.filter(i => i.price != null && i.price !== '').length
      };
      const tripId = await db.trips.add(trip);
      const historyIds = completed.map(i => i.historyId).filter(Boolean);
      await db.history.where('id').anyOf(historyIds).modify({ tripId });
      await db.items.bulkDelete(completed.map(i => i.id));
      return { ...trip, id: tripId };
    });
  }
};

async function undoPurchase(item) {
  if (!item.historyId) return;
  await db.history.delete(item.historyId);
  const product = await db.products.where('nameKey').equals(item.nameKey).first();
  if (product) {
    await db.products.update(product.id, { count: Math.max(0, (product.count || 1) - 1) });
  }
}

// ---------------------------------------------------------------------------
// Storico
// ---------------------------------------------------------------------------

export const historyActions = {
  delete: (id) => db.history.delete(id),
  clear: () => db.transaction('rw', db.history, db.trips, db.products, async () => {
    await db.history.clear();
    await db.trips.clear();
    await db.products.toCollection().modify({ count: 0, lastPurchased: null });
  }),

  async generateTestData() {
    const sample = [
      ['Latte', 2, 'l', 2.4, 3], ['Pane', 1, 'pz', 1.8, 2], ['Uova', 6, 'pz', 2.1, 6],
      ['Banane', 1, 'kg', 1.9, 5], ['Mele', 1.5, 'kg', 2.7, 7], ['Pasta', 2, 'conf', 1.6, 7],
      ['Pomodori', 1, 'kg', 2.5, 6], ['Mozzarella', 2, 'pz', 2.6, 5], ['Yogurt', 4, 'pz', 2.2, 7],
      ['Caffè', 1, 'conf', 4.9, 14], ['Carta igienica', 1, 'conf', 3.9, 21], ['Detersivo piatti', 1, 'pz', 1.7, 30],
      ['Petto di pollo', 0.6, 'kg', 6.3, 7], ['Acqua naturale', 6, 'pz', 1.8, 7], ['Biscotti', 1, 'conf', 2.3, 10],
      ['Parmigiano', 0.3, 'kg', 5.4, 14], ['Zucchine', 0.8, 'kg', 1.9, 7], ['Olio extravergine', 1, 'l', 8.9, 30]
    ];
    const entries = [];
    const today = Date.now();
    for (const [name, quantity, unit, price, every] of sample) {
      for (let daysAgo = Math.floor(Math.random() * every); daysAgo < 120; daysAgo += every + Math.round((Math.random() - 0.5) * 2)) {
        entries.push({
          itemName: name, nameKey: normalize(name), quantity, unit,
          category: guessCategory(name), price,
          storeId: null, storeName: null, tripId: null,
          purchasedAt: new Date(today - (daysAgo + 1) * 86400000 - Math.random() * 36000000).toISOString()
        });
      }
    }
    await db.transaction('rw', db.history, db.products, async () => {
      await db.history.bulkAdd(entries);
      for (const e of entries) {
        const p = await productActions.ensure({ name: e.itemName, category: e.category, unit: e.unit });
        const changes = { count: (p.count || 0) + 1, lastPrice: e.price, lastQuantity: e.quantity, unit: e.unit };
        if (!p.lastPurchased || p.lastPurchased < e.purchasedAt) changes.lastPurchased = e.purchasedAt;
        await db.products.update(p.id, changes);
      }
    });
    return entries.length;
  }
};

// ---------------------------------------------------------------------------
// Supermercati
// ---------------------------------------------------------------------------

export const storeActions = {
  async add(name) {
    const clean = String(name || '').trim();
    if (!clean) throw new Error('Inserisci un nome');
    const exists = await db.supermarkets.filter(s => s.name.toLowerCase() === clean.toLowerCase()).first();
    if (exists) throw new Error('Questo supermercato esiste già');
    return db.supermarkets.add({ name: clean, categoryOrder: null });
  },
  rename: (id, name) => db.supermarkets.update(id, { name: String(name).trim() }),
  setCategoryOrder: (id, order) => db.supermarkets.update(id, { categoryOrder: order }),
  async delete(id) {
    await db.transaction('rw', db.supermarkets, db.storeRanks, db.settings, async () => {
      await db.supermarkets.delete(id);
      await db.storeRanks.where('storeId').equals(id).delete();
      const selected = await db.settings.get('selectedStoreId');
      if (selected?.value === id) await db.settings.put({ key: 'selectedStoreId', value: null });
    });
  },
  resetLearning: (id) => db.storeRanks.where('storeId').equals(id).delete()
};

// ---------------------------------------------------------------------------
// Backup: esportazione / importazione
// ---------------------------------------------------------------------------

const BACKUP_VERSION = 3;
const TABLES = ['items', 'history', 'products', 'supermarkets', 'storeRanks', 'trips', 'settings'];

export const backupActions = {
  async exportAll() {
    const data = { app: 'lista-spesa', version: BACKUP_VERSION, exportDate: now() };
    for (const table of TABLES) data[table] = await db.table(table).toArray();
    return JSON.stringify(data, null, 2);
  },

  /** Analizza un file di backup senza modificarlo, per mostrare un'anteprima */
  parse(jsonString) {
    let data;
    try {
      data = JSON.parse(jsonString);
    } catch {
      throw new Error('Il file non è un JSON valido');
    }
    if (!data || typeof data !== 'object' || (!Array.isArray(data.items) && !Array.isArray(data.history))) {
      throw new Error('Il file non sembra un backup di Lista Spesa');
    }
    if (!data.version || data.version < 3) {
      const converted = convertLegacy(data);
      data = { version: BACKUP_VERSION, ...converted, trips: [], settings: [] };
    }
    for (const table of TABLES) if (!Array.isArray(data[table])) data[table] = [];
    return data;
  },

  /**
   * @param {object} data dati restituiti da parse()
   * @param {'replace'|'merge'} mode
   */
  async importAll(data, mode = 'replace') {
    await db.transaction('rw', TABLES.map(t => db.table(t)), async () => {
      if (mode === 'replace') {
        for (const table of TABLES) {
          await db.table(table).clear();
          if (data[table].length) await db.table(table).bulkPut(data[table]);
        }
        return;
      }

      // Unione: aggiunge ciò che manca senza toccare i dati presenti
      const storeIdMap = new Map();
      const stores = await db.supermarkets.toArray();
      for (const s of data.supermarkets) {
        const match = stores.find(x => x.name.toLowerCase() === String(s.name).toLowerCase());
        if (match) storeIdMap.set(s.id, match.id);
        else {
          const { id, ...rest } = s;
          storeIdMap.set(id, await db.supermarkets.add(rest));
        }
      }

      const tripIdMap = new Map();
      for (const t of data.trips) {
        const { id, ...rest } = t;
        tripIdMap.set(id, await db.trips.add({ ...rest, storeId: storeIdMap.get(t.storeId) ?? null }));
      }

      const existingHistory = new Set((await db.history.toArray()).map(h => `${h.nameKey}|${h.purchasedAt}`));
      const newHistory = data.history
        .filter(h => !existingHistory.has(`${h.nameKey}|${h.purchasedAt}`))
        .map(({ id, ...h }) => ({ ...h, storeId: storeIdMap.get(h.storeId) ?? null, tripId: tripIdMap.get(h.tripId) ?? null }));
      if (newHistory.length) await db.history.bulkAdd(newHistory);

      const activeKeys = new Set((await db.items.toArray()).filter(i => !i.completed).map(i => i.nameKey));
      const newItems = data.items
        .filter(i => !i.completed && !activeKeys.has(i.nameKey))
        .map(({ id, ...i }) => ({ ...i, historyId: null }));
      if (newItems.length) await db.items.bulkAdd(newItems);

      for (const p of data.products) {
        const existing = await db.products.where('nameKey').equals(p.nameKey).first();
        if (existing) {
          await db.products.update(existing.id, {
            count: (existing.count || 0) + (p.count || 0),
            favorite: existing.favorite || p.favorite || 0,
            lastPrice: existing.lastPrice ?? p.lastPrice ?? null
          });
        } else {
          const { id, ...rest } = p;
          await db.products.add(rest);
        }
      }
    });
  }
};

export async function resetAll() {
  await db.transaction('rw', TABLES.map(t => db.table(t)), async () => {
    for (const table of TABLES) await db.table(table).clear();
  });
}

export { DEFAULT_CATEGORY };
export default db;
