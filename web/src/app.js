// Craft Glass Main SPA Application Controller (Zero-dep ES Modules)

import { t, detectLocale, formatMinutes } from './core/i18n.js';
import {
  WORLDS,
  COMPANIONS,
  EQUIPMENT_CATALOG,
  ROOMS,
  HERO_BASES,
  BLESSING_STAMPS,
  BREAK_GEMS,
  STARTER_PACKS
} from './core/catalog.js';
import {
  ALLOWED_UNITS,
  ALLOWED_CATEGORIES,
  getLocalDayKey,
  addDaysToKey,
  daysBetweenKeys,
  getWeekStartKey,
  getWeekDates,
  createPoolTask,
  poolProgress,
  togglePoolChunk,
  advancePoolAmount,
  summarizeWeekByUnit,
  calculateWeeklyStreak
} from './core/weekly-pool.js';
import {
  calcTotalFocusSeconds,
  calcGuildLevel,
  companionBondInfo,
  evaluateWeeklyExpedition,
  claimExpeditionChest,
  spawnBreakGemForSession,
  getActivePendingGems,
  getDailyGemEarned,
  claimBreakGem,
  getSealedMonsters,
  recordMonsterSealEvent,
  claimSealedMonsterRewards,
  correctSessionDuration,
  purchaseItem,
  BREAK_GEM_DAILY_POINT_CAP
} from './core/rpg-engine.js';
import { FSRSCard, Rating, getDueCards } from './core/fsrs.js';
import {
  appendProofLedgerEntry,
  verifyProofLedgerChain,
  buildWeeklyProofSummary,
  encodeProofPact,
  decodeProofPact,
  issueHumanBlessing,
  redeemHumanBlessing,
  getActiveBlessing
} from './core/proof-ledger.js';
import {
  loadState,
  saveState,
  applyStarterPack,
  exportStateBackupJson,
  parseStateBackupJson
} from './core/storage.js';

import { soundEngine } from './ui/audio.js';
import { startSceneRenderer, renderStaticSpriteThumb } from './ui/pixel-renderer.js';
import {
  DeskCameraRecorder,
  saveTimelapseSession,
  listTimelapseSessions,
  getTimelapseSession,
  deleteTimelapseSession,
  exportTimelapseVideo
} from './ui/timelapse.js';
import { generateProofCardBlob } from './ui/proof-card.js';
import {
  setKeepScreenOn,
  vibrate,
  shareText,
  saveBlobFile,
  shareBlobFile,
  pushBackHandler
} from './ui/native-bridge.js';

const ACTIVE_TIMER_KEY = 'craft-glass-active-timer-v1';

const esc = (str) => String(str ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

let state = loadState();
let activeTab = 'pool';
let sceneCleanup = null;
let focusSceneCleanup = null;
let lastProofBlob = null;
let lastProofUrl = null;
let lastGeneratedPact = '';
let inspectedPact = null;
let selectedStampKey = BLESSING_STAMPS[0].key;
let activeDialogClose = null;
let cachedTimelapses = [];

const cameraRecorder = new DeskCameraRecorder();

// Live Timer State (restored from wall clock across tab close/reload)
let liveTimer = restoreActiveTimer();
let timerTickInterval = null;

function restoreActiveTimer() {
  try {
    const raw = localStorage.getItem(ACTIVE_TIMER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistActiveTimer() {
  if (!liveTimer) {
    localStorage.removeItem(ACTIVE_TIMER_KEY);
  } else {
    localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(liveTimer));
  }
}

function getTimerElapsedSeconds(timer = liveTimer, nowMs = Date.now()) {
  if (!timer) return 0;
  const base = Number(timer.accumulatedSec) || 0;
  if (timer.running && timer.resumedAt) {
    return base + Math.max(0, Math.floor((nowMs - timer.resumedAt) / 1000));
  }
  return base;
}

function formatClock(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function locale() {
  return state.settings?.locale || detectLocale();
}

function weekKeyNow() {
  return getWeekStartKey(Date.now(), state.settings?.weekStart || 'mon');
}

function setState(updater) {
  state = typeof updater === 'function' ? updater(state) : updater;
  saveState(state);
  soundEngine.setEnabled(state.settings?.soundEnabled !== false);
  document.body.classList.toggle('reduced-motion', Boolean(state.settings?.reducedMotion));
  renderAll();
}

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(showToast._tid);
  showToast._tid = setTimeout(() => { el.hidden = true; }, 2800);
}

function openDialog(html, onClose = null) {
  const dlg = document.getElementById('app-dialog');
  if (!dlg) return;
  dlg.innerHTML = html;
  if (activeDialogClose) activeDialogClose();
  const removeBack = pushBackHandler(() => {
    closeDialog();
    return true;
  });
  activeDialogClose = () => {
    removeBack();
    if (onClose) onClose();
    activeDialogClose = null;
  };
  dlg.oncancel = (e) => {
    e.preventDefault();
    closeDialog();
  };
  if (!dlg.open) dlg.showModal();
}

function closeDialog() {
  const dlg = document.getElementById('app-dialog');
  if (dlg?.open) dlg.close();
  if (activeDialogClose) activeDialogClose();
}

function renderChrome() {
  const loc = locale();
  document.documentElement.lang = loc;
  document.getElementById('brand-tagline').textContent = t(loc, 'tagline');
  const totalSec = calcTotalFocusSeconds(state.sessions);
  const rank = calcGuildLevel(totalSec, loc);
  const blessing = getActiveBlessing(state, loc);

  document.getElementById('sidebar-points').textContent = t(loc, 'common.points', { n: state.points || 0 });
  document.getElementById('sidebar-level').textContent = `${t(loc, 'common.level', { n: rank.level })} • ${rank.rank}`;
  document.getElementById('top-points-pill').textContent = t(loc, 'common.points', { n: state.points || 0 });

  const blessPill = document.getElementById('top-blessing-pill');
  if (blessing) {
    blessPill.hidden = false;
    blessPill.innerHTML = `<img src="${esc(blessing.stampSrc)}" width="18" height="18" alt=""><span>${esc(blessing.title)} (${blessing.remainingDays}d)</span>`;
  } else {
    blessPill.hidden = true;
  }

  const tabs = [
    ['pool', '📋', t(loc, 'tabs.pool')],
    ['focus', '⏱️', t(loc, 'tabs.focus')],
    ['guild', '🛡️', t(loc, 'tabs.guild')],
    ['proof', '✨', t(loc, 'tabs.proof')],
    ['insights', '📊', t(loc, 'tabs.insights')]
  ];
  const navHtml = tabs.map(([id, icon, label]) => `
    <button type="button" class="nav-btn${activeTab === id ? ' active' : ''}" data-tab="${id}" aria-current="${activeTab === id ? 'page' : 'false'}">
      <span aria-hidden="true">${icon}</span>
      <span>${esc(label)}</span>
    </button>
  `).join('');

  document.getElementById('desktop-nav').innerHTML = navHtml;
  document.getElementById('mobile-nav').innerHTML = navHtml;
}

function renderPoolTab(main) {
  const loc = locale();
  const wk = weekKeyNow();
  const weekDates = getWeekDates(wk);
  const weekPools = (state.pools || []).filter((p) => p.weekKey === wk);
  const summary = summarizeWeekByUnit(state.pools, wk);
  const streak = calculateWeeklyStreak(state.pools, wk);
  const weekdayLabels = state.settings?.weekStart === 'sun' ? t(loc, 'weekdaysSunFirst') : t(loc, 'weekdays');
  const todayKey = getLocalDayKey();

  main.innerHTML = `
    <header class="page-header">
      <h1>${esc(t(loc, 'pool.title'))}</h1>
      <p>${esc(t(loc, 'pool.subtitle'))} (${weekDates[0]} – ${weekDates[6]})</p>
    </header>

    <div class="grid-2">
      <section class="card glass">
        <div class="card-head">
          <h2>${esc(t(loc, 'pool.weeklyStreak'))}</h2>
          <span class="pill-badge">${streak} ${loc === 'ja' ? '週連続' : 'weeks'}</span>
        </div>
        <div class="stat-value">${summary.overallPercent}%</div>
        <p class="muted">${esc(t(loc, 'pool.streakDesc', { n: streak }))}</p>
        <progress class="craft-progress" max="100" value="${summary.overallPercent}"></progress>
      </section>

      <section class="card glass">
        <div class="card-head">
          <h2>${esc(t(loc, 'pool.unitSummaries'))}</h2>
        </div>
        ${summary.byUnit.length === 0 ? `<p class="muted">${esc(t(loc, 'pool.empty'))}</p>` : `
          <div class="grid-3">
            ${summary.byUnit.map((u) => `
              <div>
                <div class="muted">${esc(t(loc, `units.${u.unit}`))}</div>
                <strong>${u.done} / ${u.target}</strong>
                <div class="muted">${esc(t(loc, 'pool.remainingLabel', { n: u.remaining, unit: t(loc, `units.${u.unit}`) }))}</div>
              </div>
            `).join('')}
          </div>
        `}
      </section>
    </div>

    <section class="card glass">
      <div class="card-head">
        <h2>${esc(t(loc, 'pool.addTask'))}</h2>
        <button type="button" id="toggle-pool-form-btn" class="btn btn-secondary btn-sm">+</button>
      </div>
      <form id="pool-create-form">
        <div class="grid-2">
          <div class="field">
            <label for="pool-title">${esc(t(loc, 'pool.taskTitle'))}</label>
            <input id="pool-title" type="text" required maxlength="80" placeholder="${esc(t(loc, 'pool.taskTitlePlaceholder'))}">
          </div>
          <div class="field">
            <label for="pool-category">${esc(t(loc, 'pool.category'))}</label>
            <select id="pool-category">
              ${ALLOWED_CATEGORIES.map((c) => `<option value="${c}">${esc(t(loc, `categories.${c}`))}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="grid-3">
          <div class="field">
            <label for="pool-target">${esc(t(loc, 'pool.targetAmount'))}</label>
            <input id="pool-target" type="number" min="1" max="5000" value="90" required>
          </div>
          <div class="field">
            <label for="pool-unit">${esc(t(loc, 'pool.unit'))}</label>
            <select id="pool-unit">
              ${ALLOWED_UNITS.map((u) => `<option value="${u}">${esc(t(loc, `units.${u}`))}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="pool-chunk">${esc(t(loc, 'pool.chunkSize'))}</label>
            <input id="pool-chunk" type="number" min="1" max="1000" value="15" required>
          </div>
        </div>
        <div class="field">
          <label>${esc(t(loc, 'pool.pinDays'))}</label>
          <div class="chip-row" id="pin-day-chips">
            ${weekdayLabels.map((lbl, idx) => `<button type="button" class="chip-btn" data-pin-idx="${idx}">${esc(lbl)}</button>`).join('')}
          </div>
        </div>
        <button type="submit" class="btn btn-primary">${esc(t(loc, 'pool.createGoal'))}</button>
      </form>
    </section>

    <section class="grid-2">
      ${weekPools.map((pool) => {
        const prog = poolProgress(pool);
        return `
          <article class="card glass" data-pool-id="${esc(pool.id)}">
            <div class="card-head">
              <div>
                <span class="pill-badge muted-pill">${esc(t(loc, `categories.${pool.category}`))}</span>
                <h3>${esc(pool.title)}</h3>
              </div>
              <span class="pill-badge">${prog.percent}%</span>
            </div>
            <progress class="craft-progress" max="${prog.target}" value="${prog.done}"></progress>
            <p class="muted">
              ${prog.done} / ${prog.target} ${esc(t(loc, `units.${pool.unit}`))} •
              ${esc(t(loc, 'pool.remainingLabel', { n: prog.remaining, unit: t(loc, `units.${pool.unit}`) }))}
              ${pool.earlyCompleted ? ` • <strong>${esc(t(loc, 'pool.earlyBadge'))}</strong>` : ''}
            </p>
            ${pool.pinnedDays?.length ? `<div class="muted">📌 ${pool.pinnedDays.map((i) => weekdayLabels[i]).join(' / ')}</div>` : ''}
            <div class="chunk-grid">
              ${pool.chunks.map((c) => `
                <button type="button" class="chunk-btn${c.done ? ' done' : ''}" data-action="toggle-chunk" data-pool-id="${esc(pool.id)}" data-chunk-id="${esc(c.id)}">
                  ${c.amount} ${esc(t(loc, `units.${pool.unit}`))}
                </button>
              `).join('')}
            </div>
            <div class="chip-row">
              <button type="button" class="btn btn-primary btn-sm" data-action="focus-pool" data-pool-id="${esc(pool.id)}">⏱️ ${esc(t(loc, 'pool.focusThis'))}</button>
              <button type="button" class="btn btn-secondary btn-sm" data-action="manual-pool" data-pool-id="${esc(pool.id)}">${esc(t(loc, 'pool.logManual'))}</button>
              <button type="button" class="btn btn-danger btn-sm" data-action="delete-pool" data-pool-id="${esc(pool.id)}">✕</button>
            </div>
          </article>
        `;
      }).join('')}
    </section>

    <section class="card glass">
      <div class="card-head">
        <h2>${esc(t(loc, 'pool.milestonesTitle'))}</h2>
      </div>
      <form id="milestone-form" class="grid-3">
        <div class="field">
          <label for="ms-name">${esc(t(loc, 'pool.milestoneName'))}</label>
          <input id="ms-name" type="text" maxlength="60" placeholder="e.g., JLPT N2 / App v1.0">
        </div>
        <div class="field">
          <label for="ms-date">${esc(t(loc, 'pool.milestoneDate'))}</label>
          <input id="ms-date" type="date" value="${addDaysToKey(todayKey, 14)}">
        </div>
        <div class="field" style="justify-content:flex-end">
          <button type="submit" class="btn btn-secondary">${esc(t(loc, 'pool.addMilestone'))}</button>
        </div>
      </form>
      <div class="chip-row">
        ${(state.milestones || []).map((m) => {
          const diff = daysBetweenKeys(todayKey, m.date);
          const badge = diff > 0 ? t(loc, 'pool.daysLeft', { n: diff }) : diff === 0 ? t(loc, 'pool.dueToday') : t(loc, 'pool.passed');
          return `
            <span class="pill-badge">
              🎯 ${esc(m.name)} (${esc(badge)})
              <button type="button" data-action="delete-ms" data-ms-id="${esc(m.id)}" style="border:none;background:none;cursor:pointer;font-weight:800">×</button>
            </span>
          `;
        }).join('')}
      </div>
    </section>
  `;

  // Event wiring
  const selectedPins = new Set();
  main.querySelectorAll('[data-pin-idx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.pinIdx);
      if (selectedPins.has(idx)) selectedPins.delete(idx);
      else selectedPins.add(idx);
      btn.classList.toggle('active', selectedPins.has(idx));
    });
  });

  document.getElementById('pool-create-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('pool-title').value.trim();
    if (!title) return;
    const task = createPoolTask({
      title,
      category: document.getElementById('pool-category').value,
      unit: document.getElementById('pool-unit').value,
      target: Number(document.getElementById('pool-target').value),
      chunkSize: Number(document.getElementById('pool-chunk').value),
      weekKey: wk,
      pinnedDays: [...selectedPins]
    });
    soundEngine.play('pass');
    setState((prev) => ({ ...prev, pools: [task, ...(prev.pools || [])] }));
  });

  document.getElementById('milestone-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('ms-name').value.trim();
    const date = document.getElementById('ms-date').value;
    if (!name || !date) return;
    setState((prev) => ({
      ...prev,
      milestones: [...(prev.milestones || []), { id: `ms_${Date.now()}`, name, date }]
    }));
  });

  main.querySelectorAll('[data-action="toggle-chunk"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.poolId;
      const cid = btn.dataset.chunkId;
      soundEngine.play('flip');
      vibrate(12);
      setState((prev) => ({
        ...prev,
        pools: prev.pools.map((p) => (p.id === pid ? togglePoolChunk(p, cid) : p))
      }));
    });
  });

  main.querySelectorAll('[data-action="focus-pool"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      focusDraft.poolId = btn.dataset.poolId;
      activeTab = 'focus';
      renderAll();
    });
  });

  main.querySelectorAll('[data-action="manual-pool"]').forEach((btn) => {
    btn.addEventListener('click', () => openManualLogDialog(btn.dataset.poolId));
  });

  main.querySelectorAll('[data-action="delete-pool"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.poolId;
      setState((prev) => ({ ...prev, pools: prev.pools.filter((p) => p.id !== pid) }));
    });
  });

  main.querySelectorAll('[data-action="delete-ms"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mid = btn.dataset.msId;
      setState((prev) => ({ ...prev, milestones: prev.milestones.filter((m) => m.id !== mid) }));
    });
  });
}

