// Notation pool.
// Single source of truth for symbols, codes, units, display rendering.
// Structure per entry:
//   id          — global unique identifier
//   symbol      — physical symbol (plain text, may collide across pool)
//   code        — short identifier for use in function scopes
//   display     — UI rendering with HTML subscript tags / Unicode
//   name        — English name
//   siUnit      — SI base unit for stored value
//   displayUnit — preferred display unit
//   plausibleRange — { min, max, warn } (optional, advisory only)
//
// "kind" (input | constant | intermediate | output) is intentionally
// NOT part of the pool. It is module-dependent and assigned per
// calculation context.

export const SHARED_POOL = Object.freeze({
  // ── Geometry & time ─────────────────────────────────────────────
  layer_thickness: {
    id: "layer_thickness",
    symbol: "d",
    code: "d",
    display: "d",
    name: "Layer thickness",
    siUnit: "m",
    displayUnit: "mm",
    plausibleRange: { min: 0.001, max: 1.0, warn: "outside typical layer thickness" },
  },
  area: {
    id: "area",
    symbol: "A",
    code: "A",
    display: "A",
    name: "Area",
    siUnit: "m²",
    displayUnit: "m²",
    plausibleRange: { min: 0, warn: "area must be positive" },
  },

  // ── Material thermal properties ─────────────────────────────────
  lambda_thermal_conductivity: {
    id: "lambda_thermal_conductivity",
    symbol: "λ",
    code: "lambda",
    display: "λ",
    name: "Thermal conductivity",
    siUnit: "W/(m·K)",
    displayUnit: "W/(m·K)",
    plausibleRange: { min: 0.02, max: 5.0, warn: "outside typical building materials" },
  },
  density: {
    id: "density",
    symbol: "ρ",
    code: "rho",
    display: "ρ",
    name: "Density",
    siUnit: "kg/m³",
    displayUnit: "kg/m³",
    plausibleRange: { min: 10, max: 8000 },
  },

  // ── Resistance & transmittance ──────────────────────────────────
  thermal_resistance_layer: {
    id: "thermal_resistance_layer",
    symbol: "R",
    code: "R",
    display: "R",
    name: "Thermal resistance (layer)",
    siUnit: "(m²·K)/W",
    displayUnit: "(m²·K)/W",
    plausibleRange: { min: 0 },
  },
  thermal_resistance_total: {
    id: "thermal_resistance_total",
    symbol: "R_T",
    code: "R_T",
    display: "R<sub>T</sub>",
    name: "Total thermal resistance",
    siUnit: "(m²·K)/W",
    displayUnit: "(m²·K)/W",
    plausibleRange: { min: 0 },
  },
  surface_resistance_internal: {
    id: "surface_resistance_internal",
    symbol: "R_si",
    code: "R_si",
    display: "R<sub>si</sub>",
    name: "Internal surface heat transfer resistance",
    siUnit: "(m²·K)/W",
    displayUnit: "(m²·K)/W",
    plausibleRange: { min: 0.10, max: 0.17 },
  },
  surface_resistance_external: {
    id: "surface_resistance_external",
    symbol: "R_se",
    code: "R_se",
    display: "R<sub>se</sub>",
    name: "External surface heat transfer resistance",
    siUnit: "(m²·K)/W",
    displayUnit: "(m²·K)/W",
    plausibleRange: { min: 0.04, max: 0.04 },
  },
  thermal_transmittance: {
    id: "thermal_transmittance",
    symbol: "U",
    code: "U",
    display: "U",
    name: "Thermal transmittance",
    siUnit: "W/(m²·K)",
    displayUnit: "W/(m²·K)",
    plausibleRange: { min: 0.10, max: 6.0, warn: "outside typical range" },
  },

  // ── Temperatures (θ in °C; T reserved for Kelvin) ───────────────
  theta_indoor_air: {
    id: "theta_indoor_air",
    symbol: "θ_i",
    code: "theta_i",
    display: "θ<sub>i</sub>",
    name: "Indoor air temperature",
    siUnit: "°C",
    displayUnit: "°C",
    plausibleRange: { min: -10, max: 40 },
  },
  theta_outdoor_air: {
    id: "theta_outdoor_air",
    symbol: "θ_e",
    code: "theta_e",
    display: "θ<sub>e</sub>",
    name: "Outdoor air temperature",
    siUnit: "°C",
    displayUnit: "°C",
    plausibleRange: { min: -40, max: 50 },
  },
  theta_surface_internal: {
    id: "theta_surface_internal",
    symbol: "θ_si",
    code: "theta_si",
    display: "θ<sub>si</sub>",
    name: "Internal surface temperature",
    siUnit: "°C",
    displayUnit: "°C",
  },
  theta_surface_external: {
    id: "theta_surface_external",
    symbol: "θ_se",
    code: "theta_se",
    display: "θ<sub>se</sub>",
    name: "External surface temperature",
    siUnit: "°C",
    displayUnit: "°C",
  },
  theta_interface: {
    id: "theta_interface",
    symbol: "θ_n/n+1",
    code: "theta_interface",
    display: "θ",
    name: "Layer interface temperature",
    siUnit: "°C",
    displayUnit: "°C",
  },

  // ── Heat flux density ───────────────────────────────────────────
  heat_flux_density: {
    id: "heat_flux_density",
    symbol: "q",
    code: "q",
    display: "q",
    name: "Heat flux density",
    siUnit: "W/m²",
    displayUnit: "W/m²",
  },
});

// ── Module 1 — module-specific additions (will grow with submodules) ──
export const MODULE_1_POOL = Object.freeze({
  // Submodule 1.1 — only one module-specific quantity so far:
  heat_flow_direction: {
    id: "heat_flow_direction",
    symbol: "—",
    code: "heatFlowDirection",
    display: "Heat flow direction",
    name: "Heat flow direction",
    siUnit: "—",
    displayUnit: "—",
    // Categorical, not a number. Enumerated values:
    enumValues: ["upward", "horizontal", "downward"],
  },
});

// ── Helpers ─────────────────────────────────────────────────────────

export function lookup(id) {
  return SHARED_POOL[id] || MODULE_1_POOL[id] || null;
}

export function symbolDisplay(id) {
  const e = lookup(id);
  return e ? e.display : id;
}
