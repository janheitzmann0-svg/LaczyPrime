// UI controller for Submodule 1.1 — U-value Quick Calc (Standalone).
//
// Pure DOM API; no innerHTML anywhere. Engine and persistence are
// imported from neighbouring modules; this controller owns no
// calculation logic.

import {
  computeUValue,
  surfaceResistancesFor,
} from "../engine/uvalue.js";
import {
  MATERIALS,
  MATERIAL_BY_ID,
  CATEGORIES,
  SURFACE_RESISTANCES,
  DATA_SOURCE_NOTE,
} from "../engine/reference-data.js";
import { SHARED_POOL } from "../engine/notation.js";
import { loadQuickCalc, saveQuickCalc, resetAll } from "../storage/persistence.js";

// ── tiny helpers ────────────────────────────────────────────────────

/**
 * Element builder. attrs may include: className, id, type, value, name,
 * checked, selected, disabled, placeholder, min, max, step, aria-*,
 * data-*, and on<Event> handlers. Children may be strings or nodes.
 */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "className") node.className = v;
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === "checked" || k === "selected" || k === "disabled") {
      if (v) node.setAttribute(k, "");
    } else {
      node.setAttribute(k, String(v));
    }
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    node.appendChild(
      typeof c === "string" || typeof c === "number"
        ? document.createTextNode(String(c))
        : c
    );
  }
  return node;
}

/**
 * Render the `display` string from the notation pool (which may
 * contain `<sub>…</sub>`) into a DOM fragment, without innerHTML.
 */
function renderDisplay(displayStr) {
  const frag = document.createDocumentFragment();
  const parts = String(displayStr).split(/(<sub>.*?<\/sub>)/g);
  for (const part of parts) {
    const m = part.match(/^<sub>(.*?)<\/sub>$/);
    if (m) {
      const sub = el("sub", {}, m[1]);
      frag.appendChild(sub);
    } else if (part.length) {
      frag.appendChild(document.createTextNode(part));
    }
  }
  return frag;
}

const fmt3 = (n) =>
  Number.isFinite(n) ? n.toLocaleString("en-GB", { maximumFractionDigits: 3, minimumFractionDigits: 3 }) : "—";
const fmt2 = (n) =>
  Number.isFinite(n) ? n.toLocaleString("en-GB", { maximumFractionDigits: 2, minimumFractionDigits: 2 }) : "—";

// ── state ───────────────────────────────────────────────────────────

/**
 * In-memory state mirrors the persistence shape exactly.
 * Layers store SI values; UI converts at the boundary.
 *
 * layer = {
 *   materialId:    string | null,
 *   customName:    string,             // shown when materialId is null
 *   lambda_W_mK:   number | null,      // null = incomplete
 *   thickness_m:   number | null       // null = incomplete
 * }
 */
let state = loadQuickCalc() || {
  componentName: "",
  heatFlowDirection: "horizontal",
  layers: [],
};

function persist() {
  saveQuickCalc(state);
}

function freshLayer() {
  return {
    materialId: null,
    customName: "",
    lambda_W_mK: null,
    thickness_m: null,
  };
}

// ── derived values per layer ────────────────────────────────────────

function layerResistanceOrNull(layer) {
  if (
    !Number.isFinite(layer.lambda_W_mK) ||
    layer.lambda_W_mK <= 0 ||
    !Number.isFinite(layer.thickness_m) ||
    layer.thickness_m < 0
  ) {
    return null;
  }
  return layer.thickness_m / layer.lambda_W_mK;
}

function effectiveLayerName(layer) {
  if (layer.materialId && MATERIAL_BY_ID[layer.materialId]) {
    return MATERIAL_BY_ID[layer.materialId].name;
  }
  return layer.customName || "(custom layer)";
}

// ── results computation ─────────────────────────────────────────────

