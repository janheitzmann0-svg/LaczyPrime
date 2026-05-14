// LocalStorage persistence wrapper.
//
// Every persisted object carries `schemaVersion`. No migration logic
// is provided yet; the field is reserved for future use.
//
// All data lives under a single namespaced key. Stored payloads are
// JSON-encoded.

const STORAGE_KEY = "bauphysik.v1";
const SCHEMA_VERSION = 1;

/**
 * Default empty state.
 */
export function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    uvalueQuickCalc: {
      componentName: "",
      heatFlowDirection: "horizontal",
      layers: [],
    },
  };
}

/**
 * Load full state. Returns `emptyState()` if nothing persisted
 * or the persisted data cannot be parsed.
 */
export function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyState();
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      // Future migration logic would go here.
      return emptyState();
    }
    // Backfill any missing sections so callers can rely on shape.
    return { ...emptyState(), ...parsed };
  } catch (err) {
    console.warn("[persistence] load failed; falling back to empty state.", err);
    return emptyState();
  }
}

/**
 * Save full state.
 */
export function saveState(state) {
  try {
    const payload = { ...state, schemaVersion: SCHEMA_VERSION };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn("[persistence] save failed.", err);
  }
}

/**
 * Convenience: read/write the U-value quick-calc slice.
 */
export function loadQuickCalc() {
  return loadState().uvalueQuickCalc;
}

export function saveQuickCalc(quickCalc) {
  const state = loadState();
  state.uvalueQuickCalc = quickCalc;
  saveState(state);
}

/**
 * Wipe everything.
 */
export function resetAll() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("[persistence] reset failed.", err);
  }
}
