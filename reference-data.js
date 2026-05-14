// Reference data from:
//   Willems (Hrsg.), "Lehrbuch der Bauphysik", 9. Auflage 2022,
//   Springer Vieweg.
//   Tab. 2.1 — design values of thermal conductivity (after DIN 4108-4
//             and DIN EN ISO 10456)
//   Tab. 2.4 — design values of surface heat transfer resistance for
//             plane surfaces (after DIN EN ISO 6946)
//
// The data here are factual quantities from the underlying standards.
// Material identifiers, English names and the chosen default within a
// range are this project's own; the underlying λ and ρ figures
// originate from the standards cited above.
//
// Where Willems lists a range (e.g. "0.030 to 0.040"), the project
// chooses a representative default and exposes the full range as
// `lambdaRange` for plausibility checks and manual override.
// Values in parentheses for ρ in Willems are advisory values for
// surface mass calculations and are reproduced here as `densityRange`
// pinned to a single value.

// ── Heat flow direction → Surface resistances (Willems Tab. 2.4) ──
export const SURFACE_RESISTANCES = Object.freeze({
  upward: {
    label: "Upward (e.g. ceiling to attic)",
    R_si: 0.10, // (m²·K)/W
    R_se: 0.04,
  },
  horizontal: {
    label: "Horizontal (e.g. exterior wall)",
    R_si: 0.13,
    R_se: 0.04,
  },
  downward: {
    label: "Downward (e.g. floor over unheated cellar)",
    R_si: 0.17,
    R_se: 0.04,
  },
});

// ── Material database (Willems Tab. 2.1) ────────────────────────────
//
// Each entry:
//   id            — stable identifier, namespaced "willems_*"
//   name          — English designation
//   category      — grouping for the UI
//   lambdaDefault — chosen representative λ in W/(m·K)
//   lambdaRange   — [min, max] from the standard; may equal default
//   densityDefault — kg/m³, or null if not specified
//   densityRange  — [min, max] or null
//   notes         — short note (e.g. "DIN 18174", "lower bound only")

