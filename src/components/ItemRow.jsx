import { memo, useRef, useState } from 'react';
import { Check, Minus, Plus, Trash2, Undo2 } from 'lucide-react';
import { formatNumber, formatPrice, getUnit, canStepDown } from '../lib/units';

const THRESHOLD = 0.32;

/**
 * Riga della lista con gesti:
 *  - scorri a destra → preso / rimetti in lista
 *  - scorri a sinistra → elimina
 */
function ItemRow({ item, onToggle, onDelete, onEdit, onStep, showPrice, categoryColor }) {
  const [offset, setOffset] = useState(0);
  const [leaving, setLeaving] = useState(null);
  const gesture = useRef(null);
  const rowRef = useRef(null);
  const suppressClick = useRef(false);

  const completed = Boolean(item.completed);
  const unit = getUnit(item.unit);

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('button')) return; // i pulsanti hanno il loro tocco
    gesture.current = { x: e.clientX, y: e.clientY, mode: null, id: e.pointerId };
  };

  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.mode) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        g.mode = 'swipe';
        rowRef.current?.setPointerCapture?.(g.id);
      } else if (Math.abs(dy) > 10) {
        gesture.current = null;
        return;
      } else return;
    }
    const width = rowRef.current?.offsetWidth || 320;
    // resistenza oltre la soglia
    const limit = width * 0.6;
    const value = Math.abs(dx) > limit ? Math.sign(dx) * (limit + (Math.abs(dx) - limit) * 0.25) : dx;
    setOffset(value);
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g || g.mode !== 'swipe') return;
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 50);
    const width = rowRef.current?.offsetWidth || 320;
    if (offset > width * THRESHOLD) {
      setLeaving('right');
      setOffset(width);
      setTimeout(() => {
        onToggle(item);
        setOffset(0);
        setLeaving(null);
      }, 180);
    } else if (offset < -width * THRESHOLD) {
      setLeaving('left');
      setOffset(-width);
      setTimeout(() => onDelete(item), 180);
    } else {
      setOffset(0);
    }
  };

  const handleEdit = () => {
    if (suppressClick.current) return;
    onEdit(item);
  };

  const meta = [];
  if (item.note) meta.push(item.note);
  const priceText = showPrice && item.price != null && item.price !== '' ? formatPrice(item.price) : '';

  const direction = offset > 0 ? 'right' : offset < 0 ? 'left' : '';
  const armed = Math.abs(offset) > (rowRef.current?.offsetWidth || 320) * THRESHOLD;

  return (
    <li
      ref={rowRef}
      className={`swipe-row ${leaving ? `leaving-${leaving}` : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className={`swipe-bg swipe-bg-${direction} ${armed ? 'armed' : ''}`} aria-hidden="true">
        {direction === 'right' && (
          <span className="swipe-label">
            {completed ? <Undo2 size={20} /> : <Check size={20} />}
            {completed ? 'Rimetti' : 'Preso'}
          </span>
        )}
        {direction === 'left' && (
          <span className="swipe-label">
            Elimina
            <Trash2 size={20} />
          </span>
        )}
      </div>

      <div
        className={`item ${completed ? 'is-done' : ''}`}
        style={{
          transform: offset ? `translateX(${offset}px)` : undefined,
          transition: gesture.current?.mode === 'swipe' ? 'none' : undefined,
          '--cat-color': categoryColor
        }}
      >
        <button
          className={`check ${completed ? 'checked' : ''}`}
          onClick={() => onToggle(item)}
          aria-label={completed ? `Rimetti ${item.name} in lista` : `Segna ${item.name} come preso`}
        >
          <Check size={16} strokeWidth={3} />
        </button>

        <div className="item-main" onClick={handleEdit} role="button" tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter') onEdit(item); }}>
          <span className="item-name">{item.name}</span>
          {(meta.length > 0 || priceText || completed) && (
            <span className="item-meta">
              {completed && <span>{formatNumber(item.quantity)} {unit.label}</span>}
              {meta.map((m, i) => <span key={i}>{m}</span>)}
              {priceText && <span className="item-price">{priceText}</span>}
            </span>
          )}
        </div>

        {!completed && (
          <div className="stepper" aria-label="Quantità">
            <button
              onClick={() => onStep(item, -1)}
              disabled={!canStepDown(item.quantity, item.unit)}
              aria-label="Diminuisci"
            >
              <Minus size={15} strokeWidth={2.5} />
            </button>
            <button className="stepper-value" onClick={() => onEdit(item, 'quantity')} aria-label="Modifica quantità">
              <strong>{formatNumber(item.quantity)}</strong>
              <small>{unit.label}</small>
            </button>
            <button onClick={() => onStep(item, 1)} aria-label="Aumenta">
              <Plus size={15} strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>
    </li>
  );
}

export default memo(ItemRow);