function openManualLogDialog(poolId) {
  const loc = locale();
  const pool = (state.pools || []).find((p) => p.id === poolId);
  if (!pool) return;
  openDialog(`
    <div class="card-head">
      <h2>${esc(t(loc, 'pool.manualTitle'))}: ${esc(pool.title)}</h2>
      <button type="button" class="icon-btn" id="dlg-close-btn">✕</button>
    </div>
    <form id="manual-log-form">
      <div class="field">
        <label for="ml-amount">${esc(t(loc, 'pool.manualAmount', { unit: t(loc, `units.${pool.unit}`) }))}</label>
        <input id="ml-amount" type="number" min="0" max="1000" value="${pool.chunkSize}">
      </div>
      <div class="field">
        <label for="ml-minutes">${esc(t(loc, 'pool.manualMinutes'))}</label>
        <input id="ml-minutes" type="number" min="1" max="600" value="25" required>
      </div>
      <div class="field">
        <label for="ml-note">${esc(t(loc, 'pool.manualNote'))}</label>
        <textarea id="ml-note"></textarea>
      </div>
      <button type="submit" class="btn btn-primary">${esc(t(loc, 'common.save'))}</button>
    </form>
  `);
  document.getElementById('dlg-close-btn').onclick = closeDialog;
  document.getElementById('manual-log-form').onsubmit = async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById('ml-amount').value) || 0;
    const mins = Math.max(1, Number(document.getElementById('ml-minutes').value) || 1);
    const note = document.getElementById('ml-note').value.trim();
    const nowMs = Date.now();
    const session = {
      id: `sess_${nowMs}`,
      source: 'manual',
      poolId: pool.id,
      category: pool.category,
      dayKey: getLocalDayKey(nowMs),
      weekKey: getWeekStartKey(nowMs, state.settings?.weekStart || 'mon'),
      startedAt: nowMs - mins * 60_000,
      endedAt: nowMs,
      seconds: mins * 60,
      expeditionEligibleSeconds: mins * 60,
      companionId: state.activeCompanion,
      note,
      frameCount: 0,
      timelapseId: null
    };
    const nextLedger = await appendProofLedgerEntry(state.proofLedger || [], session);
    soundEngine.play('finish');
    closeDialog();
    setState((prev) => ({
      ...prev,
      pools: prev.pools.map((p) => (p.id === pool.id ? advancePoolAmount(p, amount, nowMs) : p)),
      sessions: [session, ...(prev.sessions || [])],
      companionBonds: {
        ...(prev.companionBonds || {}),
        [prev.activeCompanion]: (Number(prev.companionBonds?.[prev.activeCompanion]) || 0) + session.seconds
      },
      proofLedger: nextLedger
    }));
    showToast(t(loc, 'focus.summaryExp', { exp: mins }));
  };
}

const focusDraft = {
  poolId: '',
  mode: 'pomodoro', // 'stopwatch' | 'pomodoro' | 'deep'
  useCamera: false,
  blur: 'soft',
  ambient: 'off'
};

