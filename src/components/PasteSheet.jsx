import { useEffect, useMemo, useState } from 'react';
import { ClipboardPaste, ListPlus } from 'lucide-react';
import { Sheet } from './ui';
import { parseMultiline } from '../lib/parse';
import { formatQuantity } from '../lib/units';
import { readClipboard } from '../lib/native';

/** Importa una lista scritta a mano o ricevuta in chat */
export default function PasteSheet({ open, onClose, onConfirm }) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (open) setText('');
  }, [open]);

  const parsed = useMemo(() => parseMultiline(text), [text]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Incolla una lista"
      subtitle="Un prodotto per riga, anche con quantità: “2 kg mele”"
      size="tall"
      footer={
        <div className="footer-row">
          <button className="btn btn-ghost" onClick={async () => setText(await readClipboard())}>
            <ClipboardPaste size={18} /> Incolla
          </button>
          <button className="btn btn-primary grow" disabled={!parsed.length} onClick={() => onConfirm(parsed)}>
            <ListPlus size={18} /> Aggiungi {parsed.length || ''} {parsed.length === 1 ? 'articolo' : 'articoli'}
          </button>
        </div>
      }
    >
      <textarea
        className="input textarea"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={'Latte\n2 kg mele\nPasta x3\nDetersivo piatti'}
        rows={7}
        autoFocus
      />
      {parsed.length > 0 && (
        <div className="paste-preview">
          {parsed.map((p, i) => (
            <span key={i} className="chip static">
              {p.name}
              {p.quantity ? <small>{formatQuantity(p.quantity, p.unit || 'pz')}</small> : null}
            </span>
          ))}
        </div>
      )}
    </Sheet>
  );
}
