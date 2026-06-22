# QRLife

Turn any link or text into a QR code, then watch it come alive in **Conway's Game of Life**.

The QR code seeds generation 0 of the simulation; each living cell then evolves under Conway's rules while the original QR pattern fades in behind as a "ghost" so you can see how far the board has drifted from the scannable code.

## Features

- **Text / URL → QR**, encoded entirely client-side (no network needed).
- **QR-seeded Game of Life** with play / pause / single-step / reset-to-QR controls.
- Adjustable **speed**, toroidal **wrap-edges** toggle, and a **QR ghost** overlay.
- **Stability detection** — fingerprints every generation and reports when the board reaches a still life (frozen), goes extinct, or settles into an oscillating cycle of period *N*.
- On **Generate**, the QR is held static for a few seconds (so it's scannable) before the simulation starts.
- Runs on a `setInterval` loop so it keeps advancing even when the browser tab is in the background.

## Running

It's a static site — just open `index.html` in a browser. No build step, no dependencies to install.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Markup and layout |
| `style.css` | Dark theme styling |
| `app.js` | QR→grid conversion, Game of Life engine, rendering, cycle detection |
| `qrcode.js` | QR encoder ([qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by Kazuhiko Arase, MIT) |

## License

The bundled `qrcode.js` is MIT-licensed (© Kazuhiko Arase).
