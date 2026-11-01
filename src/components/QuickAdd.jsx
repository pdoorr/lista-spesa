import { useMemo, useRef, useState } from 'react';
import { Plus, SlidersHorizontal, Star, CornerDownLeft } from 'lucide-react';
import { parseItemInput } from '../lib/parse';
import { normalize, getCategory, guessCategory } from '../lib/categories';
import { formatQuantity } from '../lib/units';

/**
 * Barra di inserimento rapido con interpretazione del testo
 * ("2 kg mele") e completamento dal catalogo prodotti.
 */
export default function QuickAdd({ products, activeKeys, onAdd, onOpenDetails }) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const parsed = useMemo(() => parseItemInput(text), [text]);
  const key = normalize(parsed.name);

  const matches = useMemo(() => {
    if (!key) return [];
    return products
      .map(p => {
        const idx = p.nameKey.indexOf(key);
        if (idx === -1) return null;
        return { p, score: (idx === 0 ? 1000 : 0) + (p.favorite ? 200 : 0) + Math.min(p.count || 0, 150) };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(x => x.p);
  }, [products, key]);

  const quickPicks = useMemo(() => {
    return products
      .filter(p => !activeKeys.has(p.nameKey) && (p.favorite || p.count > 0))
      .sort((a, b) => (b.favorite || 0) - (a.favorite || 0) || (b.count || 0) - (a.count || 0))
      .slice(0, 12);
  }, [products, activeKeys]);

  const exact = matches.find(p => p.nameKey === key);
  const previewCategory = getCategory(exact?.category || guessCategory(parsed.name));

  async function submit(entry) {
    if (!entry.name) return;
    await onAdd(entry);
    setText('');
    inputRef.current?.focus();
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    submit(parsed);
  };

  const keepFocus = (e) => e.preventDefault();
  const showPanel = focused && (key ? matches.length > 0 || parsed.quantity : quickPicks.length > 0);

  return (
    <div className={`quick-add ${focused ? 'is-focused' : ''}`}>
      <form onSubmit={handleSubmit} className="quick-add-bar">
        <Plus size={22} className="quick-add-icon" />
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="Aggiungi… es. 2 kg mele"
          enterKeyHint="done"
          autoComplete="off"
          autoCapitalize="sentences"
          aria-label="Aggiungi prodotto"
        />
        {text ? (
          <button type="submit" className="quick-add-go" onMouseDown={keepFocus} aria-label="Aggiungi">
            <CornerDownLeft size={20} />
          </button>
        ) : null}
        <button
          type="button"
          className="quick-add-more"
          onMouseDown={keepFocus}
          onClick={() => onOpenDetails(parsed)}
          aria-label="Aggiungi con dettagli"
        >
          <SlidersHorizontal size={20} />
        </button>
      </form>

      {showPanel && (
        <div className="quick-panel" onMouseDown={keepFocus} onPointerDown={keepFocus}>
          {key && parsed.name && (exact || !matches.length) && (
            <button className={`quick-preview ${!exact && matches.length ? 'secondary' : ''}`} onClick={() => submit(parsed)}>
              <span className="cat-dot" style={{ '--cat-color': previewCategory.color }}>{previewCategory.emoji}</span>
              <span className="quick-preview-text">
                <strong>{parsed.name}</strong>
                <small>
                  {parsed.quantity ? formatQuantity(parsed.quantity, parsed.unit || exact?.unit || 'pz') + ' · ' : ''}
                  {previewCategory.name}
                </small>
              </span>
              <span className="pill">Aggiungi</span>
            </button>
          )}

          {key && matches.filter(p => p.nameKey !== key).map(p => {
            const cat = getCategory(p.category);
            const inList = activeKeys.has(p.nameKey);
            return (
              <button
                key={p.id}
                className="quick-match"
                onClick={() => submit({ ...parsed, name: p.name })}
              >
                <span className="cat-dot" style={{ '--cat-color': cat.color }}>{cat.emoji}</span>
                <span className="quick-match-name">{p.name}</span>
                {p.favorite ? <Star size={14} className="star" /> : null}
                {inList && <span className="pill pill-muted">in lista</span>}
              </button>
            );
          })}

          {key && parsed.name && !exact && matches.length > 0 && (
            <button className={`quick-preview ${!exact && matches.length ? 'secondary' : ''}`} onClick={() => submit(parsed)}>
              <span className="cat-dot" style={{ '--cat-color': previewCategory.color }}>{previewCategory.emoji}</span>
              <span className="quick-preview-text">
                <strong>{parsed.name}</strong>
                <small>
                  {parsed.quantity ? formatQuantity(parsed.quantity, parsed.unit || exact?.unit || 'pz') + ' · ' : ''}
                  {previewCategory.name}
                </small>
              </span>
              <span className="pill">Aggiungi</span>
            </button>
          )}

          {!key && (
            <>
              <div className="quick-title">Preferiti e frequenti</div>
              <div className="chips">
                {quickPicks.map(p => (
                  <button key={p.id} className="chip" onClick={() => submit({ name: p.name })}>
                    {p.favorite ? <Star size={13} className="star" /> : <span>{getCategory(p.category).emoji}</span>}
                    {p.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
