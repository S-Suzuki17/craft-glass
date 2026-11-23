// Crisp Pixel Art Canvas Renderer for Worlds, Rooms, Heroes, Companions, Equipment Badges & Blessing Auras.

const imageCache = new Map();

export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  if (imageCache.has(src)) return imageCache.get(src);
  const p = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  imageCache.set(src, p);
  return p;
}

const AURA_COLORS = {
  gold: ['rgba(245, 158, 11, 0.35)', 'rgba(252, 211, 77, 0.7)'],
  emerald: ['rgba(16, 185, 129, 0.35)', 'rgba(110, 231, 183, 0.7)'],
  sky: ['rgba(14, 165, 233, 0.35)', 'rgba(125, 211, 252, 0.7)'],
  violet: ['rgba(139, 92, 246, 0.35)', 'rgba(196, 181, 253, 0.7)']
};

/**
 * Draws a full animated or static hero + companion + world scene onto a canvas.
 */
export function startSceneRenderer(canvas, getOptions) {
  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d');
  let rafId = null;
  let stopped = false;

  const drawFrame = async (nowMs) => {
    if (stopped) return;
    const opts = typeof getOptions === 'function' ? getOptions() : getOptions || {};
    const {
      worldSrc = './assets/worlds/world-01.png',
      roomSrc = null,
      heroBase = 'boy-b',
      heroState = 'idle', // 'idle' | 'move' | 'study'
      companionId = 'twigfox',
      blessingTheme = null,
      equipped = {},
      reducedMotion = false
    } = opts;

    const heroSrc = `./assets/heroes/${heroBase}-${heroState}.png`;
    const compSrc = companionId
      ? `./assets/creatures/${companionId}-${heroState === 'move' ? 'move' : 'idle'}.png`
      : null;

    const [bgImg, heroImg, compImg, headImg, weaponImg] = await Promise.all([
      loadImage(roomSrc || worldSrc),
      loadImage(heroSrc),
      loadImage(compSrc),
      equipped.head && equipped.head !== 'bandana' && equipped.head !== 'none'
        ? loadImage(`./assets/equipment/head-${equipped.head}.png`)
        : Promise.resolve(null),
      equipped.weapon && equipped.weapon !== 'none'
        ? loadImage(`./assets/equipment/weapon-${equipped.weapon}.png`)
        : Promise.resolve(null)
    ]);
    if (stopped) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    // 1. Background panorama (World or Study Room)
    if (bgImg && bgImg.naturalWidth > 0) {
      const scale = Math.max(w / bgImg.naturalWidth, h / bgImg.naturalHeight);
      const dw = bgImg.naturalWidth * scale;
      const dh = bgImg.naturalHeight * scale;
      const dx = (w - dw) / 2;
      const dy = (h - dh) / 2;
      ctx.drawImage(bgImg, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = '#0f3d35';
      ctx.fillRect(0, 0, w, h);
    }

    // Ground scrim for crisp foreground legibility
    const grad = ctx.createLinearGradient(0, h * 0.55, 0, h);
    grad.addColorStop(0, 'rgba(6, 30, 26, 0)');
    grad.addColorStop(1, 'rgba(6, 30, 26, 0.38)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, h * 0.55, w, h * 0.45);

    const frameIdx = reducedMotion ? 0 : Math.floor(nowMs / 130) % 16;
    const col = frameIdx % 4;
    const row = Math.floor(frameIdx / 4);

    // Hero placement
    const spriteSize = Math.min(Math.round(h * 0.62), 116);
    const heroX = Math.round(w * 0.28);
    const heroY = Math.round(h - spriteSize - h * 0.08);
    const bob = reducedMotion ? 0 : Math.round(Math.sin(nowMs / 420) * 2);

    // 2. Human Blessing Aura (7-Day Halo)
    if (blessingTheme && AURA_COLORS[blessingTheme]) {
      const [outer, inner] = AURA_COLORS[blessingTheme];
      const cx = heroX + spriteSize / 2;
      const cy = heroY + spriteSize / 2 + 4;
      const pulse = reducedMotion ? 1 : 1 + Math.sin(nowMs / 350) * 0.06;
      const r = spriteSize * 0.55 * pulse;
      const auraGrad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      auraGrad.addColorStop(0, inner);
      auraGrad.addColorStop(0.6, outer);
      auraGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = auraGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Draw Hero (Guard against 80x80 single-frame study sprite!)
    if (heroImg && heroImg.naturalWidth > 0) {
      const isGrid = heroImg.naturalWidth > 80 && heroImg.naturalHeight > 80;
      const sx = isGrid ? col * 80 : 0;
      const sy = isGrid ? row * 80 : 0;
      ctx.drawImage(heroImg, sx, sy, 80, 80, heroX, heroY + (isGrid ? 0 : bob), spriteSize, spriteSize);
    }

    // 4. Draw Companion beside hero
    if (compImg && compImg.naturalWidth > 0) {
      const compSize = Math.round(spriteSize * 0.78);
      const compX = Math.round(heroX + spriteSize * 0.92);
      const compY = Math.round(h - compSize - h * 0.08);
      const isGrid = compImg.naturalWidth > 80 && compImg.naturalHeight > 80;
      const sx = isGrid ? col * 80 : 0;
      const sy = isGrid ? row * 80 : 0;
      ctx.drawImage(compImg, sx, sy, 80, 80, compX, compY, compSize, compSize);
    }

    // 5. Compact Equipped Crest Icons (top-right corner of canvas)
    const badges = [headImg, weaponImg].filter((img) => img && img.naturalWidth > 0);
    badges.forEach((img, i) => {
      const bSize = 30;
      const bx = w - 12 - (i + 1) * (bSize + 6);
      const by = 10;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.roundRect(bx, by, bSize, bSize, 8);
      ctx.fill();
      ctx.drawImage(img, bx + 3, by + 3, bSize - 6, bSize - 6);
    });

    if (!reducedMotion && !stopped) {
      rafId = requestAnimationFrame(drawFrame);
    }
  };

  if (getOptions()?.reducedMotion) {
    drawFrame(0);
  } else {
    rafId = requestAnimationFrame(drawFrame);
  }

  return () => {
    stopped = true;
    if (rafId != null) cancelAnimationFrame(rafId);
  };
}

export async function renderStaticSpriteThumb(canvas, src, size = 80) {
  if (!canvas || !src) return;
  const img = await loadImage(src);
  if (!img || !img.naturalWidth) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  if (img.naturalWidth > size && img.naturalHeight > size) {
    // Trim 4px top / 3px side atlas boundary to eliminate any neighbor bleed
    ctx.drawImage(img, 3, 4, size - 6, size - 6, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, canvas.width, canvas.height);
  }
}

/**
 * Live 2-Hero + Companion Face-Off Auto-Battle Canvas Renderer.
 */
export function startDuelRenderer(canvas, getDuelState) {
  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d');
  let rafId = null;
  let stopped = false;

  const drawUnit = (img, col, row, x, y, size, flipX = false) => {
    if (!img || !img.naturalWidth) return;
    const isGrid = img.naturalWidth > 80 && img.naturalHeight > 80;
    const sx = isGrid ? col * 80 : 0;
    const sy = isGrid ? row * 80 : 0;
    ctx.save();
    if (flipX) {
      ctx.translate(x + size, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, 80, 80, 0, 0, size, size);
    } else {
      ctx.drawImage(img, sx, sy, 80, 80, x, y, size, size);
    }
    ctx.restore();
  };

  const drawHpBar = (x, y, bw, bh, cur, max, color, alignRight = false, label = '') => {
    const ratio = Math.max(0, Math.min(1, cur / Math.max(1, max)));
    ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
    ctx.beginPath();
    ctx.roundRect(x, y, bw, bh, 6);
    ctx.fill();

    const fw = Math.round((bw - 4) * ratio);
    if (fw > 0) {
      ctx.fillStyle = color;
      ctx.beginPath();
      const fx = alignRight ? x + bw - 2 - fw : x + 2;
      ctx.roundRect(fx, y + 2, fw, bh - 4, 4);
      ctx.fill();
    }

    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = alignRight ? 'right' : 'left';
    ctx.fillText(label, alignRight ? x + bw - 4 : x + 4, y - 4);
    ctx.fillText(`${cur}/${max}`, alignRight ? x + bw - 6 : x + 6, y + bh - 3);
  };

  const drawFrame = async (nowMs) => {
    if (stopped) return;
    const st = typeof getDuelState === 'function' ? getDuelState() : getDuelState || {};
    const {
      worldSrc = './assets/worlds/world-01.png',
      left,
      right,
      leftHp = left?.maxHp || 100,
      rightHp = right?.maxHp || 100,
      activeTurn = null,
      bannerText = '',
      reducedMotion = false
    } = st;

    if (!left || !right) return;
    const lMove = activeTurn?.actor === 'left';
    const rMove = activeTurn?.actor === 'right';

    const [bgImg, lHero, lComp, rHero, rComp] = await Promise.all([
      loadImage(worldSrc),
      loadImage(`./assets/heroes/${left.heroBase || 'boy-b'}-${lMove ? 'move' : 'idle'}.png`),
      loadImage(`./assets/creatures/${left.companionId || 'twigfox'}-${lMove ? 'move' : 'idle'}.png`),
      loadImage(`./assets/heroes/${right.heroBase || 'girl-b'}-${rMove ? 'move' : 'idle'}.png`),
      loadImage(`./assets/creatures/${right.companionId || 'twigfox'}-${rMove ? 'move' : 'idle'}.png`)
    ]);
    if (stopped) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    if (bgImg && bgImg.naturalWidth > 0) {
      const scale = Math.max(w / bgImg.naturalWidth, h / bgImg.naturalHeight);
      const dw = bgImg.naturalWidth * scale;
      const dh = bgImg.naturalHeight * scale;
      ctx.drawImage(bgImg, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = 'rgba(6, 28, 22, 0.35)';
    ctx.fillRect(0, 0, w, h);

    const frameIdx = reducedMotion ? 0 : Math.floor(nowMs / 110) % 16;
    const col = frameIdx % 4;
    const row = Math.floor(frameIdx / 4);

    const heroSize = Math.min(Math.round(h * 0.54), 96);
    const compSize = Math.round(heroSize * 0.72);
    const groundY = Math.round(h - heroSize - 12);
    const compY = Math.round(h - compSize - 12);

    const lLunge = lMove ? 26 : rMove ? -6 : 0;
    const rLunge = rMove ? -26 : lMove ? 6 : 0;

    const lx = Math.round(w * 0.14) + lLunge;
    const rx = Math.round(w - w * 0.14 - heroSize) + rLunge;

    // Draw Left companion & hero
    drawUnit(lComp, col, row, lx - Math.round(compSize * 0.55), compY, compSize, false);
    drawUnit(lHero, col, row, lx, groundY, heroSize, false);

    // Draw Right companion & hero (flipped horizontally to face Left!)
    drawUnit(rComp, col, row, rx + Math.round(heroSize * 0.82), compY, compSize, true);
    drawUnit(rHero, col, row, rx, groundY, heroSize, true);

    // HP Bars at top
    const barW = Math.min(180, Math.round(w * 0.38));
    drawHpBar(14, 22, barW, 15, leftHp, left.maxHp, '#10b981', false, `Lv.${left.level} ${left.name}`);
    drawHpBar(w - 14 - barW, 22, barW, 15, rightHp, right.maxHp, '#f59e0b', true, `Lv.${right.level} ${right.name}`);

    // VS badge center
    ctx.font = '900 13px system-ui, sans-serif';
    ctx.fillStyle = '#fde68a';
    ctx.textAlign = 'center';
    ctx.fillText('VS', w / 2, 33);

    // Floating hit effect
    if (activeTurn) {
      const targetX = activeTurn.actor === 'left' ? rx + heroSize / 2 : lx + heroSize / 2;
      const targetY = groundY + 14;
      ctx.font = '900 16px system-ui, sans-serif';
      ctx.fillStyle = activeTurn.kind === 'crit' ? '#fde047' : '#ffffff';
      const prefix = activeTurn.kind === 'crit' ? 'CRIT ' : activeTurn.kind === 'companion' ? 'PET ' : '';
      ctx.fillText(`${prefix}-${activeTurn.dmg}`, targetX, targetY);
    }

    if (bannerText) {
      ctx.fillStyle = 'rgba(6, 78, 59, 0.88)';
      const bw = 156;
      const bh = 32;
      ctx.beginPath();
      ctx.roundRect((w - bw) / 2, h / 2 - bh / 2, bw, bh, 16);
      ctx.fill();
      ctx.font = '900 15px system-ui, sans-serif';
      ctx.fillStyle = '#fde68a';
      ctx.textAlign = 'center';
      ctx.fillText(bannerText, w / 2, h / 2 + 5);
    }

    if (!reducedMotion && !stopped) {
      rafId = requestAnimationFrame(drawFrame);
    }
  };

  if (getDuelState()?.reducedMotion) {
    drawFrame(0);
  } else {
    rafId = requestAnimationFrame(drawFrame);
  }

  return () => {
    stopped = true;
    if (rafId != null) cancelAnimationFrame(rafId);
  };
}
