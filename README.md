# LaczyPrime — building physics field manual

A didactic, transparent, SI-only tool for civil-engineering
students and energy advisors. Pro-tool register: no hand-holding
explanations in-program; the user knows the physics.

English-only UI, SI-only calculations. Static PWA, no build step,
no framework, strict CSP, localStorage persistence.

## Status

**Submodule 1.1 — U-value, homogeneous component.**
Standalone Quick-Calc layer.

Reference material database covers Willems / Schild / Stricker,
_Formeln und Tabellen Bauphysik_, 7th ed. 2022, §§ 1.6.1–1.6.19
— roughly 500 ρ/λ/μ/c<sub>p</sub> entries across 19 categories
(plasters, concretes, panels, three kinds of masonry, wood,
insulations, flooring, plastics, membranes, glass, stone, soil,
roof tiles, loose fills, metals, water/ice/snow, gases).

## How to run

ES modules require an HTTP origin. From this directory:

```
python3 -m http.server 8000
```

then open `http://localhost:8000/`.

Opening `index.html` directly via `file://` will fail in most
browsers due to the module loader's CORS rules.

## File layout (flat, as deployed on GitHub Pages)

```
laczyprime/
├── index.html              ← single entry point
├── style.css               ← editorial field-manual aesthetic
├── notation.js             ← shared symbol pool, Module 1
├── reference-data.js       ← material DB + surface resistances
├── uvalue.js               ← pure-functional U-value engine
├── persistence.js          ← localStorage, schemaVersion = 1
└── uvalue-app.js           ← UI controller (Submodule 1.1)
```

### Three-layer architecture

- **Standalone** — quick calculation, used here.
- **Project** — multi-component containers, not yet built.
- **Engine** — pure, DOM-free functions in `uvalue.js`,
  `reference-data.js`, `notation.js`.

### Notation conventions

- SI units internally (m, s, K, W, Ws). Display units (mm, °C, kWh)
  applied at the UI boundary only.
- T = thermodynamic temperature (K), θ = Celsius temperature.
- Underscored code identifiers, Unicode + `<sub>` for display.
  No KaTeX, MathJax, or other dependency.
- Code identifiers: `R_si`, `R_T`, `lambda_W_mK`, etc.

### Security stance

- Strict CSP: `default-src 'none'`, only own-origin scripts and
  styles, no inline anything, no remote anything.
- No `innerHTML` for any data. The only DOM that resembles HTML
  markup is the `<sub>…</sub>` fragment in display strings, which
  is parsed and rebuilt with `document.createElement` (see
  `renderDisplay` in `uvalue-app.js`).
- Pure static site; no backend, no remote calls, no analytics.

### Persistence

- `localStorage`, key `bauphysik.v1`. Single object holding the
  current quick-calc state. `schemaVersion: 1` reserved.
- No import/export.

## Material database

- **Source:** Willems / Schild / Stricker, _Formeln und Tabellen
  Bauphysik_, 7th ed. 2022, Springer Vieweg, §§ 1.6.1 – 1.6.19
  (after DIN 4108-4 and DIN EN ISO 10456).
- **Surface resistances:** Willems (ed.), _Lehrbuch der Bauphysik_,
  9th ed. 2022, Tab. 2.4 (after DIN EN ISO 6946).

Each material entry carries `lambda`, `density`, `c_p`, and the
DIN water-vapour diffusion resistance number `μ` (range or single
value). The U-value calculator currently consumes only `lambda`;
the remaining fields are pre-loaded for Modules 2–4.

Density-series materials (concretes, masonries) are listed as one
entry per ρ–λ pair to mirror the source's tabulation. Masonry units
with mortar-dependent λ (e.g. perforated clay bricks HLzA/B, concrete
hollow blocks Hbl, solid blocks Vbl) carry separate entries per
mortar type (LM21 / LM36 / NM-DM).

## Not yet implemented

- Temperature profile through the layer stack.
- Inhomogeneous layers (upper/lower limits per ISO 6946).
- Air-layer resistances (Willems Tab. 2.5).
- Project containers, multi-component management.
- Module 2 (summer heat protection), Module 3 (moisture / Glaser),
  Module 4 (heating load).
- Service worker / offline manifest.
