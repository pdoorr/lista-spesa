import { useEffect, useMemo, useState } from 'react';
import { Check, History, Minus, Plus, Sparkles } from 'lucide-react';
import { Sheet, EmptyState } from './ui';
import { getCategory } from '../lib/categories';
import { buildGeneratedList, describeDaysAgo, describeInterval } from '../lib/predict';
import { formatNumber, getUnit, stepDown, stepUp, canStepDown } from '../lib/units';

/** Proposta di lista basata sulla cadenza degli acquisti passati */
export default function GenerateSheet({ open, onClose, history, activeKeys, onConfirm }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (open) setRows(buildGeneratedList(history, { exclude: activeKeys }));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = useMemo(() => rows.filter(r => r.selected), [rows]);
  const due = rows.filter(r => r.ratio !== null && r.ratio >= 0.8).length;

  const update = (key, patch) => setRows(rs => rs.map(r => (r.nameKey === key ? { ...r, ...patch } : r)));
  const setAll = (value) => setRows(rs => rs.map(r => ({ ...r, selected: value })));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Genera dallo storico"
      subtitle={rows.length ? `${due} prodotti probabilmente da ricomprare` : undefined}
      size="tall"
      footer={rows.length > 0 && (
        <div className="footer-row">
          <button className="btn btn-ghost" onClick={() => setAll(selected.length !== rows.length)}>
            {selected.length === rows.length ? 'Nessuno' : 'Tutti'}
          </button>
          <button className="btn btn-primary grow" disabled={!selected.length} onClick={() => onConfirm(selected)}>
            <Sparkles size={18} /> Aggiungi {selected.length || ''} {selected.length === 1 ? 'prodotto' : 'prodotti'}
          </button>
        </div>
      )}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={<History size={30} />}
          title="Nessun suggerimento"
          text="Quando segni gli articoli come presi, l’app impara ogni quanto li compri e te li propone qui."
        />
      ) : (
        <ul className="pick-list">
          {rows.map(r => {
            const cat = getCategory(r.category);
            const urgent = r.ratio !== null && r.ratio >= 1;
            return (
              <li key={r.nameKey} className={`pick-row ${r.selected ? 'selected' : ''}`}>
                <button className="pick-toggle" onClick={() => update(r.nameKey, { selected: !r.selected })}>
                  <span className={`check ${r.selected ? 'checked' : ''}`}><Check size={14} strokeWidth={3} /></span>
                  <span className="cat-dot sm" style={{ '--cat-color': cat.color }}>{cat.emoji}</span>
                  <span className="pick-text">
                    <strong>{r.name}</strong>
                    <small>
                      {r.avgInterval ? `${describeInterval(r.avgInterval)} · ` : `${r.count} ${r.count === 1 ? 'acquisto' : 'acquisti'} · `}
                      <span className={urgent ? 'text-warn' : ''}>ultimo {describeDaysAgo(r.daysSince)}</span>
                    </small>
                  </span>
                </button>
                <div className="stepper stepper-sm">
                  <button onClick={() => update(r.nameKey, { quantity: stepDown(r.quantity, r.unit), selected: true })}
                    disabled={!canStepDown(r.quantity, r.unit)} aria-label="Diminuisci">
                    <Minus size={13} />
                  </button>
                  <span className="stepper-value"><strong>{formatNumber(r.quantity)}</strong><small>{getUnit(r.unit).label}</small></span>
                  <button onClick={() => update(r.nameKey, { quantity: stepUp(r.quantity, r.unit), selected: true })} aria-label="Aumenta">
                    <Plus size={13} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
