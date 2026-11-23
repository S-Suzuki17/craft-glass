// Native Android WebView bridge with clean browser/PWA fallbacks.

let wakeLockSentinel = null;
const backHandlers = [];

export function isNativeAndroid() {
  return Boolean(globalThis.window?.CraftGlassNative);
}

export function getAppInfo() {
  try {
    if (isNativeAndroid()) {
      return JSON.parse(globalThis.window.CraftGlassNative.getAppInfo());
    }
  } catch {
    // Fallback to web info
  }
  return { platform: 'web', versionName: '1.0.2', versionCode: 3 };
}

export async function setKeepScreenOn(enabled) {
  if (isNativeAndroid()) {
    try {
      globalThis.window.CraftGlassNative.setKeepScreenOn(Boolean(enabled));
      return true;
    } catch {
      return false;
    }
  }
  if (enabled) {
    try {
      if ('wakeLock' in navigator && !wakeLockSentinel) {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
      }
      return true;
    } catch {
      return false;
    }
  } else if (wakeLockSentinel) {
    try {
      await wakeLockSentinel.release();
    } catch {
      // Ignore release errors
    }
    wakeLockSentinel = null;
  }
  return true;
}

export function vibrate(ms = 18) {
  if (isNativeAndroid()) {
    try {
      globalThis.window.CraftGlassNative.vibrate(Number(ms) || 18);
      return;
    } catch {
      // Ignore
    }
  }
  try {
    navigator.vibrate?.(ms);
  } catch {
    // Ignore
  }
}

export async function shareText(title, text) {
  if (isNativeAndroid()) {
    try {
      globalThis.window.CraftGlassNative.shareText(String(title || ''), String(text || ''));
      return true;
    } catch {
      // Fallback
    }
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch {
      return false;
    }
  }
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function saveBlobFile(filename, blob) {
  if (isNativeAndroid()) {
    try {
      const b64 = await blobToBase64(blob);
      const ok = globalThis.window.CraftGlassNative.saveToDownloads(
        filename,
        blob.type || 'application/octet-stream',
        b64
      );
      if (ok) return true;
    } catch {
      // Fallback to anchor download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 800);
  return true;
}

export async function shareBlobFile(filename, title, blob) {
  if (isNativeAndroid()) {
    try {
      const b64 = await blobToBase64(blob);
      globalThis.window.CraftGlassNative.shareBase64File(
        filename,
        blob.type || 'application/octet-stream',
        b64,
        String(title || 'Craft Glass')
      );
      return true;
    } catch {
      // Fallback
    }
  }
  const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ title, files: [file] });
      return true;
    } catch {
      return false;
    }
  }
  return saveBlobFile(filename, blob);
}

export function pushBackHandler(fn) {
  backHandlers.push(fn);
  return () => {
    const idx = backHandlers.lastIndexOf(fn);
    if (idx !== -1) backHandlers.splice(idx, 1);
  };
}

const billingListeners = new Set();

export function onBillingUpdate(fn) {
  if (typeof fn !== 'function') return () => {};
  billingListeners.add(fn);
  return () => billingListeners.delete(fn);
}

globalThis.window.__onCraftGlassBillingUpdate = (payload) => {
  let data = payload;
  if (typeof payload === 'string') {
    try { data = JSON.parse(payload); } catch { return; }
  }
  for (const fn of billingListeners) {
    try { fn(data); } catch {}
  }
};

export function queryBillingProducts() {
  if (isNativeAndroid() && typeof globalThis.window.CraftGlassNative.queryBillingProducts === 'function') {
    try {
      globalThis.window.CraftGlassNative.queryBillingProducts();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function purchaseProProduct(productId, productType = 'subs') {
  if (isNativeAndroid() && typeof globalThis.window.CraftGlassNative.purchaseProduct === 'function') {
    try {
      globalThis.window.CraftGlassNative.purchaseProduct(String(productId), String(productType));
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function restoreProPurchases() {
  if (isNativeAndroid() && typeof globalThis.window.CraftGlassNative.restorePurchases === 'function') {
    try {
      globalThis.window.CraftGlassNative.restorePurchases();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

const adListeners = new Set();

export function onAdEvent(fn) {
  if (typeof fn !== 'function') return () => {};
  adListeners.add(fn);
  return () => adListeners.delete(fn);
}

globalThis.window.__onCraftGlassAdEvent = (payload) => {
  let data = payload;
  if (typeof payload === 'string') {
    try { data = JSON.parse(payload); } catch { return; }
  }
  for (const fn of adListeners) {
    try { fn(data); } catch {}
  }
};

export function setAdBannerSuppressed(suppressed) {
  if (isNativeAndroid() && typeof globalThis.window.CraftGlassNative.setAdBannerSuppressed === 'function') {
    try {
      globalThis.window.CraftGlassNative.setAdBannerSuppressed(Boolean(suppressed));
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function showRewardedAd() {
  if (isNativeAndroid() && typeof globalThis.window.CraftGlassNative.showRewardedAd === 'function') {
    try {
      globalThis.window.CraftGlassNative.showRewardedAd();
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

globalThis.window.__craftGlassBack = () => {
  while (backHandlers.length > 0) {
    const fn = backHandlers.pop();
    try {
      if (fn() === true) return true;
    } catch {
      // Ignore
    }
  }
  return false;
};