function renderFocusTab(main) {
  const loc = locale();
  const wk = weekKeyNow();
  const weekPools = (state.pools || []).filter((p) => p.weekKey === wk);
  const activePending = getActivePendingGems(state);
  const ownedRooms = ROOMS.filter((r) => (state.ownedRooms || ['mint', 'forest']).includes(r.id));
  const currentRoom = ROOMS.find((r) => r.id === state.activeRoom) || ROOMS[0];
  const blessing = getActiveBlessing(state, loc);
  const totalSec = calcTotalFocusSeconds(state.sessions);
  const rank = calcGuildLevel(totalSec, loc);

  main.innerHTML = `
    <header class="page-header">
      <h1>${esc(t(loc, 'focus.title'))}</h1>
      <p>${esc(t(loc, 'focus.cameraHint'))}</p>
    </header>

    ${activePending.length > 0 ? `
      <section class="card glass" style="border-color:var(--gold)">
        <div class="card-head">
          <h2>💎 ${esc(t(loc, 'focus.breakTitle'))}</h2>
          <button type="button" id="open-break-btn" class="btn btn-gold btn-sm">${esc(t(loc, 'focus.openBreak'))} (${activePending.length})</button>
        </div>
      </section>
    ` : ''}

    <section class="card glass">
      <canvas id="focus-preview-canvas" class="scene-canvas" width="440" height="190"></canvas>
      <div class="grid-2" style="margin-top:14px">
        <div class="field">
          <label for="focus-pool-select">${esc(t(loc, 'focus.linkedGoal'))}</label>
          <select id="focus-pool-select">
            <option value="">${esc(t(loc, 'focus.noGoal'))}</option>
            ${weekPools.map((p) => `<option value="${esc(p.id)}"${focusDraft.poolId === p.id ? ' selected' : ''}>${esc(p.title)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="focus-room-select">${esc(t(loc, 'focus.roomBackdrop'))}</label>
          <select id="focus-room-select">
            ${ownedRooms.map((r) => `<option value="${esc(r.id)}"${state.activeRoom === r.id ? ' selected' : ''}>${esc(r[loc] || r.en)}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="field">
        <label>${esc(t(loc, 'focus.targetRemain'))}</label>
        <div class="chip-row">
          <button type="button" class="chip-btn${focusDraft.mode === 'stopwatch' ? ' active' : ''}" data-f-mode="stopwatch">${esc(t(loc, 'focus.modeStopwatch'))}</button>
          <button type="button" class="chip-btn${focusDraft.mode === 'pomodoro' ? ' active' : ''}" data-f-mode="pomodoro">${esc(t(loc, 'focus.modePomodoro'))}</button>
          <button type="button" class="chip-btn${focusDraft.mode === 'deep' ? ' active' : ''}" data-f-mode="deep">${esc(t(loc, 'focus.modeDeep'))}</button>
        </div>
      </div>

      <div class="grid-2">
        <div class="field">
          <label>${esc(t(loc, 'focus.cameraTitle'))}</label>
          <div class="chip-row">
            <button type="button" class="chip-btn${!focusDraft.useCamera ? ' active' : ''}" data-f-cam="0">${esc(t(loc, 'focus.cameraDisable'))}</button>
            <button type="button" class="chip-btn${focusDraft.useCamera ? ' active' : ''}" data-f-cam="1">📷 ${esc(t(loc, 'focus.cameraEnable'))}</button>
          </div>
          ${focusDraft.useCamera ? `
            <div class="chip-row" style="margin-top:6px">
              <button type="button" class="chip-btn${focusDraft.blur === 'off' ? ' active' : ''}" data-f-blur="off">${esc(t(loc, 'focus.blurOff'))}</button>
              <button type="button" class="chip-btn${focusDraft.blur === 'soft' ? ' active' : ''}" data-f-blur="soft">${esc(t(loc, 'focus.blurSoft'))}</button>
              <button type="button" class="chip-btn${focusDraft.blur === 'heavy' ? ' active' : ''}" data-f-blur="heavy">${esc(t(loc, 'focus.blurHeavy'))}</button>
            </div>
          ` : ''}
        </div>
        <div class="field">
          <label for="focus-ambient-select">${esc(t(loc, 'focus.ambientSound'))}</label>
          <select id="focus-ambient-select">
            <option value="off"${focusDraft.ambient === 'off' ? ' selected' : ''}>${esc(t(loc, 'focus.ambientOff'))}</option>
            <option value="rain"${focusDraft.ambient === 'rain' ? ' selected' : ''}>${esc(t(loc, 'focus.ambientRain'))}</option>
            <option value="brown"${focusDraft.ambient === 'brown' ? ' selected' : ''}>${esc(t(loc, 'focus.ambientBrown'))}</option>
            <option value="drone"${focusDraft.ambient === 'drone' ? ' selected' : ''}>${esc(t(loc, 'focus.ambientDrone'))}</option>
          </select>
        </div>
      </div>

      <button type="button" id="start-focus-btn" class="btn btn-primary" style="width:100%">▶ ${esc(t(loc, 'focus.startSession'))}</button>
    </section>
  `;

  if (sceneCleanup) sceneCleanup();
  sceneCleanup = startSceneRenderer(document.getElementById('focus-preview-canvas'), () => ({
    roomSrc: currentRoom.src,
    worldSrc: rank.unlockedWorld.src,
    heroBase: state.profile?.heroBase || 'boy-b',
    heroState: 'study',
    companionId: state.activeCompanion || 'twigfox',
    blessingTheme: blessing?.theme || null,
    equipped: state.equipped,
    reducedMotion: state.settings?.reducedMotion
  }));

  document.getElementById('open-break-btn')?.addEventListener('click', openBreakDialog);
  document.getElementById('focus-pool-select').onchange = (e) => { focusDraft.poolId = e.target.value; };
  document.getElementById('focus-room-select').onchange = (e) => {
    setState((prev) => ({ ...prev, activeRoom: e.target.value }));
  };
  document.getElementById('focus-ambient-select').onchange = (e) => { focusDraft.ambient = e.target.value; };
  main.querySelectorAll('[data-f-mode]').forEach((b) => b.addEventListener('click', () => {
    focusDraft.mode = b.dataset.fMode;
    renderFocusTab(main);
  }));
  main.querySelectorAll('[data-f-cam]').forEach((b) => b.addEventListener('click', () => {
    focusDraft.useCamera = b.dataset.fCam === '1';
    renderFocusTab(main);
  }));
  main.querySelectorAll('[data-f-blur]').forEach((b) => b.addEventListener('click', () => {
    focusDraft.blur = b.dataset.fBlur;
    renderFocusTab(main);
  }));
  document.getElementById('start-focus-btn').onclick = startFocusSession;
}

async function startFocusSession() {
  const nowMs = Date.now();
  const targetSec = focusDraft.mode === 'pomodoro' ? 25 * 60 : focusDraft.mode === 'deep' ? 50 * 60 : 0;
  liveTimer = {
    id: `timer_${nowMs}`,
    poolId: focusDraft.poolId || null,
    mode: focusDraft.mode,
    targetSec,
    useCamera: focusDraft.useCamera,
    blur: focusDraft.blur,
    ambient: focusDraft.ambient,
    startedAt: nowMs,
    resumedAt: nowMs,
    accumulatedSec: 0,
    running: true
  };
  persistActiveTimer();
  soundEngine.play('start');
  soundEngine.startAmbient(liveTimer.ambient);
  setKeepScreenOn(true);
  renderFocusOverlay();
}

async function renderFocusOverlay() {
  const overlay = document.getElementById('focus-overlay');
  if (!liveTimer) {
    overlay.hidden = true;
    if (focusSceneCleanup) { focusSceneCleanup(); focusSceneCleanup = null; }
    clearInterval(timerTickInterval);
    cameraRecorder.stopPreview();
    soundEngine.stopAmbient();
    setKeepScreenOn(false);
    return;
  }

  const loc = locale();
  const currentRoom = ROOMS.find((r) => r.id === state.activeRoom) || ROOMS[0];
  const blessing = getActiveBlessing(state, loc);
  const comp = COMPANIONS.find((c) => c.id === state.activeCompanion) || COMPANIONS[0];
  const bond = companionBondInfo(state.companionBonds?.[comp.id] || 0, loc);

  overlay.hidden = false;
  overlay.innerHTML = `
    ${liveTimer.useCamera
      ? `<video id="focus-cam-video" class="focus-bg blur-${esc(liveTimer.blur)}" playsinline muted></video>`
      : `<img src="${esc(currentRoom.src)}" class="focus-bg" alt="">`}
    <div class="focus-fg">
      <div class="focus-glass-panel" style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
        <strong>Craft Glass • ${esc(comp[loc] || comp.en)} (♥${bond.hearts})</strong>
        <div class="chip-row">
          ${liveTimer.useCamera ? `<button type="button" id="ov-flip-cam" class="btn btn-secondary btn-sm">🔄 ${esc(t(loc, 'focus.flipCamera'))}</button>` : ''}
          <button type="button" id="ov-pause-btn" class="btn btn-secondary btn-sm">${liveTimer.running ? esc(t(loc, 'common.pause')) : esc(t(loc, 'common.resume'))}</button>
        </div>
      </div>

      <div class="focus-glass-panel" style="text-align:center">
        <div id="ov-clock" class="timer-digits">00:00</div>
        <p id="ov-subclock" style="margin:4px 0 12px;color:#a7f3d0"></p>
        <canvas id="ov-rpg-canvas" class="scene-canvas" width="360" height="140" style="max-width:360px;margin:0 auto"></canvas>
        <p style="margin:10px 0 0;font-size:0.84rem;color:#d1fae5">${esc(t(loc, 'focus.justWatchNote'))}</p>
      </div>

      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button type="button" id="ov-finish-btn" class="btn btn-primary" style="min-width:190px">✓ ${esc(t(loc, 'focus.finishSession'))}</button>
      </div>
    </div>
  `;

  if (focusSceneCleanup) focusSceneCleanup();
  focusSceneCleanup = startSceneRenderer(document.getElementById('ov-rpg-canvas'), () => ({
    roomSrc: currentRoom.src,
    heroBase: state.profile?.heroBase || 'boy-b',
    heroState: liveTimer.running ? 'study' : 'idle',
    companionId: comp.id,
    blessingTheme: blessing?.theme || null,
    equipped: state.equipped,
    reducedMotion: state.settings?.reducedMotion
  }));

  if (liveTimer.useCamera) {
    const videoEl = document.getElementById('focus-cam-video');
    cameraRecorder.startPreview(videoEl, { blurMode: liveTimer.blur }).then(() => {
      cameraRecorder.startRecording();
    }).catch(() => {
      liveTimer.useCamera = false;
      persistActiveTimer();
      renderFocusOverlay();
    });
    document.getElementById('ov-flip-cam')?.addEventListener('click', () => {
      cameraRecorder.flipCamera(document.getElementById('focus-cam-video')).catch(() => {});
    });
  }

  const updateDigits = () => {
    const elapsed = getTimerElapsedSeconds();
    document.getElementById('ov-clock').textContent = formatClock(elapsed);
    const sub = document.getElementById('ov-subclock');
    if (liveTimer.targetSec > 0) {
      const rem = Math.max(0, liveTimer.targetSec - elapsed);
      sub.textContent = `${t(loc, 'focus.targetRemain')}: ${formatClock(rem)}`;
    } else {
      sub.textContent = t(loc, 'focus.elapsed');
    }
  };
  updateDigits();
  clearInterval(timerTickInterval);
  timerTickInterval = setInterval(updateDigits, 1000);

  document.getElementById('ov-pause-btn').onclick = () => {
    const now = Date.now();
    if (liveTimer.running) {
      liveTimer.accumulatedSec = getTimerElapsedSeconds(liveTimer, now);
      liveTimer.resumedAt = null;
      liveTimer.running = false;
    } else {
      liveTimer.resumedAt = now;
      liveTimer.running = true;
    }
    persistActiveTimer();
    renderFocusOverlay();
  };

  document.getElementById('ov-finish-btn').onclick = finishFocusSession;
}

async function finishFocusSession() {
  const loc = locale();
  const nowMs = Date.now();
  const elapsedSec = getTimerElapsedSeconds(liveTimer, nowMs);
  const capturedFrames = liveTimer.useCamera ? cameraRecorder.stopRecording() : [];
  const linkedPoolId = liveTimer.poolId;
  const startedAt = liveTimer.startedAt;
  const timerId = liveTimer.id;

  liveTimer = null;
  persistActiveTimer();
  await renderFocusOverlay();

  if (elapsedSec < 60) {
    showToast(t(loc, 'focus.abandonShort'));
    return;
  }

  const pool = linkedPoolId ? (state.pools || []).find((p) => p.id === linkedPoolId) : null;
  const dayKey = getLocalDayKey(startedAt);
  const weekKey = getWeekStartKey(startedAt, state.settings?.weekStart || 'mon');
  let timelapseId = null;

  if (capturedFrames.length > 0) {
    timelapseId = `tl_${nowMs}`;
    await saveTimelapseSession({
      id: timelapseId,
      sessionId: timerId,
      dayKey,
      weekKey,
      category: pool?.category || 'study',
      startedAt,
      seconds: elapsedSec,
      frames: capturedFrames
    }).catch(() => { timelapseId = null; });
  }

  const session = {
    id: `sess_${nowMs}`,
    source: 'timer',
    poolId: linkedPoolId,
    category: pool?.category || 'study',
    dayKey,
    weekKey,
    startedAt,
    endedAt: nowMs,
    seconds: elapsedSec,
    expeditionEligibleSeconds: elapsedSec,
    companionId: state.activeCompanion || 'twigfox',
    frameCount: capturedFrames.length,
    timelapseId
  };

  const nextLedger = await appendProofLedgerEntry(state.proofLedger || [], session);
  soundEngine.play('finish');
  vibrate(35);

  let nextState = {
    ...state,
    sessions: [session, ...(state.sessions || [])],
    companionBonds: {
      ...(state.companionBonds || {}),
      [session.companionId]: (Number(state.companionBonds?.[session.companionId]) || 0) + session.seconds
    },
    proofLedger: nextLedger
  };
  nextState = spawnBreakGemForSession(nextState, session, nowMs);
  setState(nextState);

  cachedTimelapses = await listTimelapseSessions();
  openFinishSummaryDialog(session);
}

function openFinishSummaryDialog(session) {
  const loc = locale();
  const mins = Math.round(session.seconds / 60);
  const gem = (state.pendingGems || []).find((g) => g.sessionId === session.id && !g.claimedAt);
  const pool = session.poolId ? (state.pools || []).find((p) => p.id === session.poolId) : null;

  openDialog(`
    <div class="card-head">
      <h2>🎉 ${esc(t(loc, 'focus.summaryTitle'))}</h2>
      <button type="button" class="icon-btn" id="sum-close">✕</button>
    </div>
    <p class="stat-value">+${mins} EXP</p>
    <p>${esc(t(loc, 'focus.summaryExp', { exp: mins }))}</p>
    ${session.frameCount > 0 ? `<p class="muted">📷 ${esc(t(loc, 'focus.summaryFrames', { n: session.frameCount }))}</p>` : ''}
    ${gem ? `
      <div class="card" style="background:var(--gold-soft);margin:12px 0">
        <strong>💎 ${esc(t(loc, `gems.${gem.gemId}.name`))} (${esc(t(loc, `gems.${gem.gemId}.mineral`))})</strong>
        <p class="muted" style="margin:4px 0 8px">${esc(t(loc, 'focus.gemAppeared', { name: t(loc, `gems.${gem.gemId}.name`), mineral: t(loc, `gems.${gem.gemId}.mineral`) }))}</p>
        <button type="button" id="sum-break-btn" class="btn btn-gold btn-sm">${esc(t(loc, 'focus.openBreak'))}</button>
      </div>
    ` : ''}
    ${pool ? `
      <div class="field" style="margin-top:12px">
        <label for="sum-pool-delta">${esc(t(loc, 'focus.progressAdd', { title: pool.title, unit: t(loc, `units.${pool.unit}`) }))}</label>
        <div style="display:flex;gap:8px">
          <input id="sum-pool-delta" type="number" min="0" value="${pool.unit === 'min' ? mins : pool.chunkSize}">
          <button type="button" id="sum-pool-apply" class="btn btn-secondary">${esc(t(loc, 'common.save'))}</button>
        </div>
      </div>
    ` : ''}
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:14px 0">
    <p class="muted">${esc(t(loc, 'focus.summaryCorrectionHint'))}</p>
    <div style="display:flex;gap:8px;align-items:center">
      <input id="sum-fix-min" type="number" min="1" max="720" value="${mins}" style="width:110px">
      <button type="button" id="sum-fix-btn" class="btn btn-secondary btn-sm">${esc(t(loc, 'focus.applyCorrection'))}</button>
    </div>
  `);

  document.getElementById('sum-close').onclick = closeDialog;
  document.getElementById('sum-break-btn')?.addEventListener('click', () => {
    closeDialog();
    openBreakDialog();
  });
  document.getElementById('sum-pool-apply')?.addEventListener('click', () => {
    const val = Number(document.getElementById('sum-pool-delta').value) || 0;
    if (val > 0 && pool) {
      setState((prev) => ({
        ...prev,
        pools: prev.pools.map((p) => (p.id === pool.id ? advancePoolAmount(p, val) : p))
      }));
      showToast(t(loc, 'common.done'));
    }
  });
  document.getElementById('sum-fix-btn').onclick = () => {
    const newMin = Math.max(1, Number(document.getElementById('sum-fix-min').value) || 1);
    const res = correctSessionDuration(state, session.id, newMin * 60);
    if (res.changed) {
      setState(res.state);
      showToast(t(loc, 'focus.correctionApplied', { min: newMin }));
      closeDialog();
    }
  };
}

function openBreakDialog() {
  const loc = locale();
  const pending = getActivePendingGems(state);
  const dailyEarned = getDailyGemEarned(state, getLocalDayKey());
  openDialog(`
    <div class="card-head">
      <h2>🏕️ ${esc(t(loc, 'focus.breakTitle'))}</h2>
      <button type="button" class="icon-btn" id="brk-close">✕</button>
    </div>
    <p class="muted">${esc(t(loc, 'focus.breakDesc'))}</p>
    ${pending.length === 0 ? `<p class="muted">${esc(t(loc, 'common.none'))}</p>` : pending.map((g) => `
      <div class="card" style="background:var(--gold-soft);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:10px">
        <div>
          <strong>💎 ${esc(t(loc, `gems.${g.gemId}.name`))}</strong>
          <div class="muted">${esc(t(loc, `gems.${g.gemId}.mineral`))} • ${formatMinutes(loc, g.studySeconds)}</div>
        </div>
        <button type="button" class="btn btn-gold btn-sm" data-claim-gem="${esc(g.id)}">${esc(t(loc, 'focus.claimGem', { pt: g.points }))}</button>
      </div>
    `).join('')}
    <p class="muted">${dailyEarned} / ${BREAK_GEM_DAILY_POINT_CAP} pt</p>
  `);
  document.getElementById('brk-close').onclick = closeDialog;
  document.querySelectorAll('[data-claim-gem]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const res = claimBreakGem(state, btn.dataset.claimGem, Date.now(), { inBreak: true });
      if (res.granted >= 0) {
        soundEngine.play('correct');
        vibrate(25);
        setState(res.state);
        showToast(t(loc, 'focus.gemClaimed', { pt: res.granted, earned: res.dailyEarned, cap: res.cap }));
        openBreakDialog();
      }
    });
  });
}

