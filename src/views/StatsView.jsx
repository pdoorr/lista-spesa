import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart3, CalendarDays, ShoppingCart, Wallet, Receipt } from 'lucide-react';
import db from '../db';
import { TopBar, Segmented, EmptyState } from '../components/ui';
import { getCategory } from '../lib/categories';
import { formatNumber, formatPrice } from '../lib/units';

const EMPTY = [];

const monthShort = new Intl.DateTimeFormat('it-IT', { month: 'short' });
const monthLong = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });
const WEEKDAYS = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

function monthKey(d) {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export default function StatsView({ settings }) {
  const history = useLiveQuery(() => db.history.toArray(), []);
  const trips = useLiveQuery(() => db.trips.toArray(), []) ?? EMPTY;
  const [range, setRange] = useState(6);

  const data = useMemo(() => {
    if (!history) return null;
    const now = new Date();
    const thisMonth = monthKey(now);
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = monthKey(prev);
    const from = new Date(now.getFullYear(), now.getMonth() - range + 1, 1);

    const months = [];
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: monthKey(d), date: d, spent: 0, items: 0 });
    }
    const monthMap = new Map(months.map(m => [m.key, m]));

    const products = new Map();
    const categories = new Map();
    const weekdayDays = Array.from({ length: 7 }, () => new Set());
    let spentThis = 0;
    let spentPrev = 0;
    let itemsThis = 0;
    let priced = 0;

    for (const h of history) {
      const d = new Date(h.purchasedAt);
      const key = monthKey(d);
      const price = h.price != null ? Number(h.price) || 0 : 0;
      if (h.price != null) priced++;
      if (key === thisMonth) { spentThis += price; itemsThis++; }
      // confronto equo: stesso periodo del mese scorso (fino allo stesso giorno)
      if (key === prevMonth && d.getDate() <= now.getDate()) spentPrev += price;
      const m = monthMap.get(key);
      if (m) { m.spent += price; m.items += 1; }
      if (d >= from) {
        const p = products.get(h.nameKey) || { name: h.itemName, count: 0, spent: 0, category: h.category };
        p.count += 1;
        p.spent += price;
        products.set(h.nameKey, p);
        const c = categories.get(h.category || 'altro') || { count: 0, spent: 0 };
        c.count += 1;
        c.spent += price;
        categories.set(h.category || 'altro', c);
        weekdayDays[d.getDay()].add(d.toDateString());
      }
    }

    const tripsThis = trips.filter(t => monthKey(new Date(t.endedAt)) === thisMonth);
    const pricedTrips = trips.filter(t => t.total > 0);
    const avgTrip = pricedTrips.length ? pricedTrips.reduce((s, t) => s + t.total, 0) / pricedTrips.length : 0;
    const busiest = weekdayDays.map((s, i) => ({ i, n: s.size })).sort((a, b) => b.n - a.n)[0];
    const usePrices = settings.showPrices && priced > 0;

    return {
      months,
      usePrices,
      spentThis,
      spentPrev,
      itemsThis,
      tripsThis: tripsThis.length,
      avgTrip,
      busiest: busiest?.n ? WEEKDAYS[busiest.i] : null,
      topProducts: Array.from(products.values()).sort((a, b) => b.count - a.count).slice(0, 8),
      topCategories: Array.from(categories.entries())
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (usePrices ? b.spent - a.spent : b.count - a.count))
        .slice(0, 8)
    };
  }, [history, trips, range, settings.showPrices]);

  if (!data) return <div className="view-loading"><div className="spinner" /></div>;

  const empty = history.length === 0;
  const delta = data.spentPrev > 0 ? (data.spentThis - data.spentPrev) / data.spentPrev : null;

  return (
    <>
      <TopBar title="Statistiche" subtitle={monthLong.format(new Date())}>
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: 3, label: '3 mesi' },
            { value: 6, label: '6 mesi' },
            { value: 12, label: '12 mesi' }
          ]}
        />
      </TopBar>
      <main className="content">
        {empty ? (
          <EmptyState
            icon={<BarChart3 size={32} />}
            title="Ancora nessun dato"
            text="Le statistiche compaiono dopo i primi acquisti. Inserisci i prezzi per vedere quanto spendi."
          />
        ) : (
          <>
            <div className="kpis">
              {data.usePrices ? (
                <Kpi icon={<Wallet size={18} />} label="Speso questo mese" value={formatPrice(data.spentThis)}
                  note={delta !== null ? `${delta >= 0 ? '+' : '−'}${Math.abs(Math.round(delta * 100))}% vs stesso periodo del mese scorso` : 'primo mese con prezzi'} />
              ) : (
                <Kpi icon={<ShoppingCart size={18} />} label="Articoli questo mese" value={formatNumber(data.itemsThis)} />
              )}
              <Kpi icon={<Receipt size={18} />} label="Spese concluse" value={formatNumber(data.tripsThis)} note="questo mese" />
              {data.usePrices && data.avgTrip > 0 && (
                <Kpi icon={<ShoppingCart size={18} />} label="Media per spesa" value={formatPrice(data.avgTrip)} />
              )}
              {data.busiest && (
                <Kpi icon={<CalendarDays size={18} />} label="Giorno preferito" value={data.busiest} />
              )}
            </div>

            <section className="card">
              <h3 className="card-title">{data.usePrices ? 'Spesa mensile' : 'Articoli acquistati al mese'}</h3>
              <ColumnChart
                data={data.months.map(m => ({
                  key: m.key,
                  label: monthShort.format(m.date).replace('.', ''),
                  full: monthLong.format(m.date),
                  value: data.usePrices ? m.spent : m.items
                }))}
                format={data.usePrices ? formatPrice : (v) => `${formatNumber(v)} articoli`}
              />
            </section>

            <section className="card">
              <h3 className="card-title">Prodotti più acquistati</h3>
              <BarList
                rows={data.topProducts.map(p => ({
                  key: p.name,
                  label: p.name,
                  emoji: getCategory(p.category).emoji,
                  value: p.count,
                  text: `${p.count}×`
                }))}
              />
            </section>

            <section className="card">
              <h3 className="card-title">{data.usePrices ? 'Spesa per reparto' : 'Acquisti per reparto'}</h3>
              <BarList
                rows={data.topCategories.map(c => {
                  const cat = getCategory(c.id);
                  return {
                    key: c.id,
                    label: cat.name,
                    emoji: cat.emoji,
                    value: data.usePrices ? c.spent : c.count,
                    text: data.usePrices ? formatPrice(c.spent) : `${c.count}`
                  };
                })}
              />
            </section>
          </>
        )}
      </main>
    </>
  );
}

