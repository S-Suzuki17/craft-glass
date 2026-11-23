import fs from 'node:fs';
import path from 'node:path';

const SG_PUBLIC = 'D:/Development/study-glass/.local/pixel-polish-20261030/public';
const ROOT = 'D:/Development/craft-glass';
const ASSETS_DST = path.join(ROOT, 'web/assets');

const CREATURES = [
  'acornling',
  'twigfox',
  'bookmarkjay',
  'candleknight',
  'cometotter',
  'lanternmoth',
  'lilypadfrog',
  'nestowl',
  'prismseal',
  'quillfawn',
  'scrollwyrm',
  'seedling',
  'snowhare',
  'teacupbee',
  'astraldragon',
  'ribbonphoenix',
  'moonsphinx',
  'clockrook',
  'froststag',
  'compassdrake',
  'embernewt',
  'dawnleviathan',
  'starloom',
  'cloudray'
];

const AUDIO_FILES = [
  'boss.wav',
  'clear.wav',
  'correct.wav',
  'finish.wav',
  'flip.wav',
  'hit.wav',
  'homework.wav',
  'lock.wav',
  'pass.wav',
  'start.wav',
  'timeout.wav',
  'wrong.wav'
];

const STAMPS = ['applaud.png', 'checked.png', 'cheer.png', 'explain.png', 'retry.png', 'thinking.png'];
const HERO_BASES = ['boy', 'boy-b', 'girl', 'girl-b'];
const HERO_STATES = ['idle', 'move', 'study'];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyChecked(src, dst) {
  if (!fs.existsSync(src)) {
    throw new Error(`Missing source asset: ${src}`);
  }
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
}

let copiedCount = 0;

// 1. 20 Pixel Worlds
for (let i = 1; i <= 20; i++) {
  const name = `world-${String(i).padStart(2, '0')}.png`;
  copyChecked(
    path.join(SG_PUBLIC, 'assets/pixel-polish', name),
    path.join(ASSETS_DST, 'worlds', name)
  );
  copiedCount++;
}

// 2. Study Rooms
const polishDir = path.join(SG_PUBLIC, 'assets/pixel-polish');
for (const entry of fs.readdirSync(polishDir)) {
  if ((entry.startsWith('room-') && entry.endsWith('.png')) || entry === 'study-desk.png') {
    copyChecked(
      path.join(polishDir, entry),
      path.join(ASSETS_DST, 'rooms', entry)
    );
    copiedCount++;
  }
}

// 3. Heroes (4 bases x 3 states)
for (const base of HERO_BASES) {
  for (const state of HERO_STATES) {
    const file = `${base}-${state}.png`;
    copyChecked(
      path.join(polishDir, 'heroes', file),
      path.join(ASSETS_DST, 'heroes', file)
    );
    copiedCount++;
  }
}

// 4. Equipment
const equipSrcDir = path.join(polishDir, 'equipment');
for (const entry of fs.readdirSync(equipSrcDir)) {
  if (entry.endsWith('.png')) {
    copyChecked(
      path.join(equipSrcDir, entry),
      path.join(ASSETS_DST, 'equipment', entry)
    );
    copiedCount++;
  }
}

// 5. 24 Curated Creatures (idle + move)
for (const creature of CREATURES) {
  for (const state of ['idle', 'move']) {
    const file = `${creature}-${state}.png`;
    copyChecked(
      path.join(polishDir, 'enemies', file),
      path.join(ASSETS_DST, 'creatures', file)
    );
    copiedCount++;
  }
}

// 6. 6 Blessing Stamps
for (const stamp of STAMPS) {
  copyChecked(
    path.join(SG_PUBLIC, 'sprites/stamps-ds-v2', stamp),
    path.join(ASSETS_DST, 'stamps', stamp)
  );
  copiedCount++;
}

// 7. CC0 Kenney Audio Files
for (const wav of AUDIO_FILES) {
  copyChecked(
    path.join(SG_PUBLIC, 'assets/audio', wav),
    path.join(ASSETS_DST, 'audio', wav)
  );
  copiedCount++;
}

// Write clean audio CREDITS.txt matching exact CC0 Kenney files used
const creditsText = `Craft Glass — Audio & Artwork Credits

1. Sound Effects (CC0 1.0 Universal)
Kenney — Interface Sounds & Music Jingles
https://kenney.nl/assets/interface-sounds
https://kenney.nl/assets/music-jingles
License: Creative Commons CC0 1.0 Universal
https://creativecommons.org/publicdomain/zero/1.0/
Files bundled in web/assets/audio/:
${AUDIO_FILES.map((f) => `- ${f}`).join('\n')}
Processing: Excerpt trimming, mono downmix, volume normalization, 24 kHz WAV conversion.

2. Pixel Art & Stamps
Original Study Glass / Craft Glass pixel art assets (worlds, study rooms, heroes, equipment, 24 curated creatures, and 6 blessing stamp illustrations).

3. Ambient Soundscapes
Generated locally in-browser via Web Audio API synthesis (Rain, Soft Brown Noise, Warm Study Drone). No external network audio or third-party tracks.
`;
fs.writeFileSync(path.join(ASSETS_DST, 'audio/CREDITS.txt'), creditsText, 'utf8');

// Verify total size and zero forbidden exam/question files
let totalBytes = 0;
const walk = (dir) => {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      walk(full);
    } else {
      const lower = item.name.toLowerCase();
      if (lower.includes('question') || lower.includes('exam') || lower.includes('crowd-loss') || lower.includes('studio-crowd') || lower.includes('loss-close')) {
        throw new Error(`Forbidden file detected in web/assets: ${full}`);
      }
      totalBytes += fs.statSync(full).size;
    }
  }
};
walk(ASSETS_DST);

const mb = (totalBytes / (1024 * 1024)).toFixed(2);
console.log(`Synced ${copiedCount} clean asset files into web/assets (${mb} MB).`);
if (totalBytes >= 6 * 1024 * 1024) {
  throw new Error(`Asset budget exceeded: ${mb} MB >= 6.00 MB`);
}
