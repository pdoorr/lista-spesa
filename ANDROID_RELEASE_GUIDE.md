# Guida per la generazione dell'APK Release - Lista Spesa

## Panoramica
Questa guida spiega come generare un APK release firmato per l'applicazione Lista Spesa usando Capacitor e Android.

## Prerequisiti
- Node.js e npm installati
- Java Development Kit (JDK) 17 o superiore
- Android SDK con le versioni SDK necessarie

## Credenziali Keystore

Il keystore è già configurato in `android/lista-spesa.keystore` con le seguenti credenziali:

```
Keystore Path: D:\progetti\lista-spesa\android\lista-spesa.keystore
Alias: lista-sp
Keystore Password: lista-spesa-2025
Key Password: lista-spesa-2025
```

⚠️ **ATTENZIONE**: Conserva queste credenziali in modo sicuro. Se perdi il keystore o le password, non potrai aggiornare l'app sul Play Store.

## Passaggi per generare l'APK Release

### 1. Build dell'applicazione Web

```bash
npm run build
```

Questo comando crea la cartella `dist` con i file dell'applicazione compilati.

### 2. Sincronizzazione con Android (opzionale)

Se è la prima volta o hai modificato la configurazione:

```bash
npx cap sync android
```

Questo comando sincronizza i file dalla cartella `dist` con il progetto Android.

### 3. Generazione dell'APK Release

Esegui il comando Gradle per compilare l'APK release:

```bash
cd android
./gradlew.bat assembleRelease
```

Su PowerShell:

```powershell
cd android; .\gradlew.bat assembleRelease
```

### 4. Posizione dell'APK

L'APK release firmato si troverà in:

```
D:\progetti\lista-spesa\android\app\build\outputs\apk\release\app-release.apk
```

## Configurazione della Firma

La configurazione della firma è già presente nel file `android/app/build.gradle`:

```gradle
signingConfigs {
    release {
        storeFile file('lista-spesa.keystore')
        storePassword 'lista-spesa-2025'
        keyAlias 'lista-sp'
        keyPassword 'lista-spesa-2025'
    }
}
buildTypes {
    release {
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        signingConfig signingConfigs.release
    }
}
```

## Script di Automazione

Per rendere il processo più veloce, puoi usare il file `align-apk.bat` presente nella root del progetto.

### Comandi rapido

In alternativa, puoi eseguire direttamente da PowerShell:

```powershell
npm run build; cd android; .\gradlew.bat assembleRelease
```

## Verifica dell'APK

Per verificare che l'APK sia firmato correttamente:

```bash
cd android
keytool -printcert -jarfile app\build\outputs\apk\release\app-release.apk
```

## Troubleshooting

### Problema: APK non firmato
Se ricevi un APK non firmato (`app-release-unsigned.apk`), verifica che la configurazione della firma sia presente nel `build.gradle`.

### Problema: Gradle sync fallisce
- Verifica che Java JDK 17+ sia installato
- Pulisci il progetto: `./gradlew.bat clean`
- Sincronizza con Capacitor: `npx cap sync android`

### Problema: Build lentissimo
- Disabilita l'offline mode: `./gradlew.bat --offline` (se è attiva)
- Aumenta la memoria in `gradle.properties` aggiungendo:
  ```
  org.gradle.jvmargs=-Xmx2048m
  ```

## Distribuzione

### Per il Google Play Store
L'APK firmato può essere caricato direttamente sul Google Play Console.

Nota: Per la distribuzione sul Play Store, potresti dover creare anche un **App Bundle (AAB)**:

```bash
cd android
./gradlew.bat bundleRelease
```

L'AAB si troverà in:
```
D:\progetti\lista-spesa\android\app\build\outputs\bundle\release\app-release.aab
```

### Per distribuzione diretta
Puoi condividere l'APK direttamente:
- Via email o cloud storage
- Attraverso servizi come Firebase App Distribution
- Caricandolo su un sito web

## Versionamento

Aggiorna regolarmente il `versionCode` e `versionName` in `android/app/build.gradle`:

```gradle
defaultConfig {
    applicationId "com.listaspesa.app"
    minSdkVersion rootProject.ext.minSdkVersion
    targetSdkVersion rootProject.ext.targetSdkVersion
    versionCode 2  // Incrementa ad ogni release
    versionName "1.1"  // Aggiorna la versione mostrata agli utenti
    // ...
}
```

Ricorda: `versionCode` deve essere sempre incrementato per ogni release.

## Riferimenti

- [Documentazione Capacitor Android](https://capacitorjs.com/docs/android)
- [Guida firma app Android](https://developer.android.com/studio/publish/app-signing)
- [Google Play Console](https://play.google.com/console)