function results() {
  const validLayers = state.layers
    .filter(
      (l) =>
        Number.isFinite(l.lambda_W_mK) &&
        l.lambda_W_mK > 0 &&
        Number.isFinite(l.thickness_m) &&
        l.thickness_m > 0
    )
    .map((l) => ({ d_m: l.thickness_m, lambda_W_mK: l.lambda_W_mK }));

  const { R_si, R_se } = surfaceResistancesFor(state.heatFlowDirection);

  if (validLayers.length === 0) {
    return { incomplete: true, R_si, R_se, R_layers: 0, R_T: null, U: null };
  }
  const r = computeUValue({
    layers: validLayers,
    heatFlowDirection: state.heatFlowDirection,
  });
  return { incomplete: false, ...r };
}

// ── rendering ───────────────────────────────────────────────────────

const root = document.getElementById("app");

function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function render() {
  clear(root);
  root.appendChild(renderHeader());
  root.appendChild(renderComponentName());
  root.appendChild(renderHeatFlow());
  root.appendChild(renderLayers());
  root.appendChild(renderResults());
  root.appendChild(renderFooter());
}

// — header ───────────────────────────────────────────────────────────
function renderHeader() {
  return el("header", { className: "appHeader" }, [
    el("div", { className: "crumb" }, "Module 1 — Thermal protection · 1.1"),
    el("h1", {}, "U-value · homogeneous component"),
    el(
      "p",
      { className: "sub" },
      "Steady-state 1D heat flow. Layers are listed from interior to exterior."
    ),
  ]);
}

// — component name ───────────────────────────────────────────────────
function renderComponentName() {
  const input = el("input", {
    type: "text",
    id: "componentName",
    className: "nameInput",
    placeholder: "e.g. exterior wall — typical",
    value: state.componentName,
    onInput: (e) => {
      state.componentName = e.target.value;
      persist();
    },
  });
  return el("section", { className: "block" }, [
    el("label", { for: "componentName", className: "label" }, "Component name"),
    input,
  ]);
}

// — heat flow direction ──────────────────────────────────────────────
function renderHeatFlow() {
  const wrap = el("section", { className: "block" }, [
    el("div", { className: "label" }, "Heat flow direction"),
  ]);
  const group = el("div", { className: "radioGroup", role: "radiogroup" });

  for (const dir of Object.keys(SURFACE_RESISTANCES)) {
    const sr = SURFACE_RESISTANCES[dir];
    const id = `flow_${dir}`;
    const radio = el("input", {
      type: "radio",
      name: "heatFlow",
      id,
      value: dir,
      checked: state.heatFlowDirection === dir,
      onChange: () => {
        state.heatFlowDirection = dir;
        persist();
        render();
      },
    });

    const labelChildren = [sr.label, " "];
    const meta = el("span", { className: "meta" });
    meta.appendChild(renderDisplay(SHARED_POOL.surface_resistance_internal.display));
    meta.appendChild(document.createTextNode(` = ${fmt2(sr.R_si)}, `));
    meta.appendChild(renderDisplay(SHARED_POOL.surface_resistance_external.display));
    meta.appendChild(document.createTextNode(` = ${fmt2(sr.R_se)} (m²·K)/W`));
    labelChildren.push(meta);

    const label = el("label", { for: id, className: "radioLabel" }, labelChildren);
    group.appendChild(el("div", { className: "radioRow" }, [radio, label]));
  }
  wrap.appendChild(group);
  return wrap;
}

