# Bauphysik — building physics teaching tool

Didactic, transparent, English-only, SI-only.

## Status

**Submodule 1.1 — U-value for homogeneous components.**
Standalone Quick-Calc layer.

## How to run

ES modules require an HTTP origin. From this directory:

```
python3 -m http.server 8000
```

then open `http://localhost:8000/`.

Opening `index.html` directly via `file://` will fail in most
browsers due to the module loader's CORS rules.

## Architecture

```
bauphysik/
├── index.html              ← single entry point
├── css/style.css
└── js/
    ├── engine/             ← pure, DOM-free, reusable
    │   ├── notation.js         shared symbol pool + module 1 pool
    │   ├── reference-data.js   Willems Tab 2.1 + Tab 2.4
    │   └── uvalue.js           steady-state 1D U-value calc
    ├── storage/
    │   └── persistence.js      localStorage; schemaVersion = 1
    └── ui/
        └── uvalue-app.js       standalone quick-calc controller
```

### Three-layer architecture (from the project concept document)

- **Standalone layer** — quick calculation, used here.
- **Project layer** — not yet implemented.
- **Engine layer** — pure functions in `js/engine/`, called by
  whatever UI surface invokes them.

### Notation conventions

- SI units internally (m, s, K, W, Ws). Display units (mm, °C, kWh)
  applied at the UI boundary only.
- T = thermodynamic temperature (K), θ = Celsius temperature.
- Symbols rendered with Unicode plus HTML `<sub>` tags. No KaTeX,
  MathJax, or other dependency.
- Code identifiers use underscored physical notation:
  `R_si`, `R_T`, `lambda_W_mK`.

### Security stance

- Strict CSP: `default-src 'none'`, only own-origin scripts and
  styles, no inline anything, no remote anything.
- No `innerHTML` used for any data. The only DOM that resembles
  HTML markup is the `<sub>…</sub>` fragment in display strings,
  which is parsed and rebuilt with `document.createElement` (see
  `renderDisplay` in `uvalue-app.js`).
- Pure static site; no backend, no remote calls, no analytics.

### Persistence

- `localStorage`, key `bauphysik.v1`. Single object holding the
  current quick-calc state. `schemaVersion: 1` reserved.
- No import/export.

## Data sources

Willems (ed.), _Lehrbuch der Bauphysik_, 9th edition, 2022,
Springer Vieweg.
- **Tab. 2.1** — design values of thermal conductivity, after
  DIN 4108-4 and DIN EN ISO 10456.
- **Tab. 2.4** — surface heat transfer resistances for plane
  surfaces, after DIN EN ISO 6946.

Material identifiers and English names are this project's own;
underlying λ and ρ figures originate in the standards cited above.
Where Willems gives a range, this project pins one representative
default and exposes the full range for plausibility checking and
manual override.

## Not yet implemented

- Temperature profile through the layer stack (next prompt).
- Inhomogeneous layers (upper/lower limits per ISO 6946).
- Air-layer resistances (Willems Tab. 2.5).
- Project containers, multi-component management.
- Service worker / offline manifest.