function renderGuildTab(main) {
  const loc = locale();
  const wk = weekKeyNow();
  const totalSec = calcTotalFocusSeconds(state.sessions);
  const rank = calcGuildLevel(totalSec, loc);
  const earlyCompleted = (state.pools || []).some((p) => p.weekKey === wk && p.earlyCompleted);
  const expedition = evaluateWeeklyExpedition({
    weekKey: wk,
    sessions: state.sessions,
    earlyCompleted,
    claimedPoints: Number(state.expeditionClaims?.[wk]) || 0
  });
  const comp = COMPANIONS.find((c) => c.id === state.activeCompanion) || COMPANIONS[0];
  const compBond = companionBondInfo(state.companionBonds?.[comp.id] || 0, loc);
  const blessing = getActiveBlessing(state, loc);
  const sealed = getSealedMonsters(state, wk);
  const unclaimedSeals = (state.sealEvents || []).filter((e) => !e.claimedAt);
  const dueCards = getDueCards(state.cards || []);

  main.innerHTML = `
    <header class="page-header">
      <h1>${esc(t(loc, 'guild.title'))}</h1>
      <p>${esc(t(loc, 'guild.worldLabel', { n: rank.unlockedWorld.id, name: rank.unlockedWorld[loc] || rank.unlockedWorld.en }))}</p>
    </header>

    <section class="card glass">
      <canvas id="guild-hero-canvas" class="scene-canvas" width="440" height="200"></canvas>
      <div class="card-head" style="margin-top:12px">
        <div>
          <span class="pill-badge">Lv.${rank.level} • ${esc(rank.rank)}</span>
          <h2 style="margin-top:6px">${esc(rank.rankTitle)}</h2>
        </div>
        <div class="muted">${formatMinutes(loc, totalSec)} / ${loc === 'ja' ? '400時間' : '400h'}</div>
      </div>
      <progress class="craft-progress" max="100" value="${rank.percent}"></progress>
      <p class="muted">${rank.nextRank
        ? esc(t(loc, 'guild.nextRank', {
            rank: rank.nextRank.rank,
            title: rank.nextRank.title,
            remaining: formatMinutes(loc, rank.nextRank.remainingMinutes * 60)
          }))
        : esc(t(loc, 'guild.maxRank'))}</p>
    </section>

    <div class="grid-2">
      <section class="card glass">
        <div class="card-head">
          <h2>${esc(t(loc, 'guild.expeditionTitle'))}</h2>
          <span class="pill-badge">${esc(t(loc, `expeditionTiers.${expedition.tierId}`))}</span>
        </div>
        <p class="muted">${esc(t(loc, 'guild.expeditionDesc'))}</p>
        <p><strong>${esc(t(loc, 'guild.effectiveWeek', { eff: formatMinutes(loc, expedition.effectiveSeconds), days: expedition.activeDays }))}</strong></p>
        <progress class="craft-progress" max="18000" value="${Math.min(18000, expedition.effectiveSeconds)}"></progress>
        <p class="muted" style="margin-top:8px">${expedition.campBonus ? esc(t(loc, 'guild.campBonusActive')) : esc(t(loc, 'guild.campBonusLocked'))}</p>
        ${expedition.claimablePoints > 0
          ? `<button type="button" id="claim-expedition-btn" class="btn btn-gold">${esc(t(loc, 'guild.claimExpedition', { pt: expedition.claimablePoints }))}</button>`
          : `<span class="muted">${esc(t(loc, 'guild.expeditionClaimed', { pt: expedition.claimedPoints }))}</span>`}
      </section>

      <section class="card glass">
        <div class="card-head">
          <h2>${esc(t(loc, 'fsrs.title'))}</h2>
          <span class="pill-badge">${esc(t(loc, 'fsrs.dueNow', { n: dueCards.length }))}</span>
        </div>
        <p class="muted">${esc(t(loc, 'guild.sealedDesc'))}</p>
        <div class="chip-row" style="margin-bottom:10px">
          <button type="button" id="open-fsrs-review-btn" class="btn btn-primary btn-sm" ${dueCards.length === 0 ? 'disabled' : ''}>🧠 ${esc(t(loc, 'fsrs.startReview'))}</button>
          <button type="button" id="open-fsrs-add-btn" class="btn btn-secondary btn-sm">${esc(t(loc, 'fsrs.newCard'))}</button>
          ${unclaimedSeals.length > 0 ? `<button type="button" id="claim-seals-btn" class="btn btn-gold btn-sm">${esc(t(loc, 'guild.claimSeals', { pt: unclaimedSeals.length * 2 }))}</button>` : ''}
        </div>
        ${sealed.length === 0 ? `<p class="muted">${esc(t(loc, 'guild.noSealed'))}</p>` : sealed.map((m) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid #e2e8f0;gap:8px">
            <div>
              <strong>${esc(loc === 'ja' ? m.kindNameJa : m.kindNameEn)}</strong>
              <div class="muted">${esc(m.title)}</div>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" data-seal-kind="${esc(m.sourceKind)}" data-seal-id="${esc(m.sourceId)}">
              ${m.sourceKind === 'card' ? esc(t(loc, 'guild.reviewCard')) : esc(t(loc, 'guild.focusNeglected'))}
            </button>
          </div>
        `).join('')}
      </section>
    </div>

    <section class="card glass">
      <div class="card-head">
        <h2>${esc(t(loc, 'guild.companionTitle'))}</h2>
        <span class="pill-badge">${esc(comp[loc] || comp.en)} • ♥${compBond.hearts}/${compBond.maxHearts} (${esc(compBond.label)})</span>
      </div>
      <p class="muted">${esc(t(loc, 'guild.companionHint'))} — “${esc(compBond.quote)}”</p>
      <div class="item-grid">
        ${COMPANIONS.map((c) => {
          const owned = (state.ownedCompanions || []).includes(c.id);
          const isCurrent = state.activeCompanion === c.id;
          return `
            <div class="shop-item">
              <canvas width="56" height="56" data-thumb-src="${esc(c.idleSrc)}"></canvas>
              <strong>${esc(c[loc] || c.en)}</strong>
              ${isCurrent
                ? `<span class="pill-badge">${esc(t(loc, 'guild.activeCompanion'))}</span>`
                : owned
                  ? `<button type="button" class="btn btn-secondary btn-sm" data-select-comp="${esc(c.id)}">${esc(t(loc, 'guild.selectCompanion'))}</button>`
                  : `<button type="button" class="btn btn-primary btn-sm" data-buy-kind="companion" data-buy-id="${esc(c.id)}" ${state.points < c.cost ? 'disabled' : ''}>${esc(t(loc, 'guild.unlock', { cost: c.cost }))}</button>`}
            </div>
          `;
        }).join('')}
      </div>
    </section>

    <section class="card glass">
      <div class="card-head">
        <h2>${esc(t(loc, 'guild.wardrobeTitle'))}</h2>
        <span class="pill-badge">${esc(t(loc, 'common.points', { n: state.points || 0 }))}</span>
      </div>
      <p class="muted">${esc(t(loc, 'guild.wardrobeDesc', { pt: state.points || 0 }))}</p>
      <div class="chip-row" style="margin-bottom:12px">
        ${HERO_BASES.map((hb) => `
          <button type="button" class="chip-btn${state.profile?.heroBase === hb.id ? ' active' : ''}" data-hero-base="${esc(hb.id)}">${esc(hb[loc] || hb.en)}</button>
        `).join('')}
      </div>
      <div class="item-grid">
        ${EQUIPMENT_CATALOG.filter((item) => item.key !== 'none').map((item) => {
          const owned = (state.ownedGear || []).includes(item.id);
          const isEquipped = state.equipped?.[item.slot] === item.key;
          return `
            <div class="shop-item">
              <img src="${esc(item.src)}" alt="">
              <strong style="font-size:0.84rem">${esc(item[loc] || item.en)}</strong>
              ${isEquipped
                ? `<span class="pill-badge">${esc(t(loc, 'guild.equipped'))}</span>`
                : owned
                  ? `<button type="button" class="btn btn-secondary btn-sm" data-equip-slot="${esc(item.slot)}" data-equip-key="${esc(item.key)}">${esc(t(loc, 'guild.owned'))}</button>`
                  : `<button type="button" class="btn btn-primary btn-sm" data-buy-kind="gear" data-buy-id="${esc(item.id)}" ${state.points < item.cost ? 'disabled' : ''}>${esc(t(loc, 'guild.unlock', { cost: item.cost }))}</button>`}
            </div>
          `;
        }).join('')}
      </div>
    </section>

    <section class="card glass">
      <div class="card-head"><h2>💎 ${esc(t(loc, 'guild.gemsShelfTitle'))}</h2></div>
      <div class="chip-row">
        ${BREAK_GEMS.map((g) => `<span class="pill-badge muted-pill">💎 ${esc(t(loc, `gems.${g.id}.name`))} × ${Number(state.gemCollection?.[g.id]) || 0}</span>`).join('')}
      </div>
    </section>
  `;

  if (sceneCleanup) sceneCleanup();
  sceneCleanup = startSceneRenderer(document.getElementById('guild-hero-canvas'), () => ({
    worldSrc: rank.unlockedWorld.src,
    heroBase: state.profile?.heroBase || 'boy-b',
    heroState: 'move',
    companionId: comp.id,
    blessingTheme: blessing?.theme || null,
    equipped: state.equipped,
    reducedMotion: state.settings?.reducedMotion
  }));

  main.querySelectorAll('[data-thumb-src]').forEach((c) => renderStaticSpriteThumb(c, c.dataset.thumbSrc, 80));

  document.getElementById('claim-expedition-btn')?.addEventListener('click', () => {
    const res = claimExpeditionChest(state, wk);
    if (res.granted > 0) {
      soundEngine.play('clear');
      vibrate(35);
      setState(res.state);
      showToast(`+${res.granted} pt!`);
    }
  });

  document.getElementById('open-fsrs-review-btn')?.addEventListener('click', openFsrsReviewDialog);
  document.getElementById('open-fsrs-add-btn')?.addEventListener('click', openFsrsAddDialog);
  document.getElementById('claim-seals-btn')?.addEventListener('click', () => {
    const res = claimSealedMonsterRewards(state);
    soundEngine.play('clear');
    setState(res.state);
    showToast(`+${res.granted} pt!`);
  });

  main.querySelectorAll('[data-seal-kind]').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.sealKind === 'card') openFsrsReviewDialog();
      else {
        focusDraft.poolId = b.dataset.sealId;
        activeTab = 'focus';
        renderAll();
      }
    });
  });

  main.querySelectorAll('[data-select-comp]').forEach((b) => {
    b.addEventListener('click', () => {
      soundEngine.play('pass');
      setState((prev) => ({ ...prev, activeCompanion: b.dataset.selectComp }));
    });
  });

  main.querySelectorAll('[data-hero-base]').forEach((b) => {
    b.addEventListener('click', () => {
      setState((prev) => ({ ...prev, profile: { ...prev.profile, heroBase: b.dataset.heroBase } }));
    });
  });

  main.querySelectorAll('[data-equip-slot]').forEach((b) => {
    b.addEventListener('click', () => {
      soundEngine.play('pass');
      setState((prev) => ({
        ...prev,
        equipped: { ...prev.equipped, [b.dataset.equipSlot]: b.dataset.equipKey }
      }));
    });
  });

  main.querySelectorAll('[data-buy-kind]').forEach((b) => {
    b.addEventListener('click', () => {
      const res = purchaseItem(state, b.dataset.buyKind, b.dataset.buyId);
      if (res.ok) {
        soundEngine.play('correct');
        setState(res.state);
      }
    });
  });
}

function openFsrsAddDialog() {
  const loc = locale();
  openDialog(`
    <div class="card-head">
      <h2>${esc(t(loc, 'fsrs.newCard'))}</h2>
      <button type="button" class="icon-btn" id="fc-add-close">✕</button>
    </div>
    <form id="fc-add-form">
      <div class="field">
        <label for="fc-deck">${esc(t(loc, 'fsrs.deck'))}</label>
        <input id="fc-deck" type="text" value="General" required>
      </div>
      <div class="field">
        <label for="fc-front">${esc(t(loc, 'fsrs.front'))}</label>
        <textarea id="fc-front" required></textarea>
      </div>
      <div class="field">
        <label for="fc-back">${esc(t(loc, 'fsrs.back'))}</label>
        <textarea id="fc-back" required></textarea>
      </div>
      <button type="submit" class="btn btn-primary">${esc(t(loc, 'common.save'))}</button>
    </form>
  `);
  document.getElementById('fc-add-close').onclick = closeDialog;
  document.getElementById('fc-add-form').onsubmit = (e) => {
    e.preventDefault();
    const card = new FSRSCard({
      deck: document.getElementById('fc-deck').value.trim() || 'General',
      front: document.getElementById('fc-front').value.trim(),
      back: document.getElementById('fc-back').value.trim()
    }).toJSON();
    closeDialog();
    setState((prev) => ({ ...prev, cards: [card, ...(prev.cards || [])] }));
  };
}

function openFsrsReviewDialog() {
  const loc = locale();
  const due = getDueCards(state.cards || []);
  if (due.length === 0) {
    openDialog(`
      <div class="card-head">
        <h2>${esc(t(loc, 'fsrs.title'))}</h2>
        <button type="button" class="icon-btn" id="fc-done-close">✕</button>
      </div>
      <p>${esc(t(loc, 'fsrs.allCaughtUp'))}</p>
    `);
    document.getElementById('fc-done-close').onclick = closeDialog;
    return;
  }

  const card = due[0];
  openDialog(`
    <div class="card-head">
      <h2>${esc(card.deck)} (${due.length})</h2>
      <button type="button" class="icon-btn" id="fc-rev-close">✕</button>
    </div>
    <div class="card" style="background:#fff;margin:10px 0">
      <p style="font-size:1.1rem;font-weight:700">${esc(card.front)}</p>
      <div id="fc-answer-box" hidden style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0">
        <p>${esc(card.back)}</p>
      </div>
    </div>
    <button type="button" id="fc-reveal-btn" class="btn btn-primary" style="width:100%">${esc(t(loc, 'fsrs.showAnswer'))}</button>
    <div id="fc-rate-row" class="chip-row" hidden style="margin-top:10px;justify-content:center">
      <button type="button" class="btn btn-danger btn-sm" data-rate="${Rating.Again}">${esc(t(loc, 'fsrs.again'))}</button>
      <button type="button" class="btn btn-secondary btn-sm" data-rate="${Rating.Hard}">${esc(t(loc, 'fsrs.hard'))}</button>
      <button type="button" class="btn btn-primary btn-sm" data-rate="${Rating.Good}">${esc(t(loc, 'fsrs.good'))}</button>
      <button type="button" class="btn btn-gold btn-sm" data-rate="${Rating.Easy}">${esc(t(loc, 'fsrs.easy'))}</button>
    </div>
  `);
  document.getElementById('fc-rev-close').onclick = closeDialog;
  document.getElementById('fc-reveal-btn').onclick = () => {
    document.getElementById('fc-answer-box').hidden = false;
    document.getElementById('fc-reveal-btn').hidden = true;
    document.getElementById('fc-rate-row').hidden = false;
  };
  document.querySelectorAll('[data-rate]').forEach((b) => {
    b.addEventListener('click', () => {
      const rating = Number(b.dataset.rate);
      const updated = card.schedule(rating, new Date()).toJSON();
      let nextState = {
        ...state,
        cards: (state.cards || []).map((c) => (c.id === card.id ? updated : c))
      };
      if (rating >= Rating.Good) {
        soundEngine.play('correct');
        nextState = recordMonsterSealEvent(nextState, 'card', card.id);
      } else {
        soundEngine.play('flip');
      }
      setState(nextState);
      openFsrsReviewDialog();
    });
  });
}

function renderProofTab(main) {
  const loc = locale();
  const wk = weekKeyNow();
  const activeBlessing = getActiveBlessing(state, loc);
  const recentLedger = (state.proofLedger || []).slice(-6).reverse();

  main.innerHTML = `
    <header class="page-header">
      <h1>${esc(t(loc, 'proof.title'))}</h1>
      <p>${esc(t(loc, 'proof.subtitle'))}</p>
    </header>

    <section class="card glass">
      <div class="card-head"><h2>🖼️ ${esc(t(loc, 'proof.cardTitle'))}</h2></div>
      <p class="muted">${esc(t(loc, 'proof.cardDesc'))}</p>
      <div class="grid-2">
        <div class="field">
          <label for="proof-display-name">${esc(t(loc, 'proof.displayNameLabel'))}</label>
          <input id="proof-display-name" type="text" maxlength="28" value="${esc(state.profile?.displayName || '')}">
        </div>
        <div class="field">
          <label for="proof-note">${esc(t(loc, 'proof.noteLabel'))}</label>
          <input id="proof-note" type="text" maxlength="72" placeholder="...">
        </div>
      </div>
      <div class="chip-row">
        <button type="button" id="gen-proof-card-btn" class="btn btn-primary">${esc(t(loc, 'proof.generateCard'))}</button>
        ${lastProofUrl ? `<button type="button" id="save-proof-png-btn" class="btn btn-secondary">${esc(t(loc, 'proof.savePng'))}</button>` : ''}
        ${lastProofUrl ? `<button type="button" id="share-proof-png-btn" class="btn btn-gold">${esc(t(loc, 'proof.shareCard'))}</button>` : ''}
      </div>
      ${lastProofUrl ? `<img src="${esc(lastProofUrl)}" class="preview-img" style="margin-top:14px" alt="Weekly Proof Card">` : ''}
    </section>

    <section class="card glass">
      <div class="card-head">
        <h2>🤝 ${esc(t(loc, 'proof.pactTitle'))}</h2>
      </div>
      <p class="muted">${esc(t(loc, 'proof.pactDesc'))}</p>
      <div class="card" style="background:${activeBlessing ? 'var(--gold-soft)' : '#f8fafc'};margin-bottom:14px">
        ${activeBlessing
          ? `<strong>✨ ${esc(t(loc, 'proof.activeBlessing', { title: activeBlessing.title, sender: activeBlessing.senderName, days: activeBlessing.remainingDays }))}</strong>
             ${activeBlessing.note ? `<p class="muted" style="margin:4px 0 0">“${esc(activeBlessing.note)}”</p>` : ''}`
          : `<span class="muted">${esc(t(loc, 'proof.noBlessing'))}</span>`}
      </div>

      <div class="grid-2">
        <div>
          <h3>1. ${esc(t(loc, 'proof.createPact'))}</h3>
          <div class="chip-row" style="margin-bottom:8px">
            <button type="button" id="gen-pact-btn" class="btn btn-primary btn-sm">${esc(t(loc, 'proof.createPact'))}</button>
            ${lastGeneratedPact ? `<button type="button" id="copy-pact-btn" class="btn btn-secondary btn-sm">${esc(t(loc, 'proof.copyPact'))}</button>` : ''}
          </div>
          <textarea id="my-pact-box" readonly rows="3" style="width:100%;border-radius:12px;padding:8px;border:1px solid #cbd5e1">${esc(lastGeneratedPact)}</textarea>

          <h3 style="margin-top:14px">2. ${esc(t(loc, 'proof.redeemTitle'))}</h3>
          <div class="field">
            <input id="redeem-code-input" type="text" placeholder="${esc(t(loc, 'proof.pasteBlessing'))}">
          </div>
          <button type="button" id="redeem-blessing-btn" class="btn btn-gold btn-sm">${esc(t(loc, 'proof.redeemBtn'))}</button>
        </div>

        <div>
          <h3>3. ${esc(t(loc, 'proof.verifyPartnerTitle'))}</h3>
          <div class="field">
            <input id="partner-pact-input" type="text" placeholder="${esc(t(loc, 'proof.pastePact'))}">
          </div>
          <button type="button" id="inspect-pact-btn" class="btn btn-secondary btn-sm">${esc(t(loc, 'proof.inspectPact'))}</button>
          ${inspectedPact ? `
            <div class="card" style="background:#f0fdf4;margin-top:10px">
              <strong>${esc(inspectedPact.name)} (${esc(inspectedPact.weekKey)})</strong>
              <p class="muted">${formatMinutes(loc, inspectedPact.totalSeconds)} • ${inspectedPact.activeDays}d • ${inspectedPact.timelapseFrames} frames</p>
              <div class="field">
                <label for="bless-sender-name">${esc(t(loc, 'proof.yourName'))}</label>
                <input id="bless-sender-name" type="text" maxlength="24" value="${esc(state.profile?.displayName || '')}">
              </div>
              <div class="field">
                <label for="bless-note">${esc(t(loc, 'proof.blessingNote'))}</label>
                <input id="bless-note" type="text" maxlength="80">
              </div>
              <div class="stamp-grid" style="margin-bottom:10px">
                ${BLESSING_STAMPS.slice(0, 6).map((st) => `
                  <button type="button" class="stamp-choice${selectedStampKey === st.key ? ' active' : ''}" data-pick-stamp="${esc(st.key)}">
                    <img src="${esc(st.src)}" alt="">
                    <span>${esc(t(loc, `stamps.${st.key}`))}</span>
                  </button>
                `).join('')}
              </div>
              <button type="button" id="issue-blessing-btn" class="btn btn-primary btn-sm">${esc(t(loc, 'proof.issueBlessing'))}</button>
              <textarea id="issued-blessing-box" readonly rows="2" style="width:100%;margin-top:8px;border-radius:10px;padding:6px;border:1px solid #cbd5e1"></textarea>
            </div>
          ` : ''}
        </div>
      </div>
    </section>

    <section class="card glass">
      <div class="card-head"><h2>🎬 ${esc(t(loc, 'proof.timelapseTitle'))}</h2></div>
      ${cachedTimelapses.length === 0 ? `<p class="muted">${esc(t(loc, 'proof.noTimelapses'))}</p>` : `
        <div class="grid-2">
          ${cachedTimelapses.map((tl) => `
            <div class="card" style="background:#fff">
              <strong>${esc(tl.dayKey)} • ${esc(t(loc, `categories.${tl.category}`))}</strong>
              <p class="muted">${formatMinutes(loc, tl.seconds)} • ${(tl.frames || []).length} frames</p>
              <div class="chip-row">
                <button type="button" class="btn btn-primary btn-sm" data-play-tl="${esc(tl.id)}">▶ ${esc(t(loc, 'proof.play'))}</button>
                <button type="button" class="btn btn-secondary btn-sm" data-export-tl="${esc(tl.id)}">⬇ ${esc(t(loc, 'proof.exportWebm'))}</button>
                <button type="button" class="btn btn-danger btn-sm" data-del-tl="${esc(tl.id)}">✕</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    </section>

    <section class="card glass">
      <div class="card-head">
        <h2>⛓️ ${esc(t(loc, 'proof.ledgerTitle'))}</h2>
        <button type="button" id="verify-chain-btn" class="btn btn-secondary btn-sm">${esc(t(loc, 'proof.verifyChain'))}</button>
      </div>
      ${recentLedger.length === 0 ? `<p class="muted">${esc(t(loc, 'common.none'))}</p>` : recentLedger.map((entry) => `
        <div style="font-size:0.84rem;padding:6px 0;border-top:1px solid #e2e8f0">
          <strong>#${entry.seq} • ${esc(entry.dayKey)}</strong> • ${esc(t(loc, `categories.${entry.category}`))} • ${formatMinutes(loc, entry.seconds)} • <code>${esc(entry.entryHash.slice(0, 14))}…</code>
        </div>
      `).join('')}
    </section>
  `;

  document.getElementById('gen-proof-card-btn').onclick = async () => {
    const displayName = document.getElementById('proof-display-name').value.trim();
    const note = document.getElementById('proof-note').value.trim();
    const summary = await buildWeeklyProofSummary(state, wk);
    const frames = cachedTimelapses.filter((tl) => tl.weekKey === wk).flatMap((tl) => tl.frames || []).slice(0, 4);
    const blob = await generateProofCardBlob({ state, weekKey: wk, summary, displayName, note, timelapseFrames: frames, locale: loc });
    if (lastProofUrl) URL.revokeObjectURL(lastProofUrl);
    lastProofBlob = blob;
    lastProofUrl = URL.createObjectURL(blob);
    renderProofTab(main);
  };

  document.getElementById('save-proof-png-btn')?.addEventListener('click', () => {
    if (lastProofBlob) saveBlobFile(`craft-glass-proof-${wk}.png`, lastProofBlob);
  });
  document.getElementById('share-proof-png-btn')?.addEventListener('click', () => {
    if (lastProofBlob) shareBlobFile(`craft-glass-proof-${wk}.png`, 'Craft Glass Weekly Proof', lastProofBlob);
  });

  document.getElementById('gen-pact-btn').onclick = async () => {
    const summary = await buildWeeklyProofSummary(state, wk);
    lastGeneratedPact = await encodeProofPact(summary);
    setState((prev) => ({
      ...prev,
      issuedProofHashes: [...new Set([...(prev.issuedProofHashes || []), summary.proofHash])].slice(-30)
    }));
  };

  document.getElementById('copy-pact-btn')?.addEventListener('click', async () => {
    await shareText('Craft Glass Pact', lastGeneratedPact);
    showToast(t(loc, 'common.copied'));
  });

  document.getElementById('inspect-pact-btn').onclick = async () => {
    const code = document.getElementById('partner-pact-input').value.trim();
    const decoded = await decodeProofPact(code);
    if (!decoded.valid) {
      showToast(t(loc, 'errors.invalidPact'));
      return;
    }
    inspectedPact = { ...decoded, rawCode: code };
    renderProofTab(main);
  };

  main.querySelectorAll('[data-pick-stamp]').forEach((b) => {
    b.addEventListener('click', () => {
      selectedStampKey = b.dataset.pickStamp;
      main.querySelectorAll('[data-pick-stamp]').forEach((x) => x.classList.toggle('active', x === b));
    });
  });

  document.getElementById('issue-blessing-btn')?.addEventListener('click', async () => {
    if (!inspectedPact) return;
    const senderName = document.getElementById('bless-sender-name').value.trim();
    const note = document.getElementById('bless-note').value.trim();
    const res = await issueHumanBlessing(inspectedPact.rawCode, {
      stampKey: selectedStampKey,
      senderName,
      note,
      senderDeviceId: state.deviceId
    });
    if (!res.ok) {
      showToast(t(loc, `errors.${res.error}`));
      return;
    }
    document.getElementById('issued-blessing-box').value = res.code;
    await shareText('Craft Glass Blessing', res.code);
    showToast(t(loc, 'common.copied'));
  });

  document.getElementById('redeem-blessing-btn').onclick = async () => {
    const code = document.getElementById('redeem-code-input').value.trim();
    const res = await redeemHumanBlessing(state, code);
    if (!res.ok) {
      showToast(t(loc, `errors.${res.error}`));
      return;
    }
    soundEngine.play('clear');
    vibrate(40);
    setState(res.state);
    showToast(t(loc, 'common.done'));
  };

  document.getElementById('verify-chain-btn').onclick = async () => {
    const check = await verifyProofLedgerChain(state.proofLedger || []);
    showToast(check.valid ? t(loc, 'proof.chainValid', { n: check.checked }) : t(loc, 'proof.chainInvalid'));
  };

  main.querySelectorAll('[data-play-tl]').forEach((b) => {
    b.addEventListener('click', async () => {
      const tl = await getTimelapseSession(b.dataset.playTl);
      if (tl?.frames?.length) openTimelapsePlayer(tl);
    });
  });
  main.querySelectorAll('[data-export-tl]').forEach((b) => {
    b.addEventListener('click', async () => {
      const tl = await getTimelapseSession(b.dataset.exportTl);
      if (!tl?.frames?.length) return;
      const out = await exportTimelapseVideo(tl);
      await saveBlobFile(out.filename, out.blob);
    });
  });
  main.querySelectorAll('[data-del-tl]').forEach((b) => {
    b.addEventListener('click', async () => {
      await deleteTimelapseSession(b.dataset.delTl);
      cachedTimelapses = await listTimelapseSessions();
      renderProofTab(main);
    });
  });
}

function openTimelapsePlayer(tl) {
  const frames = [...(tl.frames || [])].sort((a, b) => (a.at || 0) - (b.at || 0));
  let idx = 0;
  let playing = true;
  let intervalId = null;

  openDialog(`
    <div class="card-head">
      <h2>🎬 ${esc(tl.dayKey)} (${frames.length})</h2>
      <button type="button" class="icon-btn" id="tl-close">✕</button>
    </div>
    <img id="tl-frame-img" src="${esc(frames[0].dataUrl)}" class="preview-img" alt="">
    <input id="tl-scrubber" type="range" min="0" max="${Math.max(0, frames.length - 1)}" value="0" style="width:100%;margin:10px 0">
    <div class="chip-row">
      <button type="button" id="tl-play-btn" class="btn btn-primary btn-sm">❚❚</button>
      <span id="tl-counter" class="muted">1 / ${frames.length}</span>
    </div>
  `, () => { clearInterval(intervalId); });

  const updateFrame = () => {
    document.getElementById('tl-frame-img').src = frames[idx].dataUrl;
    document.getElementById('tl-scrubber').value = String(idx);
    document.getElementById('tl-counter').textContent = `${idx + 1} / ${frames.length}`;
  };
  intervalId = setInterval(() => {
    if (!playing) return;
    idx = (idx + 1) % frames.length;
    updateFrame();
  }, 220);

  document.getElementById('tl-close').onclick = closeDialog;
  document.getElementById('tl-play-btn').onclick = (e) => {
    playing = !playing;
    e.target.textContent = playing ? '❚❚' : '▶';
  };
  document.getElementById('tl-scrubber').oninput = (e) => {
    playing = false;
    document.getElementById('tl-play-btn').textContent = '▶';
    idx = Number(e.target.value) || 0;
    updateFrame();
  };
}

function renderInsightsTab(main) {
  const loc = locale();
  const today = getLocalDayKey();
  const dayTotals = new Map();
  const catTotals = new Map();
  for (const s of state.sessions || []) {
    const dk = s.dayKey || getLocalDayKey(s.startedAt);
    dayTotals.set(dk, (dayTotals.get(dk) || 0) + (Number(s.seconds) || 0));
    catTotals.set(s.category || 'other', (catTotals.get(s.category || 'other') || 0) + (Number(s.seconds) || 0));
  }

  const heatDays = Array.from({ length: 90 }, (_, i) => addDaysToKey(today, -(89 - i)));
  const totalCatSec = Math.max(1, calcTotalFocusSeconds(state.sessions));
  const recentLogs = (state.sessions || []).slice(0, 12);

  main.innerHTML = `
    <header class="page-header">
      <h1>${esc(t(loc, 'insights.title'))}</h1>
      <p>${esc(t(loc, 'insights.backupDesc'))}</p>
    </header>

    <div class="grid-2">
      <section class="card glass">
        <div class="card-head"><h2>${esc(t(loc, 'insights.heatmapTitle'))}</h2></div>
        <div class="heatmap-grid">
          ${heatDays.map((dk) => {
            const mins = Math.round((dayTotals.get(dk) || 0) / 60);
            const lvl = mins >= 90 ? 4 : mins >= 45 ? 3 : mins >= 15 ? 2 : mins > 0 ? 1 : 0;
            return `<div class="heat-cell${lvl ? ` heat-${lvl}` : ''}" title="${dk}: ${mins}m"></div>`;
          }).join('')}
        </div>
      </section>

      <section class="card glass">
        <div class="card-head"><h2>${esc(t(loc, 'insights.categoryTitle'))}</h2></div>
        ${catTotals.size === 0 ? `<p class="muted">${esc(t(loc, 'common.none'))}</p>` : [...catTotals.entries()].sort((a, b) => b[1] - a[1]).map(([cat, sec]) => {
          const pct = Math.round((sec / totalCatSec) * 100);
          return `
            <div style="margin-bottom:8px">
              <div style="display:flex;justify-content:space-between;font-size:0.86rem">
                <strong>${esc(t(loc, `categories.${cat}`))}</strong>
                <span>${formatMinutes(loc, sec)} (${pct}%)</span>
              </div>
              <progress class="craft-progress" max="100" value="${pct}"></progress>
            </div>
          `;
        }).join('')}
      </section>
    </div>

    <section class="card glass">
      <div class="card-head"><h2>${esc(t(loc, 'insights.recentLogs'))}</h2></div>
      ${recentLogs.length === 0 ? `<p class="muted">${esc(t(loc, 'common.none'))}</p>` : recentLogs.map((s) => {
        const srcLabel = s.source === 'timer'
          ? (loc === 'ja' ? 'タイマー' : 'Timer')
          : (loc === 'ja' ? '事後入力' : 'Offline');
        return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-top:1px solid #e2e8f0;gap:8px">
          <div>
            <strong>${esc(s.dayKey)} • ${esc(t(loc, `categories.${s.category}`))}</strong>
            <div class="muted">${formatMinutes(loc, s.seconds)} (${esc(srcLabel)})</div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" data-correct-log="${esc(s.id)}">${esc(t(loc, 'insights.correctBtn'))}</button>
        </div>
      `;
      }).join('')}
    </section>

    <section class="card glass">
      <div class="card-head"><h2>⚙️ ${esc(t(loc, 'insights.settingsTitle'))}</h2></div>
      <div class="grid-2">
        <div class="field">
          <label for="set-locale">${esc(t(loc, 'insights.languageLabel'))}</label>
          <select id="set-locale">
            <option value="en"${loc === 'en' ? ' selected' : ''}>English</option>
            <option value="ja"${loc === 'ja' ? ' selected' : ''}>日本語</option>
          </select>
        </div>
        <div class="field">
          <label for="set-weekstart">${esc(t(loc, 'insights.weekStartLabel'))}</label>
          <select id="set-weekstart">
            <option value="mon"${state.settings?.weekStart !== 'sun' ? ' selected' : ''}>${esc(t(loc, 'insights.weekMon'))}</option>
            <option value="sun"${state.settings?.weekStart === 'sun' ? ' selected' : ''}>${esc(t(loc, 'insights.weekSun'))}</option>
          </select>
        </div>
      </div>
      <div class="chip-row" style="margin-bottom:14px">
        <label style="display:flex;align-items:center;gap:6px;font-weight:600">
          <input id="set-sound" type="checkbox"${state.settings?.soundEnabled !== false ? ' checked' : ''}>
          ${esc(t(loc, 'insights.soundEffects'))}
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-weight:600">
          <input id="set-motion" type="checkbox"${state.settings?.reducedMotion ? ' checked' : ''}>
          ${esc(t(loc, 'insights.reducedMotion'))}
        </label>
      </div>

      <h3>${esc(t(loc, 'insights.backupTitle'))}</h3>
      <div class="chip-row">
        <button type="button" id="export-json-btn" class="btn btn-primary btn-sm">${esc(t(loc, 'insights.exportJson'))}</button>
        <label class="btn btn-secondary btn-sm" style="cursor:pointer">
          ${esc(t(loc, 'insights.importJson'))}
          <input id="import-json-input" type="file" accept="application/json" hidden>
        </label>
        <button type="button" id="open-guide-link" class="btn btn-secondary btn-sm">${esc(t(loc, 'insights.guideBtn'))}</button>
      </div>
    </section>
  `;

  main.querySelectorAll('[data-correct-log]').forEach((b) => {
    b.addEventListener('click', () => {
      const log = (state.sessions || []).find((s) => s.id === b.dataset.correctLog);
      if (!log) return;
      const curMin = Math.round(log.seconds / 60);
      openDialog(`
        <div class="card-head">
          <h2>${esc(t(loc, 'insights.correctBtn'))}</h2>
          <button type="button" class="icon-btn" id="cor-close">✕</button>
        </div>
        <p class="muted">${esc(t(loc, 'focus.summaryCorrectionHint'))}</p>
        <div class="field">
          <label for="cor-min">${esc(t(loc, 'focus.trueDurationMin'))}</label>
          <input id="cor-min" type="number" min="1" max="720" value="${curMin}">
        </div>
        <button type="button" id="cor-apply" class="btn btn-primary">${esc(t(loc, 'focus.applyCorrection'))}</button>
      `);
      document.getElementById('cor-close').onclick = closeDialog;
      document.getElementById('cor-apply').onclick = () => {
        const nextMin = Math.max(1, Number(document.getElementById('cor-min').value) || 1);
        const res = correctSessionDuration(state, log.id, nextMin * 60);
        closeDialog();
        if (res.changed) {
          setState(res.state);
          showToast(t(loc, 'focus.correctionApplied', { min: nextMin }));
        }
      };
    });
  });

  document.getElementById('set-locale').onchange = (e) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, locale: e.target.value } }));
  };
  document.getElementById('set-weekstart').onchange = (e) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, weekStart: e.target.value } }));
  };
  document.getElementById('set-sound').onchange = (e) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, soundEnabled: e.target.checked } }));
  };
  document.getElementById('set-motion').onchange = (e) => {
    setState((prev) => ({ ...prev, settings: { ...prev.settings, reducedMotion: e.target.checked } }));
  };

  document.getElementById('export-json-btn').onclick = () => {
    const blob = new Blob([exportStateBackupJson(state)], { type: 'application/json' });
    saveBlobFile(`craft-glass-backup-${today}.json`, blob);
  };
  document.getElementById('import-json-input').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const restored = parseStateBackupJson(txt);
      setState(restored);
      showToast(t(loc, 'insights.importConfirm'));
    } catch {
      showToast(t(loc, 'insights.importError'));
    }
  };
  document.getElementById('open-guide-link').onclick = openGuideDialog;
}