// — layers table ─────────────────────────────────────────────────────
function renderLayers() {
  const section = el("section", { className: "block" }, [
    el("div", { className: "label" }, "Layers (interior → exterior)"),
  ]);
  const table = el("table", { className: "layers" });

  // header row
  const thead = el("thead", {}, [
    el("tr", {}, [
      el("th", { className: "colNum" }, "#"),
      el("th", { className: "colMat" }, "Material"),
      el("th", { className: "colLam" }, [
        renderDisplay(SHARED_POOL.lambda_thermal_conductivity.display),
        el("span", { className: "unit" }, " W/(m·K)"),
      ]),
      el("th", { className: "colThk" }, [
        renderDisplay(SHARED_POOL.layer_thickness.display),
        el("span", { className: "unit" }, " mm"),
      ]),
      el("th", { className: "colR" }, [
        renderDisplay(SHARED_POOL.thermal_resistance_layer.display),
        el("span", { className: "unit" }, " (m²·K)/W"),
      ]),
      el("th", { className: "colAct" }, ""),
    ]),
  ]);
  table.appendChild(thead);

  const tbody = el("tbody");
  state.layers.forEach((layer, index) => {
    tbody.appendChild(renderLayerRow(layer, index));
  });
  table.appendChild(tbody);
  section.appendChild(table);

  section.appendChild(
    el(
      "button",
      {
        type: "button",
        className: "addBtn",
        onClick: () => {
          state.layers.push(freshLayer());
          persist();
          render();
        },
      },
      "+ Add layer"
    )
  );

  return section;
}

function renderLayerRow(layer, index) {
  const row = el("tr", {});

  // # column
  row.appendChild(el("td", { className: "colNum" }, String(index + 1)));

  // material select
  const select = el("select", {
    className: "matSelect",
    "aria-label": `Layer ${index + 1} material`,
    onChange: (e) => {
      const v = e.target.value;
      if (v === "__custom__") {
        layer.materialId = null;
        // Keep current lambda — user can edit.
      } else {
        layer.materialId = v;
        const m = MATERIAL_BY_ID[v];
        if (m) layer.lambda_W_mK = m.lambdaDefault;
      }
      persist();
      render();
    },
  });

  // Custom option first
  select.appendChild(
    el(
      "option",
      { value: "__custom__", selected: layer.materialId == null ? true : null },
      "— Custom material —"
    )
  );

  for (const cat of CATEGORIES) {
    const grp = el("optgroup", { label: cat });
    for (const m of MATERIALS.filter((x) => x.category === cat)) {
      grp.appendChild(
        el(
          "option",
          {
            value: m.id,
            selected: layer.materialId === m.id ? true : null,
          },
          `${m.name} (λ ${fmt3(m.lambdaDefault)})`
        )
      );
    }
    select.appendChild(grp);
  }

  // material cell wraps select + optional custom-name input
  const matCell = el("td", { className: "colMat" }, [select]);
  if (layer.materialId == null) {
    matCell.appendChild(
      el("input", {
        type: "text",
        className: "customNameInput",
        placeholder: "Custom name (optional)",
        value: layer.customName || "",
        "aria-label": `Layer ${index + 1} custom name`,
        onInput: (e) => {
          layer.customName = e.target.value;
          persist();
        },
      })
    );
  }
  row.appendChild(matCell);

  // lambda input
  const lambdaInput = el("input", {
    type: "number",
    className: "num",
    step: "0.001",
    min: "0",
    inputmode: "decimal",
    value: layer.lambda_W_mK != null ? String(layer.lambda_W_mK) : "",
    "aria-label": `Layer ${index + 1} lambda`,
    onInput: (e) => {
      const v = parseFloat(e.target.value);
      layer.lambda_W_mK = Number.isFinite(v) && v > 0 ? v : null;
      persist();
      updateRowDerived(row, layer);
      updateResults();
    },
  });
  row.appendChild(el("td", { className: "colLam" }, lambdaInput));

  // thickness in mm — stored internally in m
  const thkInput = el("input", {
    type: "number",
    className: "num",
    step: "1",
    min: "0",
    inputmode: "decimal",
    value:
      layer.thickness_m != null
        ? String(Math.round(layer.thickness_m * 1000 * 1000) / 1000) // tame floats
        : "",
    "aria-label": `Layer ${index + 1} thickness in mm`,
    onInput: (e) => {
      const mm = parseFloat(e.target.value);
      layer.thickness_m = Number.isFinite(mm) && mm >= 0 ? mm / 1000 : null;
      persist();
      updateRowDerived(row, layer);
      updateResults();
    },
  });
  row.appendChild(el("td", { className: "colThk" }, thkInput));

  // R cell (derived, read-only)
  const r = layerResistanceOrNull(layer);
  row.appendChild(
    el(
      "td",
      { className: "colR derived", "data-role": "rCell" },
      r != null ? fmt3(r) : "—"
    )
  );

  // remove button
  row.appendChild(
    el("td", { className: "colAct" }, [
      el(
        "button",
        {
          type: "button",
          className: "rmBtn",
          "aria-label": `Remove layer ${index + 1}`,
          onClick: () => {
            state.layers.splice(index, 1);
            persist();
            render();
          },
        },
        "×"
      ),
    ])
  );

  return row;
}

