# Craft Glass — Task & Verification Tracker

- [x] Step 1: Scaffold `D:\Development\craft-glass`, `.gitignore`, `package.json`, `tools/sync-assets.mjs`
- [x] Step 1b: Document `docs/architecture.md` & verify clean asset budget (< 6 MB)
- [x] Step 2: Implement core domain ES modules (`i18n.js`, `catalog.js`, `weekly-pool.js`, `rpg-engine.js`, `fsrs.js`, `proof-ledger.js`, `storage.js`) and pass 100% of `node --test tests/*.test.mjs` (15/15)
- [x] Step 3: Build Web UI (`web/index.html`, `web/styles/app.css`, `web/src/app.js`, `pixel-renderer.js`, `timelapse.js`, `proof-card.js`, `audio.js`, `native-bridge.js`) and pass mobile/desktop browser verification (EN & JA, 0 console errors)
- [x] Step 4: Build Native Android Shell (`MainActivity.java`, `ShareFileProvider.java`), icons, store graphics, keystore, and validate signed `.aab` (`com.craftglass.app`)
- [/] Step 5: Create GitHub repo `S-Suzuki17/craft-glass`, push `main`, publish GitHub Pages (`privacy.html` & live `app/`)
- [ ] Step 6: Complete Google Play Console listing & Internal Testing `.aab` upload/rollout
