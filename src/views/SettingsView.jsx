import { useRef, useState } from 'react';
import {
  Moon, Sun, Smartphone, Layers, Tag, Sparkles, Vibrate, MonitorSmartphone, Store, ChevronRight,
  HardDriveDownload, HardDriveUpload, History, Database, RotateCcw, Info, Palette, Check
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import db, { settingsActions, backupActions, historyActions, resetAll } from '../db';
import { TopBar, Segmented, Switch, Sheet, useUI } from '../components/ui';
import { ACCENTS } from '../lib/theme';
import { saveFile, getAppVersion, isNative } from '../lib/native';

export default function SettingsView({ settings, onOpenStores }) {
  const { showToast, confirm } = useUI();
  const fileRef = useRef(null);
  const [pending, setPending] = useState(null);
  const counts = useLiveQuery(async () => ({
    items: await db.items.count(),
    history: await db.history.count(),
    products: await db.products.count(),
    stores: await db.supermarkets.count()
  }), []) || {};

  const set = (key) => (value) => settingsActions.set(key, value);

  async function exportBackup() {
    try {
      const json = await backupActions.exportAll();
      const date = new Date().toISOString().slice(0, 10);
      const result = await saveFile(`lista-spesa-backup-${date}.json`, json);
      if (result === 'downloaded') showToast('Backup scaricato');
    } catch (err) {
      showToast(`Esportazione non riuscita: ${err.message}`);
    }
  }

  function pickFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setPending({ data: backupActions.parse(String(reader.result)), name: file.name });
      } catch (err) {
        showToast(err.message);
      }
    };
    reader.readAsText(file);
  }

  async function doImport(mode) {
    if (mode === 'replace') {
      const ok = await confirm({
        title: 'Sostituire tutti i dati?',
        message: 'Lista, storico, catalogo e supermercati attuali verranno sostituiti da quelli del backup.',
        confirmLabel: 'Sostituisci',
        danger: true
      });
      if (!ok) return;
    }
    try {
      await backupActions.importAll(pending.data, mode);
      setPending(null);
      showToast(mode === 'replace' ? 'Backup ripristinato' : 'Dati uniti con successo');
    } catch (err) {
      showToast(`Importazione non riuscita: ${err.message}`);
    }
  }

  return (
    <>
      <TopBar title="Impostazioni" />
      <main className="content settings">
        <section className="settings-group">
          <h3 className="section-title">Aspetto</h3>
          <div className="card">
            <div className="row-setting stacked">
              <span className="row-text"><span className="row-title">Tema</span></span>
              <Segmented
                value={settings.theme}
                onChange={set('theme')}
                options={[
                  { value: 'system', label: 'Sistema', icon: <Smartphone size={16} /> },
                  { value: 'light', label: 'Chiaro', icon: <Sun size={16} /> },
                  { value: 'dark', label: 'Scuro', icon: <Moon size={16} /> }
                ]}
              />
            </div>
            <div className="row-setting stacked">
              <span className="row-text"><span className="row-title"><Palette size={16} /> Colore</span></span>
              <div className="swatches" role="radiogroup" aria-label="Colore d'accento">
                {ACCENTS.map(a => (
                  <button
                    key={a.id}
                    role="radio"
                    aria-checked={settings.accent === a.id}
                    aria-label={a.name}
                    className={`swatch ${settings.accent === a.id ? 'active' : ''}`}
                    style={{ background: a.color }}
                    onClick={() => settingsActions.set('accent', a.id)}
                  >
                    {settings.accent === a.id && <Check size={18} color="#fff" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="settings-group">
          <h3 className="section-title">Lista</h3>
          <div className="card">
            <Switch icon={<Layers size={19} />} label="Raggruppa per reparto" description="Ordina la lista come il percorso nel negozio"
              checked={settings.groupByCategory} onChange={set('groupByCategory')} />
            <Switch icon={<Tag size={19} />} label="Prezzi e budget" description="Stima del totale, spesa per mese e per reparto"
              checked={settings.showPrices} onChange={set('showPrices')} />
            <Switch icon={<Sparkles size={19} />} label="Suggerimenti intelligenti" description="Propone ciò che compri con regolarità quando sta per finire"
              checked={settings.smartSuggestions} onChange={set('smartSuggestions')} />
            <Switch icon={<MonitorSmartphone size={19} />} label="Schermo acceso durante la spesa" description="Dopo il primo articolo spuntato"
              checked={settings.keepAwake} onChange={set('keepAwake')} />
            <Switch icon={<Vibrate size={19} />} label="Vibrazione" description="Feedback al tocco e ai gesti"
              checked={settings.haptics} onChange={set('haptics')} />
          </div>
        </section>

        <section className="settings-group">
          <h3 className="section-title">Negozi</h3>
          <div className="card">
            <button className="row-setting as-button" onClick={onOpenStores}>
              <span className="row-icon"><Store size={19} /></span>
              <span className="row-text">
                <span className="row-title">Supermercati</span>
                <span className="row-desc">{counts.stores ?? '–'} salvati · ordine dei reparti e percorso</span>
              </span>
              <ChevronRight size={20} className="row-chevron" />
            </button>
          </div>
        </section>

        <section className="settings-group">
          <h3 className="section-title">Backup</h3>
          <div className="card">
            <button className="row-setting as-button" onClick={exportBackup}>
              <span className="row-icon"><HardDriveUpload size={19} /></span>
              <span className="row-text">
                <span className="row-title">Esporta backup</span>
                <span className="row-desc">{isNative ? 'Salva su Google Drive, File o invialo' : 'Scarica un file JSON con tutti i dati'}</span>
              </span>
            </button>
            <button className="row-setting as-button" onClick={() => fileRef.current?.click()}>
              <span className="row-icon"><HardDriveDownload size={19} /></span>
              <span className="row-text">
                <span className="row-title">Importa backup</span>
                <span className="row-desc">Ripristina o unisci dati da un file</span>
              </span>
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" onChange={pickFile} hidden />
          </div>
        </section>

        <section className="settings-group">
          <h3 className="section-title">Dati</h3>
          <div className="card">
            <div className="data-counts">
              <span><strong>{counts.items ?? '–'}</strong> in lista</span>
              <span><strong>{counts.history ?? '–'}</strong> acquisti</span>
              <span><strong>{counts.products ?? '–'}</strong> prodotti</span>
            </div>
            <button
              className="row-setting as-button"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Cancellare lo storico?',
                  message: `Verranno eliminati ${counts.history} acquisti e le statistiche. Lista e catalogo restano.`,
                  confirmLabel: 'Cancella',
                  danger: true,
                  icon: <History size={26} />
                });
                if (!ok) return;
                await historyActions.clear();
                showToast('Storico cancellato');
              }}
            >
              <span className="row-icon"><History size={19} /></span>
              <span className="row-text"><span className="row-title">Cancella storico acquisti</span></span>
            </button>
            <button
              className="row-setting as-button"
              onClick={async () => {
                const n = await historyActions.generateTestData();
                showToast(`Aggiunti ${n} acquisti di esempio`);
              }}
            >
              <span className="row-icon"><Database size={19} /></span>
              <span className="row-text">
                <span className="row-title">Genera dati di esempio</span>
                <span className="row-desc">Per provare suggerimenti e statistiche</span>
              </span>
            </button>
            <button
              className="row-setting as-button danger"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Ripristinare l’app?',
                  message: 'Tutti i dati verranno eliminati definitivamente. Esporta prima un backup se vuoi conservarli.',
                  confirmLabel: 'Elimina tutto',
                  danger: true,
                  icon: <RotateCcw size={26} />
                });
                if (!ok) return;
                await resetAll();
                showToast('Dati eliminati');
              }}
            >
              <span className="row-icon"><RotateCcw size={19} /></span>
              <span className="row-text"><span className="row-title">Elimina tutti i dati</span></span>
            </button>
          </div>
        </section>

        <p className="about">
          <Info size={14} /> Lista Spesa {getAppVersion()} · funziona offline, i dati restano sul tuo telefono
        </p>
      </main>

      <Sheet open={Boolean(pending)} onClose={() => setPending(null)} title="Importa backup" subtitle={pending?.name}>
        {pending && (
          <>
            <dl className="details">
              {pending.data.exportDate && (
                <div><dt>Creato il</dt><dd>{new Date(pending.data.exportDate).toLocaleString('it-IT')}</dd></div>
              )}
              <div><dt>Articoli in lista</dt><dd>{pending.data.items.length}</dd></div>
              <div><dt>Acquisti nello storico</dt><dd>{pending.data.history.length}</dd></div>
              <div><dt>Prodotti nel catalogo</dt><dd>{pending.data.products.length}</dd></div>
              <div><dt>Supermercati</dt><dd>{pending.data.supermarkets.length}</dd></div>
            </dl>
            <div className="stack-actions">
              <button className="btn btn-primary" onClick={() => doImport('merge')}>Unisci ai dati attuali</button>
              <button className="btn btn-ghost danger" onClick={() => doImport('replace')}>Sostituisci tutto</button>
            </div>
          </>
        )}
      </Sheet>
    </>
  );
}
