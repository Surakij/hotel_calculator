(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HotelCalculatorStorage = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const HISTORY_KEY = "hotelCalculator.history.v1";
  const DRAFT_KEY = "hotelCalculator.draft.v1";

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be unavailable in strict privacy modes; keep the app usable.
    }
  }

  function history() {
    const rows = readJson(HISTORY_KEY, []);
    return Array.isArray(rows) ? rows : [];
  }

  function saveHistory(entry) {
    const rows = history();
    const existing = rows.findIndex((item) => item.id === entry.id);
    const next = existing >= 0 ? rows.map((item, index) => (index === existing ? entry : item)) : [entry, ...rows];
    writeJson(HISTORY_KEY, next.slice(0, 500));
    return entry;
  }

  function deleteHistory(id) {
    writeJson(HISTORY_KEY, history().filter((entry) => entry.id !== id));
  }

  function replaceHistory(entries) {
    const safeEntries = Array.isArray(entries) ? entries : [];
    writeJson(HISTORY_KEY, safeEntries.slice(0, 500));
    return history();
  }

  function mergeHistory(entries) {
    const byId = new Map(history().map((entry) => [entry.id, entry]));
    (Array.isArray(entries) ? entries : []).forEach((entry) => {
      if (entry && entry.id) byId.set(entry.id, entry);
    });
    const merged = [...byId.values()].sort((left, right) => String(right.savedAt || "").localeCompare(String(left.savedAt || "")));
    writeJson(HISTORY_KEY, merged.slice(0, 500));
    return history();
  }

  function saveDraft(payload) {
    writeJson(DRAFT_KEY, { savedAt: new Date().toISOString(), payload });
  }

  function loadDraft() {
    return readJson(DRAFT_KEY, null);
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

  function createId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  return {
    clearDraft,
    createId,
    deleteHistory,
    history,
    loadDraft,
    mergeHistory,
    replaceHistory,
    saveDraft,
    saveHistory,
  };
});
