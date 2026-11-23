// Local IndexedDB Camera Timelapse Recorder, Privacy Blur Baker, Player & WebM Exporter

const DB_NAME = 'craft-glass-timelapse';
const STORE_NAME = 'sessions';
const DEFAULT_MAX_SESSIONS = 3;
const MAX_FRAMES_PER_SESSION = 180;
const CAPTURE_INTERVAL_MS = 10_000;
const FRAME_W = 384;
const FRAME_H = 216;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveTimelapseSession(record, { maxSessions = DEFAULT_MAX_SESSIONS } = {}) {
  const limit = Math.max(1, Number(maxSessions) || DEFAULT_MAX_SESSIONS);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
    const getAllReq = store.getAll();
    getAllReq.onsuccess = () => {
      const all = (getAllReq.result || []).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
      for (let i = limit; i < all.length; i++) {
        store.delete(all[i].id);
      }
    };
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function listTimelapseSessions() {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => {
        const sorted = (req.result || []).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
        db.close();
        resolve(sorted);
      };
      req.onerror = () => { db.close(); resolve([]); };
    });
  } catch {
    return [];
  }
}

export async function getTimelapseSession(id) {
  if (!id) return null;
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(id);
      req.onsuccess = () => { db.close(); resolve(req.result || null); };
      req.onerror = () => { db.close(); resolve(null); };
    });
  } catch {
    return null;
  }
}

export async function deleteTimelapseSession(id) {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => { db.close(); resolve(true); };
      tx.onerror = () => { db.close(); resolve(false); };
    });
  } catch {
    return false;
  }
}

export class DeskCameraRecorder {
  constructor() {
    this.stream = null;
    this.videoEl = null;
    this.blurMode = 'soft'; // 'off' | 'soft' | 'heavy'
    this.facingMode = 'environment';
    this.frames = [];
    this.timerId = null;
    this.canvas = document.createElement('canvas');
    this.canvas.width = FRAME_W;
    this.canvas.height = FRAME_H;
  }

