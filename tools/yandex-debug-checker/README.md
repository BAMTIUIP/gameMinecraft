# Yandex Games Debug Checker (development-only)

Vendored from [Nioris/yandex-games-debug-checker](https://github.com/Nioris/yandex-games-debug-checker), upstream commit `f86d4ebd1d17f92911ff64b373286fc8d85aec8e` (v1.1.0, MIT). The upstream tool is unofficial and its results are advisory, not a Yandex moderation verdict. See `LICENSE` for the upstream license.

## Run against this game

From the project root:

```bash
npm run yandex:debug-checker
```

This builds the production-shaped single-file game and starts a local preview on `http://localhost:4173` (override with `PORT=...`). The preview injects `debugcheck.js` after `/sdk.js`, serves the repository's local mock Yandex SDK, and does **not** alter `dist/` or the release archive. The mock has no live ads, purchases, or Yandex account connection.

Open the checker with **Ctrl+Shift+2 three times** or run `YGDebugChecker.open()` in DevTools. To print an automated browser report while the preview is running:

```bash
npm run yandex:debug-checker:audit
```

The script needs the existing dev dependencies `puppeteer-core` and `@sparticuz/chromium`. It launches a local headless browser, waits for the game's startup/`LoadingAPI.ready()`, opens the checker panel, and prints PASS / FAIL / WARN / NOT VERIFIED results.

**Never include the checker in a release archive.** It is served only by `tools/yandex-debug-checker/server.mjs`; the normal `npm run build`, `npm run yandex:zip`, and production `index.html` do not reference it. Always review WARN and NOT VERIFIED results manually against current official Yandex documentation; the upstream README lists its known limits.