function openGuideDialog() {
  const loc = locale();
  const sections = t(loc, 'guide.sections');
  openDialog(`
    <div class="card-head">
      <h2>${esc(t(loc, 'guide.title'))}</h2>
      <button type="button" class="icon-btn" id="gd-close">✕</button>
    </div>
    ${sections.map(([title, body]) => `
      <div style="margin-bottom:12px">
        <h3 style="margin:0 0 4px;font-size:1rem">${esc(title)}</h3>
        <p class="muted" style="margin:0">${esc(body)}</p>
      </div>
    `).join('')}
  `);
  document.getElementById('gd-close').onclick = closeDialog;
}

function openOnboardingDialog() {
  const loc = locale();
  let chosenPack = 'study';
  openDialog(`
    <div class="card-head">
      <h2>✨ ${esc(t(loc, 'onboarding.welcomeTitle'))}</h2>
    </div>
    <p class="muted">${esc(t(loc, 'onboarding.welcomeBody'))}</p>
    <div class="field">
      <label>${esc(t(loc, 'onboarding.chooseLang'))}</label>
      <div class="chip-row">
        <button type="button" class="chip-btn${loc === 'en' ? ' active' : ''}" data-onb-lang="en">English</button>
        <button type="button" class="chip-btn${loc === 'ja' ? ' active' : ''}" data-onb-lang="ja">日本語</button>
      </div>
    </div>
    <div class="field">
      <label>${esc(t(loc, 'onboarding.chooseStarter'))}</label>
      <div class="grid-2" id="onb-packs">
        ${Object.keys(STARTER_PACKS).map((key) => `
          <button type="button" class="shop-item${chosenPack === key ? ' active' : ''}" data-onb-pack="${key}" style="cursor:pointer;border:2px solid ${chosenPack === key ? 'var(--emerald)' : '#e2e8f0'}">
            <strong>${esc(t(loc, `onboarding.starterTemplates.${key}.name`))}</strong>
            <small class="muted">${esc(t(loc, `onboarding.starterTemplates.${key}.desc`))}</small>
          </button>
        `).join('')}
        <button type="button" class="shop-item" data-onb-pack="blank" style="cursor:pointer;border:2px solid #e2e8f0">
          <strong>${esc(t(loc, 'onboarding.blankStart'))}</strong>
          <small class="muted">${esc(t(loc, 'onboarding.blankDesc'))}</small>
        </button>
      </div>
    </div>
    <button type="button" id="onb-go-btn" class="btn btn-primary" style="width:100%">${esc(t(loc, 'onboarding.enterGuild'))}</button>
  `);

  document.querySelectorAll('[data-onb-lang]').forEach((b) => {
    b.addEventListener('click', () => {
      const nextLoc = b.dataset.onbLang;
      const curName = state.profile?.displayName;
      const nextName = (!curName || curName === 'クラフト冒険者' || curName === 'Craft Explorer')
        ? (nextLoc === 'ja' ? 'クラフト冒険者' : 'Craft Explorer')
        : curName;
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, locale: nextLoc },
        profile: { ...prev.profile, displayName: nextName }
      }));
      openOnboardingDialog();
    });
  });

  document.querySelectorAll('[data-onb-pack]').forEach((b) => {
    b.addEventListener('click', () => {
      chosenPack = b.dataset.onbPack;
      document.querySelectorAll('[data-onb-pack]').forEach((x) => {
        x.style.borderColor = x === b ? 'var(--emerald)' : '#e2e8f0';
      });
    });
  });

  document.getElementById('onb-go-btn').onclick = () => {
    const next = applyStarterPack(state, chosenPack);
    closeDialog();
    soundEngine.play('start');
    setState(next);
  };
}

