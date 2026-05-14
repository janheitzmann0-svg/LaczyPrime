// U-value engine for homogeneous (1D, steady-state) building components.
//
// Submodule 1.1.
// All inputs and outputs use SI base units:
//   thickness d  in m
//   lambda λ     in W/(m·K)
//   R, R_T, R_si, R_se  in (m²·K)/W
//   U            in W/(m²·K)
//
// Functions are pure and DOM-free. UI converts at the boundary.

import { SURFACE_RESISTANCES } from "./reference-data.js";

/**
 * Resistance of a single homogeneous layer.
 *   R = d / λ        (Willems eq. 2.53)
 * @param {number} d_m            thickness, m
 * @param {number} lambda_W_mK    thermal conductivity, W/(m·K)
 * @returns {number} R, (m²·K)/W
 */
export function layerResistance(d_m, lambda_W_mK) {
  if (!Number.isFinite(d_m) || d_m < 0) {
    throw new Error("Layer thickness must be a non-negative finite number.");
  }
  if (!Number.isFinite(lambda_W_mK) || lambda_W_mK <= 0) {
    throw new Error("Thermal conductivity must be a positive finite number.");
  }
  return d_m / lambda_W_mK;
}

/**
 * Sum of layer resistances (Willems eq. 2.54).
 * @param {Array<{d_m:number, lambda_W_mK:number}>} layers
 * @returns {{ R_total:number, perLayer:Array<{R:number}> }}
 */
export function layerStackResistance(layers) {
  const perLayer = layers.map((l) => ({ R: layerResistance(l.d_m, l.lambda_W_mK) }));
  const R_total = perLayer.reduce((s, x) => s + x.R, 0);
  return { R_total, perLayer };
}

/**
 * Surface resistances for a given heat flow direction (Willems Tab. 2.4).
 * @param {"upward"|"horizontal"|"downward"} direction
 * @returns {{ R_si:number, R_se:number }}
 */
export function surfaceResistancesFor(direction) {
  const v = SURFACE_RESISTANCES[direction];
  if (!v) {
    throw new Error(`Unknown heat flow direction: ${direction}`);
  }
  return { R_si: v.R_si, R_se: v.R_se };
}

/**
 * Total resistance of a homogeneous component (Willems eq. 2.55).
 *   R_T = R_si + Σ R_i + R_se
 */
export function totalResistance(R_si, R_layers, R_se) {
  return R_si + R_layers + R_se;
}

/**
 * Thermal transmittance (Willems eq. 2.56 / 2.57).
 *   U = 1 / R_T
 */
export function uValueFromTotalResistance(R_T) {
  if (!Number.isFinite(R_T) || R_T <= 0) {
    throw new Error("R_T must be a positive finite number.");
  }
  return 1 / R_T;
}

/**
 * Full calculation for a homogeneous component.
 *
 * @param {object} input
 *   input.layers           — Array<{d_m, lambda_W_mK}>, interior → exterior
 *   input.heatFlowDirection — "upward" | "horizontal" | "downward"
 * @returns {{
 *   perLayer: Array<{R:number}>,
 *   R_layers: number,
 *   R_si: number,
 *   R_se: number,
 *   R_T: number,
 *   U: number
 * }}
 */
export function computeUValue(input) {
  const { layers, heatFlowDirection } = input;
  if (!Array.isArray(layers) || layers.length === 0) {
    throw new Error("At least one layer is required.");
  }
  const { R_si, R_se } = surfaceResistancesFor(heatFlowDirection);
  const { R_total: R_layers, perLayer } = layerStackResistance(layers);
  const R_T = totalResistance(R_si, R_layers, R_se);
  const U = uValueFromTotalResistance(R_T);
  return { perLayer, R_layers, R_si, R_se, R_T, U };
}
