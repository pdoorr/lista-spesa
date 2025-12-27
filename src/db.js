import Dexie from 'dexie';

const db = new Dexie('ListaSpesaDB');

// Definizione dello schema del database
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
}).upgrade(tx => {
  // Migrazione: aggiunge il campo supermarket agli items esistenti
  tx.table('items').toCollection().modify(item => {
    if (!item.supermarket) {
      item.supermarket = null;
    }
  });
});

db.version(3).stores({
  items: '++id, name, quantity, completed, createdAt, updatedAt, supermarket',
  history: '++id, itemName, quantity, purchasedAt',
  suggestions: '++id, name, frequency, lastUsed',
  supermarketOrder: '++id, supermarket, itemIndex',
  supermarkets: '++id, name'
}).upgrade(tx => {
  // Migrazione: inizializza i supermercati di default
  const defaultSupermarkets = ['Conad', 'Esselunga', 'Coop', 'Auchan', 'Lidl', 'Euronics', 'MediaWorld', 'Altro'];
  defaultSupermarkets.forEach(name => {
    tx.table('supermarkets').add({ name });
  });
});

// Inizializza il database
export async function initializeDatabase() {
  // Database pronto per l'uso
}

// Funzioni helper per gli items
export const itemActions = {
  getAll: () => db.items.where('completed').equals(0).toArray(),
  getCompleted: () => db.items.where('completed').equals(1).reverse('updatedAt').toArray(),
  add: (item) => db.items.add({
    ...item,
    completed: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }),
  addMultiple: (items) => db.items.bulkAdd(items.map(item => ({
    ...item,
    completed: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }))),
  update: (id, updates) => db.items.update(id, {
    ...updates,
    updatedAt: new Date().toISOString()
  }),
  delete: (id) => db.items.delete(id),
  clearAll: () => db.items.clear(),
  toggleComplete: async (id, completed) => {
    const item = await db.items.get(id);
    if (item) {
      await db.items.update(id, {
        completed: completed ? 1 : 0,
        updatedAt: new Date().toISOString()
      });
      
      // Se completato, aggiungi alla storia
      if (completed) {
        await db.history.add({
          itemName: item.name,
          quantity: item.quantity,
          purchasedAt: new Date().toISOString()
        });
        
        // Aggiorna suggerimenti
        await updateSuggestions(item.name);
      }
    }
  },
  clearCompleted: () => db.items.where('completed').equals(1).delete()
};

// Funzioni helper per la storia
export const historyActions = {
  getAll: () => db.history.orderBy('purchasedAt').reverse().limit(100).toArray(),
  getRecent: (limit = 10) => db.history.orderBy('purchasedAt').reverse().limit(limit).toArray(),
  clear: () => db.history.clear(),
  // Genera dati di test per lo storico
  generateTestData: async () => {
    const testItems = [
      // Oggi
      { itemName: 'Pane', quantity: 2, purchasedAt: new Date().toISOString() },
      { itemName: 'Latte', quantity: 1, purchasedAt: new Date(Date.now() - 3600000).toISOString() },
      { itemName: 'Uova', quantity: 12, purchasedAt: new Date(Date.now() - 7200000).toISOString() },
      
      // Ieri
      { itemName: 'Formaggio', quantity: 0.5, purchasedAt: new Date(Date.now() - 86400000).toISOString() },
      { itemName: 'Pomodori', quantity: 2.5, purchasedAt: new Date(Date.now() - 90000000).toISOString() },
      { itemName: 'Pasta', quantity: 3, purchasedAt: new Date(Date.now() - 95000000).toISOString() },
      { itemName: 'Prosciutto', quantity: 0.3, purchasedAt: new Date(Date.now() - 100000000).toISOString() },
      
      // 2 giorni fa
      { itemName: 'Mele', quantity: 6, purchasedAt: new Date(Date.now() - 172800000).toISOString() },
      { itemName: 'Banane', quantity: 8, purchasedAt: new Date(Date.now() - 180000000).toISOString() },
      
      // 3 giorni fa
      { itemName: 'Caffè', quantity: 2, purchasedAt: new Date(Date.now() - 259200000).toISOString() },
      { itemName: 'Biscotti', quantity: 1, purchasedAt: new Date(Date.now() - 260000000).toISOString() },
      { itemName: 'Zucchero', quantity: 1.5, purchasedAt: new Date(Date.now() - 265000000).toISOString() },
      
      // 5 giorni fa
      { itemName: 'Olio', quantity: 1, purchasedAt: new Date(Date.now() - 432000000).toISOString() },
      { itemName: 'Aceto', quantity: 0.5, purchasedAt: new Date(Date.now() - 435000000).toISOString() },
      
      // 7 giorni fa
      { itemName: 'Pesce', quantity: 0.8, purchasedAt: new Date(Date.now() - 604800000).toISOString() },
      { itemName: 'Verdure', quantity: 3, purchasedAt: new Date(Date.now() - 610000000).toISOString() },
      
      // 14 giorni fa
      { itemName: 'Carne', quantity: 1.5, purchasedAt: new Date(Date.now() - 1209600000).toISOString() },
      { itemName: 'Pollo', quantity: 2, purchasedAt: new Date(Date.now() - 1210000000).toISOString() },
      
      // 30 giorni fa
      { itemName: 'Yogurt', quantity: 4, purchasedAt: new Date(Date.now() - 2592000000).toISOString() },
      { itemName: 'Frutta secca', quantity: 0.3, purchasedAt: new Date(Date.now() - 2600000000).toISOString() },
    ];
    
    await db.history.bulkAdd(testItems);
    return testItems.length;
  },
  // Genera lista suggerita dallo storico
  generateShoppingList: async () => {
    const history = await db.history.orderBy('purchasedAt').reverse().toArray();
    
    // Mappa per tenere traccia dell'ultima quantità per ogni prodotto
    const lastQuantityMap = new Map();
    const frequencyMap = new Map();
    
    history.forEach(item => {
      // Aggiorna l'ultima quantità (l'ultimo nella lista ordinata per data decrescente)
      if (!lastQuantityMap.has(item.itemName)) {
        lastQuantityMap.set(item.itemName, item.quantity);
        frequencyMap.set(item.itemName, 1);
      } else {
        frequencyMap.set(item.itemName, frequencyMap.get(item.itemName) + 1);
      }
    });
    
    // Converti in array e ordina per frequenza
    const sorted = Array.from(lastQuantityMap.entries())
      .map(([name, quantity]) => ({
        name,
        quantity: quantity, // Usa l'ultima quantità acquistata
        frequency: frequencyMap.get(name)
      }))
      .sort((a, b) => b.frequency - a.frequency);
    
    return sorted;
  }
};

