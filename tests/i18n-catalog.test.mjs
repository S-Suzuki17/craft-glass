import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getDictionary, t } from '../web/src/core/i18n.js';
import {
  GUILD_RANKS,
  WORLDS,
  COMPANIONS,
  EQUIPMENT_CATALOG,
  ROOMS,
  BLESSING_STAMPS,
  STARTER_PACKS
} from '../web/src/core/catalog.js';

const WEB_ASSETS = 'D:/Development/craft-glass/web/assets';

test('EN and JA dictionaries share identical structural keys and 25 guild ranks', () => {
  const en = getDictionary('en');
  const ja = getDictionary('ja');
  assert.equal(en.ranks.length, 25);
  assert.equal(ja.ranks.length, 25);
  assert.equal(GUILD_RANKS.length, 25);

  const checkKeys = (a, b, prefix = '') => {
    for (const key of Object.keys(a)) {
      assert.ok(key in b, `Missing key in ja: ${prefix}${key}`);
      if (a[key] && typeof a[key] === 'object' && !Array.isArray(a[key])) {
        checkKeys(a[key], b[key], `${prefix}${key}.`);
      }
    }
  };
  checkKeys(en, ja);
  checkKeys(ja, en);
  assert.equal(t('en', 'appName'), 'Craft Glass');
  assert.equal(t('ja', 'common.points', { n: 15 }), '15 pt');
});

test('all catalog asset references exist cleanly on disk', () => {
  const verifySrc = (rel) => {
    if (!rel) return;
    const clean = rel.replace(/^\.\//, '');
    const full = path.join('D:/Development/craft-glass/web', clean);
    assert.ok(fs.existsSync(full), `Missing asset: ${full}`);
  };
  WORLDS.forEach((w) => verifySrc(w.src));
  COMPANIONS.forEach((c) => { verifySrc(c.idleSrc); verifySrc(c.moveSrc); });
  EQUIPMENT_CATALOG.forEach((e) => verifySrc(e.src));
  ROOMS.forEach((r) => verifySrc(r.src));
  BLESSING_STAMPS.forEach((s) => verifySrc(s.src));
  assert.ok(Object.keys(STARTER_PACKS).length === 4);
  assert.ok(fs.existsSync(path.join(WEB_ASSETS, 'audio/CREDITS.txt')));
});
