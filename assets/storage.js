(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HotelCalculatorStorage = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const HISTORY_KEY = "hotelCalculator.history.v1";
  const DRAFT_KEY = "hotelCalculator.draft.v1";
  const RATE_MEMORY_KEY = "hotelCalculator.rateMemory.v1";
  const RATE_AUTOFILL_KEY = "hotelCalculator.rateAutofill.v1";

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

  function rateMemory() {
    const rows = readJson(RATE_MEMORY_KEY, []);
    return Array.isArray(rows) ? rows : [];
  }

  function rateKey(entry) {
    return [
      entry.hotel,
      entry.type,
      entry.item,
      entry.from || "",
      entry.to || "",
    ].map((value) => String(value || "").trim().toLowerCase()).join("|");
  }

  function saveRateMemory(entry) {
    if (!entry || !entry.hotel || !entry.type || !entry.item || !entry.rateFormula || Number(entry.rate || 0) <= 0) return null;
    const nextEntry = {
      hotel: String(entry.hotel).trim(),
      type: String(entry.type).trim(),
      item: String(entry.item).trim(),
      from: String(entry.from || "").trim(),
      to: String(entry.to || "").trim(),
      rate: Number(entry.rate || 0),
      rateFormula: String(entry.rateFormula).trim(),
      savedAt: new Date().toISOString(),
    };
    const nextKey = rateKey(nextEntry);
    const next = [nextEntry, ...rateMemory().filter((item) => rateKey(item) !== nextKey)];
    writeJson(RATE_MEMORY_KEY, next.slice(0, 1000));
    return nextEntry;
  }

  function findRateMemory(query) {
    if (!query || !query.hotel || !query.type || !query.item) return null;
    const normalized = {
      hotel: String(query.hotel).trim().toLowerCase(),
      type: String(query.type).trim().toLowerCase(),
      item: String(query.item).trim().toLowerCase(),
      from: String(query.from || "").trim(),
      to: String(query.to || "").trim(),
    };
    return rateMemory().find((entry) => (
      String(entry.hotel || "").trim().toLowerCase() === normalized.hotel
      && String(entry.type || "").trim().toLowerCase() === normalized.type
      && String(entry.item || "").trim().toLowerCase() === normalized.item
      && String(entry.from || "").trim() === normalized.from
      && String(entry.to || "").trim() === normalized.to
      && entry.rateFormula
    )) || null;
  }

  function rateAutofillEnabled() {
    return readJson(RATE_AUTOFILL_KEY, false) === true;
  }

  function setRateAutofillEnabled(enabled) {
    writeJson(RATE_AUTOFILL_KEY, Boolean(enabled));
    return rateAutofillEnabled();
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
    findRateMemory,
    rateAutofillEnabled,
    rateMemory,
    replaceHistory,
    saveDraft,
    saveHistory,
    saveRateMemory,
    setRateAutofillEnabled,
  };
});
