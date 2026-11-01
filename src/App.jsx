import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ListChecks, History, BarChart3, Settings } from 'lucide-react';
import db, { settingsActions, DEFAULT_SETTINGS } from './db';
import { UIProvider, closeTopOverlay, useUI } from './components/ui';
import StoreSheet from './components/StoreSheet';
import ListView from './views/ListView';
import HistoryView from './views/HistoryView';
import StatsView from './views/StatsView';
import SettingsView from './views/SettingsView';
import { applyTheme } from './lib/theme';
import { exitApp, haptic, onBackButton, setHapticsEnabled, setSystemBarsDark } from './lib/native';
import './App.css';

const TABS = [
  { id: 'list', label: 'Lista', icon: ListChecks },
  { id: 'history', label: 'Storico', icon: History },
  { id: 'stats', label: 'Statistiche', icon: BarChart3 },
  { id: 'settings', label: 'Impostazioni', icon: Settings }
];

export default function App() {
  return (
    <UIProvider>
      <Shell />
    </UIProvider>
  );
}

function Shell() {
  const { showToast } = useUI();
  const settingsRows = useLiveQuery(() => db.settings.toArray(), []);
  const stores = useLiveQuery(() => db.supermarkets.toArray(), []) || [];
  const activeCount = useLiveQuery(() => db.items.where('completed').equals(0).count(), []) || 0;
  const [tab, setTab] = useState('list');
  const [storesOpen, setStoresOpen] = useState(false);
  const lastBack = useRef(0);

  const settings = useMemo(
    () => (settingsRows ? settingsActions.toObject(settingsRows) : DEFAULT_SETTINGS),
    [settingsRows]
  );
  const selectedStore = stores.find(s => s.id === settings.selectedStoreId) || null;

  // Tema e colore d'accento (anche al cambio del tema di sistema)
  useEffect(() => {
    const apply = () => setSystemBarsDark(applyTheme(settings));
    apply();
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [settings.theme, settings.accent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setHapticsEnabled(settings.haptics);
  }, [settings.haptics]);

  // Tasto indietro di Android: chiude i fogli aperti, poi torna alla lista, poi esce
  const tabRef = useRef(tab);
  tabRef.current = tab;
  useEffect(() => onBackButton(() => {
    if (closeTopOverlay()) return;
    if (tabRef.current !== 'list') {
      setTab('list');
      return;
    }
    const now = Date.now();
    if (now - lastBack.current < 2000) exitApp();
    else {
      lastBack.current = now;
      showToast('Premi di nuovo indietro per uscire');
    }
  }), [showToast]);

  const changeTab = (id) => {
    if (id === tab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    haptic('light');
    setTab(id);
    window.scrollTo({ top: 0 });
  };

  if (!settingsRows) {
    return (
      <div className="splash">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="app">
      <div className="view" key={tab}>
        {tab === 'list' && (
          <ListView settings={settings} selectedStore={selectedStore} onOpenStores={() => setStoresOpen(true)} />
        )}
        {tab === 'history' && <HistoryView settings={settings} />}
        {tab === 'stats' && <StatsView settings={settings} />}
        {tab === 'settings' && <SettingsView settings={settings} onOpenStores={() => setStoresOpen(true)} />}
      </div>

      <nav className="bottom-nav" aria-label="Navigazione principale">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`nav-item ${tab === id ? 'active' : ''}`}
            onClick={() => changeTab(id)}
            aria-current={tab === id ? 'page' : undefined}
          >
            <span className="nav-pill">
              <Icon size={22} strokeWidth={tab === id ? 2.4 : 2} />
              {id === 'list' && activeCount > 0 && <span className="nav-badge">{activeCount > 99 ? '99+' : activeCount}</span>}
            </span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>

      <StoreSheet
        open={storesOpen}
        onClose={() => setStoresOpen(false)}
        stores={stores}
        selectedId={settings.selectedStoreId}
        onSelect={(id) => {
          settingsActions.set('selectedStoreId', id);
          haptic('light');
          setStoresOpen(false);
        }}
      />
    </div>
  );
}
