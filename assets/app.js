(function () {
  const core = window.HotelCalcCore;
  const storage = window.HotelCalculatorStorage;
  const googleDrive = window.HotelCalculatorGoogleDrive;
  const samoParser = window.HotelCalculatorSamoParser;
  const HOTEL_DATA = window.HotelCalculatorHotelData || {};
  const HOTEL_NAMES = Object.keys(HOTEL_DATA);
  const APP_VERSION = "1.6.12";
  const DEFAULT_HOTELS = ["Ozen Bolifushi", "Ozen Life Maadhoo"];
  const ROW_TYPE_ORDER = ["ROOM", "EXTRA", "MEAL", "DINNER", "TRANSFER", "GREEN_TAX"];
  const ADD_TYPE_ORDER = ["ROOM", "MEAL", "TRANSFER", "GREEN_TAX", "EXTRA", "DINNER"];
  const TYPE_LABELS = {
    ROOM: "ROOM",
    MEAL: "MEAL",
    TRANSFER: "TRANSFER",
    EXTRA: "EXTRA",
    GREEN_TAX: "GREEN TAX",
    DINNER: "DINNER",
  };
  const LISTS = {
    HOTEL: [...new Set([...DEFAULT_HOTELS, ...HOTEL_NAMES])].sort((a, b) => a.localeCompare(b)),
    ROOM: [],
    MEAL: ["BB - Adult", "BB - Child", "HB - Adult", "HB - Child", "FB - Adult", "FB - Child", "AI - Adult", "AI - Child", "AI Luxury - Adult", "AI Luxury - Child", "Cristal AI - Adult", "Cristal AI - Child"],
    TRANSFER: ["Seaplane - Adult", "Seaplane - Child", "Seaplane OW - Adult", "Seaplane OW - Child", "Domestic - Adult", "Domestic - Child", "Domestic OW - Adult", "Domestic OW - Child", "Speedboat - Adult", "Speedboat - Child", "Speedboat OW - Adult", "Speedboat OW - Child"],
    DINNER: ["Christmas Gala Dinner - Adult", "Christmas Gala Dinner - Child", "New Year Gala Dinner - Adult", "New Year Gala Dinner - Child"],
    EXTRA: ["Extra Adult", "Extra Child", "Fuel Surcharge"],
    GREEN_TAX: ["Green Tax"],
  };
  const COLORS = {
    light: {
      ROOM: { bg: "#eaf3ff", fg: "#1f65b8", border: "#b9d7fb" },
      MEAL: { bg: "#ecfdf3", fg: "#148043", border: "#b7ebc7" },
      TRANSFER: { bg: "#f2edff", fg: "#6440b5", border: "#d6c7ff" },
      EXTRA: { bg: "#fff7ed", fg: "#b45309", border: "#fed7aa" },
      GREEN_TAX: { bg: "#fefce8", fg: "#997000", border: "#fde68a" },
      DINNER: { bg: "#fff1f2", fg: "#be123c", border: "#fecdd3" },
    },
    dark: {
      ROOM: { bg: "#112d4f", fg: "#8dc2ff", border: "#2d5f98" },
      MEAL: { bg: "#123324", fg: "#7ce6a2", border: "#2f7d54" },
      TRANSFER: { bg: "#241d46", fg: "#b7a5ff", border: "#5b4ca3" },
      EXTRA: { bg: "#352514", fg: "#f5bb72", border: "#8a5a21" },
      GREEN_TAX: { bg: "#312b12", fg: "#f7d85c", border: "#87702a" },
      DINNER: { bg: "#361924", fg: "#ff9daf", border: "#8f4054" },
    },
  };
  const DEFAULT_APPEARANCE = {
    theme: "light",
    colors: {
      navy: "#082758",
      blue: "#2563eb",
      green: "#24a148",
    },
  };
  const GLOBAL_DATE_IDS = new Set(["checkin", "checkout"]);
  const DATE_RANGE_TYPES = new Set(["ROOM", "EXTRA", "MEAL", "GREEN_TAX"]);
  const UNDO_LIMIT = 80;
  const TABLE_HEADER_HEIGHT = 42;
  const TABLE_ROW_HEIGHT = 48;
  const TABLE_BOTTOM_SPACE = 20;

  const $ = (id) => document.getElementById(id);
  const rowsEl = $("rows");
  let picker = null;
  let pickerInput = null;
  let pickerMonth = null;
  let itemPicker = null;
  let itemPickerInput = null;
  let itemPickerRow = null;
  let addServiceMenuOpen = false;
  let draftTimer = null;
  let undoTimer = null;
  let suppressDraft = false;
  let undoReady = false;
  let restoringUndoState = false;
  let lastUndoSignature = "";
  let savedPayloadSignature = "";
  let samoImportData = null;
  let activeStepperStop = null;
  const autoRates = new WeakMap();
  const pendingRates = new Set();
  let rateMemoryTimer = null;
  const undoStack = [];
  const redoStack = [];
  const MONTHS = Array.from({ length: 12 }, (_, index) => new Date(2026, index, 1).toLocaleString("en-US", { month: "long" }));

  function el(tag, options = {}) {
    const node = document.createElement(tag);
    Object.entries(options).forEach(([key, value]) => {
      if (key === "className") node.className = value;
      else if (key === "textContent") node.textContent = value;
      else if (value !== undefined && value !== null) node.setAttribute(key, value);
    });
    return node;
  }

  function stepIcon(kind) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "step-symbol");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");

    const horizontal = document.createElementNS("http://www.w3.org/2000/svg", "path");
    horizontal.setAttribute("d", "M6 12h12");
    svg.appendChild(horizontal);

    if (kind === "plus") {
      const vertical = document.createElementNS("http://www.w3.org/2000/svg", "path");
      vertical.setAttribute("d", "M12 6v12");
      svg.appendChild(vertical);
    }

    return svg;
  }

  function value(id) {
    return $(id).value;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function cleanDateInput(input) {
    const digits = input.value.replace(/\D/g, "").slice(0, 8);
    const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
    input.value = parts.join(".");
  }

  function normalizeDateInput(input) {
    if (!input.value) return;
    input.value = core.formatDate(input.value);
  }

  function todayStart() {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), today.getDate());
  }

  function renderEboCheck() {
    const output = $("eboResult");
    if (!output) return;
    output.classList.remove("is-future", "is-past");

    const checkin = core.parseDate(value("checkin"));
    const days = Number(value("eboDays") || 0);
    if (!checkin || !Number.isFinite(days) || days <= 0) {
      output.textContent = "Deadline --";
      return;
    }

    const bookBy = new Date(checkin);
    bookBy.setDate(bookBy.getDate() - Math.round(days));
    output.textContent = `Deadline ${core.formatDate(bookBy)}`;
    output.classList.add(bookBy >= todayStart() ? "is-future" : "is-past");
  }

  function prepareItemReselect(input, tr) {
    const data = rowData(tr);
    if (!data.type || core.isGreenTax(data) || !input.value) return;
    input.dataset.previousValue = input.value;
    input.value = "";
  }

  function restoreItemIfEmpty(input) {
    if (!input.value && input.dataset.previousValue) input.value = input.dataset.previousValue;
    delete input.dataset.previousValue;
  }

  function itemOptions(tr) {
    const type = tr.querySelector(".type")?.value || "";
    if (!type) return [];
    if (type === "ROOM") return recordRooms(selectedHotelRecord());
    if (type === "MEAL") {
      const meals = recordMeals(selectedHotelRecord());
      return meals.length ? meals : LISTS.MEAL;
    }
    return LISTS[type] || [];
  }

  function pickerIcon(name) {
    const icons = {
      seaplane: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 14.5h12.5L21 10l-1.4-1.6-6.2 2.2-4-3.1H7l2.5 4H4.5L3.3 10H2l1 4.5Zm3.5 3.5h11"/></svg>',
      domestic: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 15.5 20 8l-1.4-1.7-7 1.8-4.1-2.9-2 .8 2.4 3.8-4.7 1.3L2 10l-1 .5 3 5Zm2.5 3h11"/></svg>',
      speedboat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 14h12.5l3-3.5H9.3L7.5 8H5l1.4 2.5H2.5L3 14Zm1 4c1.2.9 2.8.9 4 0 1.2.9 2.8.9 4 0 1.2.9 2.8.9 4 0 1.2.9 2.8.9 4 0"/></svg>',
      meal: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v8M4.5 3v8M9.5 3v8M4.5 11h5L8 21H6l-1.5-10Zm9-8v18M14 3c4 2.8 4 7.2 0 10"/></svg>',
      dinner: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h10v14H7zM7 9h10M10 3v4M14 3v4M10 13h4"/></svg>',
      extra: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    };
    const span = el("span", { className: "item-picker-icon" });
    span.innerHTML = icons[name] || icons.extra;
    return span;
  }

  function pickerChoice(label, value, type) {
    const button = el("button", { className: "item-picker-choice item-picker-chip", type: "button", textContent: label });
    button.dataset.value = value;
    button.title = value;
    button.classList.toggle("selected", itemPickerInput?.value === value);
    if (type) button.dataset.type = type;
    return button;
  }

  function pickerSection({ title, subtitle = "", icon = "extra", type = "", choices = [] }) {
    const section = el("section", { className: "item-picker-section" });
    if (type) section.dataset.type = type;
    if (title) {
      const head = el("div", { className: "item-picker-section-head" });
      head.appendChild(pickerIcon(icon));
      const text = el("div", { className: "item-picker-section-title" });
      text.appendChild(el("strong", { textContent: title }));
      if (subtitle) text.appendChild(el("span", { textContent: subtitle }));
      head.appendChild(text);
      section.appendChild(head);
    } else {
      section.classList.add("no-title");
    }
    const grid = el("div", { className: "item-picker-chip-grid" });
    choices.forEach((choice) => grid.appendChild(pickerChoice(choice.label, choice.value, type)));
    section.appendChild(grid);
    return section;
  }

  function pickerRowSection({ title, subtitle = "", icon = "extra", type = "", choices = [] }) {
    const section = pickerSection({ title, subtitle, icon, type, choices });
    section.classList.add("item-picker-row-section");
    return section;
  }

  function matchesItemQuery(choice, query) {
    return !query || choice.label.toLowerCase().includes(query) || choice.value.toLowerCase().includes(query);
  }

  function stripGuestSuffix(value) {
    return String(value || "").replace(/\s+-\s+(Adult|Child)$/i, "").trim();
  }

  function dinnerLabel(value) {
    return stripGuestSuffix(value).replace(/\s+Dinner$/i, "").trim();
  }

  function dinnerEventName(value) {
    const label = dinnerLabel(value);
    if (/christmas/i.test(label)) return "Christmas 24.12";
    if (/new year/i.test(label)) return "New Year 31.12";
    return label;
  }

  function mealPickerGroups() {
    const recordMealsList = recordMeals(selectedHotelRecord());
    if (!recordMealsList.length) return null;
    const groups = { adult: [], child: [] };
    recordMealsList.forEach((meal) => {
      if (/^BB\s+-\s+/i.test(meal)) return;
      const guest = /\s+-\s+Adult$/i.test(meal) ? "adult" : /\s+-\s+Child$/i.test(meal) ? "child" : "";
      if (!guest) return;
      groups[guest].push({ label: stripGuestSuffix(meal), value: meal });
    });
    return groups;
  }

  function renderStructuredItemPicker(type, query) {
    const sections = [];
    if (type === "TRANSFER") {
      [
        { title: "Seaplane", icon: "seaplane", type: "TRANSFER", values: [["Adult", "Seaplane - Adult"], ["Child", "Seaplane - Child"], ["OW ADL", "Seaplane OW - Adult"], ["OW CHD", "Seaplane OW - Child"]] },
        { title: "Domestic", icon: "domestic", type: "TRANSFER", values: [["Adult", "Domestic - Adult"], ["Child", "Domestic - Child"], ["OW ADL", "Domestic OW - Adult"], ["OW CHD", "Domestic OW - Child"]] },
        { title: "Speedboat", icon: "speedboat", type: "TRANSFER", values: [["Adult", "Speedboat - Adult"], ["Child", "Speedboat - Child"], ["OW ADL", "Speedboat OW - Adult"], ["OW CHD", "Speedboat OW - Child"]] },
      ].forEach((group) => {
        const choices = group.values.map(([label, value]) => ({ label, value })).filter((choice) => matchesItemQuery(choice, query));
        if (choices.length) sections.push(pickerRowSection({ title: group.title, icon: group.icon, type: group.type, choices }));
      });
    } else if (type === "MEAL") {
      const groups = mealPickerGroups();
      if (!groups) return false;
      const adult = groups.adult.filter((choice) => matchesItemQuery(choice, query));
      const child = groups.child.filter((choice) => matchesItemQuery(choice, query));
      if (adult.length) sections.push(pickerSection({ title: "Adult", icon: "meal", type: "MEAL", choices: adult }));
      if (child.length) sections.push(pickerSection({ title: "Child", icon: "meal", type: "MEAL", choices: child }));
    } else if (type === "DINNER") {
      const byEvent = new Map();
      LISTS.DINNER.forEach((value) => {
        const event = dinnerEventName(value);
        const label = /\s+-\s+Adult$/i.test(value) ? "ADL" : /\s+-\s+Child$/i.test(value) ? "CHD" : dinnerLabel(value);
        if (!byEvent.has(event)) byEvent.set(event, []);
        byEvent.get(event).push({ label, value });
      });
      byEvent.forEach((choices, title) => {
        const filtered = choices.filter((choice) => matchesItemQuery(choice, query) || title.toLowerCase().includes(query));
        if (filtered.length) sections.push(pickerRowSection({ title, icon: "dinner", type: "DINNER", choices: filtered }));
      });
    } else if (type === "EXTRA") {
      const choices = LISTS.EXTRA
        .map((value) => ({ label: value, value }))
        .filter((choice) => matchesItemQuery(choice, query));
      if (choices.length) sections.push(pickerRowSection({ type: "EXTRA", choices }));
    } else {
      return false;
    }
    if (!sections.length) return true;
    itemPicker.classList.add("structured");
    sections.forEach((section) => itemPicker.appendChild(section));
    return true;
  }

  function closeItemPicker({ restore = true, refocus = false } = {}) {
    if (itemPicker) itemPicker.remove();
    if (restore && itemPickerInput) restoreItemIfEmpty(itemPickerInput);
    if (itemPickerInput) itemPickerInput.dataset.pickerOpen = "0";
    const input = itemPickerInput;
    itemPicker = null;
    itemPickerInput = null;
    itemPickerRow = null;
    if (refocus && input) input.focus();
  }

  function positionItemPicker() {
    if (!itemPicker || !itemPickerInput) return;
    const rect = itemPickerInput.getBoundingClientRect();
    const structured = itemPicker.classList.contains("structured");
    const itemType = itemPicker.dataset.itemType;
    const structuredWidth = itemType === "TRANSFER" ? 560 : itemType === "DINNER" ? 420 : 520;
    const width = structured ? Math.max(rect.width, structuredWidth) : Math.max(rect.width, 260);
    const clampedWidth = Math.min(width, window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), window.innerWidth - clampedWidth - 12);
    const desiredMax = structured ? 420 : 320;
    const bottomSpace = window.innerHeight - rect.bottom - 14;
    const topSpace = rect.top - 14;

    itemPicker.style.left = `${left}px`;
    itemPicker.style.width = `${clampedWidth}px`;
    itemPicker.style.maxHeight = `${desiredMax}px`;

    const estimatedHeight = Math.min(itemPicker.scrollHeight || desiredMax, desiredMax);
    const openUp = bottomSpace < estimatedHeight && topSpace > bottomSpace;
    const availableHeight = openUp ? topSpace - 8 : bottomSpace;
    itemPicker.classList.toggle("drop-up", openUp);
    itemPicker.style.maxHeight = `${Math.max(150, Math.min(desiredMax, availableHeight))}px`;
    itemPicker.style.top = openUp
      ? `${Math.max(12, rect.top - Math.min(estimatedHeight, Math.max(150, availableHeight)) - 6)}px`
      : `${rect.bottom + 6}px`;
  }

  function renderItemPicker() {
    if (!itemPicker || !itemPickerInput || !itemPickerRow) return;
    const query = itemPickerInput.value.trim().toLowerCase();
    const type = itemPickerRow.querySelector(".type")?.value || "";
    const options = itemOptions(itemPickerRow).filter((option) => option.toLowerCase().includes(query));
    itemPicker.innerHTML = "";
    itemPicker.classList.remove("structured");
    itemPicker.dataset.itemType = type;
    if (renderStructuredItemPicker(type, query)) {
      if (!itemPicker.children.length) itemPicker.appendChild(el("div", { className: "item-picker-empty", textContent: "No matches. Manual entry is available." }));
      positionItemPicker();
      return;
    }
    if (!options.length) {
      itemPicker.appendChild(el("div", { className: "item-picker-empty", textContent: "No matches" }));
      return;
    }
    options.forEach((option) => {
      const button = el("button", { className: "item-picker-choice", type: "button", textContent: option });
      button.dataset.value = option;
      itemPicker.appendChild(button);
    });
  }

  function openItemPicker(input, tr, { clearCurrent = false } = {}) {
    closeItemPicker({ restore: false });
    itemPickerInput = input;
    itemPickerRow = tr;
    if (clearCurrent) prepareItemReselect(input, tr);
    itemPicker = el("div", { className: "item-picker open" });
    itemPicker.addEventListener("wheel", (event) => event.stopPropagation());
    document.body.appendChild(itemPicker);
    input.dataset.pickerOpen = "1";
    positionItemPicker();
    renderItemPicker();
  }

  function chooseItemPickerValue(value) {
    if (!itemPickerInput) return;
    itemPickerInput.value = value;
    delete itemPickerInput.dataset.previousValue;
    itemPickerInput.dispatchEvent(new Event("input", { bubbles: true }));
    closeItemPicker({ restore: false, refocus: true });
  }

  function isInsideFloatingPanel(target) {
    return target instanceof Element && (
      (picker && picker.contains(target))
      || (itemPicker && itemPicker.contains(target))
    );
  }

  function handleDateKeydown(input, event, onApply) {
    if (event.key === "Enter") {
      event.preventDefault();
      normalizeDateInput(input);
      onApply();
      closePicker();
      input.blur();
    } else if (event.key === "Escape") {
      closePicker();
    }
  }

  function numberPrecision(value) {
    const match = String(value || "1").match(/\.(\d+)/);
    return match ? match[1].length : 0;
  }

  function stepNumber(input, direction) {
    const step = Number(input.step || 1) || 1;
    const min = input.min === "" ? -Infinity : Number(input.min);
    const max = input.max === "" ? Infinity : Number(input.max);
    const current = input.value === "" ? 0 : Number(input.value);
    const precision = numberPrecision(input.step);
    const next = Math.min(max, Math.max(min, current + direction * step));

    input.value = precision ? next.toFixed(precision) : String(Math.round(next));
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function numberStepper(input, compact = false) {
    const wrap = el("span", { className: `number-stepper${compact ? " compact" : ""}` });
    const minus = el("button", { className: "step-button", type: "button", title: "Decrease" });
    const plus = el("button", { className: "step-button", type: "button", title: "Increase" });
    minus.appendChild(stepIcon("minus"));
    plus.appendChild(stepIcon("plus"));

    function bindHold(button, direction) {
      let holdTimer = null;
      let repeatTimer = null;
      let pointerActive = false;
      let suppressClick = false;

      function stopHold() {
        pointerActive = false;
        clearTimeout(holdTimer);
        clearInterval(repeatTimer);
        holdTimer = null;
        repeatTimer = null;
        if (activeStepperStop === stopHold) activeStepperStop = null;
      }

      button.addEventListener("pointerdown", (event) => {
        if (button.disabled) return;
        event.preventDefault();
        activeStepperStop?.();
        activeStepperStop = stopHold;
        pointerActive = true;
        suppressClick = true;
        button.setPointerCapture?.(event.pointerId);
        stepNumber(input, direction);
        holdTimer = setTimeout(() => {
          repeatTimer = setInterval(() => stepNumber(input, direction), 160);
        }, 500);
      });

      ["pointerup", "pointercancel", "pointerleave"].forEach((type) => {
        button.addEventListener(type, () => {
          if (pointerActive) stopHold();
        });
      });

      button.addEventListener("click", (event) => {
        if (suppressClick) {
          suppressClick = false;
          event.preventDefault();
          return;
        }
        stepNumber(input, direction);
      });
    }

    bindHold(minus, -1);
    bindHold(plus, 1);
    wrap.addEventListener("wheel", (event) => {
      if (input.disabled) return;
      event.preventDefault();
      event.stopPropagation();
      stepNumber(input, event.deltaY > 0 ? -1 : 1);
    }, { passive: false });
    wrap.append(minus, input, plus);
    return wrap;
  }

  function childAgeValues() {
    const raw = String(value("ages") || "");
    return (raw.includes("/") ? raw.split("/") : raw.split(/[,\s;]+/))
      .map((item) => item.trim())
      .map((item) => item ? String(Math.min(17, Math.max(0, Number(item) || 0))) : "");
  }

  function normalizeChildAgeInput(input) {
    if (!input.value.trim()) return;
    const next = Math.min(17, Math.max(0, Number(input.value) || 0));
    input.value = String(next);
  }

  function syncAgesFromFields() {
    const fields = [...document.querySelectorAll(".child-age-input")];
    $("ages").value = fields.map((input) => input.value.trim()).join("/");
  }

  function renderChildAgeFields({ restore = false } = {}) {
    const container = $("childAgeFields");
    if (!container) return;
    const count = Math.max(0, Number(value("children") || 0) || 0);
    const existing = [...container.querySelectorAll(".child-age-input")].map((input) => input.value.trim());
    const saved = !restore && existing.length ? existing : childAgeValues();
    container.innerHTML = "";

    if (!count) {
      container.appendChild(el("span", { className: "child-age-empty", textContent: "No children" }));
      $("ages").value = "";
      return;
    }

    for (let index = 0; index < count; index += 1) {
      const input = el("input", {
        className: "child-age-input",
        type: "number",
        min: "0",
        max: "17",
        step: "1",
        inputmode: "numeric",
        placeholder: `Age ${index + 1}`,
        "aria-label": `Child ${index + 1} age`,
      });
      input.value = saved[index] || "";
      input.addEventListener("input", () => {
        normalizeChildAgeInput(input);
        syncAgesFromFields();
        recalc();
      });
      container.appendChild(numberStepper(input, true));
    }
    syncAgesFromFields();
  }

  function toast(message) {
    const box = $("toast");
    box.textContent = message;
    box.style.display = "block";
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      box.style.display = "none";
    }, 2200);
  }

  function downloadBlob(filename, content, type) {
    const blob = new Blob([content], { type });
    const link = el("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function renderDatalist(id, items) {
    $(id).innerHTML = items.map((item) => `<option value="${escapeHtml(item)}">`).join("");
  }

  function clonePayload(payload) {
    return JSON.parse(JSON.stringify(payload));
  }

  function payloadSignature(payload) {
    return JSON.stringify({
      hotel: payload.hotel,
      checkin: payload.checkin,
      checkout: payload.checkout,
      guests: payload.guests,
      spo: payload.spo,
      eboDays: payload.eboDays || "",
      rows: payload.rows,
    });
  }

  function updateUndoButtons() {
    const undo = $("undoChange");
    const redo = $("redoChange");
    if (undo) undo.disabled = undoStack.length <= 1;
    if (redo) redo.disabled = redoStack.length === 0;
  }

  function setSaveButtonSaved(saved) {
    const button = $("saveCalculation");
    if (!button) return;
    const label = button.querySelector(".save-label");
    button.disabled = saved;
    button.classList.toggle("is-saved", saved);
    if (label) label.textContent = saved ? "Saved" : "Save";
  }

  function markCalculationSaved(payload) {
    savedPayloadSignature = payloadSignature(payload);
    setSaveButtonSaved(true);
  }

  function clearSaveStatus() {
    savedPayloadSignature = "";
    setSaveButtonSaved(false);
  }

  function updateSaveStatus() {
    if (!savedPayloadSignature) {
      setSaveButtonSaved(false);
      return;
    }
    const currentSignature = payloadSignature(sharePayload());
    setSaveButtonSaved(currentSignature === savedPayloadSignature);
  }

  function pushUndoSnapshot({ clearRedo = true } = {}) {
    if (!undoReady || restoringUndoState) return;
    const payload = clonePayload(sharePayload());
    const signature = payloadSignature(payload);
    if (signature === lastUndoSignature) {
      updateUndoButtons();
      return;
    }
    undoStack.push(payload);
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    lastUndoSignature = signature;
    if (clearRedo) redoStack.length = 0;
    updateUndoButtons();
  }

  function scheduleUndoSnapshot() {
    if (!undoReady || restoringUndoState) return;
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => pushUndoSnapshot(), 300);
  }

  function flushUndoSnapshot() {
    clearTimeout(undoTimer);
    undoTimer = null;
    pushUndoSnapshot();
  }

  function selectedHotelRecord() {
    const hotel = value("hotel").trim().toLowerCase();
    const name = HOTEL_NAMES.find((item) => item.toLowerCase() === hotel);
    return name ? HOTEL_DATA[name] : null;
  }

  function recordRooms(record) {
    if (Array.isArray(record)) return record;
    return Array.isArray(record?.rooms) ? record.rooms : [];
  }

  function recordMeals(record) {
    return Array.isArray(record?.meals) ? record.meals : [];
  }

  function updateRoomList() {
    const record = selectedHotelRecord();
    const rooms = recordRooms(record);
    renderDatalist("list_ROOM", rooms);
  }

  function serviceDefaults(type) {
    if (type === "ROOM") return { type, qty: 1 };
    if (type === "MEAL") return { type, qty: Number(value("adults") || 0) };
    if (type === "TRANSFER") return { type, qty: Number(value("adults") || 0) };
    if (type === "GREEN_TAX") return { type, item: "Green Tax", qty: 0, rate: 12 };
    return { type, qty: 0 };
  }

  function currentServiceTypes() {
    return new Set([...rowsEl.querySelectorAll("tr")]
      .map((tr) => tr.querySelector(".type")?.value)
      .filter(Boolean));
  }

  function closeAddServiceMenu() {
    const menu = $("addServiceMenu");
    const button = $("addRow");
    if (menu) {
      menu.classList.remove("open");
      menu.innerHTML = "";
    }
    if (button) button.setAttribute("aria-expanded", "false");
    addServiceMenuOpen = false;
  }

  function renderAddServiceMenu() {
    const menu = $("addServiceMenu");
    if (!menu) return;
    const used = currentServiceTypes();
    const available = ADD_TYPE_ORDER.filter((type) => !used.has(type));
    menu.innerHTML = "";

    if (!available.length) {
      menu.appendChild(el("div", { className: "add-service-empty", textContent: "All types already added" }));
      return;
    }

    available.forEach((type) => {
      const button = el("button", {
        className: "add-service-choice",
        type: "button",
        role: "menuitem",
        textContent: TYPE_LABELS[type] || type,
      });
      button.dataset.type = type;
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        flushUndoSnapshot();
        addRow(serviceDefaults(type));
        closeAddServiceMenu();
      });
      menu.appendChild(button);
    });
  }

  function toggleAddServiceMenu() {
    const menu = $("addServiceMenu");
    const button = $("addRow");
    if (!menu || !button) return;
    if (addServiceMenuOpen) {
      closeAddServiceMenu();
      return;
    }
    closeTypePickers();
    closeItemPicker();
    closePicker();
    renderAddServiceMenu();
    menu.classList.add("open");
    button.setAttribute("aria-expanded", "true");
    addServiceMenuOpen = true;
  }

  function updateMealList() {
    const record = selectedHotelRecord();
    const meals = recordMeals(record);
    renderDatalist("list_MEAL", meals.length ? meals : LISTS.MEAL);
  }

  function updateHotelScopedLists() {
    updateRoomList();
    updateMealList();
  }

  function buildLists() {
    renderDatalist("hotelList", LISTS.HOTEL);
    Object.keys(LISTS).filter((type) => type !== "HOTEL").forEach((type) => {
      const datalist = el("datalist", { id: `list_${type}` });
      datalist.innerHTML = "";
      document.body.appendChild(datalist);
      renderDatalist(`list_${type}`, LISTS[type]);
    });
    updateHotelScopedLists();
  }

  function createTypeSelect(selected = "") {
    const wrap = el("div", { className: "type-picker-wrap type-static-wrap" });
    const select = el("select", { className: "type type-native", tabindex: "-1", "aria-hidden": "true" });
    const placeholder = el("option", { value: "", textContent: "" });
    placeholder.selected = !selected;
    placeholder.disabled = true;
    placeholder.hidden = true;
    select.appendChild(placeholder);

    const label = el("span", {
      className: "type-picker-button type-static-label",
      textContent: selected ? TYPE_LABELS[selected] || selected : "",
    });

    ROW_TYPE_ORDER.forEach((type) => {
      const option = el("option", { value: type, textContent: TYPE_LABELS[type] || type });
      option.selected = type === selected;
      select.appendChild(option);
    });

    wrap.append(select, label);
    return wrap;
  }

  function positionTypePicker(wrap) {
    const button = wrap.querySelector(".type-picker-button");
    const menu = wrap.typePickerMenu;
    if (!button || !menu) return;
    const rect = button.getBoundingClientRect();
    const width = Math.max(rect.width, 136);
    const menuHeight = Math.min(menu.scrollHeight || 212, 240);
    const below = window.innerHeight - rect.bottom - 8;
    const top = below >= menuHeight || rect.top < menuHeight + 8
      ? rect.bottom + 5
      : rect.top - menuHeight - 5;
    menu.style.left = `${Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)}px`;
    menu.style.top = `${Math.max(8, top)}px`;
    menu.style.width = `${width}px`;
    menu.style.maxHeight = `${menuHeight}px`;
  }

  function openTypePicker(wrap) {
    const menu = wrap.typePickerMenu;
    const button = wrap.querySelector(".type-picker-button");
    if (!menu || !button) return;
    document.body.appendChild(menu);
    wrap.classList.add("open");
    menu.classList.add("open");
    button.setAttribute("aria-expanded", "true");
    positionTypePicker(wrap);
  }

  function closeTypePickers() {
    document.querySelectorAll(".type-picker-wrap.open").forEach((wrap) => {
      wrap.classList.remove("open");
      wrap.querySelector(".type-picker-button")?.setAttribute("aria-expanded", "false");
    });
    document.querySelectorAll(".type-picker-menu.open").forEach((menu) => {
      menu.classList.remove("open");
    });
  }

  function positionOpenTypePickers() {
    document.querySelectorAll(".type-picker-wrap.open").forEach(positionTypePicker);
  }

  function addDiscount(container, value = 0, removable = true) {
    const wrap = el("span", { className: "discount-item" });
    const input = el("input", { className: "discount", type: "number", min: "0", max: "100", step: "1", placeholder: "%" });
    input.value = value || "";
    wrap.appendChild(numberStepper(input, true));

    if (removable) {
      const remove = el("button", { className: "discount-remove", type: "button", title: "Remove discount", textContent: "-" });
      remove.addEventListener("click", () => {
        activeStepperStop?.();
        wrap.remove();
        recalc();
        scheduleRowRate(container.closest("tr"));
      });
      wrap.appendChild(remove);
    }

    container.appendChild(wrap);
  }

  function setupDiscounts(container, data = {}) {
    const values = Array.isArray(data.discounts) && data.discounts.length
      ? data.discounts
      : [data.d1 ?? data.discount ?? 0, data.d2 ?? 0, data.d3 ?? 0, data.d4 ?? 0];
    const lastFilled = values.reduce((last, item, index) => (Number(item) > 0 ? index : last), 0);

    for (let index = 0; index <= lastFilled; index += 1) addDiscount(container, values[index], index > 0);

    const add = el("button", { className: "discount-add", type: "button", title: "Add another discount", textContent: "+" });
    add.addEventListener("click", () => {
      if (container.querySelectorAll(".discount").length < 4) {
        addDiscount(container, 0, true);
        recalc();
      }
    });
    container.appendChild(add);
  }

  function syncDiscountColumnWidth() {
    const maxDiscounts = Math.max(1, ...[...rowsEl.querySelectorAll(".discounts")].map((cell) => Math.max(1, cell.querySelectorAll(".discount-item").length)));
    document.documentElement.style.setProperty("--discount-column-width", `${152 + (maxDiscounts - 1) * 140}px`);
  }

  function syncTableMinHeight() {
    const rowCount = Math.max(1, rowsEl.querySelectorAll("tr").length);
    const height = TABLE_HEADER_HEIGHT + rowCount * TABLE_ROW_HEIGHT + TABLE_BOTTOM_SPACE;
    document.documentElement.style.setProperty("--table-wrap-min-height", `${height}px`);
  }

  function rowData(tr) {
    const type = tr.querySelector(".type").value;
    const data = {
      type,
      item: tr.querySelector(".item").value.trim(),
      from: tr.querySelector(".from").value,
      to: tr.querySelector(".to").value,
      qty: Number(tr.querySelector(".qty").value || 0),
      rateFormula: tr.querySelector(".rate").value.trim(),
      discounts: [...tr.querySelectorAll(".discount")].map((input) => Number(input.value || 0)).filter((item) => item !== 0),
      followGlobal: tr.dataset.followGlobal === "1",
    };
    if (type === "ROOM") {
      data.roomKey = tr.dataset.roomKey;
      data.roomAdults = Number(tr.querySelector(".room-adults")?.value || 0);
      data.roomChildren = Number(tr.querySelector(".room-children")?.value || 0);
    } else if (isPersonExtra(data)) {
      data.assignedRoomKey = tr.querySelector(".assigned-room")?.value || "";
    }
    return data;
  }

  function canUseRateMemory(data) {
    return data.type && data.item && !core.isGreenTax(data);
  }

  function rateMemoryQuery(tr) {
    const data = rowData(tr);
    if (!canUseRateMemory(data)) return null;
    return {
      hotel: value("hotel"),
      type: data.type,
      item: data.item,
      from: data.from,
      to: data.to,
      spo: value("spo"),
    };
  }

  function rememberRowRate(tr) {
    const query = rateMemoryQuery(tr);
    if (!query || !query.hotel) return;
    const data = rowData(tr);
    const calculated = core.calculateRow(data);
    if (!calculated.valid || !data.rateFormula || Number(calculated.rate || 0) <= 0) return;
    storage.saveRateMemory({
      ...query,
      rate: calculated.rate,
      rateFormula: data.rateFormula,
      discounts: value("spo").trim() && core.isDiscountable(data) ? data.discounts : [],
    });
  }

  function scheduleRowRate(tr) {
    pendingRates.add(tr);
    clearTimeout(rateMemoryTimer);
    rateMemoryTimer = setTimeout(() => {
      pendingRates.forEach((row) => {
        if (rowsEl.contains(row)) rememberRowRate(row);
      });
      pendingRates.clear();
    }, 300);
  }

  function setDiscountValues(tr, discounts) {
    const values = Array.isArray(discounts) ? discounts.filter((item) => Number(item) > 0) : [];
    const container = tr.querySelector(".discounts");
    if (!container) return;
    container.innerHTML = "";
    setupDiscounts(container, { discounts: values });
  }

  function applyRememberedRate(tr, { force = false, replaceExisting = false } = {}) {
    const rate = tr.querySelector(".rate");
    if (!rate) return false;
    const query = rateMemoryQuery(tr);
    const key = JSON.stringify(query);
    const previous = autoRates.get(tr);
    if (previous && previous.key !== key) {
      if (rate.value === previous.value) {
        rate.value = "";
        rate.removeAttribute("title");
        if (JSON.stringify(rowData(tr).discounts) === previous.discounts) setDiscountValues(tr, []);
      }
      autoRates.delete(tr);
    }
    if (!force && !storage.rateAutofillEnabled()) return false;
    if (!query || !query.hotel) return false;
    const remembered = storage.findRateMemory(query);
    if (!remembered) return false;
    if (rate.value.trim() && !replaceExisting) return false;
    rate.value = remembered.rateFormula;
    rate.title = "Filled from local rate memory";
    if (query.spo && Array.isArray(remembered.discounts)) setDiscountValues(tr, remembered.discounts);
    autoRates.set(tr, { key, value: rate.value, discounts: JSON.stringify(rowData(tr).discounts) });
    return true;
  }

  function applyRememberedRates({ force = false, replaceExisting = false } = {}) {
    let filled = 0;
    rowsEl.querySelectorAll("tr").forEach((tr) => {
      if (applyRememberedRate(tr, { force, replaceExisting })) filled += 1;
    });
    return filled;
  }

  function isDateRangeType(type) {
    return DATE_RANGE_TYPES.has(type);
  }

  function isOneWayTransfer(row) {
    return row.type === "TRANSFER" && /\bOW\b/i.test(row.item || "");
  }

  function dinnerDate(row) {
    const year = core.parseDate(value("checkin"))?.getFullYear() || new Date().getFullYear();
    if (/new year/i.test(row.item || "")) return `31.12.${year}`;
    if (/christmas|xmas/i.test(row.item || "")) return `24.12.${year}`;
    return "";
  }

  function clampDateValue(dateValue, minValue, maxValue) {
    const date = core.parseDate(dateValue);
    if (!date) return "";
    const min = core.parseDate(minValue);
    const max = core.parseDate(maxValue);
    if (min && date < min) return core.formatDate(min);
    if (max && date > max) return core.formatDate(max);
    return core.formatDate(date);
  }

  function clampRowDates(tr) {
    const data = rowData(tr);
    if (!data.type) return;

    const from = tr.querySelector(".from");
    const to = tr.querySelector(".to");
    const checkin = value("checkin");
    const checkout = value("checkout");

    if (data.type === "DINNER") {
      const fixedDate = dinnerDate(data);
      from.value = fixedDate;
      to.value = "";
      return;
    }

    if (data.type === "TRANSFER" && !isOneWayTransfer(data)) {
      from.value = "";
      to.value = "";
      return;
    }

    if (!isDateRangeType(data.type) && !isOneWayTransfer(data)) return;

    from.value = clampDateValue(from.value, checkin, checkout);
    to.value = clampDateValue(to.value, from.value || checkin, checkout);
  }

  function currentRows() {
    return [...rowsEl.querySelectorAll("tr")].map(rowData).filter((row) => row.type);
  }

  function rowTypeRank(tr) {
    const type = tr.querySelector(".type").value;
    if (type === "EXTRA" && /^fuel surcharge$/i.test(tr.querySelector(".item")?.value || "")) {
      return ROW_TYPE_ORDER.indexOf("TRANSFER") + 0.5;
    }
    const rank = ROW_TYPE_ORDER.indexOf(type);
    return rank === -1 ? ROW_TYPE_ORDER.length : rank;
  }

  function groupRowsByType() {
    [...rowsEl.querySelectorAll("tr")]
      .map((tr, index) => ({ tr, index, rank: rowTypeRank(tr) }))
      .sort((left, right) => left.rank - right.rank || left.index - right.index)
      .forEach(({ tr }) => rowsEl.appendChild(tr));
  }

  function isPersonExtra(row) {
    return row.type === "EXTRA" && /(adult|child)/i.test(row.item || "");
  }

  function refreshRoomAllocationControls() {
    const roomGroups = [];
    const seen = new Set();

    rowsEl.querySelectorAll("tr").forEach((tr) => {
      const type = tr.querySelector(".type")?.value;
      const item = tr.querySelector(".item")?.value.trim();
      const roomControls = tr.querySelector(".room-allocation");
      const extraControls = tr.querySelector(".extra-assignment");
      if (roomControls) roomControls.hidden = type !== "ROOM";
      if (extraControls) extraControls.hidden = !(type === "EXTRA" && /(adult|child)/i.test(item || ""));
      if (type !== "ROOM" || seen.has(tr.dataset.roomKey)) return;
      seen.add(tr.dataset.roomKey);
      roomGroups.push({ key: tr.dataset.roomKey, item: item || "Room" });
    });

    rowsEl.querySelectorAll(".assigned-room").forEach((select) => {
      const selected = select.dataset.assignedRoomKey || select.value || "";
      select.innerHTML = "";
      select.appendChild(el("option", { value: "", textContent: "Split automatically" }));
      roomGroups.forEach((room, index) => {
        select.appendChild(el("option", {
          value: room.key,
          textContent: `Room ${index + 1} · ${room.item}`,
        }));
      });
      select.value = roomGroups.some((room) => room.key === selected) ? selected : "";
      select.dataset.assignedRoomKey = select.value;
      select.title = select.options[select.selectedIndex]?.textContent || "Split automatically";
    });
  }

  function syncRoomGuests(source, selector) {
    const roomKey = source.closest("tr")?.dataset.roomKey;
    if (!roomKey) return;
    rowsEl.querySelectorAll("tr").forEach((tr) => {
      if (tr.dataset.roomKey === roomKey && tr.querySelector(".type")?.value === "ROOM") {
        tr.querySelector(selector).value = source.value;
      }
    });
  }

  function syncSingleRoomGuestsFromHeader() {
    const roomRows = [...rowsEl.querySelectorAll("tr")]
      .filter((tr) => tr.querySelector(".type")?.value === "ROOM");
    const roomKeys = [...new Set(roomRows.map((tr) => tr.dataset.roomKey))];
    if (roomKeys.length !== 1) return;
    roomRows.forEach((tr) => {
      tr.querySelector(".room-adults").value = value("adults") || 0;
      tr.querySelector(".room-children").value = value("children") || 0;
    });
  }

  function isGlobalDateRow(tr) {
    const data = rowData(tr);
    return data.type === "ROOM" || data.type === "MEAL" || core.isGreenTax(data) || isPersonExtra(data);
  }

  function isColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || ""));
  }

  function normalizeAppearance(settings = {}) {
    const colors = settings.colors || {};
    return {
      theme: settings.theme === "dark" ? "dark" : "light",
      colors: {
        navy: isColor(colors.navy) ? colors.navy : DEFAULT_APPEARANCE.colors.navy,
        blue: isColor(colors.blue) ? colors.blue : DEFAULT_APPEARANCE.colors.blue,
        green: isColor(colors.green) ? colors.green : DEFAULT_APPEARANCE.colors.green,
      },
    };
  }

  function currentAppearance() {
    return normalizeAppearance(storage?.appearanceSettings ? storage.appearanceSettings() : DEFAULT_APPEARANCE);
  }

  function applyAppearance(settings = currentAppearance()) {
    const next = normalizeAppearance(settings);
    document.documentElement.dataset.theme = next.theme;
    Object.entries(next.colors).forEach(([name, color]) => {
      document.documentElement.style.setProperty(`--${name}`, color);
    });
    rowsEl.querySelectorAll("tr").forEach(updateTypeColor);
    return next;
  }

  function updateAppearanceControls(settings = currentAppearance()) {
    const next = normalizeAppearance(settings);
    const theme = $("appearanceTheme");
    const navy = $("appearanceNavy");
    const blue = $("appearanceBlue");
    const green = $("appearanceGreen");
    if (theme) theme.value = next.theme;
    if (navy) navy.value = next.colors.navy;
    if (blue) blue.value = next.colors.blue;
    if (green) green.value = next.colors.green;
  }

  function saveAppearanceFromControls() {
    const next = normalizeAppearance({
      theme: $("appearanceTheme")?.value,
      colors: {
        navy: $("appearanceNavy")?.value,
        blue: $("appearanceBlue")?.value,
        green: $("appearanceGreen")?.value,
      },
    });
    const saved = storage?.saveAppearanceSettings ? storage.saveAppearanceSettings(next) : next;
    applyAppearance(saved);
    updateAppearanceControls(saved);
  }

  function showSettingsModal() {
    updateAppearanceControls();
    $("settingsModal").showModal();
  }

  function resetAppearance() {
    const settings = storage?.resetAppearanceSettings ? storage.resetAppearanceSettings() : DEFAULT_APPEARANCE;
    applyAppearance(settings);
    updateAppearanceControls(settings);
    toast("Appearance reset");
  }

  function applyAutoQty(tr) {
    const data = rowData(tr);
    const item = data.item.toLowerCase();
    const qty = tr.querySelector(".qty");
    const rate = tr.querySelector(".rate");

    if (["ROOM", "EXTRA"].includes(data.type) && Number(qty.value || 0) <= 0) {
      qty.value = 1;
    }

    if (["MEAL", "TRANSFER", "DINNER"].includes(data.type)) {
      if (data.type === "MEAL" && !item) qty.value = value("adults") || 0;
      else if (data.type === "TRANSFER" && !item) qty.value = value("adults") || 0;
      else if (item.includes("adult")) qty.value = value("adults") || 0;
      else if (item.includes("child")) qty.value = value("children") || 0;
      else if (item.includes("infant")) qty.value = value("infants") || 0;
    }

    if (core.isGreenTax(data)) {
      if (!tr.querySelector(".item").value) tr.querySelector(".item").value = "Green Tax";
      qty.value = Number(value("adults") || 0) + Number(value("children") || 0);
      if (!rate.value) rate.value = 12;
    }

    if (data.type === "DINNER") {
      const fixedDate = dinnerDate(data);
      tr.querySelector(".from").value = fixedDate;
      tr.querySelector(".to").value = "";
    }
  }

  function applyGlobalDates(tr) {
    if (tr.dataset.followGlobal !== "1" || !isGlobalDateRow(tr)) return;
    tr.querySelector(".from").value = value("checkin");
    tr.querySelector(".to").value = value("checkout");
  }

  function syncGlobalRows() {
    rowsEl.querySelectorAll("tr").forEach((tr) => {
      if (tr.dataset.followGlobal === undefined) tr.dataset.followGlobal = isGlobalDateRow(tr) ? "1" : "0";
      applyGlobalDates(tr);
    });
  }

  function updateTypeColor(tr) {
    const select = tr.querySelector(".type");
    const button = tr.querySelector(".type-picker-button");
    const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const color = COLORS[theme][select.value];
    const target = button || select;
    const addSame = tr.querySelector(".add-same-service");
    target.textContent = select.value ? TYPE_LABELS[select.value] || select.value : "";
    target.style.background = color ? color.bg : "";
    target.style.color = color ? color.fg : "";
    target.style.borderColor = color ? color.border : "";
    tr.querySelectorAll(".type-picker-choice").forEach((choice) => {
      choice.classList.toggle("selected", choice.dataset.value === select.value);
    });
  }

  function updateRowState(tr) {
    const data = rowData(tr);
    const item = tr.querySelector(".item");
    const from = tr.querySelector(".from");
    const to = tr.querySelector(".to");
    const nights = tr.querySelector(".nights");
    const qty = tr.querySelector(".qty");
    const rate = tr.querySelector(".rate");
    const discountControls = tr.querySelectorAll(".discount, .discount-add, .discount-remove");
    const hasType = Boolean(data.type);
    const hideItem = core.isGreenTax(data);
    const hideNights = data.type === "TRANSFER" || data.type === "DINNER";
    const hideTransferDates = data.type === "TRANSFER" && !isOneWayTransfer(data);
    const lockDates = data.type === "DINNER" || hideTransferDates;
    const allowDiscounts = hasType && core.isDiscountable(data);
    const isDinner = data.type === "DINNER";

    tr.querySelector(".room-allocation").hidden = data.type !== "ROOM";
    tr.querySelector(".extra-assignment").hidden = !isPersonExtra(data);

    tr.classList.toggle("inactive-row", !hasType);
    tr.querySelectorAll("td").forEach((cell) => cell.classList.remove("muted-cell"));

    item.disabled = !hasType || hideItem;
    from.disabled = !hasType || lockDates;
    to.disabled = !hasType || lockDates;
    from.hidden = hideTransferDates;
    to.hidden = isDinner || hideTransferDates;
    nights.disabled = !hasType || hideNights;
    qty.disabled = !hasType;
    rate.disabled = !hasType;
    if (!rate.value.trim()) rate.removeAttribute("title");
    discountControls.forEach((control) => {
      control.disabled = !allowDiscounts;
    });
    const addSame = tr.querySelector(".add-same-service");
    if (addSame) {
      addSame.disabled = !hasType;
      addSame.title = hasType ? `Add another ${TYPE_LABELS[data.type] || data.type}` : "Choose type first";
      addSame.setAttribute("aria-label", addSame.title);
    }

    item.closest("td").classList.toggle("muted-cell", hideItem);
    nights.closest("td").classList.toggle("muted-cell", hideNights);
    tr.querySelector(".discounts").classList.toggle("muted-cell", !allowDiscounts);
    from.closest("td").classList.toggle("muted-cell", hideTransferDates);
    to.closest("td").classList.toggle("muted-cell", isDinner || hideTransferDates);
  }

  function recalc() {
    syncGlobalRows();
    rowsEl.querySelectorAll("tr").forEach(clampRowDates);
    syncDiscountColumnWidth();
    syncTableMinHeight();
    $("nights").value = core.nightsBetween(value("checkin"), value("checkout"));

    const calculated = core.calculateRows(currentRows());
    let rowIndex = 0;
    rowsEl.querySelectorAll("tr").forEach((tr) => {
      const data = rowData(tr);
      if (!data.type) {
        tr.querySelector(".nights").value = "0";
        tr.querySelector(".net").textContent = "0.00";
        updateTypeColor(tr);
        updateRowState(tr);
        return;
      }
      const row = calculated.rows[rowIndex++];
      tr.querySelector(".nights").value = row.nights;
      tr.querySelector(".net").textContent = row.valid ? core.money(row.net) : "--";
      updateTypeColor(tr);
      updateRowState(tr);
    });

    const valid = calculated.total !== null && [...document.querySelectorAll('input[type="number"]')].every((input) => input.disabled || input.validity.valid);
    document.querySelectorAll('input[type="number"]').forEach((input) => input.setAttribute("aria-invalid", String(!input.disabled && !input.validity.valid)));
    $("grandTotal").textContent = valid ? `$${core.money(calculated.total)}` : "Check inputs";
    if (valid) renderStaySummary(calculated.rows);
    else $("staySummary").innerHTML = "";
    renderEboCheck();
    updateSaveStatus();
    scheduleDraftSave();
    scheduleUndoSnapshot();
    return valid;
  }

  function renderStaySummary(calculatedRows) {
    const container = $("staySummary");
    const summaries = core.buildStaySummaries(calculatedRows, { calculated: true }).filter((row) => row.total > 0);

    if (!summaries.length) {
      container.innerHTML = "";
      return;
    }

    const rows = summaries.map((row) => `
      <tr>
        <td>${escapeHtml(row.dates)}</td>
        <td>${escapeHtml(row.room)}</td>
        <td>${row.roomAdults} ADL${row.roomChildren ? ` + ${row.roomChildren} CHD` : ""}</td>
        <td>${core.money(row.roomNet)}</td>
        <td>${core.money(row.mealNet)}</td>
        <td>${core.money(row.extraNet)}</td>
        <td>${core.money(row.total)}</td>
      </tr>
    `).join("");

    container.innerHTML = `
      <div class="summary-title">ROOM + MEAL CHECK</div>
      <div class="summary-table-wrap">
        <table class="summary-table">
          <thead>
            <tr>
              <th>DATES</th>
              <th>ROOM</th>
              <th>GUESTS</th>
              <th>ROOM NET</th>
              <th>MEAL NET</th>
              <th>EXTRA</th>
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  function addRow(data = {}, options = {}) {
    const tr = el("tr");
    tr.dataset.followGlobal = data.followGlobal === true ? "1" : "0";
    tr.dataset.roomKey = data.roomKey || storage.createId();
    const hasExistingRoom = [...rowsEl.querySelectorAll("tr")]
      .some((row) => row.querySelector(".type")?.value === "ROOM");

    const typeCell = el("td", { className: "type-cell" });
    typeCell.appendChild(createTypeSelect(data.type || ""));
    const addSame = el("button", { className: "add-same-service", type: "button", title: "Add similar service", "aria-label": "Add similar service", textContent: "+" });
    typeCell.appendChild(addSame);

    const itemCell = el("td", { className: "item-cell" });
    const itemLayout = el("div", { className: "item-layout" });
    const item = el("input", { className: "item", placeholder: "Choose or type manually", autocomplete: "off" });
    item.value = data.item || "";
    itemLayout.appendChild(item);

    const roomAllocation = el("div", { className: "row-allocation room-allocation" });
    roomAllocation.appendChild(el("span", { className: "allocation-title", textContent: "Guests" }));
    const roomAdultsLabel = el("label", { className: "allocation-field" });
    roomAdultsLabel.appendChild(el("span", { textContent: "ADL" }));
    const roomAdults = el("input", { className: "room-adults", type: "number", min: "0", step: "1", "aria-label": "Adults in this room" });
    roomAdults.value = data.roomAdults ?? (data.type === "ROOM" && !hasExistingRoom ? value("adults") || 0 : 0);
    roomAdultsLabel.appendChild(numberStepper(roomAdults, true));
    const roomChildrenLabel = el("label", { className: "allocation-field" });
    roomChildrenLabel.appendChild(el("span", { textContent: "CHD" }));
    const roomChildren = el("input", { className: "room-children", type: "number", min: "0", step: "1", "aria-label": "Children in this room" });
    roomChildren.value = data.roomChildren ?? (data.type === "ROOM" && !hasExistingRoom ? value("children") || 0 : 0);
    roomChildrenLabel.appendChild(numberStepper(roomChildren, true));
    roomAllocation.append(roomAdultsLabel, roomChildrenLabel);
    itemLayout.appendChild(roomAllocation);

    const extraAssignment = el("label", { className: "row-allocation extra-assignment" });
    extraAssignment.appendChild(el("span", { className: "allocation-title", textContent: "Assign to" }));
    const assignedRoom = el("select", { className: "assigned-room", "aria-label": "Assign extra charge to room" });
    assignedRoom.dataset.assignedRoomKey = data.assignedRoomKey || "";
    extraAssignment.appendChild(assignedRoom);
    itemLayout.appendChild(extraAssignment);
    itemCell.appendChild(itemLayout);

    const fromCell = el("td");
    const from = el("input", { className: "from", inputmode: "numeric", placeholder: "dd.mm.yyyy", autocomplete: "off" });
    from.value = core.formatDate(data.from || "");
    fromCell.appendChild(from);

    const toCell = el("td");
    const to = el("input", { className: "to", inputmode: "numeric", placeholder: "dd.mm.yyyy", autocomplete: "off" });
    to.value = core.formatDate(data.to || "");
    toCell.appendChild(to);

    const nightsCell = el("td");
    const nights = el("input", { className: "nights", type: "number", min: "0", step: "1", readonly: "", value: "0" });
    nightsCell.appendChild(numberStepper(nights));

    const qtyCell = el("td");
    const qty = el("input", { className: "qty", type: "number", min: "0", step: "1" });
    qty.value = data.qty ?? "";
    qtyCell.appendChild(numberStepper(qty));

    const rateCell = el("td");
    const rate = el("input", { className: "rate", type: "text", inputmode: "decimal", autocomplete: "off" });
    rate.value = data.rateFormula || (Number(data.rate || 0) > 0 ? data.rate : "");
    rateCell.appendChild(rate);

    const discountsCell = el("td", { className: "discounts" });
    setupDiscounts(discountsCell, data);

    const netCell = el("td", { className: "net", textContent: "0.00" });
    const deleteCell = el("td");
    deleteCell.appendChild(el("button", { className: "delete", type: "button", title: "Delete row", "aria-label": "Delete row", textContent: "x" }));

    [typeCell, itemCell, fromCell, toCell, nightsCell, qtyCell, rateCell, discountsCell, netCell, deleteCell].forEach((cell) => tr.appendChild(cell));
    if (options.after && options.after.parentNode === rowsEl) options.after.after(tr);
    else rowsEl.appendChild(tr);

    const type = tr.querySelector(".type");
    type.addEventListener("change", () => {
      item.value = "";
      closeItemPicker({ restore: false });
      tr.dataset.followGlobal = isGlobalDateRow(tr) ? "1" : "0";
      applyAutoQty(tr);
      applyRememberedRate(tr);
      clampRowDates(tr);
      updateRowState(tr);
      groupRowsByType();
      refreshRoomAllocationControls();
      recalc();
    });

    item.addEventListener("input", () => {
      delete item.dataset.previousValue;
      if (itemPickerInput === item) renderItemPicker();
      if (isGlobalDateRow(tr)) tr.dataset.followGlobal = "1";
      applyAutoQty(tr);
      clampRowDates(tr);
      applyRememberedRate(tr);
      updateRowState(tr);
      refreshRoomAllocationControls();
      recalc();
    });
    item.addEventListener("click", () => {
      if (item.dataset.pickerOpen === "1") {
        closeItemPicker();
        return;
      }
      openItemPicker(item, tr, { clearCurrent: true });
    });
    item.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeItemPicker();
        item.blur();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        if (item.dataset.pickerOpen !== "1") openItemPicker(item, tr);
        itemPicker?.querySelector(".item-picker-choice")?.focus();
      }
    });
    item.addEventListener("blur", () => {
      if (itemPickerInput === item) return;
      restoreItemIfEmpty(item);
      applyAutoQty(tr);
      clampRowDates(tr);
      updateRowState(tr);
      refreshRoomAllocationControls();
      recalc();
    });

    roomAdults.addEventListener("input", () => {
      syncRoomGuests(roomAdults, ".room-adults");
      recalc();
    });
    roomChildren.addEventListener("input", () => {
      syncRoomGuests(roomChildren, ".room-children");
      recalc();
    });
    assignedRoom.addEventListener("change", () => {
      assignedRoom.dataset.assignedRoomKey = assignedRoom.value;
      assignedRoom.title = assignedRoom.options[assignedRoom.selectedIndex]?.textContent || "Split automatically";
      recalc();
    });

    tr.querySelectorAll(".from,.to").forEach((input) => {
      input.addEventListener("input", () => cleanDateInput(input));
      input.addEventListener("blur", () => {
        normalizeDateInput(input);
        tr.dataset.followGlobal = "0";
        clampRowDates(tr);
        applyRememberedRate(tr);
        recalc();
      });
      input.addEventListener("click", () => togglePicker(input));
      input.addEventListener("keydown", (event) => {
        handleDateKeydown(input, event, () => {
          tr.dataset.followGlobal = "0";
          clampRowDates(tr);
          recalc();
        });
      });
    });

    tr.querySelector(".nights").addEventListener("input", () => {
      const data = rowData(tr);
      if (!isDateRangeType(data.type)) return recalc();
      const fromInput = tr.querySelector(".from");
      const toInput = tr.querySelector(".to");
      if (!fromInput.value) fromInput.value = value("checkin");
      toInput.value = core.addDays(fromInput.value, tr.querySelector(".nights").value);
      tr.dataset.followGlobal = "0";
      clampRowDates(tr);
      applyRememberedRate(tr);
      recalc();
    });
    tr.querySelector(".qty").addEventListener("input", recalc);
    tr.querySelector(".rate").addEventListener("input", () => {
      autoRates.delete(tr);
      tr.querySelector(".rate").removeAttribute("title");
      recalc();
    });
    tr.querySelector(".rate").addEventListener("blur", () => {
      rememberRowRate(tr);
      recalc();
    });
    tr.querySelector(".discounts").addEventListener("input", () => {
      recalc();
      scheduleRowRate(tr);
    });
    tr.querySelector(".add-same-service").addEventListener("click", () => {
      flushUndoSnapshot();
      const nextType = tr.querySelector(".type").value;
      const created = addRow(serviceDefaults(nextType), { after: tr });
      if (created) created.querySelector(".item")?.focus();
    });
    tr.querySelector(".delete").addEventListener("click", () => {
      activeStepperStop?.();
      flushUndoSnapshot();
      closeTypePickers();
      closeItemPicker({ restore: false });
      tr.remove();
      refreshRoomAllocationControls();
      recalc();
    });

    if (data.followGlobal !== true && data.followGlobal !== false) {
      tr.dataset.followGlobal = isGlobalDateRow(tr) ? "1" : "0";
    }
    if (!options.preserveValues) applyAutoQty(tr);
    clampRowDates(tr);
    updateRowState(tr);
    refreshRoomAllocationControls();
    if (!options.deferRender) {
      if (data.type) groupRowsByType();
      recalc();
    }
    return tr;
  }

  function createDefaultRows() {
    activeStepperStop?.();
    rowsEl.innerHTML = "";
    ["ROOM", "MEAL", "TRANSFER", "GREEN_TAX"].forEach((type) => addRow(serviceDefaults(type), { deferRender: true }));
  }

  function setCheckoutFromNights() {
    const nights = Number(value("nights") || 0);
    $("checkout").value = value("checkin") && nights > 0 ? core.addDays(value("checkin"), nights) : "";
    syncGlobalRows();
    rowsEl.querySelectorAll("tr").forEach(clampRowDates);
    applyRememberedRates();
    recalc();
  }

  function handleGlobalDate(input) {
    normalizeDateInput(input);
    const checkin = value("checkin");
    const checkout = value("checkout");

    if (input.id === "checkin" && checkin && Number(value("nights") || 0) > 0) {
      $("checkout").value = core.addDays(checkin, value("nights"));
    } else if (input.id === "checkout" && checkin && checkout && core.parseDate(checkout) < core.parseDate(checkin)) {
      $("checkout").value = "";
    }

    syncGlobalRows();
    rowsEl.querySelectorAll("tr").forEach((tr) => {
      clampRowDates(tr);
      applyRememberedRate(tr);
    });
    recalc();
  }

  function sharePayload() {
    return {
      hotel: value("hotel"),
      checkin: value("checkin"),
      checkout: value("checkout"),
      guests: {
        adults: value("adults"),
        children: value("children"),
        infants: value("infants"),
        ages: value("ages"),
      },
      spo: value("spo"),
      eboDays: value("eboDays"),
      rows: currentRows(),
    };
  }

  function prepareRoomAllocationRows(inputRows, guests = {}) {
    const rows = inputRows.map((row) => ({ ...row }));
    const preparedRooms = [];
    const adults = Number(guests.adults || 0);
    const children = Number(guests.children || 0);

    function overlaps(left, right) {
      const leftFrom = core.parseDate(left.from);
      const leftTo = core.parseDate(left.to);
      const rightFrom = core.parseDate(right.from);
      const rightTo = core.parseDate(right.to);
      return leftFrom && leftTo && rightFrom && rightTo && leftFrom < rightTo && rightFrom < leftTo;
    }

    rows.forEach((row) => {
      if (row.type !== "ROOM") return;
      let priorPeriod = null;
      if (!row.roomKey) {
        priorPeriod = [...preparedRooms].reverse().find((prior) => (
          prior.item === row.item && prior.to === row.from && !overlaps(prior, row)
        ));
        row.roomKey = priorPeriod?.roomKey || storage.createId();
      }

      const sameRoom = preparedRooms.find((prior) => prior.roomKey === row.roomKey);
      const overlapsAnotherRoom = preparedRooms.some((prior) => prior.roomKey !== row.roomKey && overlaps(prior, row));
      if (row.roomAdults === undefined) row.roomAdults = sameRoom ? sameRoom.roomAdults : (overlapsAnotherRoom ? 0 : adults);
      if (row.roomChildren === undefined) row.roomChildren = sameRoom ? sameRoom.roomChildren : (overlapsAnotherRoom ? 0 : children);
      preparedRooms.push(row);
    });
    return rows;
  }

  function applyPayload(payload) {
    if (!payload) return false;
    activeStepperStop?.();
    clearTimeout(rateMemoryTimer);
    pendingRates.clear();
    closePicker();
    closeItemPicker({ restore: false });
    suppressDraft = true;
    $("hotel").value = storage.canonicalHotelName(payload.hotel);
    if (payload.hotel === "Riu Atoll and Riu Palace Maldivas") {
      const hotels = [...new Set((payload.rows || []).filter((row) => row.type === "ROOM")
        .map((row) => storage.canonicalHotelName(payload.hotel, row.item)))];
      if (hotels.length === 1) $("hotel").value = hotels[0];
    }
    if (payload.hotel === "Centara Mirage Lagoon Maldives & Centara Grand Lagoon Maldives") {
      const hotels = [...new Set((payload.rows || []).filter((row) => row.type === "ROOM")
        .map((row) => storage.canonicalHotelName(payload.hotel, row.item)))].filter((name) => name !== payload.hotel);
      if (hotels.length === 1) $("hotel").value = hotels[0];
    }
    $("checkin").value = core.formatDate(payload.checkin || "");
    $("checkout").value = core.formatDate(payload.checkout || "");
    $("adults").value = payload.guests?.adults ?? "0";
    $("children").value = payload.guests?.children ?? "0";
    $("infants").value = payload.guests?.infants ?? "0";
    $("ages").value = payload.guests?.ages || "";
    renderChildAgeFields({ restore: true });
    $("spo").value = payload.spo || "";
    $("eboDays").value = payload.eboDays || "";
    updateHotelScopedLists();
    rowsEl.innerHTML = "";
    if (Array.isArray(payload.rows)) {
      prepareRoomAllocationRows(payload.rows, payload.guests)
        .forEach((row) => addRow(row, { preserveValues: true, deferRender: true }));
      groupRowsByType();
    } else createDefaultRows();
    suppressDraft = false;
    recalc();
    return true;
  }

  function hasMeaningfulCalculation() {
    const payload = sharePayload();
    if (payload.hotel || payload.checkin || payload.checkout || payload.spo) return true;
    const guests = payload.guests || {};
    if (Number(guests.adults || 0) || Number(guests.children || 0) || Number(guests.infants || 0) || guests.ages) return true;
    return payload.rows.some((row) => {
      if (!row.type) return false;
      if (core.isGreenTax(row) && !row.from && !row.to && !Number(row.qty || 0)) return false;
      return Boolean(row.item || row.from || row.to || row.rateFormula || row.discounts?.length);
    });
  }

  function normalizedMealPlan(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function mealPlanTokens(value) {
    return normalizedMealPlan(value)
      .replace(/\s+-\s+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(" ");
  }

  function findMealValue(record, plan, guest) {
    const wanted = normalizedMealPlan(plan);
    if (!record || !wanted) return "";
    const suffix = guest === "child" ? "Child" : "Adult";
    const wantedTokens = mealPlanTokens(plan);
    const matchingGuestMeals = recordMeals(record).filter((meal) => new RegExp(`\\s+-\\s+${suffix}$`, "i").test(meal));
    const exact = matchingGuestMeals.find((meal) => {
      if (!new RegExp(`\\s+-\\s+${suffix}$`, "i").test(meal)) return false;
      return normalizedMealPlan(stripGuestSuffix(meal)) === wanted;
    });
    if (exact) return exact;
    const tokenMatch = matchingGuestMeals.filter((meal) => mealPlanTokens(stripGuestSuffix(meal)) === wantedTokens);
    if (tokenMatch.length === 1) return tokenMatch[0];
    if (/\bplatinum\b/.test(wanted)) {
      const platinumMatches = matchingGuestMeals.filter((meal) => /\bplatinum\b/.test(normalizedMealPlan(stripGuestSuffix(meal))));
      if (platinumMatches.length === 1) return platinumMatches[0];
    }
    if (/^[a-z]{2,4}$/i.test(wanted)) {
      const codeMatches = matchingGuestMeals.filter((meal) => new RegExp(`\\b${wanted}\\b`, "i").test(stripGuestSuffix(meal)));
      if (codeMatches.length === 1) return codeMatches[0];
    }
    return "";
  }

  function transferItem(mode, guest, oneWay) {
    const names = { SPEEDBOAT: "Speedboat", SEAPLANE: "Seaplane", DOMESTIC: "Domestic" };
    const base = names[mode] || "";
    if (!base) return "";
    const suffix = guest === "child" ? "Child" : "Adult";
    return oneWay ? `${base} OW - ${suffix}` : `${base} - ${suffix}`;
  }

  function roomsWithQuotationPeriods(rooms, quotation) {
    const components = quotation?.components || [];
    if (rooms?.length === 1 && components.length > 1) {
      const room = rooms[0];
      const nights = core.nightsBetween(room.from, room.to);
      if (nights > 0 && components.every((part) => Number.isInteger(part.nights) && part.nights > 0)
        && components.reduce((sum, part) => sum + part.nights, 0) === nights) {
        let from = room.from;
        return components.map((part) => {
          const to = core.addDays(from, part.nights);
          const segment = { ...room, from, to, nights: part.nights };
          from = to;
          return segment;
        });
      }
    }
    if (!Array.isArray(rooms) || !rooms.length || components.length !== rooms.length) return rooms;
    const exact = rooms.every((room, index) => Number(room.nights || core.nightsBetween(room.from, room.to)) === Number(components[index]?.nights || 0));
    if (!exact) return rooms;
    return rooms;
  }

  function samoGalaDinnerText(galaDinners = []) {
    return galaDinners
      .map((gala) => {
        const name = gala.itemBase || gala.raw || "";
        const date = gala.from && gala.to && gala.from !== gala.to ? `${gala.from} - ${gala.to}` : gala.from || gala.to || "";
        return [name, date].filter(Boolean).join(" · ");
      })
      .filter(Boolean)
      .join("; ");
  }

  function addSamoDinnerRows(rows, warnings, galaDinners, adults, children) {
    (galaDinners || []).forEach((gala) => {
      if (!gala.itemBase) {
        warnings.push(`Gala dinner "${gala.raw}" was not safely mapped.`);
        return;
      }
      const adultItem = `${gala.itemBase} - Adult`;
      const childItem = `${gala.itemBase} - Child`;
      if (adults > 0 && LISTS.DINNER.includes(adultItem)) {
        rows.push({ type: "DINNER", item: adultItem, from: gala.from, to: "", qty: adults });
      }
      if (children > 0 && LISTS.DINNER.includes(childItem)) {
        rows.push({ type: "DINNER", item: childItem, from: gala.from, to: "", qty: children });
      }
    });
  }

  function buildSamoPayload(parsed) {
    const hotel = parsed.mappedHotel || parsed.hotel || "";
    const record = parsed.mappedHotel ? HOTEL_DATA[parsed.mappedHotel] : null;
    const warnings = [...(parsed.warnings || [])];
    const adults = Number(parsed.adults || 0);
    const children = Number(parsed.children || 0);
    const rows = [];

    function mappedRoomName(item) {
      const names = record?.rooms || [];
      const tokens = (name) => String(name || "")
        .toLowerCase()
        .replace(/-/g, " ")
        .replace(/\btwo\b/g, "2")
        .replace(/\bthree\b/g, "3")
        .replace(/\bfour\b/g, "4")
        .split(/\s+/)
        .filter((word) => word && word !== "with")
        .sort()
        .join(" ");
      const exact = names.find((name) => name.toLowerCase() === String(item || "").toLowerCase());
      if (exact) return exact;
      const matches = names.filter((name) => tokens(name) === tokens(item));
      return matches.length === 1 ? matches[0] : item;
    }

    roomsWithQuotationPeriods(parsed.rooms || [], parsed.roomQuotation).forEach((room) => {
      if (!room.item && !room.from && !room.to) return;
      rows.push({
        type: "ROOM",
        item: mappedRoomName(room.item) || "",
        from: room.from || parsed.checkin || "",
        to: room.to || parsed.checkout || "",
        qty: 1,
        rateFormula: "",
        followGlobal: false,
      });
    });

    if (parsed.mealPlan) {
      const adultMeal = adults > 0 ? findMealValue(record, parsed.mealPlan, "adult") : "";
      const childMeal = children > 0 ? findMealValue(record, parsed.mealPlan, "child") : "";
      if (adults > 0 && adultMeal) rows.push({ type: "MEAL", item: adultMeal, from: parsed.checkin, to: parsed.checkout, qty: adults, followGlobal: true });
      if (children > 0 && childMeal) rows.push({ type: "MEAL", item: childMeal, from: parsed.checkin, to: parsed.checkout, qty: children, followGlobal: true });
      if ((adults > 0 && !adultMeal) || (children > 0 && !childMeal)) warnings.push(`Meal plan "${parsed.mealPlan}" was not safely mapped for the selected hotel.`);
    }

    if (parsed.transfer?.mode) {
      const adultTransfer = adults > 0 ? transferItem(parsed.transfer.mode, "adult", parsed.transfer.oneWay) : "";
      const childTransfer = children > 0 ? transferItem(parsed.transfer.mode, "child", parsed.transfer.oneWay) : "";
      if (adultTransfer) rows.push({ type: "TRANSFER", item: adultTransfer, qty: adults });
      if (childTransfer) rows.push({ type: "TRANSFER", item: childTransfer, qty: children });
    } else if (parsed.transfer?.status === "unresolved") {
      warnings.push("Transfer was detected but not safely mapped.");
    }

    if (parsed.fuelSurcharge) {
      rows.push({ type: "EXTRA", item: "Fuel Surcharge", qty: adults + children });
    }

    addSamoDinnerRows(rows, warnings, parsed.galaDinners, adults, children);

    if (parsed.greenTax) {
      rows.push({
        type: "GREEN_TAX",
        item: "Green Tax",
        from: parsed.checkin,
        to: parsed.checkout,
        qty: adults + children,
        rate: 12,
        followGlobal: true,
      });
    }

    return {
      payload: {
        hotel,
        checkin: parsed.checkin || "",
        checkout: parsed.checkout || "",
        guests: {
          adults: String(adults),
          children: String(children),
          infants: String(Number(parsed.infants || 0)),
          ages: (parsed.childAges || []).join("/"),
        },
        spo: parsed.spo || "",
        rows,
      },
      warnings,
    };
  }

  function statusPill(status) {
    const normalized = status || "Detected";
    const span = el("span", { className: `samo-status ${normalized.toLowerCase()}`, textContent: normalized });
    return span;
  }

  function previewLine(label, value, status = "Detected") {
    const row = el("div", { className: "samo-preview-line" });
    row.appendChild(el("span", { className: "samo-preview-label", textContent: label }));
    row.appendChild(el("strong", { textContent: value || "--" }));
    row.appendChild(statusPill(status));
    return row;
  }

  function renderSamoPreview(parsed) {
    const box = $("samoImportPreview");
    const apply = $("applySamoImport");
    box.innerHTML = "";
    if (!parsed) {
      apply.disabled = true;
      box.appendChild(el("div", { className: "samo-import-empty", textContent: "Paste request text and parse it first." }));
      return;
    }
    apply.disabled = false;
    const mapped = buildSamoPayload(parsed);
    const hotelStatus = parsed.hotelStatus === "mapped" ? "Mapped" : "Unresolved";
    const transferText = parsed.transfer?.mode ? `${parsed.transfer.mode}${parsed.transfer.oneWay ? " OW" : ""}` : parsed.transfer?.raw || "";
    const galaDinnerText = samoGalaDinnerText(parsed.galaDinners);

    box.appendChild(el("h3", { textContent: "Detected" }));
    box.appendChild(previewLine("Hotel", parsed.mappedHotel || parsed.hotel, hotelStatus));
    box.appendChild(previewLine("Stay", parsed.checkin && parsed.checkout ? `${parsed.checkin} - ${parsed.checkout}` : "", parsed.checkin && parsed.checkout ? "Detected" : "Unresolved"));
    box.appendChild(previewLine("Nights", parsed.nights ? String(parsed.nights) : "", parsed.nights ? "Detected" : "Unresolved"));
    box.appendChild(previewLine("Guests", `${parsed.adults || 0} ADL, ${parsed.children || 0} CHD, ${parsed.infants || 0} INF`, parsed.adults ? "Detected" : "Unresolved"));
    if (parsed.childAges?.length) box.appendChild(previewLine("Child ages", parsed.childAges.join("/"), "Detected"));
    box.appendChild(previewLine("Meal", parsed.mealPlan, parsed.mealPlan ? "Detected" : "Unresolved"));
    box.appendChild(previewLine("Transfer", transferText, parsed.transfer?.mode ? "Mapped" : "Unresolved"));
    if (parsed.fuelSurcharge) box.appendChild(previewLine("Fuel surcharge", "One time · all guests", "Mapped"));
    if (galaDinnerText) box.appendChild(previewLine("Gala Dinner", galaDinnerText, "Mapped"));
    box.appendChild(previewLine("Green Tax", parsed.greenTax ? "Yes" : parsed.freeText ? "" : "No", parsed.freeText && !parsed.greenTax ? "Unresolved" : "Detected"));
    if (parsed.spo) box.appendChild(previewLine("SPO", parsed.spo, "Detected"));
    if (parsed.roomQuotation?.raw) box.appendChild(previewLine("Room quotation", parsed.roomQuotation.raw, "Detected"));

    const roomList = el("div", { className: "samo-preview-rooms" });
    roomList.appendChild(el("h3", { textContent: "Rooms" }));
    if (parsed.rooms?.length) {
      parsed.rooms.forEach((room, index) => {
        roomList.appendChild(el("div", {
          className: "samo-preview-room",
          textContent: `${index + 1}. ${room.item || "--"} · ${room.from || "--"} - ${room.to || "--"}`,
        }));
      });
    } else {
      roomList.appendChild(el("div", { className: "samo-import-empty", textContent: "No room rows detected." }));
    }
    box.appendChild(roomList);

    if (mapped.warnings.length) {
      const warnings = el("div", { className: "samo-preview-warnings" });
      mapped.warnings.forEach((warning) => warnings.appendChild(el("div", { textContent: warning })));
      box.appendChild(warnings);
    }
  }

  function openSamoImport() {
    if (!samoParser) {
      toast("SAMO importer is not available");
      return;
    }
    samoImportData = null;
    $("samoImportText").value = "";
    renderSamoPreview(null);
    $("samoImportModal").showModal();
    $("samoImportText").focus();
  }

  function closeSamoImport() {
    samoImportData = null;
    $("samoImportText").value = "";
    renderSamoPreview(null);
    $("samoImportModal").close();
  }

  function parseSamoImport() {
    const text = $("samoImportText").value;
    if (!text.trim()) {
      toast("Paste request text first");
      return;
    }
    samoImportData = samoParser.parseSamoRequest(text, { hotelNames: HOTEL_NAMES });
    renderSamoPreview(samoImportData);
  }

  function applySamoImport() {
    if (!samoImportData) return;
    if (hasMeaningfulCalculation() && !window.confirm("Replace current calculation with imported request?")) return;
    const { payload } = buildSamoPayload(samoImportData);
    const savedDatePayload = payload.checkin
      ? storage.history().find((entry) => {
        const saved = entry?.payload;
        return saved
          && core.formatDate(saved.checkin) === core.formatDate(payload.checkin)
          && Number(saved.eboDays || 0) > 0;
      })?.payload
      : null;
    if (savedDatePayload?.eboDays !== undefined) payload.eboDays = savedDatePayload.eboDays;
    flushUndoSnapshot();
    applyPayload(payload);
    clearSaveStatus();
    if (applyRememberedRates({ replaceExisting: true })) recalc();
    pushUndoSnapshot();
    closeSamoImport();
    toast("Request imported");
  }

  function restoreUndoPayload(payload) {
    restoringUndoState = true;
    applyPayload(payload);
    lastUndoSignature = payloadSignature(sharePayload());
    restoringUndoState = false;
    updateUndoButtons();
    scheduleDraftSave();
  }

  function undoChange() {
    flushUndoSnapshot();
    if (undoStack.length <= 1) return;
    const current = undoStack.pop();
    redoStack.push(current);
    restoreUndoPayload(clonePayload(undoStack[undoStack.length - 1]));
    toast("Undone");
  }

  function redoChange() {
    flushUndoSnapshot();
    if (!redoStack.length) return;
    const next = redoStack.pop();
    undoStack.push(clonePayload(next));
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    restoreUndoPayload(clonePayload(next));
    toast("Redone");
  }

  function initUndoHistory() {
    undoReady = true;
    pushUndoSnapshot();
  }

  function calculationEntry() {
    const payload = sharePayload();
    const total = Number(String($("grandTotal").textContent || "0").replace(/[$,]/g, ""));
    return {
      id: storage.createId(),
      appVersion: APP_VERSION,
      savedAt: new Date().toISOString(),
      hotel: payload.hotel || "Untitled hotel",
      checkin: payload.checkin,
      checkout: payload.checkout,
      spo: payload.spo,
      guests: payload.guests,
      total,
      payload,
      shareText: core.buildShareText(payload),
    };
  }

  function scheduleDraftSave() {
    if (suppressDraft || !storage) return;
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => storage.saveDraft(sharePayload()), 300);
  }

  function restoreDraft() {
    if (!storage) return false;
    const draft = storage.loadDraft();
    if (!draft?.payload) return false;
    return applyPayload(draft.payload);
  }

  function shareText() {
    if (!recalc()) {
      toast("Check the highlighted numbers before sharing.");
      return "";
    }
    return core.buildShareText(sharePayload());
  }

  function shareHtml(text) {
    return text.split("\n").map((line) => {
      const escaped = escapeHtml(line);
      if (/^TOTAL:/i.test(line)) return `<strong>${escaped}</strong>`;
      const datedService = /^(\d{2}\.\d{2}(?:\s+-\s+\d{2}\.\d{2})?)\s+:\s+([^:]+)\s+:\s+(.*)$/.exec(line);
      if (datedService) {
        return `<strong>${escapeHtml(datedService[1])} : ${escapeHtml(datedService[2].trim())}</strong> : ${escapeHtml(datedService[3])}`;
      }
      const plainService = /^([^:]+)\s+:\s+(.*)$/.exec(line);
      if (plainService && !/^SPO$/i.test(plainService[1].trim())) {
        return `<strong>${escapeHtml(plainService[1].trim())}</strong> : ${escapeHtml(plainService[2])}`;
      }
      return escaped;
    }).join("\n");
  }

  function showShare() {
    const text = shareText();
    if (!text) return;
    $("shareText").innerHTML = shareHtml(text);
    $("shareModal").showModal();
  }

  async function copyShare() {
    const text = shareText();
    if (!text) return;
    const html = `<pre style="font:10pt/1.45 Arial, sans-serif; white-space:pre-wrap;">${shareHtml(text)}</pre>`;
    try {
      if (window.ClipboardItem && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      toast("Calculation copied to clipboard");
    } catch {
      const textarea = el("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
      toast("Calculation copied");
    }
  }

  function downloadShare() {
    const text = shareText();
    if (!text) return;
    const hotel = (value("hotel") || "Hotel").replace(/[^a-z0-9]+/gi, "_");
    downloadBlob(`${hotel}_calculation.txt`, text, "text/plain;charset=utf-8");
    toast("Short calculation downloaded");
  }

  function saveCalculation() {
    if (!recalc()) {
      toast("Check the highlighted numbers before saving.");
      return;
    }
    const entry = calculationEntry();
    if (!storage.saveHistory(entry)) {
      clearSaveStatus();
      toast("Could not save calculation. Browser storage may be full or unavailable.");
      return;
    }
    rowsEl.querySelectorAll("tr").forEach(rememberRowRate);
    markCalculationSaved(entry.payload);
    renderHistory();
    toast("Calculation saved");
  }

  function historyRows() {
    const query = ($("historySearch")?.value || "").trim().toLowerCase();
    return storage.history().filter((entry) => {
      const haystack = [
        entry.hotel,
        entry.checkin,
        entry.checkout,
        entry.spo,
        core.money(entry.total),
        new Date(entry.savedAt).toLocaleDateString(),
      ].join(" ").toLowerCase();
      return !query || haystack.includes(query);
    });
  }

  function historyDateKey(savedAt) {
    const date = new Date(savedAt);
    if (Number.isNaN(date.getTime())) return "unknown";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function historyDateLabel(savedAt) {
    const date = new Date(savedAt);
    if (Number.isNaN(date.getTime())) return "Unknown date";
    return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  function renderHistoryItem(entry) {
    return `
      <article class="history-item" data-id="${escapeHtml(entry.id)}">
        <div>
          <strong>${escapeHtml(entry.hotel || "Untitled hotel")}</strong>
          <span>${escapeHtml(entry.checkin || "--")} - ${escapeHtml(entry.checkout || "--")} · ${escapeHtml(entry.spo || "No SPO")}</span>
          <small>${escapeHtml(new Date(entry.savedAt).toLocaleString())}</small>
        </div>
        <div class="history-total">$${core.money(entry.total)}</div>
        <div class="history-actions">
          <button class="history-open add" type="button">Open</button>
          <button class="history-copy share" type="button">Copy</button>
          <button class="history-delete clear" type="button">Delete</button>
        </div>
      </article>
    `;
  }

  function renderHistory() {
    const list = $("historyList");
    if (!list || !storage) return;
    const rows = historyRows();
    if (!rows.length) {
      list.innerHTML = '<div class="history-empty">No saved calculations yet.</div>';
      return;
    }

    const groups = rows.reduce((map, entry) => {
      const key = historyDateKey(entry.savedAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(entry);
      return map;
    }, new Map());

    list.innerHTML = [...groups.entries()].map(([key, entries]) => `
      <section class="history-day">
        <h3 class="history-date">
          <span>${escapeHtml(historyDateLabel(entries[0].savedAt))}</span>
          <small>${entries.length} calculation${entries.length === 1 ? "" : "s"}</small>
        </h3>
        ${entries.map(renderHistoryItem).join("")}
      </section>
    `).join("");
  }

  function renderDriveStatus(message = "") {
    const box = $("driveStatus");
    if (!box || !googleDrive) return;
    const status = googleDrive.status();
    const text = message || (
      !status.configured
        ? "Google Drive sync is optional. Add a Google OAuth Client ID in assets/googleConfig.js to enable it."
        : status.signedIn
          ? "Google Drive is connected. Sync stores this history in your private Drive app data."
          : "Google Drive sync is optional. Sign in to keep history after cache clears or on another computer."
    );
    box.textContent = text;
    box.classList.toggle("connected", status.signedIn);
  }

  function showHistoryModal() {
    renderHistory();
    renderDriveStatus();
    $("historyModal").showModal();
  }

  async function connectDrive() {
    try {
      await googleDrive.connect();
      renderDriveStatus("Google Drive connected.");
      toast("Google Drive connected");
    } catch (error) {
      renderDriveStatus(error.message);
      toast(error.message);
    }
  }

  async function syncDrive() {
    try {
      const merged = await googleDrive.sync(storage.history());
      storage.replaceHistory(merged);
      renderHistory();
      renderDriveStatus(`Google Drive synced ${merged.length} saved calculation${merged.length === 1 ? "" : "s"}.`);
      toast("Google Drive history synced");
    } catch (error) {
      renderDriveStatus(error.message);
      toast(error.message);
    }
  }

  function signOutDrive() {
    googleDrive.signOut();
    renderDriveStatus("Google Drive disconnected.");
    toast("Google Drive disconnected");
  }

  function exportHistory() {
    const payload = {
      app: "Hotel Calculator",
      appVersion: APP_VERSION,
      exportedAt: new Date().toISOString(),
      history: storage.history(),
    };
    downloadBlob("hotel_calculator_history.json", JSON.stringify(payload, null, 2), "application/json;charset=utf-8");
    toast("History backup exported");
  }

  function importHistoryFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const data = JSON.parse(String(reader.result || "{}"));
        const rows = Array.isArray(data) ? data : data.history;
        storage.mergeHistory(rows);
        renderHistory();
        toast("History backup imported");
      } catch {
        toast("Could not import history file");
      }
    });
    reader.readAsText(file);
  }

  function clearAll() {
    if (!window.confirm("Clear the current calculation and start a new one?")) return;
    flushUndoSnapshot();
    clearTimeout(rateMemoryTimer);
    pendingRates.clear();
    ["hotel", "checkin", "checkout", "ages", "spo", "eboDays"].forEach((id) => {
      $(id).value = "";
    });
    ["adults", "children", "infants", "nights"].forEach((id) => {
      $(id).value = "0";
    });
    renderChildAgeFields();
    createDefaultRows();
    clearSaveStatus();
    recalc();
    storage.clearDraft();
    toast("Calculation cleared");
  }

  function closePicker() {
    if (picker) picker.remove();
    picker = null;
    pickerInput = null;
  }

  function positionPicker() {
    const rect = pickerInput.getBoundingClientRect();
    const width = 330;
    const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
    let top = rect.bottom + 6;
    if (top + picker.offsetHeight > window.innerHeight - 8) top = Math.max(8, rect.top - picker.offsetHeight - 6);
    picker.style.left = `${left}px`;
    picker.style.top = `${top}px`;
  }

  function renderPicker() {
    picker.innerHTML = "";
    const row = pickerInput.closest("tr");
    const todayLimit = todayStart();
    const fieldMinDate = pickerInput.id === "checkout" || pickerInput.classList.contains("to")
      ? core.parseDate(row?.querySelector(".from")?.value || value("checkin"))
      : pickerInput.classList.contains("from")
        ? core.parseDate(value("checkin"))
        : null;
    const minDate = fieldMinDate && fieldMinDate > todayLimit ? fieldMinDate : todayLimit;
    const maxDate = GLOBAL_DATE_IDS.has(pickerInput.id) ? null : core.parseDate(value("checkout"));
    const selected = core.parseDate(pickerInput.value);
    const today = new Date();
    const canShowMonth = (year, month) => {
      const monthStart = new Date(year, month, 1);
      const monthEnd = new Date(year, month + 1, 0);
      return (!minDate || monthEnd >= minDate) && (!maxDate || monthStart <= maxDate);
    };
    const moveCalendar = (months) => {
      const next = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + months, 1);
      if (!canShowMonth(next.getFullYear(), next.getMonth())) return;
      pickerMonth = next;
      renderPicker();
    };
    const moveCalendarYear = (years) => moveCalendar(years * 12);
    const head = el("div", { className: "calendar-head" });
    const prevYear = el("button", { className: "calendar-nav", type: "button", title: "Previous year", textContent: "«" });
    const prevMonth = el("button", { className: "calendar-nav", type: "button", title: "Previous month", textContent: "‹" });
    const nextMonth = el("button", { className: "calendar-nav", type: "button", title: "Next month", textContent: "›" });
    const nextYear = el("button", { className: "calendar-nav", type: "button", title: "Next year", textContent: "»" });
    const monthWrap = el("div", { className: "calendar-month-wrap" });
    const monthButton = el("button", { className: "calendar-month", type: "button", title: "Choose month", textContent: MONTHS[pickerMonth.getMonth()] });
    const monthMenu = el("div", { className: "calendar-month-menu" });
    const yearInput = el("input", { className: "calendar-year", type: "number", min: "1900", max: "2100", step: "1", title: "Year" });

    MONTHS.forEach((month, index) => {
      const monthOption = el("button", { type: "button", textContent: month.slice(0, 3) });
      monthOption.classList.toggle("selected", index === pickerMonth.getMonth());
      monthOption.disabled = !canShowMonth(pickerMonth.getFullYear(), index);
      monthOption.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (monthOption.disabled) return;
        pickerMonth = new Date(pickerMonth.getFullYear(), index, 1);
        renderPicker();
      });
      monthMenu.appendChild(monthOption);
    });
    monthWrap.append(monthButton, monthMenu);
    yearInput.value = pickerMonth.getFullYear();
    prevYear.disabled = !canShowMonth(pickerMonth.getFullYear() - 1, pickerMonth.getMonth());
    prevMonth.disabled = !canShowMonth(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1);
    nextMonth.disabled = !canShowMonth(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1);
    nextYear.disabled = !canShowMonth(pickerMonth.getFullYear() + 1, pickerMonth.getMonth());

    prevYear.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveCalendarYear(-1);
    });
    prevMonth.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveCalendar(-1);
    });
    nextMonth.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveCalendar(1);
    });
    nextYear.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      moveCalendarYear(1);
    });
    monthButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      monthWrap.classList.toggle("open");
    });
    yearInput.addEventListener("change", (event) => {
      event.stopPropagation();
      const year = Math.max(1900, Math.min(2100, Number(yearInput.value) || new Date().getFullYear()));
      pickerMonth = new Date(year, pickerMonth.getMonth(), 1);
      renderPicker();
    });
    picker.onwheel = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const direction = event.deltaY > 0 ? 1 : -1;
      if (event.target === yearInput) moveCalendarYear(direction);
      else moveCalendar(direction);
    };

    head.append(prevYear, prevMonth, monthWrap, yearInput, nextMonth, nextYear);
    picker.appendChild(head);

    const grid = el("div", { className: "calendar-grid" });
    ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].forEach((day) => grid.appendChild(el("span", { textContent: day })));

    const first = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    for (let index = 0; index < offset; index += 1) grid.appendChild(el("span", { className: "empty" }));

    const days = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 0).getDate();

    for (let day = 1; day <= days; day += 1) {
      const date = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), day);
      const button = el("button", { type: "button", textContent: day });
      if ((minDate && date < minDate) || (maxDate && date > maxDate)) button.disabled = true;
      if (selected && selected.getTime() === date.getTime()) button.classList.add("selected");
      if (
        date.getFullYear() === today.getFullYear()
        && date.getMonth() === today.getMonth()
        && date.getDate() === today.getDate()
      ) {
        button.classList.add("today");
      }
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        pickerInput.value = core.formatDate(date);
        if (!GLOBAL_DATE_IDS.has(pickerInput.id)) pickerInput.closest("tr").dataset.followGlobal = "0";
        else handleGlobalDate(pickerInput);
        if (!GLOBAL_DATE_IDS.has(pickerInput.id)) clampRowDates(pickerInput.closest("tr"));
        if (!GLOBAL_DATE_IDS.has(pickerInput.id)) applyRememberedRate(pickerInput.closest("tr"));
        closePicker();
        recalc();
      });
      grid.appendChild(button);
    }

    picker.appendChild(grid);

    const actions = el("div", { className: "calendar-actions" });
    const clear = el("button", { type: "button", textContent: "Clear date" });
    clear.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      pickerInput.value = "";
      if (!GLOBAL_DATE_IDS.has(pickerInput.id)) pickerInput.closest("tr").dataset.followGlobal = "0";
      closePicker();
      recalc();
    });
    actions.appendChild(clear);
    picker.appendChild(actions);

    positionPicker();
  }

  function openPicker(input) {
    closePicker();
    pickerInput = input;
    const base = core.parseDate(input.value) || (input.id === "checkin" ? null : core.parseDate(value("checkin"))) || new Date();
    pickerMonth = new Date(base.getFullYear(), base.getMonth(), 1);
    picker = el("div", { className: "calendar" });
    document.body.appendChild(picker);
    renderPicker();
  }

  function togglePicker(input) {
    if (picker && pickerInput === input) {
      closePicker();
      return;
    }
    openPicker(input);
  }

  function wireEvents() {
    window.addEventListener("blur", () => activeStepperStop?.());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) activeStepperStop?.();
    });
    $("hotel").addEventListener("input", () => {
      updateHotelScopedLists();
      applyRememberedRates();
      recalc();
    });

    const rateAutofill = $("rateAutofill");
    if (rateAutofill) {
      rateAutofill.checked = storage.rateAutofillEnabled();
      rateAutofill.addEventListener("change", () => {
        storage.setRateAutofillEnabled(rateAutofill.checked);
        const filled = rateAutofill.checked ? applyRememberedRates({ force: true }) : 0;
        recalc();
        toast(rateAutofill.checked
          ? `Rate auto-fill enabled${filled ? `, ${filled} filled` : ""}`
          : "Rate auto-fill disabled");
      });
    }

    ["checkin", "checkout"].forEach((id) => {
      const input = $(id);
      input.addEventListener("input", () => cleanDateInput(input));
      input.addEventListener("blur", () => handleGlobalDate(input));
      input.addEventListener("click", () => togglePicker(input));
      input.addEventListener("keydown", (event) => handleDateKeydown(input, event, () => handleGlobalDate(input)));
    });

    $("nights").addEventListener("input", setCheckoutFromNights);
    ["adults", "children", "infants"].forEach((id) => {
      $(id).addEventListener("input", () => {
        if (id === "children") renderChildAgeFields();
        rowsEl.querySelectorAll("tr").forEach(applyAutoQty);
        if (id !== "infants") syncSingleRoomGuestsFromHeader();
        recalc();
      });
    });
    ["nights", "adults", "children", "infants"].forEach((id) => {
      const input = $(id);
      input.parentNode.appendChild(numberStepper(input));
    });
    $("eboResult").before(numberStepper($("eboDays")));
    renderChildAgeFields();
    ["ages", "eboDays"].forEach((id) => $(id).addEventListener("input", recalc));
    $("spo").addEventListener("input", () => {
      applyRememberedRates();
      recalc();
    });

    $("addRow").addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleAddServiceMenu();
    });
    $("clearAll").addEventListener("click", clearAll);
    $("undoChange").addEventListener("click", undoChange);
    $("redoChange").addEventListener("click", redoChange);
    $("saveCalculation").addEventListener("click", saveCalculation);
    $("showHistory").addEventListener("click", showHistoryModal);
    $("showSamoImport").addEventListener("click", openSamoImport);
    $("parseSamoImport").addEventListener("click", parseSamoImport);
    $("samoImportText").addEventListener("input", () => {
      samoImportData = null;
      renderSamoPreview(null);
    });
    $("applySamoImport").addEventListener("click", applySamoImport);
    $("closeSamoImport").addEventListener("click", closeSamoImport);
    $("cancelSamoImport").addEventListener("click", closeSamoImport);
    $("samoImportModal").addEventListener("close", () => {
      samoImportData = null;
      $("samoImportText").value = "";
    });
    $("showSettings").addEventListener("click", showSettingsModal);
    $("showShare").addEventListener("click", showShare);
    $("copyShare").addEventListener("click", copyShare);
    $("downloadShare").addEventListener("click", downloadShare);
    $("downloadShareModal").addEventListener("click", downloadShare);
    $("closeShare").addEventListener("click", () => $("shareModal").close());
    $("closeHistory").addEventListener("click", () => $("historyModal").close());
    $("closeSettings").addEventListener("click", () => $("settingsModal").close());
    ["appearanceTheme", "appearanceNavy", "appearanceBlue", "appearanceGreen"].forEach((id) => {
      $(id).addEventListener("input", saveAppearanceFromControls);
    });
    $("resetAppearance").addEventListener("click", resetAppearance);
    $("historySearch").addEventListener("input", renderHistory);
    $("connectDrive").addEventListener("click", connectDrive);
    $("syncDrive").addEventListener("click", syncDrive);
    $("signOutDrive").addEventListener("click", signOutDrive);
    $("exportHistory").addEventListener("click", exportHistory);
    $("importHistory").addEventListener("click", () => $("historyFile").click());
    $("historyFile").addEventListener("change", (event) => {
      importHistoryFile(event.target.files?.[0]);
      event.target.value = "";
    });
    $("historyList").addEventListener("click", (event) => {
      const item = event.target.closest(".history-item");
      if (!item) return;
      const entry = storage.history().find((row) => row.id === item.dataset.id);
      if (!entry) return;
      if (event.target.closest(".history-open")) {
        flushUndoSnapshot();
        applyPayload(entry.payload);
        if (payloadSignature(sharePayload()) === payloadSignature(entry.payload)) markCalculationSaved(sharePayload());
        else clearSaveStatus();
        $("historyModal").close();
        toast("Saved calculation opened");
      } else if (event.target.closest(".history-copy")) {
        navigator.clipboard?.writeText(entry.shareText || core.buildShareText(entry.payload));
        toast("Saved share copied");
      } else if (event.target.closest(".history-delete") && window.confirm("Delete this saved calculation?")) {
        storage.deleteHistory(entry.id);
        renderHistory();
        toast("Saved calculation deleted");
      }
    });
    document.addEventListener("click", (event) => {
      if (picker && !picker.contains(event.target) && event.target !== pickerInput) closePicker();
      if (itemPicker && !itemPicker.contains(event.target) && event.target !== itemPickerInput) closeItemPicker();
      if (!event.target.closest(".type-picker-wrap") && !event.target.closest(".type-picker-menu")) closeTypePickers();
      if (!event.target.closest(".add-service-wrap")) closeAddServiceMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeAddServiceMenu();
        closeItemPicker();
        closeTypePickers();
      }
    });
    document.addEventListener("click", (event) => {
      const choice = event.target.closest(".item-picker-choice");
      if (choice && itemPicker?.contains(choice)) chooseItemPickerValue(choice.dataset.value || "");
    });
    window.addEventListener("resize", () => {
      closePicker();
      closeItemPicker();
      closeTypePickers();
      closeAddServiceMenu();
    });
    window.addEventListener("scroll", (event) => {
      if (isInsideFloatingPanel(event.target)) return;
      closePicker();
      closeItemPicker();
      closeAddServiceMenu();
      positionOpenTypePickers();
    }, true);
  }

  buildLists();
  applyAppearance();
  wireEvents();
  $("appVersion").textContent = `v${APP_VERSION}`;
  if (!restoreDraft()) createDefaultRows();
  recalc();
  initUndoHistory();
  window.HotelCalculatorApp = { addRow, applyRememberedRates, recalc, shareText, saveCalculation, undoChange, redoChange, parseSamoImport: samoParser?.parseSamoRequest };
})();
