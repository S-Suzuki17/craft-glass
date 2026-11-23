// 1080px White & Deep-Emerald Weekly Proof Card PNG Generator

import { getWeekDates } from '../core/weekly-pool.js';
import { calcGuildLevel, calcTotalFocusSeconds } from '../core/rpg-engine.js';
import { t, formatMinutes } from '../core/i18n.js';
import { loadImage } from './pixel-renderer.js';

export async function generateProofCardBlob({
  state,
  weekKey,
  summary,
  displayName = '',
  note = '',
  timelapseFrames = [],
  locale = 'en'
}) {
  const width = 1080;
  const hasFrames = timelapseFrames.length > 0;
  const hasNote = Boolean(String(note || '').trim());
  const height = 1080 + (hasFrames ? 220 : 0) + (hasNote ? 120 : 0);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Crisp White Backdrop + Subtle Emerald Accent Header
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#065f46';
  ctx.fillRect(0, 0, width, 168);

  // Header Brand & Proof Hash
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px system-ui, -apple-system, sans-serif';
  ctx.fillText('Craft Glass', 56, 74);
  ctx.font = '600 22px system-ui, -apple-system, sans-serif';
  ctx.fillStyle = '#a7f3d0';
  ctx.fillText(t(locale, 'tagline'), 56, 114);

  const dates = getWeekDates(weekKey);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px system-ui, -apple-system, sans-serif';
  ctx.fillText(`${dates[0]}  –  ${dates[6]}`, width - 56, 70);
  ctx.font = 'bold 20px ui-monospace, monospace';
  ctx.fillStyle = '#fde68a';
  ctx.fillText(`#CG-${summary.proofHash.toUpperCase()}`, width - 56, 112);
  ctx.textAlign = 'left';

  // Profile & Guild Rank Row
  const totalSec = calcTotalFocusSeconds(state.sessions);
  const rank = calcGuildLevel(totalSec, locale);

  ctx.fillStyle = '#f0fdf4';
  ctx.strokeStyle = '#bbf7d0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(56, 200, width - 112, 130, 22);
  ctx.fill();
  ctx.stroke();

  const heroImg = await loadImage(`./assets/heroes/${state.profile?.heroBase || 'boy-b'}-idle.png`);
  if (heroImg && heroImg.naturalWidth > 0) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(heroImg, 0, 0, 80, 80, 78, 214, 102, 102);
    ctx.imageSmoothingEnabled = true;
  }

  const labelName = String(displayName || '').trim() || (locale === 'ja' ? 'クラフト冒険者' : 'Craft Explorer');
  ctx.fillStyle = '#064e3b';
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText(labelName, 200, 255);
  ctx.fillStyle = '#047857';
  ctx.font = '600 23px system-ui, sans-serif';
  ctx.fillText(`Lv.${rank.level}  •  ${rank.rank} (${rank.rankTitle})`, 200, 298);

  // Metric Pills
  const metrics = [
    [locale === 'ja' ? '今週の合計時間' : 'Weekly Total', formatMinutes(locale, summary.totalSeconds)],
    [locale === 'ja' ? '活動日数' : 'Active Days', `${summary.activeDays} / 7`],
    [locale === 'ja' ? 'タイムラプス' : 'Timelapse Frames', `${summary.timelapseFrames}`]
  ];
  const cardW = (width - 112 - 36) / 3;
  metrics.forEach(([lbl, val], idx) => {
    const x = 56 + idx * (cardW + 18);
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.roundRect(x, 360, cardW, 128, 20);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText(lbl, x + 24, 405);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 38px system-ui, sans-serif';
    ctx.fillText(val, x + 24, 458);
  });

  // Daily Bar Chart
  const dayLabels = state.settings?.weekStart === 'sun'
    ? t(locale, 'weekdaysSunFirst')
    : t(locale, 'weekdays');
  const daySec = new Map(dates.map((d) => [d, 0]));
  for (const s of state.sessions || []) {
    if (daySec.has(s.dayKey)) daySec.set(s.dayKey, daySec.get(s.dayKey) + (Number(s.seconds) || 0));
  }
  const maxMin = Math.max(60, ...dates.map((d) => Math.ceil((daySec.get(d) || 0) / 60)));

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(locale === 'ja' ? '日別の実作業時間' : 'Daily Craft Minutes', 56, 542);

  const chartX = 56;
  const chartY = 570;
  const chartW = width - 112;
  const chartH = 220;
  ctx.fillStyle = '#f8fafc';
  ctx.beginPath();
  ctx.roundRect(chartX, chartY, chartW, chartH, 20);
  ctx.fill();

  const barStep = (chartW - 80) / 7;
  dates.forEach((d, i) => {
    const mins = Math.round((daySec.get(d) || 0) / 60);
    const ratio = mins / maxMin;
    const bh = Math.max(8, Math.round(ratio * 130));
    const bx = chartX + 44 + i * barStep + 14;
    const by = chartY + 168 - bh;
    ctx.fillStyle = mins > 0 ? '#0f766e' : '#cbd5e1';
    ctx.beginPath();
    ctx.roundRect(bx, by, 54, bh, 10);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#334155';
    ctx.font = '600 19px system-ui, sans-serif';
    ctx.fillText(dayLabels[i], bx + 27, chartY + 198);
    if (mins > 0) {
      ctx.fillStyle = '#065f46';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(`${mins}m`, bx + 27, by - 10);
    }
  });
  ctx.textAlign = 'left';

  // Category Breakdown Bars
  const catSec = new Map();
  for (const s of state.sessions || []) {
    if (!daySec.has(s.dayKey)) continue;
    catSec.set(s.category, (catSec.get(s.category) || 0) + (Number(s.seconds) || 0));
  }
  const catRows = [...catSec.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText(locale === 'ja' ? 'カテゴリ別内訳' : 'Category Breakdown', 56, 845);

  const catTotal = Math.max(1, summary.totalSeconds);
  if (catRows.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '500 22px system-ui, sans-serif';
    ctx.fillText(locale === 'ja' ? '今週の集中記録はまだありません' : 'No recorded focus sessions this week yet.', 56, 895);
  } else {
    catRows.forEach(([cat, sec], idx) => {
      const y = 875 + idx * 44;
      const pct = Math.round((sec / catTotal) * 100);
      ctx.fillStyle = '#1e293b';
      ctx.font = '600 20px system-ui, sans-serif';
      ctx.fillText(t(locale, `categories.${cat}`), 56, y + 20);
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.roundRect(270, y + 4, 580, 20, 10);
      ctx.fill();
      ctx.fillStyle = '#0f766e';
      ctx.beginPath();
      ctx.roundRect(270, y + 4, Math.max(14, Math.round((pct / 100) * 580)), 20, 10);
      ctx.fill();
      ctx.textAlign = 'right';
      ctx.fillStyle = '#065f46';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(`${formatMinutes(locale, sec)} (${pct}%)`, width - 56, y + 20);
      ctx.textAlign = 'left';
    });
  }

  let cursorY = 1055;
  if (hasFrames) {
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(locale === 'ja' ? '作業タイムラプス証跡（ぼかし保護済み）' : 'Blurred Desk Timelapse Proof', 56, cursorY);
    const slice = timelapseFrames.slice(0, 4);
    for (let i = 0; i < slice.length; i++) {
      const img = await loadImage(slice[i].dataUrl);
      if (img) {
        const fx = 56 + i * 246;
        const fy = cursorY + 20;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(fx, fy, 228, 130, 14);
        ctx.clip();
        ctx.drawImage(img, fx, fy, 228, 130);
        ctx.restore();
      }
    }
    cursorY += 190;
  }

  if (hasNote) {
    ctx.fillStyle = '#f0fdf4';
    ctx.beginPath();
    ctx.roundRect(56, cursorY, width - 112, 86, 16);
    ctx.fill();
    ctx.fillStyle = '#064e3b';
    ctx.font = '500 22px system-ui, sans-serif';
    ctx.fillText(`“${String(note).trim().slice(0, 72)}”`, 80, cursorY + 52);
  }

  // Footer
  ctx.fillStyle = '#64748b';
  ctx.font = '500 18px system-ui, sans-serif';
  ctx.fillText('Craft Glass • Verified On-Device Ledger • Zero AI Hype', 56, height - 26);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
