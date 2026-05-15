// UI controller for Submodule 1.1 — U-value Quick Calc (Standalone).
//
// Pure DOM API; no innerHTML anywhere. Engine and persistence are
// imported from neighbouring modules; this controller owns no
// calculation logic.

import {
  computeUValue,
  surfaceResistancesFor,
} from "./uvalue.js";
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