function renderAll() {
  renderChrome();
  const main = document.getElementById('app-main');
  if (sceneCleanup) { sceneCleanup(); sceneCleanup = null; }

  if (activeTab === 'pool') renderPoolTab(main);
  else if (activeTab === 'focus') renderFocusTab(main);
  else if (activeTab === 'guild') renderGuildTab(main);
  else if (activeTab === 'proof') renderProofTab(main);
  else if (activeTab === 'insights') renderInsightsTab(main);

  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      renderAll();
    });
  });
}

// Initial bootstrap
document.addEventListener('DOMContentLoaded', async () => {
  soundEngine.setEnabled(state.settings?.soundEnabled !== false);
  document.body.classList.toggle('reduced-motion', Boolean(state.settings?.reducedMotion));

  document.getElementById('lang-toggle-btn').onclick = () => {
    const nextLoc = locale() === 'en' ? 'ja' : 'en';
    setState((prev) => {
      const curName = prev.profile?.displayName;
      const nextName = (!curName || curName === 'クラフト冒険者' || curName === 'Craft Explorer')
        ? (nextLoc === 'ja' ? 'クラフト冒険者' : 'Craft Explorer')
        : curName;
      return {
        ...prev,
        settings: { ...prev.settings, locale: nextLoc },
        profile: { ...prev.profile, displayName: nextName }
      };
    });
  };
  document.getElementById('guide-open-btn').onclick = openGuideDialog;

  cachedTimelapses = await listTimelapseSessions();
  renderAll();
  if (liveTimer) renderFocusOverlay();
  if (!state.onboarded) openOnboardingDialog();
});
