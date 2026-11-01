import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Check, ChevronRight, GripVertical, MapPin, Plus, RotateCcw, Store, Trash2, Wand2 } from 'lucide-react';
import { Sheet, useUI } from './ui';
import db, { storeActions } from '../db';
import { getCategory } from '../lib/categories';
import { getCategoryOrder } from '../lib/order';
import { haptic } from '../lib/native';

const EMPTY = [];

export default function StoreSheet({ open, onClose, stores, selectedId, onSelect }) {
  const { showToast } = useUI();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null);

  async function add(e) {
    e.preventDefault();
    try {
      const id = await storeActions.add(newName);
      setNewName('');
      showToast('Supermercato aggiunto');
      onSelect(id);
    } catch (err) {
      showToast(err.message);
    }
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Dove fai la spesa?" subtitle="La lista seguirà il percorso del negozio">
        <div className="store-list">
          <button className={`store-row ${selectedId == null ? 'active' : ''}`} onClick={() => onSelect(null)}>
            <span className="store-avatar muted"><MapPin size={18} /></span>
            <span className="store-name">Nessun negozio</span>
            {selectedId == null && <Check size={20} className="store-check" />}
          </button>
          {stores.map(s => (
            <div key={s.id} className={`store-row ${selectedId === s.id ? 'active' : ''}`}>
              <button className="store-select" onClick={() => onSelect(s.id)}>
                <span className="store-avatar">{s.name.slice(0, 1).toUpperCase()}</span>
                <span className="store-name">{s.name}</span>
                {selectedId === s.id && <Check size={20} className="store-check" />}
              </button>
              <button className="icon-btn" onClick={() => setEditing(s)} aria-label={`Impostazioni ${s.name}`}>
                <ChevronRight size={20} />
              </button>
            </div>
          ))}
        </div>
        <form className="inline-add" onSubmit={add}>
          <Store size={18} />
          <input
            className="input"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nuovo supermercato…"
            autoCapitalize="words"
          />
          <button className="btn btn-primary btn-sm" disabled={!newName.trim()} aria-label="Aggiungi supermercato">
            <Plus size={18} />
          </button>
        </form>
      </Sheet>

      <StoreSettings store={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function StoreSettings({ store, onClose }) {
  const { showToast, confirm } = useUI();
  const live = useLiveQuery(() => (store ? db.supermarkets.get(store.id) : null), [store?.id]);
  const ranks = useLiveQuery(() => (store ? db.storeRanks.where('storeId').equals(store.id).toArray() : []), [store?.id]) ?? EMPTY;
  const products = useLiveQuery(() => db.products.toArray(), []) ?? EMPTY;
  const [name, setName] = useState('');
  const current = live || store;

  const { order, learned, custom } = useMemo(() => {
    const rankMap = new Map(ranks.map(r => [r.nameKey, r.rank]));
    const productMap = new Map(products.map(p => [p.nameKey, p]));
    return getCategoryOrder(current, rankMap, productMap);
  }, [current, ranks, products]);

  if (!store) return <Sheet open={false} onClose={onClose} />;

  const onDragEnd = async (result) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const next = [...order];
    const [moved] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, moved);
    haptic('light');
    await storeActions.setCategoryOrder(store.id, next);
  };

  const renderRow = (id, provided, snapshot) => {
    const cat = getCategory(id);
    return (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        className={`order-row ${snapshot.isDragging ? 'dragging' : ''}`}
        style={provided.draggableProps.style}
      >
        <span className="cat-dot" style={{ '--cat-color': cat.color }}>{cat.emoji}</span>
        <span>{cat.name}</span>
        <GripVertical size={18} className="grip" />
      </div>
    );
  };

  return (
    <Sheet open={Boolean(store)} onClose={onClose} title={current?.name} subtitle="Impostazioni del negozio" size="tall">
      <form
        className="inline-add"
        onSubmit={async e => {
          e.preventDefault();
          if (!name.trim()) return;
          await storeActions.rename(store.id, name);
          setName('');
          showToast('Nome aggiornato');
        }}
      >
        <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Rinomina…" />
        <button className="btn btn-secondary btn-sm" disabled={!name.trim()}>Salva</button>
      </form>

      <div className="section-title-row">
        <h3 className="section-title">Ordine dei reparti</h3>
        <span className={`pill ${custom ? '' : 'pill-muted'}`}>
          {custom ? 'Personalizzato' : learned ? 'Appreso' : 'Predefinito'}
        </span>
      </div>
      <p className="hint">
        Tieni premuto e trascina i reparti nell’ordine in cui li incontri. Se non lo imposti, l’app impara
        il percorso dall’ordine in cui spunti gli articoli in questo negozio.
      </p>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable
          droppableId="categories"
          renderClone={(provided, snapshot, rubric) => renderRow(order[rubric.source.index], provided, snapshot)}
        >
          {(provided) => (
            <div className="order-list" ref={provided.innerRef} {...provided.droppableProps}>
              {order.map((id, index) => (
                <Draggable key={id} draggableId={id} index={index}>
                  {(p, s) => renderRow(id, p, s)}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      <div className="stack-actions">
        {custom && (
          <button className="btn btn-secondary" onClick={() => storeActions.setCategoryOrder(store.id, null)}>
            <Wand2 size={18} /> Torna all’ordine automatico
          </button>
        )}
        {ranks.length > 0 && (
          <button
            className="btn btn-ghost"
            onClick={async () => {
              await storeActions.resetLearning(store.id);
              showToast('Percorso appreso azzerato');
            }}
          >
            <RotateCcw size={18} /> Azzera percorso appreso ({ranks.length} prodotti)
          </button>
        )}
        <button
          className="btn btn-ghost danger"
          onClick={async () => {
            const ok = await confirm({
              title: `Eliminare ${current.name}?`,
              message: 'Verranno rimossi anche l’ordine dei reparti e il percorso appreso. Lo storico resta invariato.',
              confirmLabel: 'Elimina',
              danger: true,
              icon: <Trash2 size={26} />
            });
            if (!ok) return;
            await storeActions.delete(store.id);
            onClose();
            showToast('Supermercato eliminato');
          }}
        >
          <Trash2 size={18} /> Elimina supermercato
        </button>
      </div>
    </Sheet>
  );
}
