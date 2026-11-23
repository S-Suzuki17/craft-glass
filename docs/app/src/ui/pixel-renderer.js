// Crisp Pixel Art Canvas Renderer for Worlds, Rooms, Heroes, Companions, Equipment Badges,
// Direct On-Hero Weapon & Shield Rendering, Pixel Contact Shadows & Hop/Bounce Walk Cycles,
// 20-World Stage Weather & Ambient Particle FX, and High-Impact RPG Battle / Stage Boss VFX.

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
 * Maps worldSrc (world-01 .. world-20) to one of 7 atmospheric particle systems.
 */
export function resolveWorldWeatherKind(worldSrc = '') {
  const m = String(worldSrc).match(/world-(\d{2})/i);
  const id = m ? Number(m[1]) : 1;
  switch (id) {
    case 1:
    case 2:
    case 9:
    case 14:
      return 'fireflies'; // Meadow, Woods, Misty Fen, Harvest Orchard
    case 3:
    case 13:
    case 17:
      return 'crystal'; // Crystal Cavern, Clockwork Canal, Silent Archive
    case 4:
    case 18:
      return 'snow'; // Lantern Peaks, Aurora Glade
    case 5:
    case 6:
    case 16:
    case 19:
    case 20:
      return 'starlight'; // Cloud Corridor, Keep, Moonlit Cloister, Slumber Garden, Dawn Observatory
    case 7:
    case 11:
    case 12:
      return 'embers'; // Amber Dunes, Windcarved Ruins, Ember Ridge
    case 8:
    case 15:
      return 'bubbles'; // Coral Cove, Emerald Trench
    case 10:
      return 'petals'; // Blossom Terrace
    default:
      return 'fireflies';
  }
}

/**
 * Deterministic, zero-allocation ambient stage weather particle renderer across all 20 worlds.
 */