// Funzioni helper per l'ordine dei supermercati
export const supermarketOrderActions = {
  getAll: () => db.supermarketOrder.toArray(),
  getBySupermarket: (supermarket) => db.supermarketOrder.where('supermarket').equals(supermarket).toArray(),
  save: (supermarket, items) => {
    // Elimina l'ordine esistente per questo supermercato
    return db.supermarketOrder.where('supermarket').equals(supermarket).delete().then(() => {
      // Salva il nuovo ordine
      return db.supermarketOrder.bulkAdd(items.map((item, index) => ({
        supermarket,
        itemIndex: index,
        itemName: item
      })));
    });
  },
  deleteBySupermarket: (supermarket) => db.supermarketOrder.where('supermarket').equals(supermarket).delete(),
  clear: () => db.supermarketOrder.clear()
};

// Funzioni helper per i supermercati
export const supermarketActions = {
  getAll: () => db.supermarkets.toArray(),
  add: (name) => db.supermarkets.add({ name }),
  delete: (id) => db.supermarkets.delete(id),
  deleteByName: (name) => db.supermarkets.where('name').equals(name).delete(),
  clear: () => db.supermarkets.clear()
};

// Funzioni helper per i suggerimenti
export const suggestionActions = {
  getAll: () => db.suggestions.orderBy('frequency').reverse().limit(20).toArray(),
  addOrUpdate: async (name) => {
    const existing = await db.suggestions.where('name').equals(name).first();
    if (existing) {
      await db.suggestions.update(existing.id, {
        frequency: existing.frequency + 1,
        lastUsed: new Date().toISOString()
      });
    } else {
      await db.suggestions.add({
        name,
        frequency: 1,
        lastUsed: new Date().toISOString()
      });
    }
  }
};

// Funzione interna per aggiornare i suggerimenti
async function updateSuggestions(name) {
  await suggestionActions.addOrUpdate(name);
}

// Funzioni di export/import
export const exportActions = {
  // Esporta tutto il database in JSON (tutte le tabelle per backup completo)
  exportAll: async () => {
    const [items, history, suggestions, supermarketOrder, supermarkets] = await Promise.all([
      db.items.toArray(),
      db.history.toArray(),
      db.suggestions.toArray(),
      db.supermarketOrder.toArray(),
      db.supermarkets.toArray()
    ]);

    const exportData = {
      version: 2,
      exportDate: new Date().toISOString(),
      items,
      history,
      suggestions,
      supermarketOrder,
      supermarkets
    };

    return JSON.stringify(exportData, null, 2);
  },

  // Importa dati dal JSON
  importAll: async (jsonString) => {
    try {
      const data = JSON.parse(jsonString);

      // Pulisci il database esistente
      await db.items.clear();
      await db.history.clear();
      await db.suggestions.clear();
      await db.supermarketOrder.clear();
      await db.supermarkets.clear();

      // Importa i nuovi dati (supporta versione 1 e 2)
      if (data.items && data.items.length > 0) {
        await db.items.bulkAdd(data.items);
      }
      if (data.history && data.history.length > 0) {
        await db.history.bulkAdd(data.history);
      }
      if (data.suggestions && data.suggestions.length > 0) {
        await db.suggestions.bulkAdd(data.suggestions);
      }
      // Supporto per versioni >= 2
      if (data.supermarketOrder && data.supermarketOrder.length > 0) {
        await db.supermarketOrder.bulkAdd(data.supermarketOrder);
      }
      if (data.supermarkets && data.supermarkets.length > 0) {
        await db.supermarkets.bulkAdd(data.supermarkets);
      }

      return { success: true, imported: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
};

export default db;