  async startPreview(videoEl, { blurMode = 'soft', facingMode = 'environment' } = {}) {
    this.stopPreview();
    this.videoEl = videoEl;
    this.blurMode = blurMode;
    this.facingMode = facingMode;
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Camera unavailable');
    }
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: this.facingMode }, width: { ideal: 640 }, height: { ideal: 360 } },
      audio: false
    });
    if (this.videoEl) {
      this.videoEl.srcObject = this.stream;
      await this.videoEl.play().catch(() => {});
    }
    return true;
  }

  setBlurMode(mode) {
    this.blurMode = ['off', 'soft', 'heavy'].includes(mode) ? mode : 'soft';
  }

  async flipCamera(videoEl) {
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    return this.startPreview(videoEl, { blurMode: this.blurMode, facingMode: this.facingMode });
  }

  captureFrame() {
    if (!this.videoEl || this.videoEl.readyState < 2) return null;
    if (this.frames.length >= MAX_FRAMES_PER_SESSION) return null;
    const ctx = this.canvas.getContext('2d');
    const vw = this.videoEl.videoWidth || 640;
    const vh = this.videoEl.videoHeight || 360;
    const scale = Math.max(FRAME_W / vw, FRAME_H / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (FRAME_W - dw) / 2;
    const dy = (FRAME_H - dh) / 2;

    ctx.save();
    if (this.blurMode === 'soft') {
      ctx.filter = 'blur(8px) saturate(1.08)';
    } else if (this.blurMode === 'heavy') {
      ctx.filter = 'blur(18px) contrast(1.15)';
    } else {
      ctx.filter = 'none';
    }
    ctx.drawImage(this.videoEl, dx, dy, dw, dh);
    ctx.restore();

    const dataUrl = this.canvas.toDataURL('image/jpeg', 0.56);
    const frame = { at: Date.now(), dataUrl };
    this.frames.push(frame);
    return frame;
  }

  startRecording() {
    this.frames = [];
    this.captureFrame();
    this.timerId = setInterval(() => this.captureFrame(), CAPTURE_INTERVAL_MS);
  }

  stopRecording() {
    if (this.timerId != null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.captureFrame();
    const captured = [...this.frames];
    this.frames = [];
    return captured;
  }

  stopPreview() {
    if (this.timerId != null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((tr) => tr.stop());
      this.stream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
  }
}

export async function exportTimelapseVideo(session, { hd = false } = {}) {
  const frames = [...(session?.frames || [])].sort((a, b) => (a.at || 0) - (b.at || 0));
  if (frames.length === 0) throw new Error('No frames');
  const canvas = document.createElement('canvas');
  canvas.width = hd ? 1280 : 640;
  canvas.height = hd ? 720 : 360;
  const ctx = canvas.getContext('2d');

  if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
    const resp = await fetch(frames[0].dataUrl);
    return { blob: await resp.blob(), filename: `craft-glass-frame-${session.dayKey || 'timelapse'}.jpg` };
  }

  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) =>
    MediaRecorder.isTypeSupported(m)
  ) || '';
  const stream = canvas.captureStream(12);
  const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };

  const done = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime || 'video/webm' }));
  });

  const barH = hd ? 44 : 28;
  const barW = hd ? 360 : 220;
  recorder.start();
  for (let i = 0; i < frames.length; i++) {
    const img = await new Promise((res) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = () => res(null);
      el.src = frames[i].dataUrl;
    });
    if (img) {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(6, 78, 59, 0.78)';
      ctx.fillRect(16, canvas.height - barH - 14, barW, barH);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${hd ? 20 : 14}px system-ui, sans-serif`;
      ctx.fillText(`Craft Glass${hd ? ' HD' : ''} • ${session.dayKey || ''} (${i + 1}/${frames.length})`, 26, canvas.height - (hd ? 28 : 22));
    }
    await new Promise((r) => setTimeout(r, 110));
  }
  recorder.stop();
  const blob = await done;
  return { blob, filename: `craft-glass-timelapse-${hd ? 'hd-' : ''}${session.dayKey || Date.now()}.webm` };
}

export async function exportWeeklyVlogVideo(sessions = [], weekKey = '') {
  const orderedSessions = [...(sessions || [])].sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
  const merged = [];
  for (const s of orderedSessions) {
    const sortedFrames = [...(s.frames || [])].sort((a, b) => (a.at || 0) - (b.at || 0));
    for (const f of sortedFrames) {
      merged.push({ ...f, dayKey: s.dayKey, category: s.category });
    }
  }
  if (merged.length === 0) throw new Error('No frames');
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');

  if (typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
    const resp = await fetch(merged[0].dataUrl);
    return { blob: await resp.blob(), filename: `craft-glass-vlog-${weekKey || 'week'}.jpg` };
  }

  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) =>
    MediaRecorder.isTypeSupported(m)
  ) || '';
  const stream = canvas.captureStream(12);
  const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data); };
  const done = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime || 'video/webm' }));
  });

  recorder.start();
  for (let i = 0; i < merged.length; i++) {
    const item = merged[i];
    const img = await new Promise((res) => {
      const el = new Image();
      el.onload = () => res(el);
      el.onerror = () => res(null);
      el.src = item.dataUrl;
    });
    if (img) {
      ctx.drawImage(img, 0, 0, 1280, 720);
      ctx.fillStyle = 'rgba(6, 78, 59, 0.8)';
      ctx.fillRect(24, 720 - 62, 440, 42);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(`Craft Glass Weekly Vlog • ${item.dayKey || weekKey} (${i + 1}/${merged.length})`, 36, 720 - 34);
    }
    await new Promise((r) => setTimeout(r, 95));
  }
  recorder.stop();
  const blob = await done;
  return { blob, filename: `craft-glass-weekly-vlog-${weekKey || Date.now()}.webm` };
}
