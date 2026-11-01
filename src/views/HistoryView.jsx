import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { History, Plus, Search, Star, Trash2, X, Package, CalendarDays } from 'lucide-react';
import db, { historyActions, itemActions, productActions } from '../db';
import { TopBar, Sheet, Segmented, EmptyState, useUI } from '../components/ui';
import { CATEGORIES, getCategory, normalize } from '../lib/categories';
import { buildProductStats, describeDaysAgo, describeInterval } from '../lib/predict';
import { formatPrice, formatQuantity } from '../lib/units';
import { haptic } from '../lib/native';

const EMPTY = [];

const DAYS_PAGE = 21;

const dayFormat = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
const dayFormatYear = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const timeFormat = new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' });

function dayLabel(date) {
  const d = new Date(date);
  const today = new Date();
  const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((start(today) - start(d)) / 86400000);
  if (diff === 0) return 'Oggi';
  if (diff === 1) return 'Ieri';
  const text = d.getFullYear() === today.getFullYear() ? dayFormat.format(d) : dayFormatYear.format(d);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function HistoryView({ settings }) {
  const { showToast } = useUI();
  const history = useLiveQuery(() => db.history.orderBy('purchasedAt').reverse().toArray(), []);
  const products = useLiveQuery(() => db.products.toArray(), []) ?? EMPTY;
  const [mode, setMode] = useState('timeline');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [days, setDays] = useState(DAYS_PAGE);
  const [entry, setEntry] = useState(null);
  const [product, setProduct] = useState(null);

  const q = normalize(query);
  const filtered = useMemo(
    () => (history || []).filter(h => !q || (h.nameKey || normalize(h.itemName)).includes(q) || normalize(h.storeName).includes(q)),
    [history, q]
  );

  const dayGroups = useMemo(() => {
    const map = new Map();
    for (const h of filtered) {
      const d = new Date(h.purchasedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!map.has(key)) map.set(key, { key, date: h.purchasedAt, entries: new Map(), total: 0, count: 0, stores: new Set() });
      const g = map.get(key);
      g.count += 1;
      if (h.price != null) g.total += Number(h.price) || 0;
      if (h.storeName) g.stores.add(h.storeName);
      // stesso prodotto nello stesso giorno: una sola riga
      const aggKey = `${h.nameKey}|${h.unit}`;
      if (!g.entries.has(aggKey)) g.entries.set(aggKey, { ...h, times: 0, ids: [], totalQty: 0, totalPrice: null });
      const e = g.entries.get(aggKey);
      e.times += 1;
      e.ids.push(h.id);
      e.totalQty += Number(h.quantity) || 0;
      if (h.price != null) e.totalPrice = (e.totalPrice || 0) + Number(h.price);
    }
    return Array.from(map.values());
  }, [filtered]);

  const stats = useMemo(() => {
    const productMap = new Map(products.map(p => [p.nameKey, p]));
    const fromHistory = buildProductStats(history || []);
    const seen = new Set(fromHistory.map(s => s.nameKey));
    const all = [
      ...fromHistory.map(s => ({ ...s, product: productMap.get(s.nameKey) })),
      ...products.filter(p => !seen.has(p.nameKey)).map(p => ({ nameKey: p.nameKey, name: p.name, count: 0, category: p.category, product: p, unit: p.unit }))
    ];
    return all
      .filter(s => !q || s.nameKey.includes(q))
      .sort((a, b) => (b.product?.favorite || 0) - (a.product?.favorite || 0) || b.count - a.count || a.name.localeCompare(b.name));
  }, [history, products, q]);

  async function addToList(name, quantity, unit) {
    const res = await itemActions.add({ name, quantity, unit });
    haptic('light');
    showToast(res.merged ? `${res.item.name}: quantità aggiornata` : `${res.item.name} aggiunto alla lista`);
  }

  if (!history) return <div className="view-loading"><div className="spinner" /></div>;

  return (
    <>
      <TopBar
        title="Storico"
        subtitle={`${history.length} ${history.length === 1 ? 'acquisto registrato' : 'acquisti registrati'}`}
        actions={
          <button className="icon-btn" onClick={() => { setSearching(s => !s); setQuery(''); }} aria-label="Cerca">
            {searching ? <X size={21} /> : <Search size={21} />}
          </button>
        }
      >
        {searching && (
          <div className="search-bar">
            <Search size={18} />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Cerca prodotto o negozio…" />
          </div>
        )}
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: 'timeline', label: 'Cronologia', icon: <CalendarDays size={16} /> },
            { value: 'products', label: 'Prodotti', icon: <Package size={16} /> }
          ]}
        />
      </TopBar>

      <main className="content">
        {mode === 'timeline' && (
          dayGroups.length === 0 ? (
            <EmptyState
              icon={<History size={32} />}
              title={q ? 'Nessun risultato' : 'Nessun acquisto registrato'}
              text={q ? 'Prova con un altro nome.' : 'Quando spunti un articolo dalla lista, finisce qui.'}
            />
          ) : (
            <>
              {dayGroups.slice(0, days).map(g => (
                <section key={g.key} className="day-card">
                  <header className="day-header">
                    <div>
                      <h3>{dayLabel(g.date)}</h3>
                      <span>
                        {g.count} {g.count === 1 ? 'articolo' : 'articoli'}
                        {g.stores.size ? ` · ${Array.from(g.stores).join(', ')}` : ''}
                      </span>
                    </div>
                    {settings.showPrices && g.total > 0 && <strong className="day-total">{formatPrice(g.total)}</strong>}
                  </header>
                  <ul className="history-rows">
                    {Array.from(g.entries.values()).map(e => {
                      const cat = getCategory(e.category);
                      return (
                        <li key={e.id}>
                          <button className="history-row" onClick={() => setEntry(e)}>
                            <span className="cat-dot sm" style={{ '--cat-color': cat.color }}>{cat.emoji}</span>
                            <span className="history-name">
                              {e.itemName}
                              {e.times > 1 && <span className="times">×{e.times}</span>}
                            </span>
                            <span className="history-qty">{formatQuantity(e.totalQty, e.unit)}</span>
                            {settings.showPrices && e.totalPrice != null && <span className="history-price">{formatPrice(e.totalPrice)}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
              {dayGroups.length > days && (
                <button className="btn btn-secondary wide" onClick={() => setDays(d => d + DAYS_PAGE)}>
                  Mostra giorni precedenti
                </button>
              )}
            </>
          )
        )}

        {mode === 'products' && (
          stats.length === 0 ? (
            <EmptyState icon={<Package size={32} />} title={q ? 'Nessun risultato' : 'Nessun prodotto'} text="Il catalogo si riempie man mano che usi la lista." />
          ) : (
            <ul className="product-rows">
              {stats.map(s => {
                const cat = getCategory(s.product?.category || s.category);
                return (
                  <li key={s.nameKey} className="product-row">
                    <button className="product-main" onClick={() => setProduct(s)}>
                      <span className="cat-dot" style={{ '--cat-color': cat.color }}>{cat.emoji}</span>
                      <span className="product-text">
                        <strong>
                          {s.product?.name || s.name}
                          {s.product?.favorite ? <Star size={13} className="star" /> : null}
                        </strong>
                        <small>
                          {s.count ? `${s.count} ${s.count === 1 ? 'acquisto' : 'acquisti'}` : 'mai acquistato'}
                          {s.avgInterval ? ` · ${describeInterval(s.avgInterval)}` : ''}
                          {s.last ? ` · ${describeDaysAgo((Date.now() - s.last) / 86400000)}` : ''}
                        </small>
                      </span>
                    </button>
                    <button className="icon-btn tonal" onClick={() => addToList(s.product?.name || s.name, s.lastQuantity, s.unit)} aria-label={`Aggiungi ${s.name}`}>
                      <Plus size={20} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )
        )}
      </main>

      <Sheet open={Boolean(entry)} onClose={() => setEntry(null)} title={entry?.itemName} subtitle={entry ? dayLabel(entry.purchasedAt) : ''}>
        {entry && (
          <>
            <dl className="details">
              <div><dt>Quantità</dt><dd>{formatQuantity(entry.totalQty, entry.unit)}</dd></div>
              <div><dt>Reparto</dt><dd>{getCategory(entry.category).emoji} {getCategory(entry.category).name}</dd></div>
              {entry.storeName && <div><dt>Negozio</dt><dd>{entry.storeName}</dd></div>}
              {entry.totalPrice != null && <div><dt>Prezzo</dt><dd>{formatPrice(entry.totalPrice)}</dd></div>}
              <div><dt>Ora</dt><dd>{timeFormat.format(new Date(entry.purchasedAt))}{entry.times > 1 ? ` (+${entry.times - 1})` : ''}</dd></div>
            </dl>
            <div className="stack-actions">
              <button className="btn btn-primary" onClick={() => { addToList(entry.itemName, entry.quantity, entry.unit); setEntry(null); }}>
                <Plus size={18} /> Aggiungi di nuovo alla lista
              </button>
              <button
                className="btn btn-ghost danger"
                onClick={async () => {
                  const removed = await db.history.bulkGet(entry.ids);
                  await Promise.all(entry.ids.map(id => historyActions.delete(id)));
                  setEntry(null);
                  showToast('Voce eliminata dallo storico', {
                    action: { label: 'Annulla', onClick: () => db.history.bulkPut(removed.filter(Boolean)) }
                  });
                }}
              >
                <Trash2 size={18} /> Elimina dallo storico
              </button>
            </div>
          </>
        )}
      </Sheet>

      <ProductSheet product={product} onClose={() => setProduct(null)} onAdd={addToList} showPrices={settings.showPrices} />
    </>
  );
}

function ProductSheet({ product, onClose, onAdd, showPrices }) {
  const { showToast, confirm } = useUI();
  const live = useLiveQuery(() => (product ? db.products.where('nameKey').equals(product.nameKey).first() : null), [product?.nameKey]);
  const p = live || product?.product;
  const name = p?.name || product?.name;

  return (
    <Sheet open={Boolean(product)} onClose={onClose} title={name} subtitle={product?.count ? `${product.count} acquisti` : 'Nel catalogo'} size="tall">
      {product && (
        <>
          <dl className="details">
            {product.avgInterval ? <div><dt>Frequenza</dt><dd>{describeInterval(product.avgInterval)}</dd></div> : null}
            {product.last ? <div><dt>Ultimo acquisto</dt><dd>{describeDaysAgo((Date.now() - product.last) / 86400000)}</dd></div> : null}
            {p?.lastQuantity ? <div><dt>Quantità abituale</dt><dd>{formatQuantity(p.lastQuantity, p.unit)}</dd></div> : null}
            {showPrices && p?.lastPrice != null ? <div><dt>Ultimo prezzo</dt><dd>{formatPrice(p.lastPrice)}</dd></div> : null}
            {showPrices && product.totalSpent > 0 ? <div><dt>Speso in totale</dt><dd>{formatPrice(product.totalSpent)}</dd></div> : null}
          </dl>

          <h3 className="section-title">Reparto</h3>
          <div className="category-grid compact">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                className={`category-chip ${(p?.category || product.category) === c.id ? 'active' : ''}`}
                style={{ '--cat-color': c.color }}
                onClick={async () => {
                  const prod = await productActions.ensure({ name, category: c.id });
                  await db.products.update(prod.id, { category: c.id });
                  showToast(`Reparto aggiornato: ${c.name}`);
                }}
              >
                <span>{c.emoji}</span>{c.name}
              </button>
            ))}
          </div>

          <div className="stack-actions">
            <button className="btn btn-primary" onClick={() => { onAdd(name, p?.lastQuantity, p?.unit); onClose(); }}>
              <Plus size={18} /> Aggiungi alla lista
            </button>
            <button className="btn btn-secondary" onClick={() => productActions.toggleFavorite(name)}>
              <Star size={18} /> {p?.favorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
            </button>
            {p?.id && (
              <button
                className="btn btn-ghost danger"
                onClick={async () => {
                  const ok = await confirm({
                    title: `Dimenticare “${name}”?`,
                    message: 'Il prodotto non verrà più proposto nei completamenti. Lo storico degli acquisti resta.',
                    confirmLabel: 'Rimuovi',
                    danger: true
                  });
                  if (!ok) return;
                  await productActions.delete(p.id);
                  onClose();
                  showToast('Prodotto rimosso dal catalogo');
                }}
              >
                <Trash2 size={18} /> Rimuovi dal catalogo
              </button>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
