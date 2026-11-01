// Integrazione con le API native Android (Capacitor) con fallback web
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { KeepAwake } from '@capacitor-community/keep-awake';

export const isNative = Capacitor.isNativePlatform();

let hapticsEnabled = true;
export function setHapticsEnabled(value) {
  hapticsEnabled = value;
}

/** Feedback aptico: 'light' | 'medium' | 'success' | 'warning' */
export function haptic(kind = 'light') {
  if (!hapticsEnabled) return;
  try {
    if (isNative) {
      if (kind === 'success') Haptics.notification({ type: NotificationType.Success });
      else if (kind === 'warning') Haptics.notification({ type: NotificationType.Warning });
      else Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light });
    } else if (navigator.vibrate) {
      navigator.vibrate(kind === 'success' ? [12, 40, 12] : kind === 'medium' ? 18 : 8);
    }
  } catch {
    // feedback non disponibile
  }
}

/**
 * Condivide un testo (WhatsApp, Telegram, email...).
 * @returns {Promise<'shared'|'copied'|'cancelled'>}
 */
export async function shareText(title, text) {
  try {
    if (isNative) {
      await Share.share({ title, text, dialogTitle: title });
      return 'shared';
    }
    if (navigator.share) {
      await navigator.share({ title, text });
      return 'shared';
    }
  } catch (err) {
    if (String(err?.message || err).toLowerCase().includes('cancel') || err?.name === 'AbortError') return 'cancelled';
  }
  await copyText(text);
  return 'copied';
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement('textarea');
    area.value = text;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
}

export async function readClipboard() {
  try {
    return await navigator.clipboard.readText();
  } catch {
    return '';
  }
}

/**
 * Salva/condivide un file di backup. Su Android apre il pannello di
 * condivisione (Google Drive, File, email...), sul web lo scarica.
 */
export async function saveFile(filename, content, mime = 'application/json') {
  if (isNative) {
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8
    });
    try {
      await Share.share({ title: filename, files: [uri], dialogTitle: 'Salva o invia il backup' });
    } catch (err) {
      if (!String(err?.message || err).toLowerCase().includes('cancel')) throw err;
      return 'cancelled';
    }
    return 'shared';
  }
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

/** Registra il gestore del tasto "indietro" di Android */
export function onBackButton(handler) {
  if (!isNative) return () => {};
  const listener = App.addListener('backButton', handler);
  return () => {
    listener.then(l => l.remove());
  };
}

export function exitApp() {
  if (isNative) App.minimizeApp().catch(() => App.exitApp());
}

/** Colore delle icone di barra di stato/navigazione in base al tema */
export function setSystemBarsDark(dark) {
  if (!isNative) return;
  SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
}

let wakeLock = null;
/** Mantiene lo schermo acceso (utile mentre si fa la spesa) */
export async function setKeepAwake(active) {
  try {
    if (isNative) {
      if (active) await KeepAwake.keepAwake();
      else await KeepAwake.allowSleep();
      return;
    }
    if (active && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!active && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    // non supportato
  }
}

export function getAppVersion() {
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
}