/**
 * Local DOM update for a single row's R cell — avoids a full re-render
 * on every keystroke. Full re-render is reserved for structural change
 * (add/remove/material change).
 */
function updateRowDerived(row, layer) {
  const rCell = row.querySelector('[data-role="rCell"]');
  if (!rCell) return;
  clear(rCell);
  const r = layerResistanceOrNull(layer);
  rCell.appendChild(document.createTextNode(r != null ? fmt3(r) : "—"));
}

// — results section ──────────────────────────────────────────────────
function renderResults() {
  const section = el("section", {
    className: "block results",
    id: "resultsSection",
  });
  buildResultsContent(section);
  return section;
}

function buildResultsContent(section) {
  clear(section);
  section.appendChild(el("div", { className: "label" }, "Result"));

  const r = results();

  // R_layers row
  section.appendChild(
    rowLine(
      [renderDisplay(SHARED_POOL.thermal_resistance_layer.display), "  (Σ layers)"],
      r.R_layers != null ? `${fmt3(r.R_layers)} (m²·K)/W` : "—"
    )
  );

  // R_si
  section.appendChild(
    rowLine(
      [renderDisplay(SHARED_POOL.surface_resistance_internal.display)],
      `${fmt2(r.R_si)} (m²·K)/W`
    )
  );

  // R_se
  section.appendChild(
    rowLine(
      [renderDisplay(SHARED_POOL.surface_resistance_external.display)],
      `${fmt2(r.R_se)} (m²·K)/W`
    )
  );

  // R_T
  section.appendChild(
    rowLine(
      [renderDisplay(SHARED_POOL.thermal_resistance_total.display)],
      r.R_T != null ? `${fmt3(r.R_T)} (m²·K)/W` : "—",
      "rTotalLine"
    )
  );

  // U
  section.appendChild(
    rowLine(
      [renderDisplay(SHARED_POOL.thermal_transmittance.display)],
      r.U != null ? `${fmt3(r.U)} W/(m²·K)` : "—",
      "uLine"
    )
  );

  if (r.incomplete) {
    section.appendChild(
      el(
        "p",
        { className: "hint" },
        "Add at least one layer with thickness and λ to obtain a U-value."
      )
    );
  }
}

function rowLine(labelChildren, valueText, extraClass) {
  const cn = "resRow" + (extraClass ? ` ${extraClass}` : "");
  return el("div", { className: cn }, [
    el("span", { className: "resLabel" }, [].concat(labelChildren)),
    el("span", { className: "resValue" }, valueText),
  ]);
}

function updateResults() {
  const section = document.getElementById("resultsSection");
  if (section) buildResultsContent(section);
}

// — footer ───────────────────────────────────────────────────────────
function renderFooter() {
  return el("footer", { className: "appFooter" }, [
    el(
      "button",
      {
        type: "button",
        className: "resetBtn",
        onClick: () => {
          if (!window.confirm("Reset this calculation? Cannot be undone.")) return;
          resetAll();
          state = {
            componentName: "",
            heatFlowDirection: "horizontal",
            layers: [],
          };
          persist();
          render();
        },
      },
      "Reset"
    ),
    el("p", { className: "src" }, DATA_SOURCE_NOTE),
  ]);
}

// ── boot ────────────────────────────────────────────────────────────
render();
