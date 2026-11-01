import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Star, Trash2 } from 'lucide-react';
import { Sheet } from './ui';
import { CATEGORIES, guessCategory, normalize } from '../lib/categories';
import { UNITS, stepDown, stepUp, canStepDown, estimatePrice } from '../lib/units';
import db from '../db';

const emptyForm = { name: '', quantity: 1, unit: 'pz', category: '', note: '', price: '' };

/** Foglio di creazione/modifica di un articolo */
export default function ItemEditor({ open, item, initial, focus, showPrices, onClose, onSave, onDelete, onToggleFavorite }) {
  const [form, setForm] = useState(emptyForm);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const qtyRef = useRef(null);
  const isEdit = Boolean(item);

  useEffect(() => {
    if (!open) return;
    const source = item || initial || {};
    setForm({
      name: source.name || '',
      quantity: source.quantity || 1,
      unit: source.unit || 'pz',
      category: source.category || (source.name ? guessCategory(source.name) : ''),
      note: source.note || '',
      price: source.price != null ? String(source.price).replace('.', ',') : ''
    });
    setCategoryTouched(Boolean(item));
    const key = normalize(source.name);
    if (key) {
      db.products.where('nameKey').equals(key).first().then(p => {
        setFavorite(Boolean(p?.favorite));
        // Per un nuovo articolo usa ciò che il catalogo ricorda
        if (!item && p) {
          setForm(f => ({
            ...f,
            unit: source.unit || p.unit || f.unit,
            quantity: source.quantity || p.lastQuantity || f.quantity,
            category: p.category || f.category
          }));
          setCategoryTouched(true);
        }
      });
    } else setFavorite(false);
    if (focus === 'quantity') setTimeout(() => qtyRef.current?.select(), 250);
  }, [open, item, initial, focus]);

  const set = (patch) => setForm(f => ({ ...f, ...patch }));

  const onNameChange = (name) => {
    set({ name, ...(categoryTouched ? {} : { category: guessCategory(name) }) });
  };

  const parsedPrice = form.price === '' ? null : Number(String(form.price).replace(',', '.'));
  const priceInvalid = form.price !== '' && (!Number.isFinite(parsedPrice) || parsedPrice < 0);

  async function suggestPrice() {
    const p = await db.products.where('nameKey').equals(normalize(form.name)).first();
    const est = estimatePrice(p, form.quantity, form.unit);
    if (est != null) set({ price: String(est).replace('.', ',') });
  }

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!form.name.trim() || priceInvalid) return;
    onSave({
      name: form.name.trim(),
      quantity: Number(form.quantity) > 0 ? Number(form.quantity) : 1,
      unit: form.unit,
      category: form.category || guessCategory(form.name),
      note: form.note.trim(),
      price: parsedPrice
    });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Modifica articolo' : 'Nuovo articolo'}
      size="tall"
      footer={
        <div className="footer-row">
          {isEdit && (
            <button type="button" className="btn btn-ghost danger" onClick={() => onDelete(item)}>
              <Trash2 size={18} /> Elimina
            </button>
          )}
          <button type="submit" form="item-form" className="btn btn-primary grow" disabled={!form.name.trim() || priceInvalid}>
            {isEdit ? 'Salva' : 'Aggiungi alla lista'}
          </button>
        </div>
      }
    >
      <form id="item-form" className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="item-name">Prodotto</label>
          <div className="input-with-action">
            <input
              id="item-name"
              className="input input-lg"
              value={form.name}
              onChange={e => onNameChange(e.target.value)}
              placeholder="Es. Mozzarella"
              autoFocus={!isEdit && !form.name}
              autoCapitalize="sentences"
              autoComplete="off"
            />
            <button
              type="button"
              className={`icon-btn fav ${favorite ? 'on' : ''}`}
              onClick={async () => {
                if (!form.name.trim()) return;
                setFavorite(await onToggleFavorite(form.name.trim()));
              }}
              aria-label={favorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
              aria-pressed={favorite}
            >
              <Star size={22} />
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="item-qty">Quantità</label>
          <div className="qty-editor">
            <div className="stepper stepper-lg">
              <button type="button" onClick={() => set({ quantity: stepDown(form.quantity, form.unit) })}
                disabled={!canStepDown(form.quantity, form.unit)} aria-label="Diminuisci">
                <Minus size={18} />
              </button>
              <input
                id="item-qty"
                ref={qtyRef}
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                value={form.quantity}
                onChange={e => set({ quantity: e.target.value === '' ? '' : Number(e.target.value) })}
                onFocus={e => e.target.select()}
              />
              <button type="button" onClick={() => set({ quantity: stepUp(form.quantity, form.unit) })} aria-label="Aumenta">
                <Plus size={18} />
              </button>
            </div>
            <div className="unit-picker" role="radiogroup" aria-label="Unità">
              {UNITS.map(u => (
                <button
                  key={u.id}
                  type="button"
                  role="radio"
                  aria-checked={form.unit === u.id}
                  className={form.unit === u.id ? 'active' : ''}
                  onClick={() => set({ unit: u.id, quantity: u.id === form.unit ? form.quantity : u.def })}
                >
                  {u.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="field">
          <label>Reparto</label>
          <div className="category-grid">
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                type="button"
                className={`category-chip ${form.category === c.id ? 'active' : ''}`}
                style={{ '--cat-color': c.color }}
                onClick={() => { set({ category: c.id }); setCategoryTouched(true); }}
              >
                <span>{c.emoji}</span>
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="field-row">
          {showPrices && (
            <div className="field">
              <label htmlFor="item-price">Prezzo totale</label>
              <div className={`input-affix ${priceInvalid ? 'invalid' : ''}`}>
                <span>€</span>
                <input
                  id="item-price"
                  className="input"
                  inputMode="decimal"
                  value={form.price}
                  onChange={e => set({ price: e.target.value.replace(/[^0-9.,]/g, '') })}
                  placeholder="0,00"
                />
                {!form.price && form.name && (
                  <button type="button" className="link-btn" onClick={suggestPrice}>stima</button>
                )}
              </div>
            </div>
          )}
          <div className="field grow">
            <label htmlFor="item-note">Nota</label>
            <input
              id="item-note"
              className="input"
              value={form.note}
              onChange={e => set({ note: e.target.value })}
              placeholder="Es. senza lattosio"
            />
          </div>
        </div>
      </form>
    </Sheet>
  );
}
