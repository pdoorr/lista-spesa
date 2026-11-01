import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ChevronDown, ClipboardPaste, Eraser, MapPin, MoreVertical, PartyPopper, Plus, Share2,
  ShoppingBasket, Sparkles, Store, Trash2
} from 'lucide-react';
import db, { itemActions, productActions } from '../db';
import { TopBar, Menu, EmptyState, useUI } from '../components/ui';
import ItemRow from '../components/ItemRow';
import QuickAdd from '../components/QuickAdd';
import ItemEditor from '../components/ItemEditor';
import GenerateSheet from '../components/GenerateSheet';
import PasteSheet from '../components/PasteSheet';
import { getCategory } from '../lib/categories';
import { arrangeItems, getCategoryOrder } from '../lib/order';
import { getDueProducts } from '../lib/predict';
import { formatPrice, formatQuantity, stepDown, stepUp } from '../lib/units';
import { haptic, setKeepAwake, shareText } from '../lib/native';

const EMPTY = [];

export default function ListView({ settings, selectedStore, onOpenStores }) {
  const { showToast, confirm } = useUI();
  const items = useLiveQuery(() => db.items.toArray(), []);
  const products = useLiveQuery(() => db.products.toArray(), []) ?? EMPTY;
  const history = useLiveQuery(() => db.history.orderBy('purchasedAt').reverse().limit(3000).toArray(), []) ?? EMPTY;
  const ranksRaw = useLiveQuery(
    () => (selectedStore ? db.storeRanks.where('storeId').equals(selectedStore.id).toArray() : []),
    [selectedStore?.id]
  ) ?? EMPTY;

  const [editor, setEditor] = useState({ open: false, item: null, initial: null, focus: null });
  const [menuOpen, setMenuOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(true);

  const active = useMemo(() => (items || []).filter(i => !i.completed), [items]);
  const completed = useMemo(
    () => (items || []).filter(i => i.completed).sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || '')),
    [items]
  );
  const activeKeys = useMemo(() => new Set(active.map(i => i.nameKey)), [active]);
  const productMap = useMemo(() => new Map(products.map(p => [p.nameKey, p])), [products]);
  const ranks = useMemo(() => new Map(ranksRaw.map(r => [r.nameKey, r.rank])), [ranksRaw]);

  const { order: categoryOrder, learned } = useMemo(
    () => getCategoryOrder(selectedStore, ranks, productMap),
    [selectedStore, ranks, productMap]
  );
  const groups = useMemo(
    () => arrangeItems(active, { groupByCategory: settings.groupByCategory, categoryOrder, ranks }),
    [active, settings.groupByCategory, categoryOrder, ranks]
  );

  const due = useMemo(() => {
    if (!settings.smartSuggestions) return [];
    const exclude = new Set((items || []).map(i => i.nameKey));
    return getDueProducts(history, { exclude, limit: 8 });
  }, [history, items, settings.smartSuggestions]);

  const total = items?.length || 0;
  const progress = total ? completed.length / total : 0;
  const estimate = useMemo(() => {
    const all = items || [];
    const priced = all.filter(i => i.price != null && i.price !== '');
    return {
      total: priced.reduce((s, i) => s + Number(i.price), 0),
      cart: completed.filter(i => i.price != null && i.price !== '').reduce((s, i) => s + Number(i.price), 0),
      priced: priced.length
    };
  }, [items, completed]);

  // Schermo acceso mentre la spesa è in corso (almeno un articolo preso)
  const shopping = completed.length > 0 && active.length > 0;
  useEffect(() => {
    setKeepAwake(Boolean(settings.keepAwake && shopping));
    return () => { setKeepAwake(false); };
  }, [settings.keepAwake, shopping]);

  // ------------------------------------------------------------------ azioni

  const addItem = useCallback(async (entry) => {
    try {
      const res = await itemActions.add(entry);
      haptic('light');
      if (res.merged) showToast(`${res.item.name}: quantità aggiornata a ${formatQuantity(res.item.quantity, res.item.unit)}`);
    } catch (err) {
      showToast(err.message);
    }
  }, [showToast]);

  const toggle = useCallback(async (item) => {
    const next = !item.completed;
    haptic(next ? 'medium' : 'light');
    await itemActions.setCompleted(item.id, next, selectedStore);
    if (next) {
      const remaining = (items || []).filter(i => !i.completed && i.id !== item.id).length;
      if (remaining === 0) {
        haptic('success');
        showToast('Hai preso tutto! 🎉', { action: { label: 'Termina spesa', onClick: () => finish() } });
      }
    }
  }, [items, selectedStore, showToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = useCallback(async (item) => {
    const removed = await itemActions.remove(item.id);
    haptic('light');
    setEditor(e => ({ ...e, open: false }));
    if (removed) {
      showToast(`${removed.name} eliminato`, { action: { label: 'Annulla', onClick: () => itemActions.restore(removed) } });
    }
  }, [showToast]);

  const step = useCallback(async (item, dir) => {
    const quantity = dir > 0 ? stepUp(item.quantity, item.unit) : stepDown(item.quantity, item.unit);
    if (quantity === item.quantity) return;
    haptic('light');
    const changes = { quantity };
    // aggiorna la stima del prezzo in proporzione
    if (item.price != null && item.quantity > 0) changes.price = Math.round((item.price / item.quantity) * quantity * 100) / 100;
    await itemActions.update(item.id, changes);
  }, []);

  const openEditor = useCallback((item, focus = null) => {
    setEditor({ open: true, item, initial: null, focus });
  }, []);

  async function saveEditor(values) {
    if (editor.item) {
      await itemActions.update(editor.item.id, values);
    } else {
      await addItem(values);
    }
    setEditor(e => ({ ...e, open: false }));
  }

  async function finish() {
    const cart = await db.items.where('completed').equals(1).toArray();
    if (!cart.length) return;
    const cartTotal = cart.reduce((s, i) => s + (Number(i.price) || 0), 0);
    const left = await db.items.where('completed').equals(0).count();
    const ok = await confirm({
      title: 'Concludere la spesa?',
      message: `${cart.length} ${cart.length === 1 ? 'articolo preso' : 'articoli presi'}`
        + (cartTotal ? ` per ${formatPrice(cartTotal)}` : '')
        + (selectedStore ? ` da ${selectedStore.name}` : '')
        + '. ' + (left ? `${left === 1 ? 'L’articolo non preso resta' : `I ${left} articoli non presi restano`} in lista.` : 'La lista tornerà vuota.'),
      confirmLabel: 'Concludi',
      icon: <PartyPopper size={26} />
    });
    if (!ok) return;
    const trip = await itemActions.finishShopping(selectedStore);
    haptic('success');
    if (trip) showToast(`Spesa salvata nello storico${trip.total ? ` · ${formatPrice(trip.total)}` : ''}`);
  }

  async function share() {
    if (!active.length) {
      showToast('La lista è vuota');
      return;
    }
    const lines = [`🛒 Lista della spesa${selectedStore ? ` (${selectedStore.name})` : ''}`];
    const shareGroups = arrangeItems(active, { groupByCategory: true, categoryOrder, ranks });
    for (const g of shareGroups) {
      lines.push('', `*${g.category.emoji} ${g.category.name}*`);
      for (const i of g.items) {
        lines.push(`• ${i.name} – ${formatQuantity(i.quantity, i.unit)}${i.note ? ` (${i.note})` : ''}`);
      }
    }
    const result = await shareText('Lista della spesa', lines.join('\n'));
    if (result === 'copied') showToast('Lista copiata negli appunti');
  }

  async function clearList() {
    const ok = await confirm({
      title: 'Svuotare la lista?',
      message: `Verranno rimossi ${total} articoli. Gli acquisti già fatti restano nello storico.`,
      confirmLabel: 'Svuota',
      danger: true,
      icon: <Trash2 size={26} />
    });
    if (!ok) return;
    const removed = await itemActions.clearAll();
    showToast('Lista svuotata', { action: { label: 'Annulla', onClick: () => itemActions.restoreMany(removed) } });
  }

  async function addMany(list, message) {
    const res = await itemActions.addMany(list);
    haptic('success');
    showToast(message(res));
  }

  // ------------------------------------------------------------------ render

  if (!items) return <div className="view-loading"><div className="spinner" /></div>;

  const storeChip = (
    <button className={`store-chip ${selectedStore ? 'active' : ''}`} onClick={onOpenStores}>
      {selectedStore ? <Store size={15} /> : <MapPin size={15} />}
      <span>{selectedStore ? selectedStore.name : 'Scegli negozio'}</span>
      <ChevronDown size={15} />
    </button>
  );

  return (
    <>
      <TopBar
        title="Lista Spesa"
        subtitle={storeChip}
        actions={
          <>
            <button className="icon-btn" onClick={share} aria-label="Condividi lista"><Share2 size={21} /></button>
            <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="Altre azioni"><MoreVertical size={21} /></button>
          </>
        }
      >
        <QuickAdd
          products={products}
          activeKeys={activeKeys}
          onAdd={addItem}
          onOpenDetails={(parsed) => setEditor({ open: true, item: null, initial: { ...parsed, quantity: parsed.quantity || undefined }, focus: null })}
        />
      </TopBar>

      <main className="content">
        {total > 0 && (
          <section className="summary-card">
            <div className="summary-top">
              <div>
                <div className="summary-count">
                  <strong>{completed.length}</strong> di {total} {total === 1 ? 'articolo' : 'articoli'}
                </div>
                <div className="summary-sub">
                  {active.length === 0 ? 'Tutto preso!' : `${active.length} ancora da prendere`}
                  {selectedStore && learned ? ' · percorso appreso' : ''}
                </div>
              </div>
              {settings.showPrices && estimate.priced > 0 && (
                <div className="summary-money">
                  <strong>{formatPrice(shopping || active.length === 0 ? estimate.cart : estimate.total)}</strong>
                  <span>{shopping || active.length === 0 ? 'nel carrello' : `stima${estimate.priced < total ? ` (${estimate.priced}/${total})` : ''}`}</span>
                </div>
              )}
            </div>
            <div className="progress" aria-hidden="true"><span style={{ width: `${progress * 100}%` }} /></div>
          </section>
        )}

        {due.length > 0 && (
          <section className="due">
            <div className="section-title-row">
              <h3 className="section-title"><Sparkles size={15} /> Forse ti serve</h3>
              <button className="link-btn" onClick={() => setGenerateOpen(true)}>Vedi tutti</button>
            </div>
            <div className="chips scroll">
              {due.map(d => (
                <button key={d.nameKey} className="chip chip-suggest" onClick={() => addItem({ name: d.name, quantity: d.lastQuantity, unit: d.unit })}>
                  <span>{getCategory(d.category).emoji}</span>
                  {d.name}
                  <Plus size={14} />
                </button>
              ))}
            </div>
          </section>
        )}

        {total === 0 ? (
          <EmptyState
            icon={<ShoppingBasket size={34} />}
            title="La lista è vuota"
            text="Scrivi qui sopra cosa ti serve, anche con la quantità: “2 kg mele”, “latte x3”."
          >
            {history.length > 0 && (
              <button className="btn btn-primary" onClick={() => setGenerateOpen(true)}>
                <Sparkles size={18} /> Genera dallo storico
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setPasteOpen(true)}>
              <ClipboardPaste size={18} /> Incolla una lista
            </button>
          </EmptyState>
        ) : (
          <>
            {groups.map(group => (
              <section key={group.category?.id || 'all'} className="group">
                {group.category && (
                  <h3 className="group-title" style={{ '--cat-color': group.category.color }}>
                    <span className="group-emoji">{group.category.emoji}</span>
                    {group.category.name}
                    <span className="group-count">{group.items.length}</span>
                  </h3>
                )}
                <ul className="items">
                  {group.items.map(item => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      onToggle={toggle}
                      onDelete={remove}
                      onEdit={openEditor}
                      onStep={step}
                      showPrice={settings.showPrices}
                      categoryColor={getCategory(item.category).color}
                    />
                  ))}
                </ul>
              </section>
            ))}

            {completed.length > 0 && (
              <section className="group group-done">
                <div className="done-header">
                  <button className="group-title as-button" onClick={() => setShowCompleted(s => !s)} aria-expanded={showCompleted}>
                    <ChevronDown size={18} className={`chev ${showCompleted ? '' : 'closed'}`} />
                    Nel carrello
                    <span className="group-count">{completed.length}</span>
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={finish}>
                    <PartyPopper size={16} /> Termina spesa
                  </button>
                </div>
                {showCompleted && (
                  <ul className="items">
                    {completed.map(item => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onToggle={toggle}
                        onDelete={remove}
                        onEdit={openEditor}
                        onStep={step}
                        showPrice={settings.showPrices}
                        categoryColor={getCategory(item.category).color}
                      />
                    ))}
                  </ul>
                )}
              </section>
            )}
            <p className="gesture-hint">Scorri a destra per spuntare, a sinistra per eliminare</p>
          </>
        )}
      </main>

      <Menu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={[
          { label: 'Genera dallo storico', icon: <Sparkles size={19} />, onClick: () => setGenerateOpen(true) },
          { label: 'Incolla una lista', icon: <ClipboardPaste size={19} />, onClick: () => setPasteOpen(true) },
          { label: 'Aggiungi con dettagli', icon: <Plus size={19} />, onClick: () => setEditor({ open: true, item: null, initial: null, focus: null }) },
          { label: 'Cambia negozio', icon: <Store size={19} />, onClick: onOpenStores },
          'divider',
          { label: 'Termina spesa', icon: <PartyPopper size={19} />, onClick: finish, disabled: !completed.length },
          { label: 'Svuota lista', icon: <Eraser size={19} />, onClick: clearList, disabled: !total, danger: true }
        ]}
      />

      <ItemEditor
        open={editor.open}
        item={editor.item}
        initial={editor.initial}
        focus={editor.focus}
        showPrices={settings.showPrices}
        onClose={() => setEditor(e => ({ ...e, open: false }))}
        onSave={saveEditor}
        onDelete={remove}
        onToggleFavorite={productActions.toggleFavorite}
      />

      <GenerateSheet
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        history={history}
        activeKeys={activeKeys}
        onConfirm={async (rows) => {
          setGenerateOpen(false);
          await addMany(rows.map(r => ({ name: r.name, quantity: r.quantity, unit: r.unit, category: r.category })),
            ({ added }) => `${added} ${added === 1 ? 'prodotto aggiunto' : 'prodotti aggiunti'} alla lista`);
        }}
      />

      <PasteSheet
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        onConfirm={async (list) => {
          setPasteOpen(false);
          await addMany(list, ({ added, merged }) => `${added} aggiunti${merged ? `, ${merged} aggiornati` : ''}`);
        }}
      />
    </>
  );
}