function Kpi({ icon, label, value, note }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{icon}{label}</span>
      <strong className="kpi-value">{value}</strong>
      {note && <span className="kpi-note">{note}</span>}
    </div>
  );
}

/** Istogramma a colonne a serie singola, con valore al tocco */
function ColumnChart({ data, format }) {
  const [active, setActive] = useState(data.length - 1);
  const max = Math.max(...data.map(d => d.value), 0);
  const current = data[active] || data[data.length - 1];

  return (
    <div className="colchart">
      <div className="colchart-readout" aria-live="polite">
        <strong>{format(current.value)}</strong>
        <span>{current.full}</span>
      </div>
      <div className="colchart-plot" role="list">
        {data.map((d, i) => (
          <button
            key={d.key}
            role="listitem"
            className={`colchart-col ${i === active ? 'active' : ''}`}
            onClick={() => setActive(i)}
            onPointerEnter={() => setActive(i)}
            aria-label={`${d.full}: ${format(d.value)}`}
          >
            <span className="colchart-bar-wrap">
              <span className="colchart-bar" style={{ height: max ? `${Math.max((d.value / max) * 100, d.value ? 3 : 0)}%` : 0 }} />
            </span>
            <span className="colchart-label">{d.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/** Barre orizzontali ordinate con etichetta e valore */
function BarList({ rows }) {
  const max = Math.max(...rows.map(r => r.value), 0);
  if (!rows.length) return <p className="hint">Nessun dato nel periodo.</p>;
  return (
    <ul className="barlist">
      {rows.map(r => (
        <li key={r.key}>
          <div className="barlist-head">
            <span className="barlist-label"><span>{r.emoji}</span>{r.label}</span>
            <span className="barlist-value">{r.text}</span>
          </div>
          <div className="barlist-track">
            <span style={{ width: max ? `${Math.max((r.value / max) * 100, 2)}%` : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