export const MATERIALS = Object.freeze([
  // Plasters, mortars, screeds ─────────────────────────────────────
  {
    id: "willems_lime_cement_plaster",
    name: "Lime / lime-cement / hydraulic-lime plaster mortar",
    category: "Plasters, mortars, screeds",
    lambdaDefault: 1.0, lambdaRange: [1.0, 1.0],
    densityDefault: 1800, densityRange: [1800, 1800],
  },
  {
    id: "willems_cement_screed",
    name: "Cement screed",
    category: "Plasters, mortars, screeds",
    lambdaDefault: 1.40, lambdaRange: [1.40, 1.40],
    densityDefault: 2000, densityRange: [2000, 2000],
  },
  {
    id: "willems_lime_gypsum_plaster",
    name: "Lime-gypsum / gypsum plaster mortar",
    category: "Plasters, mortars, screeds",
    lambdaDefault: 0.70, lambdaRange: [0.70, 0.70],
    densityDefault: 1400, densityRange: [1400, 1400],
  },
  {
    id: "willems_gypsum_plaster_no_aggregate",
    name: "Gypsum plaster (without aggregates)",
    category: "Plasters, mortars, screeds",
    lambdaDefault: 0.51, lambdaRange: [0.51, 0.51],
    densityDefault: 1200, densityRange: [1200, 1200],
  },
  {
    id: "willems_synthetic_resin_plaster",
    name: "Synthetic resin plaster",
    category: "Plasters, mortars, screeds",
    lambdaDefault: 0.70, lambdaRange: [0.70, 0.70],
    densityDefault: 1100, densityRange: [1100, 1100],
  },

  // Concretes ──────────────────────────────────────────────────────
  {
    id: "willems_normal_concrete",
    name: "Normal-weight concrete",
    category: "Concretes",
    lambdaDefault: 1.85, lambdaRange: [1.6, 2.1],
    densityDefault: 2300, densityRange: [2200, 2400],
  },
  {
    id: "willems_lightweight_concrete_closed",
    name: "Lightweight / steel-lightweight concrete (closed structure)",
    category: "Concretes",
    lambdaDefault: 0.85, lambdaRange: [0.39, 1.6],
    densityDefault: 1400, densityRange: [800, 2000],
  },
  {
    id: "willems_lightweight_concrete_nofines",
    name: "Lightweight concrete (no-fines, non-porous aggregate)",
    category: "Concretes",
    lambdaDefault: 1.05, lambdaRange: [0.81, 1.4],
    densityDefault: 1800, densityRange: [1600, 2000],
  },

  // Building panels ────────────────────────────────────────────────
  {
    id: "willems_aac_panel",
    name: "Autoclaved aerated concrete (AAC) panels",
    category: "Building panels",
    lambdaDefault: 0.22, lambdaRange: [0.20, 0.29],
    densityDefault: 600, densityRange: [400, 800],
  },
  {
    id: "willems_gypsum_wall_panel",
    name: "Gypsum wall panels",
    category: "Building panels",
    lambdaDefault: 0.45, lambdaRange: [0.35, 0.58],
    densityDefault: 975, densityRange: [750, 1200],
  },
  {
    id: "willems_gypsum_plasterboard",
    name: "Gypsum plasterboard",
    category: "Building panels",
    lambdaDefault: 0.25, lambdaRange: [0.25, 0.25],
    densityDefault: 800, densityRange: [800, 800],
  },

  // Masonry ────────────────────────────────────────────────────────
  {
    id: "willems_masonry_clinker",
    name: "Clinker brick masonry (solid / perforated / ceramic)",
    category: "Masonry",
    lambdaDefault: 1.0, lambdaRange: [0.81, 1.4],
    densityDefault: 2100, densityRange: [1800, 2400],
  },
  {
    id: "willems_masonry_clay_brick",
    name: "Fired clay brick masonry (solid / perforated / filling)",
    category: "Masonry",
    lambdaDefault: 0.80, lambdaRange: [0.50, 1.4],
    densityDefault: 1800, densityRange: [1200, 2400],
  },
  {
    id: "willems_masonry_perforated_AB",
    name: "Perforated clay bricks (perforation A and B)",
    category: "Masonry",
    lambdaDefault: 0.36, lambdaRange: [0.27, 0.45],
    densityDefault: 775, densityRange: [550, 1000],
  },
  {
    id: "willems_masonry_calcium_silicate",
    name: "Calcium silicate masonry",
    category: "Masonry",
    lambdaDefault: 0.79, lambdaRange: [0.50, 1.3],
    densityDefault: 1600, densityRange: [1000, 2200],
  },

  // Insulation materials ───────────────────────────────────────────
  {
    id: "willems_wood_wool_lightweight",
    name: "Wood-wool building boards, d ≥ 25 mm",
    category: "Insulation materials",
    lambdaDefault: 0.075, lambdaRange: [0.065, 0.090],
    densityDefault: 410, densityRange: [360, 460],
  },
  {
    id: "willems_eps",
    name: "Expanded polystyrene (EPS, particle foam)",
    category: "Insulation materials",
    lambdaDefault: 0.038, lambdaRange: [0.035, 0.040],
    densityDefault: 15, densityRange: [15, 30],
    notes: "ρ ≥ 15 kg/m³ per standard; range here is illustrative.",
  },
  {
    id: "willems_xps",
    name: "Extruded polystyrene (XPS)",
    category: "Insulation materials",
    lambdaDefault: 0.035, lambdaRange: [0.030, 0.040],
    densityDefault: 30, densityRange: [25, 45],
    notes: "ρ ≥ 25 kg/m³ per standard.",
  },
  {
    id: "willems_pur_pir",
    name: "Polyurethane rigid foam (PUR / PIR)",
    category: "Insulation materials",
    lambdaDefault: 0.028, lambdaRange: [0.020, 0.040],
    densityDefault: 35, densityRange: [30, 50],
    notes: "ρ ≥ 30 kg/m³ per standard.",
  },
  {
    id: "willems_mineral_or_plant_fibre",
    name: "Mineral / plant fibre insulation",
    category: "Insulation materials",
    lambdaDefault: 0.040, lambdaRange: [0.035, 0.050],
    densityDefault: 60, densityRange: [8, 500],
  },
  {
    id: "willems_cellular_glass",
    name: "Cellular glass (foam glass), DIN 18174",
    category: "Insulation materials",
    lambdaDefault: 0.050, lambdaRange: [0.045, 0.060],
    densityDefault: 125, densityRange: [100, 150],
  },
  {
    id: "willems_wood_fibre_board",
    name: "Wood fibre insulation board, DIN 68755",
    category: "Insulation materials",
    lambdaDefault: 0.050, lambdaRange: [0.040, 0.070],
    densityDefault: 280, densityRange: [120, 450],
  },

  // Wood & wood-based products ─────────────────────────────────────
  {
    id: "willems_softwood",
    name: "Softwood (spruce, pine, fir)",
    category: "Wood & wood-based products",
    lambdaDefault: 0.13, lambdaRange: [0.13, 0.13],
    densityDefault: 600, densityRange: [600, 600],
  },
  {
    id: "willems_hardwood",
    name: "Hardwood (beech, oak)",
    category: "Wood & wood-based products",
    lambdaDefault: 0.20, lambdaRange: [0.20, 0.20],
    densityDefault: 800, densityRange: [800, 800],
  },
  {
    id: "willems_plywood",
    name: "Plywood",
    category: "Wood & wood-based products",
    lambdaDefault: 0.15, lambdaRange: [0.15, 0.15],
    densityDefault: 800, densityRange: [800, 800],
  },
  {
    id: "willems_particle_board",
    name: "Particle board (flat-pressed)",
    category: "Wood & wood-based products",
    lambdaDefault: 0.13, lambdaRange: [0.13, 0.13],
    densityDefault: 700, densityRange: [700, 700],
  },
  {
    id: "willems_hardboard",
    name: "Hardboard (hard wood fibre board)",
    category: "Wood & wood-based products",
    lambdaDefault: 0.17, lambdaRange: [0.17, 0.17],
    densityDefault: 1000, densityRange: [1000, 1000],
  },

  // Coverings, sealants, roofing ──────────────────────────────────
  {
    id: "willems_plastic_flooring_pvc",
    name: "Plastic flooring (e.g. PVC)",
    category: "Coverings, sealants, roofing",
    lambdaDefault: 0.23, lambdaRange: [0.23, 0.23],
    densityDefault: 1500, densityRange: [1500, 1500],
  },
  {
    id: "willems_bitumen_roofing",
    name: "Bitumen roofing sheets",
    category: "Coverings, sealants, roofing",
    lambdaDefault: 0.17, lambdaRange: [0.17, 0.17],
    densityDefault: 1200, densityRange: [1200, 1200],
    notes: "Per DIN 52128.",
  },

  // Other materials ────────────────────────────────────────────────
  {
    id: "willems_loose_fill_porous",
    name: "Loose fills (porous materials)",
    category: "Other materials",
    lambdaDefault: 0.10, lambdaRange: [0.060, 0.27],
    densityDefault: 500, densityRange: [100, 1500],
  },
  {
    id: "willems_loose_fill_sand_gravel",
    name: "Loose fills (sand, gravel, grit, dry)",
    category: "Other materials",
    lambdaDefault: 0.70, lambdaRange: [0.70, 0.70],
    densityDefault: 1800, densityRange: [1800, 1800],
  },
  {
    id: "willems_glass",
    name: "Glass",
    category: "Other materials",
    lambdaDefault: 0.80, lambdaRange: [0.80, 0.80],
    densityDefault: 2500, densityRange: [2500, 2500],
  },
  {
    id: "willems_metals",
    name: "Metals (highly material-dependent)",
    category: "Other materials",
    lambdaDefault: 50, lambdaRange: [15, 380],
    densityDefault: null, densityRange: null,
    notes: "Density depends strongly on the specific metal — not given in source table.",
  },
]);

// Index by id for fast lookup
export const MATERIAL_BY_ID = Object.freeze(
  Object.fromEntries(MATERIALS.map((m) => [m.id, m]))
);

// List of unique categories in display order
export const CATEGORIES = Object.freeze([
  "Plasters, mortars, screeds",
  "Concretes",
  "Building panels",
  "Masonry",
  "Insulation materials",
  "Wood & wood-based products",
  "Coverings, sealants, roofing",
  "Other materials",
]);

// Source attribution string for footer / about
export const DATA_SOURCE_NOTE =
  "Material data from Willems (ed.), Lehrbuch der Bauphysik, 9th ed. 2022, " +
  "Springer Vieweg, Tab. 2.1 (after DIN 4108-4 and DIN EN ISO 10456). " +
  "Surface resistances from Tab. 2.4 (after DIN EN ISO 6946).";
