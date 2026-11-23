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
