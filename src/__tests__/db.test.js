import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import Dexie from 'dexie';
import db, { itemActions, backupActions, storeActions } from '../db';

beforeEach(async () => {
  await Promise.all(db.tables.map(t => t.clear()));
});

describe('itemActions', () => {
  it('aggiunge con reparto automatico e unisce i duplicati', async () => {
    await itemActions.add({ name: 'mele', quantity: 2, unit: 'kg' });
    const res = await itemActions.add({ name: 'Mele', quantity: 1 });
    expect(res.merged).toBe(true);
    const items = await db.items.toArray();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ name: 'Mele', quantity: 3, unit: 'kg', category: 'frutta-verdura' });
  });

  it('ricorda unità e reparto corretti dal catalogo', async () => {
    const { id } = await itemActions.add({ name: 'Zenzero candito' });
    await itemActions.update(id, { category: 'colazione', unit: 'conf' });
    await itemActions.remove(id);
    await itemActions.add({ name: 'zenzero candito' });
    const [item] = await db.items.toArray();
    expect(item).toMatchObject({ category: 'colazione', unit: 'conf' });
  });

  it('acquisto e annullamento mantengono lo storico coerente', async () => {
    const { id } = await itemActions.add({ name: 'Pane', price: 2 });
    await itemActions.setCompleted(id, true);
    expect(await db.history.count()).toBe(1);
    await itemActions.setCompleted(id, false);
    expect(await db.history.count()).toBe(0);
    await itemActions.setCompleted(id, true);
    const product = await db.products.where('nameKey').equals('pane').first();
    expect(product).toMatchObject({ count: 1, lastPrice: 2 });
  });

  it('conclude la spesa creando un riepilogo', async () => {
    const store = { id: await storeActions.add('Test'), name: 'Test' };
    const a = await itemActions.add({ name: 'Latte', price: 1.5 });
    const b = await itemActions.add({ name: 'Uova', price: 2.5 });
    await itemActions.add({ name: 'Riso' });
    await itemActions.setCompleted(a.id, true, store);
    await itemActions.setCompleted(b.id, true, store);
    const trip = await itemActions.finishShopping(store);
    expect(trip).toMatchObject({ itemCount: 2, total: 4, storeName: 'Test' });
    expect(await db.items.count()).toBe(1);
    const history = await db.history.toArray();
    expect(history.every(h => h.tripId === trip.id)).toBe(true);
    expect(await db.storeRanks.where('storeId').equals(store.id).count()).toBe(2);
  });
});

describe('backup', () => {
  it('esporta e reimporta', async () => {
    await itemActions.add({ name: 'Latte' });
    const json = await backupActions.exportAll();
    await db.items.clear();
    await backupActions.importAll(backupActions.parse(json), 'replace');
    expect(await db.items.count()).toBe(1);
  });

  it('converte i backup della versione precedente', () => {
    const legacy = {
      version: 2,
      items: [{ id: 1, name: 'latte', quantity: 2, completed: 0 }],
      history: [{ id: 1, itemName: 'Pane', quantity: 1, purchasedAt: '2026-01-01T10:00:00.000Z' }],
      suggestions: [{ id: 1, name: 'Pane', frequency: 4 }],
      supermarkets: [{ id: 1, name: 'Coop' }],
      supermarketOrder: [{ supermarket: 'Coop', itemIndex: 0, itemName: 'latte' }]
    };
    const data = backupActions.parse(JSON.stringify(legacy));
    expect(data.items[0]).toMatchObject({ name: 'Latte', nameKey: 'latte', unit: 'pz', category: 'latticini' });
    expect(data.products.find(p => p.nameKey === 'pane').count).toBe(4);
    expect(data.storeRanks).toEqual([{ storeId: 1, nameKey: 'latte', rank: 0 }]);
  });

  it('rifiuta file non validi', () => {
    expect(() => backupActions.parse('ciao')).toThrow();
    expect(() => backupActions.parse('{"foo":1}')).toThrow();
  });
});

describe('migrazione da v3', () => {
  it('converte un database esistente', async () => {
    const old = new Dexie('MigrazioneTest');
    old.version(3).stores({
      items: '++id, name, quantity, completed, createdAt, updatedAt, supermarket',
      history: '++id, itemName, quantity, purchasedAt',
      suggestions: '++id, name, frequency, lastUsed',
      supermarketOrder: '++id, supermarket, itemIndex',
      supermarkets: '++id, name'
    });
    await old.open();
    await old.items.add({ name: 'Latte', quantity: 1, completed: 0 });
    await old.history.add({ itemName: 'Latte', quantity: 1, purchasedAt: '2026-01-01T10:00:00.000Z' });
    await old.supermarkets.add({ name: 'Coop' });
    old.close();

    // riapre con lo schema dell'app
    const { default: Dx } = await import('dexie');
    const fresh = new Dx('MigrazioneTest');
    // copia la definizione delle versioni dall'istanza dell'app
    for (const v of db._versions) {
      const version = fresh.version(v._cfg.version).stores(v._cfg.storesSource);
      if (v._cfg.contentUpgrade) version.upgrade(v._cfg.contentUpgrade);
    }
    await fresh.open();
    const [item] = await fresh.table('items').toArray();
    expect(item).toMatchObject({ nameKey: 'latte', category: 'latticini', unit: 'pz' });
    expect(await fresh.table('products').count()).toBe(1);
    expect(fresh.tables.map(t => t.name)).not.toContain('suggestions');
    fresh.close();
  });
});
