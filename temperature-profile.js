// Steady-state, 1-D temperature profile through a homogeneous multi-layer
// component.
//
// Source: Willems (Hrsg.), Lehrbuch der Bauphysik, 9. Aufl. 2022, §2.4
// (book pp. 38–41).
//
// Boundary conditions (theta_i_C, theta_e_C) are user inputs in degrees
// Celsius. All resistances are in SI ((m²·K)/W). Heat flux density q is
// in W/m².
//
// Method (eq. 2.65 + cascade in §2.4.1):
//   q       = U · (θ_i − θ_e)
//   θ_si    = θ_i  − R_si · q
//   θ_{n+1} = θ_n  − (d_n / λ_n) · q        for each layer n
//   θ_se    is the result after the last layer step
//   θ_e_calc = θ_se − R_se · q              (closure check, ≈ θ_e_input)
//
// All functions are pure and DOM-free.

import { computeUValue } from "./uvalue.js";

/**
 * Heat flux density through a component (Willems eq. 2.65).
 *   q = U · (θ_i − θ_e)
 * @param {number} U_W_m2K
 * @param {number} theta_i_C
 * @param {number} theta_e_C
 * @returns {number} q in W/m²
 */
export function heatFluxDensity(U_W_m2K, theta_i_C, theta_e_C) {
  if (!Number.isFinite(U_W_m2K) || U_W_m2K <= 0) {
    throw new Error("U must be a positive finite number.");
  }
  if (!Number.isFinite(theta_i_C) || !Number.isFinite(theta_e_C)) {
    throw new Error("Boundary temperatures must be finite numbers.");
  }
  return U_W_m2K * (theta_i_C - theta_e_C);
}

/**
 * Full steady-state temperature profile.
 *
 * @param {object} input
 *   input.layers           — Array<{d_m, lambda_W_mK}>, interior → exterior
 *   input.heatFlowDirection — "upward" | "horizontal" | "downward"
 *   input.theta_i_C        — indoor air temperature, °C
 *   input.theta_e_C        — outdoor air temperature, °C
 *
 * @returns {{
 *   U: number,
 *   R_T: number, R_si: number, R_se: number,
 *   R_layers: number,
 *   q: number,
 *   theta_i_C: number, theta_e_C: number,
 *   theta_si_C: number, theta_se_C: number,
 *   theta_e_calc_C: number,
 *   totalThickness_m: number,
 *   nodes: Array<{
 *     x_m: number,
 *     theta_C: number,
 *     kind: "air_interior"|"surface_interior"|"interface"
 *           |"surface_exterior"|"air_exterior",
 *     label: string,
 *     interfaceIndex: number|null
 *   }>,
 *   perLayer: Array<{
 *     d_m: number,
 *     lambda_W_mK: number,
 *     R: number,
 *     x_start_m: number,
 *     x_end_m: number,
 *     theta_start_C: number,
 *     theta_end_C: number
 *   }>
 * }}
 */
export function computeTemperatureProfile(input) {
  const { layers, heatFlowDirection, theta_i_C, theta_e_C } = input;

  if (!Array.isArray(layers) || layers.length === 0) {
    throw new Error("At least one layer is required.");
  }
  if (!Number.isFinite(theta_i_C) || !Number.isFinite(theta_e_C)) {
    throw new Error("Boundary temperatures must be finite numbers.");
  }

  const u = computeUValue({ layers, heatFlowDirection });
  const { U, R_T, R_si, R_se, R_layers, perLayer } = u;

  const q = heatFluxDensity(U, theta_i_C, theta_e_C);

  // Cascade temperatures from interior outward.
  const theta_si_C = theta_i_C - R_si * q;

  const enrichedLayers = [];
  let runningTheta = theta_si_C;
  let runningX = 0;

  for (let i = 0; i < layers.length; i++) {
    const d = layers[i].d_m;
    const lam = layers[i].lambda_W_mK;
    const R = perLayer[i].R;
    const x_start = runningX;
    const theta_start = runningTheta;
    runningX += d;
    runningTheta -= R * q;
    enrichedLayers.push({
      d_m: d,
      lambda_W_mK: lam,
      R,
      x_start_m: x_start,
      x_end_m: runningX,
      theta_start_C: theta_start,
      theta_end_C: runningTheta,
    });
  }

  const totalThickness_m = runningX;
  const theta_se_C = runningTheta;
  const theta_e_calc_C = theta_se_C - R_se * q;

  // Build node list — used by the visualisation. Interface nodes carry
  // labels like θ_{1/2}, θ_{2/3}; surface and air nodes their own.
  const nodes = [];

  nodes.push({
    x_m: 0,
    theta_C: theta_i_C,
    kind: "air_interior",
    label: "θ_i",
    interfaceIndex: null,
  });
  nodes.push({
    x_m: 0,
    theta_C: theta_si_C,
    kind: "surface_interior",
    label: "θ_si",
    interfaceIndex: null,
  });
  for (let i = 0; i < enrichedLayers.length - 1; i++) {
    nodes.push({
      x_m: enrichedLayers[i].x_end_m,
      theta_C: enrichedLayers[i].theta_end_C,
      kind: "interface",
      label: `θ_${i + 1}/${i + 2}`,
      interfaceIndex: i + 1,
    });
  }
  nodes.push({
    x_m: totalThickness_m,
    theta_C: theta_se_C,
    kind: "surface_exterior",
    label: "θ_se",
    interfaceIndex: null,
  });
  nodes.push({
    x_m: totalThickness_m,
    theta_C: theta_e_calc_C,
    kind: "air_exterior",
    label: "θ_e",
    interfaceIndex: null,
  });

  return {
    U,
    R_T,
    R_si,
    R_se,
    R_layers,
    q,
    theta_i_C,
    theta_e_C,
    theta_si_C,
    theta_se_C,
    theta_e_calc_C,
    totalThickness_m,
    nodes,
    perLayer: enrichedLayers,
  };
}
