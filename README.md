# 🛒 Lista Spesa PWA

Applicazione web progressiva (PWA) per la gestione della lista della spesa che funziona completamente offline.

## ✨ Caratteristiche

- **✅ Funziona Offline**: Tutti i dati sono salvati localmente con IndexedDB
- **📱 Installabile**: Può essere installata come app nativa su Android/iOS
- **📋 Gestione Lista**: Aggiungi, modifica, elimina e marca prodotti come comprati
- **🔢 Quantità**: Gestione quantità per ogni prodotto con controlli rapidi
- **📊 Storico**: Visualizza lo storico degli acquisti
- **💡 Suggerimenti**: Suggerimenti intelligenti basati sulla frequenza di acquisto
- **🪄 Generazione Automatica**: Crea automaticamente la lista dallo storico acquisti
- **💾 Backup**: Esporta i dati in JSON per backup o caricamento su Google Drive
- **📥 Ripristino**: Importa dati da file JSON per ripristinare il backup
- **🎨 UI Moderna**: Interfaccia pulita e responsive

## 🚀 Installazione

### Prerequisiti
- Node.js 18+ 
- npm o yarn

### Setup

```bash
# Installa le dipendenze
npm install

# Avvia in sviluppo
npm run dev

# Build per produzione
npm run build

# Anteprima build
npm run preview
```

## 📱 Installazione su Android

1. Apri l'app nel browser Chrome su Android
2. Vai a `http://localhost:5173` (o il tuo URL di produzione)
3. Tocca il menu (⋮) in alto a destra
4. Seleziona "Aggiungi alla schermata Home" o "Installa app"

## 🗄️ Struttura del Database

L'app usa **IndexedDB** (tramite Dexie.js) con le seguenti tabelle:

### `items`
Prodotti nella lista corrente
- `id`: ID univoco
- `name`: Nome del prodotto
- `quantity`: Quantità
- `completed`: Stato (0/1)
- `createdAt`: Data creazione
- `updatedAt`: Data ultima modifica

### `history`
Storico acquisti
- `id`: ID univoco
- `itemName`: Nome prodotto
- `quantity`: Quantità
- `purchasedAt`: Data acquisto

### `suggestions`
Suggerimenti prodotti
- `id`: ID univoco
- `name`: Nome prodotto
- `frequency`: Numero di acquisti
- `lastUsed`: Data ultimo uso

## 🎯 Funzionalità

### Gestione Lista
- Aggiungi prodotti con nome e quantità
- Marca prodotti come comprati (vengono salvati nello storico)
- Elimina prodotti dalla lista
- Ripristina prodotti dalla lista completati

### Generazione Automatica
Cliccando sull'icona ✨ (Sparkles) puoi generare automaticamente una lista della spesa basata sullo storico:
- I prodotti sono ordinati per frequenza di acquisto
- La quantità suggerita è la media delle quantità acquistate
- Puoi rivedere la lista prima di confermare

### Backup e Ripristino
**Esporta Dati:**
- Clicca "Esporta" nella sezione Storico
- Scarica un file JSON con tutti i tuoi dati (lista, storico, suggerimenti)
- Puoi caricare questo file su Google Drive o altri servizi cloud per backup

**Importa Dati:**
- Clicca "Importa" nella sezione Storico
- Seleziona un file JSON di backup precedentemente esportato
- Tutti i dati attuali verranno sostituiti con quelli del file

### Suggerimenti
I prodotti che compri più spesso appaiono nei suggerimenti:
- Ordinati per frequenza di acquisto
- Clicca per aggiungerli rapidamente alla lista

### Storico
- Registro automatico di ogni acquisto
- Visualizzazione cronologica con data e ora
- Base per la generazione automatica della lista

## 🛠️ Tecnologie

- **React 18** - Framework UI
- **Vite** - Build tool e dev server
- **Dexie.js** - Wrapper per IndexedDB
- **Lucide React** - Icone
- **Vite PWA Plugin** - Service worker e manifest
- **Capacitor** - Incapsulamento in app nativa

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
