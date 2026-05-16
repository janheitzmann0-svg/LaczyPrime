// UI controller for Submodule 1.1 — U-value Quick Calc (Standalone).
//
// Pure DOM API; no innerHTML anywhere. Engine and persistence are
// imported from neighbouring modules; this controller owns no
// calculation logic.

import {
  computeUValue,
  surfaceResistancesFor,
} from "./uvalue.js";
import { computeTemperatureProfile } from "./temperature-profile.js";
import {
  MATERIALS,
  MATERIAL_BY_ID,
  CATEGORIES,
  SURFACE_RESISTANCES,
  DATA_SOURCE_NOTE,
} from "./reference-data.js";
import { SHARED_POOL } from "./notation.js";
import { loadQuickCalc, saveQuickCalc, resetAll } from "./persistence.js";

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
  theta_i_C: 20,
  theta_e_C: -10,
};

// Backward-compat: older persisted state may lack the boundary fields.
if (!Number.isFinite(state.theta_i_C)) state.theta_i_C = 20;
if (!Number.isFinite(state.theta_e_C)) state.theta_e_C = -10;

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
    return {
      incomplete: true,
      R_si,
      R_se,
      R_layers: 0,
      R_T: null,
      U: null,
      profile: null,
    };
  }
  const r = computeUValue({
    layers: validLayers,
    heatFlowDirection: state.heatFlowDirection,
  });

  let profile = null;
  if (Number.isFinite(state.theta_i_C) && Number.isFinite(state.theta_e_C)) {
    try {
      profile = computeTemperatureProfile({
        layers: validLayers,
        heatFlowDirection: state.heatFlowDirection,
        theta_i_C: state.theta_i_C,
        theta_e_C: state.theta_e_C,
      });
    } catch {
      profile = null;
    }
  }

  // Carry valid layer names alongside the profile so the diagram can
  // label each band with the correct material.
  const validLayerNames = state.layers
    .filter(
      (l) =>
        Number.isFinite(l.lambda_W_mK) &&
        l.lambda_W_mK > 0 &&
        Number.isFinite(l.thickness_m) &&
        l.thickness_m > 0
    )
    .map((l) => effectiveLayerName(l));

  return { incomplete: false, ...r, profile, layerNames: validLayerNames };
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
  const h1 = el("h1", {}, [
    "U-value ",
    el("em", {}, "— homogeneous component"),
  ]);
  const brand = el("div", { className: "brand", "aria-label": "LaczyPrime" }, [
    el("span", { className: "brandWord" }, "Laczy"),
    el("span", { className: "brandWordAccent" }, "Prime"),
    el("span", { className: "brandDot", "aria-hidden": "true" }, ""),
    el("span", { className: "brandTag" }, "Building physics · field manual"),
  ]);
  return el("header", { className: "appHeader" }, [
    brand,
    el("div", { className: "headerBody" }, [
      el("div", { className: "chapterMark", "aria-hidden": "true" }, "1.1"),
      el("div", { className: "headerText" }, [
        el("div", { className: "crumb" }, "Module 1 · Thermal protection"),
        h1,
        el(
          "p",
          { className: "sub" },
          "Steady-state, one-dimensional heat flow through a homogeneous build-up. " +
            "Layers ordered from interior to exterior."
        ),
      ]),
    ]),
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

  // — Material picker — custom searchable popover ───────────────────
  // A trigger button shows the current selection; clicking opens a
  // popover anchored to the row with a search input and filtered list.
  const matCell = el("td", { className: "colMat" });
  matCell.appendChild(renderMaterialPicker(layer, index));

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

// ── searchable material picker ──────────────────────────────────────
//
// A trigger button shows the current selection; clicking opens a
// popover with a search input and a filtered, category-grouped list.
// One picker per layer; only one open at a time (closing handled by
// outside-click listener).

let _openPicker = null;
function closeOpenPicker() {
  if (_openPicker) {
    _openPicker.remove();
    _openPicker = null;
    document.removeEventListener("click", _outsideClickHandler, true);
    document.removeEventListener("keydown", _escKeyHandler, true);
  }
}
function _outsideClickHandler(e) {
  if (_openPicker && !_openPicker.contains(e.target)) closeOpenPicker();
}
function _escKeyHandler(e) {
  if (e.key === "Escape") closeOpenPicker();
}

function renderMaterialPicker(layer, index) {
  const triggerLabel = layer.materialId && MATERIAL_BY_ID[layer.materialId]
    ? MATERIAL_BY_ID[layer.materialId].name
    : layer.customName
      ? `${layer.customName} (custom)`
      : "Choose material…";

  const triggerIsCustom = layer.materialId == null && !layer.customName;

  const trigger = el(
    "button",
    {
      type: "button",
      className: "matTrigger" + (triggerIsCustom ? " is-placeholder" : ""),
      "aria-haspopup": "listbox",
      "aria-label": `Layer ${index + 1} material`,
      onClick: (e) => {
        e.stopPropagation();
        const wasOpen = _openPicker && _openPicker.dataset.forIndex === String(index);
        closeOpenPicker();
        if (!wasOpen) openPicker(trigger, layer, index);
      },
    },
    [
      el("span", { className: "matTriggerLabel" }, triggerLabel),
      el("span", { className: "matTriggerChevron", "aria-hidden": "true" }, "▾"),
    ]
  );
  return trigger;
}

function openPicker(anchorEl, layer, index) {
  const popover = el("div", {
    className: "matPopover",
    "data-for-index": String(index),
    role: "dialog",
    "aria-label": "Choose material",
  });

  // Anchor positioning: place under the trigger, full-width.
  const rect = anchorEl.getBoundingClientRect();
  popover.style.position = "absolute";
  popover.style.left = `${window.scrollX + rect.left}px`;
  popover.style.top = `${window.scrollY + rect.bottom + 4}px`;
  popover.style.minWidth = `${Math.max(rect.width, 360)}px`;

  // Search input
  const searchInput = el("input", {
    type: "search",
    className: "matSearch",
    placeholder: "Search materials… (or leave blank to browse)",
    "aria-label": "Search materials",
    autocomplete: "off",
    spellcheck: "false",
  });
  popover.appendChild(searchInput);

  // List container
  const listBox = el("div", { className: "matList", role: "listbox" });
  popover.appendChild(listBox);

  function pick(materialId) {
    if (materialId === "__custom__") {
      layer.materialId = null;
      // keep lambda; user will edit
    } else {
      layer.materialId = materialId;
      const m = MATERIAL_BY_ID[materialId];
      if (m && Number.isFinite(m.lambda)) layer.lambda_W_mK = m.lambda;
    }
    closeOpenPicker();
    persist();
    render();
  }

  function renderList(query) {
    clear(listBox);
    const q = (query || "").trim().toLowerCase();

    // Custom option always at top
    listBox.appendChild(
      el(
        "button",
        {
          type: "button",
          className: "matItem matItem--custom",
          onClick: () => pick("__custom__"),
        },
        [
          el("span", { className: "matItemName" }, "— Custom material —"),
          el("span", { className: "matItemMeta" }, "manual λ, manual name"),
        ]
      )
    );

    let total = 0;
    for (const cat of CATEGORIES) {
      const matches = MATERIALS.filter(
        (m) =>
          m.category === cat &&
          (q === "" ||
            m.name.toLowerCase().includes(q) ||
            (m.subgroup && m.subgroup.toLowerCase().includes(q)) ||
            cat.toLowerCase().includes(q))
      );
      if (matches.length === 0) continue;

      listBox.appendChild(el("div", { className: "matCatHead" }, cat));

      let lastSub = null;
      for (const m of matches) {
        if (m.subgroup && m.subgroup !== lastSub) {
          listBox.appendChild(
            el("div", { className: "matSubHead" }, m.subgroup)
          );
          lastSub = m.subgroup;
        }
        const isSelected = layer.materialId === m.id;
        listBox.appendChild(
          el(
            "button",
            {
              type: "button",
              className: "matItem" + (isSelected ? " is-selected" : ""),
              onClick: () => pick(m.id),
            },
            [
              el("span", { className: "matItemName" }, m.name),
              el("span", { className: "matItemMeta" },
                `λ ${fmt3(m.lambda)}` +
                (m.density != null ? ` · ρ ${m.density}` : "")),
            ]
          )
        );
        total++;
      }
    }
    if (total === 0 && q !== "") {
      listBox.appendChild(
        el("div", { className: "matEmpty" }, "No matching materials.")
      );
    }
  }

  searchInput.addEventListener("input", (e) => renderList(e.target.value));
  renderList("");

  document.body.appendChild(popover);
  _openPicker = popover;
  // Defer registration so the same click that opened doesn't close it.
  setTimeout(() => {
    document.addEventListener("click", _outsideClickHandler, true);
    document.addEventListener("keydown", _escKeyHandler, true);
  }, 0);
  searchInput.focus();
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

  const r = results();

  // — Hero: the U-value, big and quiet ——
  const heroValueText = r.U != null ? fmt3(r.U) : "—";
  const hero = el("div", { className: "hero" }, [
    el("div", { className: "heroLabel" }, "U-value"),
    el("div", { className: "heroLine" }, [
      el("span", { className: "heroValue" }, heroValueText),
      el("span", { className: "heroUnit" }, "W/(m²·K)"),
    ]),
  ]);
  section.appendChild(hero);

  // — Breakdown: how U gets there ——
  const breakdown = el("div", { className: "breakdown" });

  breakdown.appendChild(
    resRow(
      [
        renderDisplay(SHARED_POOL.thermal_resistance_layer.display),
        el("span", { className: "rowSub" }, "Σ layers"),
      ],
      r.R_layers != null ? fmt3(r.R_layers) : "—",
      "(m²·K)/W"
    )
  );
  breakdown.appendChild(
    resRow(
      [renderDisplay(SHARED_POOL.surface_resistance_internal.display)],
      fmt2(r.R_si),
      "(m²·K)/W"
    )
  );
  breakdown.appendChild(
    resRow(
      [renderDisplay(SHARED_POOL.surface_resistance_external.display)],
      fmt2(r.R_se),
      "(m²·K)/W"
    )
  );
  breakdown.appendChild(
    resRow(
      [renderDisplay(SHARED_POOL.thermal_resistance_total.display)],
      r.R_T != null ? fmt3(r.R_T) : "—",
      "(m²·K)/W",
      "rTotalLine"
    )
  );

  section.appendChild(breakdown);

  if (r.incomplete) {
    section.appendChild(
      el(
        "p",
        { className: "hint" },
        "Add at least one layer with thickness and λ to obtain a U-value."
      )
    );
  }

  // ── Temperature profile sub-section ───────────────────────────────
  if (!r.incomplete && r.profile) {
    section.appendChild(buildTemperatureProfileBlock(r));
  }
}

// ── Temperature profile (sub-section inside results) ────────────────

function buildTemperatureProfileBlock(r) {
  const p = r.profile;

  const block = el("div", { className: "profileBlock" });

  // Section heading
  block.appendChild(
    el("div", { className: "profileHead" }, [
      el("div", { className: "profileTitle" }, "Temperature profile"),
      el(
        "div",
        { className: "profileSub" },
        "Steady-state, 1-D · Willems §2.4"
      ),
    ])
  );

  // Boundary condition inputs (θ_i, θ_e)
  const boundaryRow = el("div", { className: "boundaryRow" });

  const mkBoundaryInput = (id, labelSpec, value, onChange) => {
    const input = el("input", {
      type: "number",
      id,
      className: "num numCompact",
      step: "0.1",
      inputmode: "decimal",
      value: String(value),
      "aria-label": labelSpec.name,
      onInput: (e) => onChange(parseFloat(e.target.value)),
    });
    const labelEl = el("label", { for: id, className: "boundaryLabel" });
    labelEl.appendChild(renderDisplay(labelSpec.display));
    return el("div", { className: "boundaryField" }, [
      labelEl,
      input,
      el("span", { className: "boundaryUnit" }, "°C"),
    ]);
  };

  boundaryRow.appendChild(
    mkBoundaryInput(
      "thetaI",
      SHARED_POOL.theta_indoor_air,
      state.theta_i_C,
      (v) => {
        state.theta_i_C = Number.isFinite(v) ? v : state.theta_i_C;
        persist();
        updateResults();
      }
    )
  );
  boundaryRow.appendChild(
    mkBoundaryInput(
      "thetaE",
      SHARED_POOL.theta_outdoor_air,
      state.theta_e_C,
      (v) => {
        state.theta_e_C = Number.isFinite(v) ? v : state.theta_e_C;
        persist();
        updateResults();
      }
    )
  );

  block.appendChild(boundaryRow);

  // Heat flux density q — small hero line
  const qHero = el("div", { className: "qLine" }, [
    el("span", { className: "qLabel" }, [
      renderDisplay(SHARED_POOL.heat_flux_density.display),
      el("span", { className: "qSub" }, "heat flux density"),
    ]),
    el("span", { className: "qValueGroup" }, [
      el("span", { className: "qValue" }, fmt2(p.q)),
      el("span", { className: "qUnit" }, "W/m²"),
    ]),
  ]);
  block.appendChild(qHero);

  // θ table
  block.appendChild(buildThetaTable(p));

  // SVG diagram
  block.appendChild(buildTemperatureDiagram(p, r.layerNames));

  return block;
}

function buildThetaTable(p) {
  const table = el("table", { className: "thetaTable" });
  const thead = el("thead", {}, [
    el("tr", {}, [
      el("th", {}, "Point"),
      el("th", { className: "tNum" }, "x"),
      el("th", { className: "tNum" }, "θ"),
    ]),
  ]);
  table.appendChild(thead);

  const tbody = el("tbody");
  for (const n of p.nodes) {
    const labelCell = el("td", {});
    labelCell.appendChild(formatThetaLabel(n.label));
    const xText = (n.x_m * 1000).toLocaleString("en-GB", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    });
    tbody.appendChild(
      el("tr", { className: `thetaRow thetaRow--${n.kind}` }, [
        labelCell,
        el("td", { className: "tNum" }, [
          el("span", {}, xText),
          el("span", { className: "tUnit" }, " mm"),
        ]),
        el("td", { className: "tNum" }, [
          el("span", {}, fmt2(n.theta_C)),
          el("span", { className: "tUnit" }, " °C"),
        ]),
      ])
    );
  }
  table.appendChild(tbody);
  return table;
}

/**
 * Render a θ-label like "θ_si", "θ_1/2", "θ_i" into a DOM fragment with
 * proper subscript. Avoids innerHTML.
 */
function formatThetaLabel(raw) {
  const frag = document.createDocumentFragment();
  // raw is "θ_<subscript>"
  const m = raw.match(/^θ_(.+)$/);
  if (!m) {
    frag.appendChild(document.createTextNode(raw));
    return frag;
  }
  frag.appendChild(document.createTextNode("θ"));
  frag.appendChild(el("sub", {}, m[1]));
  return frag;
}

// ── SVG diagram ─────────────────────────────────────────────────────

const SVG_NS = "http://www.w3.org/2000/svg";

function svg(tag, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    node.setAttribute(k, String(v));
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
 * Build the temperature profile diagram as an SVG element.
 *
 * Layout: airZone | layer1 | layer2 | … | layerN | airZone
 *
 * Component layers are drawn to real scale. The two air zones at the
 * sides have a fixed pixel width purely for didactic visualisation of
 * R_si / R_se — they are not metric distances.
 */
function buildTemperatureDiagram(profile, layerNames) {
  // SVG viewBox dimensions — designed for ~700×320 logical units.
  const W = 700;
  const H = 340;
  const PAD = { top: 28, right: 18, bottom: 64, left: 56 };
  const AIR_PX = 56; // didactic width of each air zone in px

  const plotX0 = PAD.left;
  const plotX1 = W - PAD.right;
  const plotY0 = PAD.top;
  const plotY1 = H - PAD.bottom;
  const plotW = plotX1 - plotX0;
  const plotH = plotY1 - plotY0;

  // x-axis: component thickness scaled, plus air zones at the sides
  const total_m = profile.totalThickness_m;
  const componentPxW = plotW - 2 * AIR_PX;
  const mToPx = (m) => plotX0 + AIR_PX + (m / total_m) * componentPxW;
  const airInteriorXStart = plotX0;
  const airInteriorXEnd = plotX0 + AIR_PX;
  const airExteriorXStart = plotX1 - AIR_PX;
  const airExteriorXEnd = plotX1;

  // y-axis: temperature
  const allThetas = profile.nodes.map((n) => n.theta_C);
  const yMinRaw = Math.min(...allThetas);
  const yMaxRaw = Math.max(...allThetas);
  // round to nearest 5°C, with a 1°C padding on the small side
  const yMin = Math.floor((yMinRaw - 1) / 5) * 5;
  const yMax = Math.ceil((yMaxRaw + 1) / 5) * 5;
  const yToPx = (t) => plotY1 - ((t - yMin) / (yMax - yMin)) * plotH;

  // ── Root SVG ──────────────────────────────────────────────────
  const root = svg("svg", {
    class: "tempSvg",
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label": "Steady-state temperature profile through component",
    preserveAspectRatio: "xMidYMid meet",
  });

  // Air zones (interior + exterior) as subtle background bands
  root.appendChild(
    svg("rect", {
      x: airInteriorXStart,
      y: plotY0,
      width: AIR_PX,
      height: plotH,
      class: "airBand",
    })
  );
  root.appendChild(
    svg("rect", {
      x: airExteriorXStart,
      y: plotY0,
      width: AIR_PX,
      height: plotH,
      class: "airBand",
    })
  );

  // Layer background bands — alternating shade
  profile.perLayer.forEach((layer, i) => {
    const x = mToPx(layer.x_start_m);
    const w = mToPx(layer.x_end_m) - x;
    root.appendChild(
      svg("rect", {
        x,
        y: plotY0,
        width: w,
        height: plotH,
        class: i % 2 === 0 ? "layerBand layerBand--a" : "layerBand layerBand--b",
      })
    );
  });

  // Surface lines — solid verticals at component edges (start/end of layers)
  // These mark the boundary between the component body and the air zones.
  root.appendChild(
    svg("line", {
      x1: mToPx(0),
      y1: plotY0,
      x2: mToPx(0),
      y2: plotY1,
      class: "surfaceLine",
    })
  );
  root.appendChild(
    svg("line", {
      x1: mToPx(total_m),
      y1: plotY0,
      x2: mToPx(total_m),
      y2: plotY1,
      class: "surfaceLine",
    })
  );

  // Interface lines between layers
  for (let i = 0; i < profile.perLayer.length - 1; i++) {
    const x = mToPx(profile.perLayer[i].x_end_m);
    root.appendChild(
      svg("line", {
        x1: x,
        y1: plotY0,
        x2: x,
        y2: plotY1,
        class: "interfaceLine",
      })
    );
  }

  // ── y-axis (temperature) ──────────────────────────────────────
  // Vertical axis line
  root.appendChild(
    svg("line", {
      x1: plotX0,
      y1: plotY0,
      x2: plotX0,
      y2: plotY1,
      class: "axisLine",
    })
  );
  // Tick marks every 5°C
  const yStep = (yMax - yMin) >= 40 ? 10 : 5;
  for (let t = yMin; t <= yMax; t += yStep) {
    const py = yToPx(t);
    root.appendChild(
      svg("line", {
        x1: plotX0 - 4,
        y1: py,
        x2: plotX0,
        y2: py,
        class: "tickMark",
      })
    );
    root.appendChild(
      svg(
        "text",
        {
          x: plotX0 - 8,
          y: py + 3.5,
          class: "axisLabel",
          "text-anchor": "end",
        },
        String(t)
      )
    );
    // light horizontal grid line across plot
    root.appendChild(
      svg("line", {
        x1: plotX0,
        y1: py,
        x2: plotX1,
        y2: py,
        class: t === 0 ? "gridLine gridLine--zero" : "gridLine",
      })
    );
  }
  // y-axis title
  root.appendChild(
    svg(
      "text",
      {
        x: 14,
        y: plotY0 + plotH / 2,
        class: "axisTitle",
        transform: `rotate(-90 14 ${plotY0 + plotH / 2})`,
        "text-anchor": "middle",
      },
      "θ  /  °C"
    )
  );

  // ── x-axis (thickness in m) ───────────────────────────────────
  // Horizontal axis line at the bottom of the plot
  root.appendChild(
    svg("line", {
      x1: plotX0,
      y1: plotY1,
      x2: plotX1,
      y2: plotY1,
      class: "axisLine",
    })
  );
  // Ticks at every layer boundary (in the component portion)
  const tickPositions = [0, ...profile.perLayer.map((l) => l.x_end_m)];
  let lastLabelPx = -1000;
  const TICK_LABEL_MIN_PX = 22;
  for (const xm of tickPositions) {
    const px = mToPx(xm);
    // tick mark always drawn
    root.appendChild(
      svg("line", {
        x1: px,
        y1: plotY1,
        x2: px,
        y2: plotY1 + 4,
        class: "tickMark",
      })
    );
    // label only if not crowding the previous label
    if (px - lastLabelPx >= TICK_LABEL_MIN_PX) {
      root.appendChild(
        svg(
          "text",
          {
            x: px,
            y: plotY1 + 16,
            class: "axisLabel",
            "text-anchor": "middle",
          },
          xm.toFixed(3)
        )
      );
      lastLabelPx = px;
    }
  }
  // x-axis title
  root.appendChild(
    svg(
      "text",
      {
        x: plotX0 + plotW / 2,
        y: H - 6,
        class: "axisTitle",
        "text-anchor": "middle",
      },
      "x  /  m"
    )
  );

  // ── Layer name labels (above plot, in each band) ──────────────
  profile.perLayer.forEach((layer, i) => {
    const x = (mToPx(layer.x_start_m) + mToPx(layer.x_end_m)) / 2;
    const wPx = mToPx(layer.x_end_m) - mToPx(layer.x_start_m);
    const rawName = layerNames[i] || `Layer ${i + 1}`;
    // approx 5.5 px per char at 10.5px italic
    const maxChars = Math.floor((wPx - 6) / 5.5);
    let display;
    if (maxChars < 4) {
      display = String(i + 1);
    } else if (rawName.length > maxChars) {
      display = rawName.slice(0, maxChars - 1) + "…";
    } else {
      display = rawName;
    }
    root.appendChild(
      svg(
        "text",
        {
          x,
          y: plotY0 - 8,
          class: "layerName",
          "text-anchor": "middle",
        },
        display
      )
    );
  });

  // ── Temperature polyline (red) ────────────────────────────────
  // Map nodes to SVG coordinates. Air-interior node sits at the
  // far-left edge of the interior air band; air-exterior at far-right
  // edge of the exterior air band. Surface nodes sit at component edges.
  const polyPts = profile.nodes.map((n) => {
    let px;
    if (n.kind === "air_interior") px = airInteriorXStart;
    else if (n.kind === "air_exterior") px = airExteriorXEnd;
    else if (n.kind === "surface_interior") px = mToPx(0);
    else if (n.kind === "surface_exterior") px = mToPx(total_m);
    else px = mToPx(n.x_m);
    return { px, py: yToPx(n.theta_C), node: n };
  });

  // Polyline
  const polyD =
    "M " + polyPts.map((p) => `${p.px.toFixed(2)} ${p.py.toFixed(2)}`).join(" L ");
  root.appendChild(svg("path", { d: polyD, class: "tempLine" }));

  // Node dots and inline labels.
  // Label placement uses a two-pass conflict-avoidance:
  // (1) default side = above for nodes warmer than the midpoint, below
  //     otherwise; (2) if the chosen side crowds the previous label
  //     within MIN_PX, try the opposite side; (3) if that also crowds,
  //     suppress this label. Dots are always drawn — the θ-table holds
  //     the precise values, the diagram is for visual flow.
  const midT = (profile.theta_i_C + profile.theta_e_C) / 2;
  const MIN_PX_DIST = 24;
  const lastPxBySide = { above: -1000, below: -1000 };
  const labelDecisions = polyPts.map((p) => {
    const preferred = p.node.theta_C >= midT ? "above" : "below";
    const other = preferred === "above" ? "below" : "above";
    let side = null;
    if (p.px - lastPxBySide[preferred] >= MIN_PX_DIST) side = preferred;
    else if (p.px - lastPxBySide[other] >= MIN_PX_DIST) side = other;
    if (side) lastPxBySide[side] = p.px;
    return { side };
  });

  polyPts.forEach((p, i) => {
    root.appendChild(
      svg("circle", {
        cx: p.px,
        cy: p.py,
        r: 3.2,
        class: "tempDot",
      })
    );
    const decision = labelDecisions[i];
    if (!decision.side) return;
    const dy = decision.side === "above" ? -8 : 14;
    const valueText = p.node.theta_C.toLocaleString("en-GB", {
      maximumFractionDigits: 1,
      minimumFractionDigits: 1,
    });
    root.appendChild(
      svg(
        "text",
        {
          x: p.px,
          y: p.py + dy,
          class: "tempLabel",
          "text-anchor": "middle",
        },
        valueText
      )
    );
  });

  // Wrap in a figure for proper semantics & spacing.
  const figure = el("figure", { className: "tempFig" }, [root]);
  return figure;
}

function resRow(labelChildren, valueText, unitText, extraClass) {
  const cn = "resRow" + (extraClass ? ` ${extraClass}` : "");
  return el("div", { className: cn }, [
    el("span", { className: "resLabel" }, [].concat(labelChildren)),
    el("span", { className: "resValueGroup" }, [
      el("span", { className: "resValue" }, valueText),
      el("span", { className: "resUnit" }, unitText),
    ]),
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
            theta_i_C: 20,
            theta_e_C: -10,
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

// ── service worker registration ─────────────────────────────────────
// Network-first strategy is implemented in sw.js — updates ship
// immediately on next page load, cache is offline fallback only.
// Registered after first render so it never blocks UI.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js", { scope: "./" })
      .catch((err) => {
        console.warn("[laczyprime] service worker registration failed:", err);
      });
  });
}
