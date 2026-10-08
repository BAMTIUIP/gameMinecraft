# Vendored web fonts for the trailer recorder

The capture sandbox cannot reach `fonts.googleapis.com`, so the recorder inlines the game's two web
fonts as base64 `@font-face` data URLs. These are the same fonts the game loads in production, so
the recorded footage matches what players see.

- **Pixelify Sans** (the menu/display font, `--font-display`) — © Stefie Justprince, [OFL-1.1](https://openfontlicense.org), via [@fontsource/pixelify-sans](https://www.npmjs.com/package/@fontsource/pixelify-sans) (MIT).
- **Space Grotesk** (the body font) — © Florian Karsten, [OFL-1.1](https://openfontlicense.org), via [@fontsource/space-grotesk](https://www.npmjs.com/package/@fontsource/space-grotesk) (MIT).

`manifest.json` lists the vendored woff2 files with their family, weight and `unicode-range`
(subset) so `tools/trailer/record.mjs` can emit complete `@font-face` rules. Latin + Cyrillic
subsets of Pixelify Sans and the Latin subset of Space Grotesk, weights 400–700.
