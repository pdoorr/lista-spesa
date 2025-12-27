# Script per la generazione automatica dell'APK Release
# Uso: .\build-release-apk.ps1

Write-Host "====================================" -ForegroundColor Cyan
Write-Host "  Build APK Release - Lista Spesa   " -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build dell'app web
Write-Host "[1/3] Build dell'applicazione web..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Errore durante il build dell'app web" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build completato" -ForegroundColor Green
Write-Host ""

# Step 2: Sincronizzazione con Android
Write-Host "[2/3] Sincronizzazione con Android..." -ForegroundColor Yellow
npx cap sync android
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Sync fallito, ma continuo comunque..." -ForegroundColor Yellow
} else {
    Write-Host "✅ Sync completato" -ForegroundColor Green
}
Write-Host ""

# Step 3: Generazione APK Release
Write-Host "[3/3] Generazione APK Release..." -ForegroundColor Yellow
cd android
.\gradlew.bat assembleRelease
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Errore durante la generazione dell'APK" -ForegroundColor Red
    cd ..
    exit 1
}

$apkPath = "app\build\outputs\apk\release\app-release.apk"
if (Test-Path $apkPath) {
    $apkSize = (Get-Item $apkPath).Length / 1MB
    Write-Host "✅ APK Release generato con successo!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📁 Percorso: $apkPath" -ForegroundColor Cyan
    Write-Host "📦 Dimensione: $([math]::Round($apkSize, 2)) MB" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "L'APK è pronto per essere distribuito!" -ForegroundColor Green
} else {
    Write-Host "⚠️  APK non trovato nel percorso atteso" -ForegroundColor Yellow
}

cd ..
Write-Host ""
Write-Host "====================================" -ForegroundColor Cyan

