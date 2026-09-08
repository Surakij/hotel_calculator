(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HotelCalculatorStorage = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const namespace = typeof document === "undefined" ? "" : document.documentElement.dataset.storageNamespace || "";
  const HISTORY_KEY = "hotelCalculator.history.v1";
  const DRAFT_KEY = "hotelCalculator.draft.v1";
  const RATE_MEMORY_KEY = "hotelCalculator.rateMemory.v1";
  const RATE_AUTOFILL_KEY = "hotelCalculator.rateAutofill.v1";
  const APPEARANCE_KEY = "hotelCalculator.appearance.v1";
  const DEFAULT_APPEARANCE = {
    theme: "light",
    colors: {
      navy: "#082758",
      blue: "#2563eb",
      green: "#24a148",
    },
  };

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(namespace + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(namespace + key, JSON.stringify(value));
      return true;
    } catch {
      return false;
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
    return writeJson(HISTORY_KEY, next.slice(0, 500)) ? entry : null;
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
    try { localStorage.removeItem(namespace + DRAFT_KEY); } catch { /* Storage may be unavailable. */ }
  }

  function rateMemory() {
    const rows = readJson(RATE_MEMORY_KEY, []);
    return Array.isArray(rows) ? rows : [];
  }

  function canonicalHotelName(name, item = "") {
    const value = String(name || "").trim();
    if (/^angsana resort & spa maldives - velavaru$/i.test(value)) return "Angsana Velavaru";
    if (/^coco palm dhunikolhu$/i.test(value)) return "Coco Palm Dhuni Kolhu";
    if (/^heritance aarah$/i.test(value)) return "Heritance Aarah Maldives";
    if (value === "Centara Mirage Lagoon Maldives & Centara Grand Lagoon Maldives") {
      if (/^(?:Panoramic|Mirage|Beachfront|Overwater|Four Bedroom)/i.test(item)) return "Centara Mirage Lagoon Maldives";
    }
    if (/^fihaalhohi maldives$/i.test(value)) return "Fihalhohi Maldives";
    if (value === "Riu Atoll and Riu Palace Maldivas") {
      if (/^RIU Atoll - /i.test(item)) return "Riu Atoll";
      if (/^RIU Palace Maldivas - /i.test(item)) return "Riu Palace Maldives";
    }
    return /^inter continental maldives maamunagau$/i.test(value)
      ? "Intercontinental Maldives Maamunagau Resort" : value;
  }

  function canonicalItemName(hotel, item) {
    const value = String(item || "").trim();
    if (/^fiha{1,2}lhohi maldives$/i.test(String(hotel || "").trim())
      && /^(?:Deluxe Beach|Deluxe Sky|Deluxe Superior|Premium Beach)$/i.test(value)) return `${value} Room`;
    return value;
  }

  function rateKey(entry) {
    return [
      canonicalHotelName(entry.hotel, entry.item),
      entry.type,
      canonicalItemName(entry.hotel, entry.item),
      entry.from || "",
      entry.to || "",
      entry.spo || "",
    ].map((value) => String(value || "").trim().toLowerCase()).join("|");
  }

  function normalizeDiscounts(discounts) {
    return (Array.isArray(discounts) ? discounts : [])
      .map((item) => Number(item || 0))
      .filter((item) => item > 0 && item <= 100)
      .slice(0, 4);
  }

  function saveRateMemory(entry) {
    if (!entry || !entry.hotel || !entry.type || !entry.item || !entry.rateFormula || Number(entry.rate || 0) <= 0) return null;
    const spo = String(entry.spo || "").trim();
    const nextEntry = {
      hotel: canonicalHotelName(entry.hotel, entry.item),
      type: String(entry.type).trim(),
      item: canonicalItemName(entry.hotel, entry.item),
      from: String(entry.from || "").trim(),
      to: String(entry.to || "").trim(),
      spo,
      rate: Number(entry.rate || 0),
      rateFormula: String(entry.rateFormula).trim(),
      savedAt: new Date().toISOString(),
    };
    const discounts = spo ? normalizeDiscounts(entry.discounts) : [];
    if (discounts.length) nextEntry.discounts = discounts;
    const nextKey = rateKey(nextEntry);
    const next = [nextEntry, ...rateMemory().filter((item) => rateKey(item) !== nextKey)];
    writeJson(RATE_MEMORY_KEY, next.slice(0, 1000));
    return nextEntry;
  }

  function findRateMemory(query) {
    if (!query || !query.hotel || !query.type || !query.item) return null;
    const normalized = {
      hotel: canonicalHotelName(query.hotel, query.item).toLowerCase(),
      type: String(query.type).trim().toLowerCase(),
      item: canonicalItemName(query.hotel, query.item).toLowerCase(),
      from: String(query.from || "").trim(),
      to: String(query.to || "").trim(),
      spo: String(query.spo || "").trim().toLowerCase(),
    };
    const sameDates = (entry) => {
      const entryFrom = String(entry.from || "").trim();
      const entryTo = String(entry.to || "").trim();
      if (normalized.type === "dinner") {
        return entryFrom === normalized.from
          && (!entryTo || entryTo === entryFrom)
          && (!normalized.to || normalized.to === normalized.from);
      }
      return entryFrom === normalized.from && entryTo === normalized.to;
    };
    const matchesBase = (entry) => (
      canonicalHotelName(entry.hotel, entry.item).toLowerCase() === normalized.hotel
      && String(entry.type || "").trim().toLowerCase() === normalized.type
      && canonicalItemName(entry.hotel, entry.item).toLowerCase() === normalized.item
      && sameDates(entry)
      && entry.rateFormula
    );
    const rows = rateMemory();
    const exact = rows.find((entry) => (
      matchesBase(entry)
      && String(entry.spo || "").trim().toLowerCase() === normalized.spo
    ));
    if (exact) return exact;
    if (normalized.spo) return rows.find((entry) => matchesBase(entry) && !String(entry.spo || "").trim()) || null;
    return null;
  }

  function rateAutofillEnabled() {
    return readJson(RATE_AUTOFILL_KEY, false) === true;
  }

  function setRateAutofillEnabled(enabled) {
    writeJson(RATE_AUTOFILL_KEY, Boolean(enabled));
    return rateAutofillEnabled();
  }

  function isColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || ""));
  }

  function appearanceSettings() {
    const settings = readJson(APPEARANCE_KEY, DEFAULT_APPEARANCE);
    const colors = settings && typeof settings.colors === "object" ? settings.colors : {};
    return {
      theme: settings?.theme === "dark" ? "dark" : "light",
      colors: {
        navy: isColor(colors.navy) ? colors.navy : DEFAULT_APPEARANCE.colors.navy,
        blue: isColor(colors.blue) ? colors.blue : DEFAULT_APPEARANCE.colors.blue,
        green: isColor(colors.green) ? colors.green : DEFAULT_APPEARANCE.colors.green,
      },
    };
  }

  function saveAppearanceSettings(settings) {
    const next = {
      theme: settings?.theme === "dark" ? "dark" : "light",
      colors: {
        navy: isColor(settings?.colors?.navy) ? settings.colors.navy : DEFAULT_APPEARANCE.colors.navy,
        blue: isColor(settings?.colors?.blue) ? settings.colors.blue : DEFAULT_APPEARANCE.colors.blue,
        green: isColor(settings?.colors?.green) ? settings.colors.green : DEFAULT_APPEARANCE.colors.green,
      },
    };
    writeJson(APPEARANCE_KEY, next);
    return appearanceSettings();
  }

  function resetAppearanceSettings() {
    writeJson(APPEARANCE_KEY, DEFAULT_APPEARANCE);
    return appearanceSettings();
  }

  function createId() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  return {
    canonicalHotelName,
    canonicalItemName,
    appearanceSettings,
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
    resetAppearanceSettings,
    saveAppearanceSettings,
    setRateAutofillEnabled,
  };
});