export function drawStageWeatherFX(ctx, w, h, worldSrc, nowMs = 0, reducedMotion = false) {
  const kind = resolveWorldWeatherKind(worldSrc);
  const t = reducedMotion ? 1000 : nowMs;
  const count = 16;

  ctx.save();
  if (kind === 'starlight' || kind === 'snow') {
    const auroraGrad = ctx.createLinearGradient(0, 0, w, h * 0.45);
    auroraGrad.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
    auroraGrad.addColorStop(0.5, 'rgba(167, 243, 208, 0.14)');
    auroraGrad.addColorStop(1, 'rgba(192, 132, 252, 0.08)');
    ctx.fillStyle = auroraGrad;
    ctx.fillRect(0, 0, w, h * 0.45);
  }

  for (let i = 0; i < count; i++) {
    const seed = (i * 97 + 31) % 100;
    const norm = seed / 100;
    const speed = 0.015 + (i % 5) * 0.005;

    if (kind === 'fireflies') {
      const px = ((norm * w) + Math.sin(t * 0.0012 + i) * 18 + w) % w;
      const py = h * 0.25 + ((norm * h * 0.65 + Math.cos(t * 0.0015 + i * 2) * 12) % (h * 0.68));
      const alpha = 0.35 + 0.55 * Math.abs(Math.sin(t * 0.003 + i * 1.7));
      ctx.fillStyle = i % 3 === 0 ? `rgba(167, 243, 208, ${alpha.toFixed(2)})` : `rgba(253, 224, 71, ${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(px, py, (i % 2) + 1.8, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'crystal') {
      const px = (norm * (w - 24)) + 12;
      const py = 14 + ((i * 37) % Math.max(20, h - 28));
      const pulse = Math.abs(Math.sin(t * 0.0028 + i * 1.3));
      const r = 1.5 + pulse * 2.5;
      ctx.fillStyle = i % 2 === 0 ? `rgba(103, 232, 249, ${(0.3 + pulse * 0.6).toFixed(2)})` : `rgba(240, 171, 252, ${(0.3 + pulse * 0.6).toFixed(2)})`;
      ctx.fillRect(Math.round(px - r), Math.round(py - 0.8), Math.round(r * 2), 1.6);
      ctx.fillRect(Math.round(px - 0.8), Math.round(py - r), 1.6, Math.round(r * 2));
    } else if (kind === 'snow') {
      const py = ((norm * h) + t * speed * 1.4) % h;
      const px = ((norm * w) + Math.sin(t * 0.0015 + i) * 14 + w) % w;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
      ctx.beginPath();
      ctx.arc(px, py, (i % 2) + 1.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'starlight') {
      const px = ((norm * w) + t * speed * 0.5) % w;
      const py = 10 + ((i * 29) % Math.max(24, Math.round(h * 0.72)));
      const twinkle = 0.35 + 0.6 * Math.abs(Math.cos(t * 0.0025 + i));
      ctx.fillStyle = i % 2 === 0 ? `rgba(254, 240, 138, ${twinkle.toFixed(2)})` : `rgba(196, 181, 253, ${twinkle.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(px, py, (i % 3 === 0 ? 2.4 : 1.5), 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'embers') {
      const py = h - (((norm * h) + t * speed * 1.8) % h);
      const px = ((norm * w) + Math.sin(t * 0.002 + i) * 10 + w) % w;
      const alpha = Math.max(0.18, Math.min(0.9, py / h));
      ctx.fillStyle = i % 2 === 0 ? `rgba(251, 146, 60, ${alpha.toFixed(2)})` : `rgba(253, 224, 71, ${alpha.toFixed(2)})`;
      ctx.fillRect(Math.round(px), Math.round(py), 2.5, 2.5);
    } else if (kind === 'petals') {
      const py = ((norm * h) + t * speed * 1.3) % h;
      const px = ((norm * w) + t * speed * 0.8 + Math.sin(t * 0.002 + i) * 12) % w;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(251, 207, 232, 0.85)' : 'rgba(244, 114, 182, 0.75)';
      ctx.beginPath();
      ctx.ellipse(px, py, 2.8, 1.6, (t * 0.002 + i) % Math.PI, 0, Math.PI * 2);
      ctx.fill();
    } else if (kind === 'bubbles') {
      const py = h - (((norm * h) + t * speed * 1.2) % h);
      const px = ((norm * w) + Math.sin(t * 0.0018 + i) * 9 + w) % w;
      ctx.strokeStyle = 'rgba(165, 243, 252, 0.72)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(px, py, (i % 3) + 1.8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/**
 * Crisp pixel-art oval contact shadow beneath a unit that shrinks slightly as hopOffset rises.
 */
function drawPixelShadow(ctx, cx, bottomY, width, hopOffset = 0) {
  const liftScale = Math.max(0.7, 1 - Math.abs(hopOffset) * 0.025);
  const rx = Math.round(width * 0.34 * liftScale);
  const ry = Math.max(3, Math.round(width * 0.075 * liftScale));
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(Math.round(cx), Math.round(bottomY - 3), rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Pixel dust puffs kicking up behind a walking or lunging character.
 */
function drawPixelDustPuffs(ctx, baseX, bottomY, dir = 1, nowMs = 0) {
  ctx.save();
  for (let i = 0; i < 4; i++) {
    const phase = ((nowMs * 0.006 + i * 0.25) % 1);
    const px = Math.round(baseX - dir * (8 + phase * 22 + i * 3));
    const py = Math.round(bottomY - 4 - phase * 12 - (i % 2) * 3);
    const sz = Math.max(2, Math.round((1 - phase) * 5));
    ctx.fillStyle = `rgba(241, 245, 249, ${(0.65 * (1 - phase)).toFixed(2)})`;
    ctx.fillRect(px, py, sz, sz);
  }
  ctx.restore();
}

/**
 * Draws equipped weapon & shield directly onto the hero sprite with animated attack swing.
 */
function drawHeroEquipmentOnSprite(ctx, weaponImg, shieldImg, x, y, size, flipX = false, isAttacking = false, nowMs = 0) {
  const gearSize = Math.round(size * 0.36);
  const swingAngle = isAttacking ? Math.sin(nowMs * 0.025) * 0.55 + 0.35 : Math.sin(nowMs * 0.003) * 0.06;

  // Off-hand shield
  if (shieldImg && shieldImg.naturalWidth > 0) {
    ctx.save();
    const sx = flipX ? x + Math.round(size * 0.68) : x + Math.round(size * 0.06);
    const sy = y + Math.round(size * 0.46);
    ctx.drawImage(shieldImg, sx, sy, Math.round(gearSize * 0.88), Math.round(gearSize * 0.88));
    ctx.restore();
  }

  // Main-hand weapon with swing arc
  if (weaponImg && weaponImg.naturalWidth > 0) {
    ctx.save();
    const wx = flipX ? x + Math.round(size * 0.22) : x + Math.round(size * 0.78);
    const wy = y + Math.round(size * 0.52);
    ctx.translate(wx, wy);
    if (flipX) {
      ctx.scale(-1, 1);
    }
    ctx.rotate(swingAngle);
    ctx.drawImage(weaponImg, -Math.round(gearSize * 0.25), -Math.round(gearSize * 0.75), gearSize, gearSize);
    ctx.restore();
  }
}

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

    const [bgImg, heroImg, compImg, headImg, weaponImg, shieldImg] = await Promise.all([
      loadImage(roomSrc || worldSrc),
      loadImage(heroSrc),
      loadImage(compSrc),
      equipped.head && equipped.head !== 'bandana' && equipped.head !== 'none'
        ? loadImage(`./assets/equipment/head-${equipped.head}.png`)
        : Promise.resolve(null),
      equipped.weapon && equipped.weapon !== 'none'
        ? loadImage(`./assets/equipment/weapon-${equipped.weapon}.png`)
        : Promise.resolve(null),
      equipped.shield && equipped.shield !== 'none'
        ? loadImage(`./assets/equipment/shield-${equipped.shield}.png`)
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

    // 1b. 20-World Stage Weather & Ambient Particle FX
    drawStageWeatherFX(ctx, w, h, worldSrc, nowMs, reducedMotion);

    const frameIdx = reducedMotion ? 0 : Math.floor(nowMs / 120) % 16;
    const col = frameIdx % 4;
    const row = Math.floor(frameIdx / 4);

    // Hero placement + lively hop/bounce during 'move' or subtle breathing bob
    const spriteSize = Math.min(Math.round(h * 0.62), 116);
    const heroX = Math.round(w * 0.28);
    const baseHeroY = Math.round(h - spriteSize - h * 0.08);
    const isMoving = heroState === 'move';
    const hop = reducedMotion
      ? 0
      : isMoving
        ? -Math.round(Math.abs(Math.sin(nowMs / 135)) * 7)
        : Math.round(Math.sin(nowMs / 380) * 2.5);
    const heroY = baseHeroY + hop;

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

    // Contact shadow & dust puffs for Hero
    drawPixelShadow(ctx, heroX + spriteSize / 2, baseHeroY + spriteSize, spriteSize, hop);
    if (isMoving && !reducedMotion) {
      drawPixelDustPuffs(ctx, heroX + spriteSize * 0.3, baseHeroY + spriteSize - 4, 1, nowMs);
    }

    // 3. Draw Hero (Guard against 80x80 single-frame study sprite!) + Direct On-Hero Equipment
    if (heroImg && heroImg.naturalWidth > 0) {
      const isGrid = heroImg.naturalWidth > 80 && heroImg.naturalHeight > 80;
      const sx = isGrid ? col * 80 : 0;
      const sy = isGrid ? row * 80 : 0;
      ctx.drawImage(heroImg, sx, sy, 80, 80, heroX, heroY, spriteSize, spriteSize);
      drawHeroEquipmentOnSprite(ctx, weaponImg, shieldImg, heroX, heroY, spriteSize, false, isMoving, nowMs);
    }

    // 4. Draw Companion beside hero with synchronized bounce & contact shadow
    if (compImg && compImg.naturalWidth > 0) {
      const compSize = Math.round(spriteSize * 0.78);
      const compX = Math.round(heroX + spriteSize * 0.92);
      const baseCompY = Math.round(h - compSize - h * 0.08);
      const compHop = reducedMotion
        ? 0
        : isMoving
          ? -Math.round(Math.abs(Math.cos(nowMs / 135)) * 6)
          : Math.round(Math.cos(nowMs / 360) * 2);
      drawPixelShadow(ctx, compX + compSize / 2, baseCompY + compSize, compSize, compHop);
      const isGrid = compImg.naturalWidth > 80 && compImg.naturalHeight > 80;
      const sx = isGrid ? col * 80 : 0;
      const sy = isGrid ? row * 80 : 0;
      ctx.drawImage(compImg, sx, sy, 80, 80, compX, baseCompY + compHop, compSize, compSize);
    }

    // 5. Compact Equipped Crest Icons (top-right corner of canvas)
    const badges = [headImg, weaponImg, shieldImg].filter((img) => img && img.naturalWidth > 0);
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
  const cw = canvas.width;
  const ch = canvas.height;
  ctx.clearRect(0, 0, cw, ch);
  ctx.imageSmoothingEnabled = false;

  // Subtle radial elemental pixel backdrop glow for companions & monsters
  const cx = cw / 2;
  const cy = ch / 2;
  const rad = Math.min(cw, ch) * 0.46;
  const glow = ctx.createRadialGradient(cx, cy, rad * 0.15, cx, cy, rad);
  glow.addColorStop(0, 'rgba(167, 243, 208, 0.42)');
  glow.addColorStop(0.7, 'rgba(56, 189, 248, 0.14)');
  glow.addColorStop(1, 'rgba(15, 118, 110, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, Math.PI * 2);
  ctx.fill();

  // Crisp pixel ground shadow under thumbnail sprite
  drawPixelShadow(ctx, cx, ch - 2, cw * 0.82, 0);

  if (img.naturalWidth > size && img.naturalHeight > size) {
    // Trim 4px top / 3px side atlas boundary to eliminate any neighbor bleed
    ctx.drawImage(img, 3, 4, size - 6, size - 6, 0, 0, cw, ch);
  } else {
    ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, cw, ch);
  }
}

/**
 * Live 2-Hero + Companion / Stage Boss Face-Off Auto-Battle Canvas Renderer.
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
    ctx.fillStyle = 'rgba(15, 23, 42, 0.76)';
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
      stageLabel = '',
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
    const isRightMonster = Boolean(right.isMonster);
    const monsterSpriteId = right.spriteId || right.companionId || right.monsterId || 'astraldragon';
    const rightIdleSrc = right.idleSrc || `./assets/creatures/${monsterSpriteId}-idle.png`;
    const rightMoveSrc = right.moveSrc || `./assets/creatures/${monsterSpriteId}-move.png`;

    const lEq = left.equipped || {};
    const rEq = right.equipped || {};

    const [bgImg, lHero, lComp, rHero, rComp, lWeapon, lShield, rWeapon, rShield] = await Promise.all([
      loadImage(worldSrc),
      loadImage(`./assets/heroes/${left.heroBase || 'boy-b'}-${lMove ? 'move' : 'idle'}.png`),
      loadImage(`./assets/creatures/${left.companionId || 'twigfox'}-${lMove ? 'move' : 'idle'}.png`),
      isRightMonster
        ? loadImage(rMove ? rightMoveSrc : rightIdleSrc)
        : loadImage(`./assets/heroes/${right.heroBase || 'girl-b'}-${rMove ? 'move' : 'idle'}.png`),
      isRightMonster
        ? Promise.resolve(null)
        : loadImage(`./assets/creatures/${right.companionId || 'twigfox'}-${rMove ? 'move' : 'idle'}.png`),
      lEq.weapon && lEq.weapon !== 'none'
        ? loadImage(`./assets/equipment/weapon-${lEq.weapon}.png`)
        : Promise.resolve(null),
      lEq.shield && lEq.shield !== 'none'
        ? loadImage(`./assets/equipment/shield-${lEq.shield}.png`)
        : Promise.resolve(null),
      !isRightMonster && rEq.weapon && rEq.weapon !== 'none'
        ? loadImage(`./assets/equipment/weapon-${rEq.weapon}.png`)
        : Promise.resolve(null),
      !isRightMonster && rEq.shield && rEq.shield !== 'none'
        ? loadImage(`./assets/equipment/shield-${rEq.shield}.png`)
        : Promise.resolve(null)
    ]);
    if (stopped) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    // High-impact camera shake on crit or companion skill turns
    const shouldShake = !reducedMotion && activeTurn && (activeTurn.kind === 'crit' || activeTurn.kind === 'companion');
    const shakeX = shouldShake ? Math.round(Math.sin(nowMs * 0.085) * 3.5) : 0;
    const shakeY = shouldShake ? Math.round(Math.cos(nowMs * 0.095) * 2.5) : 0;

    ctx.save();
    if (shouldShake) {
      ctx.translate(shakeX, shakeY);
    }

    if (bgImg && bgImg.naturalWidth > 0) {
      const scale = Math.max(w / bgImg.naturalWidth, h / bgImg.naturalHeight);
      const dw = bgImg.naturalWidth * scale;
      const dh = bgImg.naturalHeight * scale;
      ctx.drawImage(bgImg, (w - dw) / 2, (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(0, 0, w, h);
    }

    ctx.fillStyle = 'rgba(6, 28, 22, 0.36)';
    ctx.fillRect(0, 0, w, h);

    // 20-World Stage Weather & Ambient Particle FX inside the Duel Arena
    drawStageWeatherFX(ctx, w, h, worldSrc, nowMs, reducedMotion);

    const frameIdx = reducedMotion ? 0 : Math.floor(nowMs / 105) % 16;
    const col = frameIdx % 4;
    const row = Math.floor(frameIdx / 4);

    const heroSize = Math.min(Math.round(h * 0.54), 96);
    const compSize = Math.round(heroSize * 0.72);
    const groundY = Math.round(h - heroSize - 12);
    const compY = Math.round(h - compSize - 12);

    const lIsCompTurn = lMove && activeTurn?.kind === 'companion';
    const rIsCompTurn = rMove && activeTurn?.kind === 'companion';
    const isLeftVictory = Boolean(bannerText && String(bannerText).toUpperCase().includes('VICTORY'));

    const lLunge = lMove && !lIsCompTurn ? 28 : rMove ? -6 : 0;
    const rLunge = rMove && (!rIsCompTurn || isRightMonster) ? -28 : lMove ? 6 : 0;
    const lCompLunge = lIsCompTurn ? 36 : 0;
    const rCompLunge = rIsCompTurn ? -36 : 0;

    // Dynamic hop / bounce during attack lunges or celebratory victory jump
    const lHop = reducedMotion
      ? 0
      : (lMove || isLeftVictory)
        ? -Math.round(Math.abs(Math.sin(nowMs / 115)) * 8)
        : Math.round(Math.sin(nowMs / 360) * 2);
    const rHop = reducedMotion
      ? 0
      : rMove
        ? -Math.round(Math.abs(Math.sin(nowMs / 115)) * 8)
        : Math.round(Math.cos(nowMs / 340) * 2.5);

    const lx = Math.round(w * 0.14) + lLunge;
    const rightScale = isRightMonster ? 1.15 : 1;
    const rightMainSize = Math.round(heroSize * rightScale);
    const rightGroundY = Math.round(h - rightMainSize - 10);
    const rx = Math.round(w - w * 0.14 - rightMainSize) + rLunge;

    const lCompX = lx - Math.round(compSize * 0.55) + lCompLunge;
    const rCompX = rx + Math.round(heroSize * 0.82) + rCompLunge;

    // Contact shadows & dust puffs for Left team
    drawPixelShadow(ctx, lCompX + compSize / 2, compY + compSize, compSize, lHop);
    drawPixelShadow(ctx, lx + heroSize / 2, groundY + heroSize, heroSize, lHop);
    if (lMove && !reducedMotion) {
      drawPixelDustPuffs(ctx, lx + heroSize * 0.25, groundY + heroSize - 3, 1, nowMs);
    }

    // Draw Left companion & hero + Direct On-Hero Weapon & Shield
    drawUnit(lComp, col, row, lCompX, compY + lHop, compSize, false);
    drawUnit(lHero, col, row, lx, groundY + lHop, heroSize, false);
    drawHeroEquipmentOnSprite(ctx, lWeapon, lShield, lx, groundY + lHop, heroSize, false, lMove, nowMs);

    // Contact shadows & dust puffs for Right team
    drawPixelShadow(ctx, rx + rightMainSize / 2, rightGroundY + rightMainSize, rightMainSize, rHop);
    if (rMove && !reducedMotion) {
      drawPixelDustPuffs(ctx, rx + rightMainSize * 0.75, rightGroundY + rightMainSize - 3, -1, nowMs);
    }

    // Menacing Purple / Crimson Boss Aura when right.isMonster is active
    if (isRightMonster) {
      const mCx = rx + rightMainSize / 2;
      const mCy = rightGroundY + rightMainSize / 2 + 4 + rHop;
      const pulse = reducedMotion ? 1 : 1 + Math.sin(nowMs / 240) * 0.09;
      const mRadius = rightMainSize * 0.64 * pulse;
      const bossAura = ctx.createRadialGradient(mCx, mCy, mRadius * 0.18, mCx, mCy, mRadius);
      bossAura.addColorStop(0, 'rgba(244, 63, 94, 0.72)');
      bossAura.addColorStop(0.55, 'rgba(147, 51, 234, 0.45)');
      bossAura.addColorStop(1, 'rgba(88, 28, 135, 0)');
      ctx.save();
      ctx.fillStyle = bossAura;
      ctx.beginPath();
      ctx.arc(mCx, mCy, mRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // Draw Right companion for human rival
      drawPixelShadow(ctx, rCompX + compSize / 2, compY + compSize, compSize, rHop);
      drawUnit(rComp, col, row, rCompX, compY + rHop, compSize, true);
    }

    // Draw Right main unit (Hero or 1.15x Scaled Wild Monster / Stage Boss)
    drawUnit(rHero, col, row, rx, rightGroundY + rHop, rightMainSize, true);
    if (!isRightMonster) {
      drawHeroEquipmentOnSprite(ctx, rWeapon, rShield, rx, rightGroundY + rHop, rightMainSize, true, rMove, nowMs);
    }

    // HP Bars at top (including Companion Lv or Boss Element/Lv!)
    const barW = Math.min(186, Math.round(w * 0.39));
    const lTag = `Lv.${left.level} ${left.name} ★Lv.${left.compLevel || 1}`;
    const rTag = isRightMonster
      ? `Lv.${right.level} ${right.name}`
      : `Lv.${right.level} ${right.name} ★Lv.${right.compLevel || 1}`;
    drawHpBar(14, 24, barW, 15, leftHp, left.maxHp, '#10b981', false, lTag);
    drawHpBar(w - 14 - barW, 24, barW, 15, rightHp, right.maxHp, isRightMonster ? '#e11d48' : '#f59e0b', true, rTag);

    // Top-center stageLabel crest above VS
    if (stageLabel) {
      ctx.save();
      ctx.font = '800 9px system-ui, sans-serif';
      const tw = Math.max(58, Math.round(ctx.measureText(stageLabel).width + 16));
      const cx = (w - tw) / 2;
      ctx.fillStyle = isRightMonster ? 'rgba(136, 19, 55, 0.85)' : 'rgba(6, 78, 59, 0.85)';
      ctx.strokeStyle = isRightMonster ? 'rgba(251, 113, 133, 0.65)' : 'rgba(110, 231, 183, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(cx, 4, tw, 15, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fef3c7';
      ctx.textAlign = 'center';
      ctx.fillText(stageLabel, w / 2, 14);
      ctx.restore();
    }

    // VS badge center
    ctx.font = '900 13px system-ui, sans-serif';
    ctx.fillStyle = '#fde68a';
    ctx.textAlign = 'center';
    ctx.fillText('VS', w / 2, 35);

    // Elemental slash / beam VFX lines, pixel hit sparks, skill cut-in ribbon, and floating numbers
    if (activeTurn) {
      const targetX = activeTurn.actor === 'left' ? rx + rightMainSize / 2 : lx + heroSize / 2;
      const targetCenterY = (activeTurn.actor === 'left' ? rightGroundY : groundY) + heroSize * 0.48;
      const casterX = activeTurn.actor === 'left' ? lx + heroSize / 2 : rx + rightMainSize / 2;
      const casterCenterY = (activeTurn.actor === 'left' ? groundY : rightGroundY) + heroSize * 0.52;
      const targetY = groundY + 12;

      ctx.save();
      if (activeTurn.kind === 'companion') {
        // Arcane / elemental beam from caster companion to target + burst ring
        const beamGrad = ctx.createLinearGradient(casterX, casterCenterY, targetX, targetCenterY);
        beamGrad.addColorStop(0, 'rgba(103, 232, 249, 0.15)');
        beamGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.85)');
        beamGrad.addColorStop(1, 'rgba(253, 224, 71, 0.95)');
        ctx.strokeStyle = beamGrad;
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(casterX, casterCenterY);
        ctx.lineTo(targetX, targetCenterY);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(103, 232, 249, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(targetX, targetCenterY, 24, 0, Math.PI * 2);
        ctx.stroke();

        // Sleek pixel-art Skill Cut-In Ribbon across top-middle
        const cutInText = `⚡ ${activeTurn.skillName || 'COMPANION SKILL'}`;
        ctx.font = '900 11px system-ui, sans-serif';
        const cw = Math.max(132, Math.round(ctx.measureText(cutInText).width + 24));
        const cx = (w - cw) / 2;
        const cy = 44;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.86)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(cx, cy, cw, 20, 6);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#67e8f9';
        ctx.textAlign = 'center';
        ctx.fillText(cutInText, w / 2, cy + 14);
      } else if (activeTurn.kind === 'crit') {
        // Golden X-cross critical slash lines
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(targetX - 26, targetCenterY - 24);
        ctx.lineTo(targetX + 26, targetCenterY + 24);
        ctx.moveTo(targetX + 26, targetCenterY - 24);
        ctx.lineTo(targetX - 26, targetCenterY + 24);
        ctx.stroke();
      } else {
        // Crisp diagonal elemental strike slash
        ctx.strokeStyle = '#a7f3d0';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.moveTo(targetX - 22, targetCenterY - 20);
        ctx.lineTo(targetX + 22, targetCenterY + 20);
        ctx.stroke();
      }

      // 12 Crisp Pixel-Square Impact Sparks radiating from the hit target
      const sparkCount = 12;
      const sparkPhase = reducedMotion ? 0.5 : ((nowMs % 360) / 360);
      for (let i = 0; i < sparkCount; i++) {
        const angle = (i / sparkCount) * Math.PI * 2 + (nowMs * 0.004);
        const dist = 10 + sparkPhase * 28 + (i % 3) * 5;
        const sx = Math.round(targetX + Math.cos(angle) * dist);
        const sy = Math.round(targetCenterY + Math.sin(angle) * dist);
        const sz = i % 2 === 0 ? 5 : 4;
        ctx.fillStyle = activeTurn.kind === 'crit'
          ? (i % 2 === 0 ? '#fde047' : '#fb923c')
          : activeTurn.kind === 'companion'
            ? (i % 2 === 0 ? '#67e8f9' : '#c084fc')
            : (i % 2 === 0 ? '#a7f3d0' : '#ffffff');
        ctx.fillRect(sx - Math.floor(sz / 2), sy - Math.floor(sz / 2), sz, sz);
      }

      // Glowing emerald heal ring + rising pixel pluses around caster when heal > 0
      if (activeTurn.heal > 0) {
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.9)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(casterX, casterCenterY + 16, 28, 11, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      ctx.font = '900 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = activeTurn.kind === 'crit' ? '#fde047' : activeTurn.kind === 'companion' ? '#67e8f9' : '#ffffff';
      const prefix = activeTurn.kind === 'crit'
        ? 'CRIT '
        : activeTurn.kind === 'companion'
          ? `★ ${activeTurn.skillName || 'SKILL'} `
          : '';
      ctx.fillText(`${prefix}-${activeTurn.dmg}`, targetX, targetY);

      if (activeTurn.heal > 0) {
        ctx.fillStyle = '#4ade80';
        ctx.fillText(`+${activeTurn.heal} HP`, casterX, targetY - 16);
      }
    }

    if (bannerText) {
      ctx.fillStyle = 'rgba(6, 78, 59, 0.88)';
      const bw = 176;
      const bh = 32;
      ctx.beginPath();
      ctx.roundRect((w - bw) / 2, h / 2 - bh / 2, bw, bh, 16);
      ctx.fill();
      ctx.font = '900 15px system-ui, sans-serif';
      ctx.fillStyle = '#fde68a';
      ctx.textAlign = 'center';
      ctx.fillText(bannerText, w / 2, h / 2 + 5);
    }

    ctx.restore();

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
