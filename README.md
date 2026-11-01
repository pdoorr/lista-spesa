# 🛒 Lista Spesa

App Android (Capacitor) e PWA per la lista della spesa: funziona completamente offline,
impara le tue abitudini e segue il percorso del tuo supermercato.

## ✨ Funzionalità

### Lista
- **Inserimento rapido intelligente**: scrivi “2 kg mele”, “latte x3”, “500 g farina”: quantità e unità vengono riconosciute da sole
- **Completamento automatico** dal catalogo dei prodotti già usati, con preferiti ⭐ e prodotti frequenti a portata di tocco
- **Reparti automatici** (frutta e verdura, latticini, dispensa, surgelati, casa…) riconosciuti dal nome; le correzioni vengono ricordate
- **Unità di misura**: pz, conf, kg, g, l, ml con passi adatti (+1 pz, +0,5 kg, +100 g…)
- **Gesti**: scorri a destra per spuntare, a sinistra per eliminare, con **Annulla**
- **Note e prezzi** per ogni articolo, con **stima del totale** e prezzo proposto dall’ultimo acquisto
- **Duplicati uniti**: aggiungere un prodotto già in lista ne aumenta la quantità
- **Termina spesa**: gli articoli presi diventano una spesa nello storico (totale, negozio, numero articoli)
- **Condividi** la lista (WhatsApp, Telegram, email…) e **incolla** una lista ricevuta in chat
- **Schermo sempre acceso** mentre fai la spesa (opzionale)

### Supermercati
- Scegli il negozio: la lista si ordina secondo **il percorso dei reparti**
- L’ordine dei reparti si **trascina** a piacere oppure viene **appreso** dall’ordine in cui spunti gli articoli in quel negozio
- Il negozio scelto viene ricordato

### Suggerimenti
- **“Forse ti serve”**: l’app calcola ogni quanto compri un prodotto e te lo propone quando sta per finire
- **Genera dallo storico**: proposta di lista ordinata per urgenza, con preselezione e quantità modificabili

### Storico e statistiche
- Cronologia per giorno con totale speso e negozi, ricerca, eliminazione di singole voci (con annulla), riaggiunta in lista
- Catalogo prodotti con frequenza d’acquisto, ultimo prezzo, reparto e preferiti
- Statistiche: spesa del mese (confrontata con lo stesso periodo del mese scorso), spesa media, spesa mensile, prodotti più acquistati, spesa per reparto

### App
- Nuovo design (Material 3), **tema chiaro/scuro/di sistema** e 6 colori d’accento
- Navigazione a schede in basso, fogli a comparsa, vibrazione al tocco
- **Tasto indietro di Android** gestito (chiude i pannelli, poi torna alla lista, poi esce con doppio tocco)
- Bordo-a-bordo su Android 15+ con aree sicure corrette
- **Backup** su Google Drive/File tramite il pannello di condivisione, **importazione** con anteprima e scelta tra *unisci* e *sostituisci* (compatibile con i backup della versione 1)
- Nuova icona e splash screen (anche in versione scura)

## 🚀 Sviluppo

```bash
npm install      # dipendenze
npm run dev      # server di sviluppo
npm test         # test (parser, reparti, previsioni, database e migrazione)
npm run lint     # controllo del codice
npm run build    # build di produzione
```

## 🗂️ Struttura

```
src/
  App.jsx               shell: tema, navigazione, tasto indietro
  db.js                 schema IndexedDB (Dexie), migrazioni, azioni, backup
  lib/
    categories.js       reparti e riconoscimento automatico
    parse.js            interpretazione di “2 kg mele” e di liste incollate
    units.js            unità, passi, formattazione, stima prezzi
    predict.js          frequenze e prodotti in esaurimento
    order.js            ordinamento per reparto/percorso del negozio
    native.js           Capacitor: vibrazione, condivisione, file, schermo acceso
    theme.js            tema e colori d’accento
  components/           riga con gesti, inserimento rapido, editor, fogli, UI di base
  views/                Lista, Storico, Statistiche, Impostazioni
```

## 🗄️ Database (IndexedDB, versione 5)

| Tabella | Contenuto |
|---|---|
| `items` | articoli in lista: nome, quantità, unità, reparto, nota, prezzo, stato |
| `history` | ogni acquisto: prodotto, quantità, unità, prezzo, negozio, spesa di appartenenza |
| `products` | catalogo: reparto e unità ricordati, ultimo prezzo/quantità, conteggio, preferito |
| `supermarkets` | negozi e ordine personalizzato dei reparti |
| `storeRanks` | percorso appreso: posizione tipica di ogni prodotto in ogni negozio |
| `trips` | spese concluse: data, negozio, totale, numero articoli |
| `settings` | preferenze (tema, colore, opzioni, negozio scelto) |

I dati della versione precedente vengono migrati automaticamente al primo avvio:
reparti assegnati, suggerimenti trasformati in catalogo, ordine manuale per supermercato
convertito in percorso appreso.

## 🤖 Creare APK Android Release

### 📚 Documentazione Completa
Per una guida dettagliata, consulta il file [ANDROID_RELEASE_GUIDE.md](./ANDROID_RELEASE_GUIDE.md)

### 🔑 Credenziali Keystore
```
Keystore: android/lista-spesa.keystore
Alias: lista-sp
Password: lista-spesa-2025
```

### 🚀 Metodo Rapido (Consigliato)

Usa lo script automatizzato:

```bash
npm run android:release
```

Questo comando esegue automaticamente:
1. Build dell'app web
2. Sincronizzazione con Android
3. Generazione APK release firmato

L'APK verrà generato in: `android/app/build/outputs/apk/release/app-release.apk`

### 🛠️ Metodo Manuale

**Passo 1: Build dell'app web**
```bash
npm run build
```

**Passo 2: Sincronizzazione con Android**
```bash
npm run android:sync
# oppure
npx cap sync android
```

**Passo 3: Generazione APK**
```bash
cd android
./gradlew.bat assembleRelease
```

### 📱 Altri comandi utili

```bash
# Apri il progetto in Android Studio
npm run android:open

# Solo sincronizzazione
npm run android:sync
```

### 📦 Output

Dopo il build, l'APK firmato si troverà in:
```
android/app/build/outputs/apk/release/app-release.apk
```

### ⚠️ Prerequisiti
- Node.js 18+
- Java JDK 11 o superiore
- Android SDK con API Level 33 o superiore

### 📲 Installazione APK
1. Trasferisci il file APK sul dispositivo Android
2. Sul dispositivo, vai su `Impostazioni` → `Sicurezza`
3. Abilita `Origini sconosciute`
4. Apri il file APK per installare l'app

### 🌐 Google Play Store
Per pubblicare sul Play Store, genera un **App Bundle (AAB)**:

```bash
cd android
./gradlew.bat bundleRelease
```

L'AAB si troverà in: `android/app/build/outputs/bundle/release/app-release.aab`

## 📄 Licenza

ISC
