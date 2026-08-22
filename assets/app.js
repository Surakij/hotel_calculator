(function () {
  const core = window.HotelCalcCore;
  const storage = window.HotelCalculatorStorage;
  const HOTEL_DATA = window.HotelCalculatorHotelData || {};
  const HOTEL_NAMES = Object.keys(HOTEL_DATA);
  const APP_VERSION = "1.0.0";
  const DEFAULT_HOTELS = ["Ozen Bolifushi", "Ozen Life Maadhoo"];
  const DEFAULT_ROOMS = ["2 Bedroom Suite", "Ocean Pool Suite SUNSET", "Beach Pool Villa"];
  const ROW_TYPE_ORDER = ["ROOM", "EXTRA", "MEAL", "DINNER", "TRANSFER", "GREEN_TAX"];
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
    ROOM: DEFAULT_ROOMS,
    MEAL: ["BB - Adult", "BB - Child", "HB - Adult", "HB - Child", "FB - Adult", "FB - Child", "AI - Adult", "AI - Child", "AI Luxury - Adult", "AI Luxury - Child", "Cristal AI - Adult", "Cristal AI - Child"],
    TRANSFER: ["Seaplane - Adult", "Seaplane - Child", "Seaplane OW - Adult", "Seaplane OW - Child", "Domestic - Adult", "Domestic - Child", "Domestic OW - Adult", "Domestic OW - Child", "Speedboat - Adult", "Speedboat - Child", "Speedboat OW - Adult", "Speedboat OW - Child"],
    DINNER: ["Christmas Gala Dinner - Adult", "Christmas Gala Dinner - Child", "New Year Gala Dinner - Adult", "New Year Gala Dinner - Child"],
    EXTRA: ["Extra Adult", "Extra Child"],
    GREEN_TAX: ["Green Tax"],
  };
  const COLORS = {
    ROOM: { bg: "#eaf3ff", fg: "#1f65b8", border: "#b9d7fb" },
    MEAL: { bg: "#ecfdf3", fg: "#148043", border: "#b7ebc7" },
    TRANSFER: { bg: "#f2edff", fg: "#6440b5", border: "#d6c7ff" },
    EXTRA: { bg: "#fff7ed", fg: "#b45309", border: "#fed7aa" },
    GREEN_TAX: { bg: "#fefce8", fg: "#997000", border: "#fde68a" },
    DINNER: { bg: "#fff1f2", fg: "#be123c", border: "#fecdd3" },
  };
  const GLOBAL_DATE_IDS = new Set(["checkin", "checkout"]);
  const DATE_RANGE_TYPES = new Set(["ROOM", "EXTRA", "MEAL", "GREEN_TAX"]);

  const $ = (id) => document.getElementById(id);
  const rowsEl = $("rows");
  let picker = null;
  let pickerInput = null;
  let pickerMonth = null;
  let draftTimer = null;
  let suppressDraft = false;
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
    input.value = input.value.replace(/[^\d.]/g, "").slice(0, 10);
  }

  function normalizeDateInput(input) {
    if (!input.value) return;
    input.value = core.formatDate(input.value);
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
    const minus = el("button", { className: "step-button", type: "button", title: "Decrease", textContent: "-" });
    const plus = el("button", { className: "step-button", type: "button", title: "Increase", textContent: "+" });

    minus.addEventListener("click", () => stepNumber(input, -1));
    plus.addEventListener("click", () => stepNumber(input, 1));
    wrap.append(minus, input, plus);
    return wrap;
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

  function selectedHotelRecord() {
    const hotel = value("hotel").trim().toLowerCase();
    const name = HOTEL_NAMES.find((item) => item.toLowerCase() === hotel);
    return name ? HOTEL_DATA[name] : null;
  }

  function updateRoomList() {
    const record = selectedHotelRecord();
    const rooms = record ? record : DEFAULT_ROOMS;
    renderDatalist("list_ROOM", rooms);
  }

  function buildLists() {
    renderDatalist("hotelList", LISTS.HOTEL);
    Object.keys(LISTS).filter((type) => type !== "HOTEL").forEach((type) => {
      const datalist = el("datalist", { id: `list_${type}` });
      datalist.innerHTML = "";
      document.body.appendChild(datalist);
      renderDatalist(`list_${type}`, LISTS[type]);
    });
    updateRoomList();
  }

  function createTypeSelect(selected = "") {
    const select = el("select", { className: "type" });
    const placeholder = el("option", { value: "", textContent: "" });
    placeholder.selected = !selected;
    placeholder.disabled = true;
    placeholder.hidden = true;
    select.appendChild(placeholder);
    ROW_TYPE_ORDER.forEach((type) => {
      const option = el("option", { value: type, textContent: TYPE_LABELS[type] || type });
      option.selected = type === selected;
      select.appendChild(option);
    });
    return select;
  }

  function addDiscount(container, value = 0, removable = true) {
    const wrap = el("span", { className: "discount-item" });
    const input = el("input", { className: "discount", type: "number", min: "0", max: "100", step: "1", placeholder: "%" });
    input.value = value || "";
    wrap.appendChild(numberStepper(input, true));

    if (removable) {
      const remove = el("button", { className: "discount-remove", type: "button", title: "Remove discount", textContent: "-" });
      remove.addEventListener("click", () => {
        wrap.remove();
        recalc();
      });
      wrap.appendChild(remove);
    }

    container.appendChild(wrap);
  }

  function setupDiscounts(container, data = {}) {
    const values = [data.d1 ?? data.discount ?? 0, data.d2 ?? 0, data.d3 ?? 0, data.d4 ?? 0];
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

  function rowData(tr) {
    return {
      type: tr.querySelector(".type").value,
      item: tr.querySelector(".item").value.trim(),
      from: tr.querySelector(".from").value,
      to: tr.querySelector(".to").value,
      qty: Number(tr.querySelector(".qty").value || 0),
      rate: Number(tr.querySelector(".rate").value || 0),
      discounts: [...tr.querySelectorAll(".discount")].map((input) => Number(input.value || 0)).filter((item) => item > 0),
    };
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
      const fixed = core.parseDate(fixedDate);
      const min = core.parseDate(checkin);
      const max = core.parseDate(checkout);
      const insideStay = fixed && (!min || fixed >= min) && (!max || fixed <= max);
      from.value = insideStay ? fixedDate : "";
      to.value = insideStay ? fixedDate : "";
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

  function isGlobalDateRow(tr) {
    const data = rowData(tr);
    return data.type === "ROOM" || data.type === "MEAL" || core.isGreenTax(data) || isPersonExtra(data);
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
      tr.querySelector(".to").value = fixedDate;
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
    const color = COLORS[select.value];
    select.style.background = color ? color.bg : "";
    select.style.color = color ? color.fg : "";
    select.style.borderColor = color ? color.border : "";
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
    const lockDates = data.type === "DINNER" || (data.type === "TRANSFER" && !isOneWayTransfer(data));
    const allowDiscounts = hasType && core.isDiscountable(data);

    tr.classList.toggle("inactive-row", !hasType);
    tr.querySelectorAll("td").forEach((cell) => cell.classList.remove("muted-cell"));

    item.disabled = !hasType || hideItem;
    from.disabled = !hasType || lockDates;
    to.disabled = !hasType || lockDates;
    nights.disabled = !hasType || hideNights;
    qty.disabled = !hasType;
    rate.disabled = !hasType;
    discountControls.forEach((control) => {
      control.disabled = !allowDiscounts;
    });

    item.closest("td").classList.toggle("muted-cell", hideItem);
    nights.closest("td").classList.toggle("muted-cell", hideNights);
    tr.querySelector(".discounts").classList.toggle("muted-cell", !allowDiscounts);
  }

  function recalc() {
    syncGlobalRows();
    rowsEl.querySelectorAll("tr").forEach(clampRowDates);
    $("nights").value = core.nightsBetween(value("checkin"), value("checkout"));

    const calculated = core.calculateRows(currentRows());
    rowsEl.querySelectorAll("tr").forEach((tr) => {
      const data = rowData(tr);
      if (!data.type) {
        tr.querySelector(".nights").value = "0";
        tr.querySelector(".net").textContent = "0.00";
        updateTypeColor(tr);
        updateRowState(tr);
        return;
      }
      const row = core.calculateRow(data);
      tr.querySelector(".nights").value = row.nights;
      tr.querySelector(".net").textContent = core.money(row.net);
      updateTypeColor(tr);
      updateRowState(tr);
    });

    $("grandTotal").textContent = `$${core.money(calculated.total)}`;
    $("topTotal").value = core.money(calculated.total);
    renderStaySummary();
    renderValidation();
    scheduleDraftSave();
  }

  function validationMessages() {
    const messages = [];
    const checkin = value("checkin");
    const checkout = value("checkout");
    const rows = currentRows();
    const started = value("hotel").trim()
      || checkin
      || checkout
      || value("spo").trim()
      || rows.some((row) => !core.isGreenTax(row) && (row.item || row.from || row.to || row.rate > 0));

    if (!started) return messages;

    if (!value("hotel").trim()) messages.push("Hotel is empty.");
    if (!core.parseDate(checkin) || !core.parseDate(checkout)) messages.push("Stay dates are incomplete.");
    if (core.parseDate(checkin) && core.parseDate(checkout) && core.nightsBetween(checkin, checkout) <= 0) messages.push("Check-out should be after check-in.");

    rows.forEach((row) => {
      const name = row.item || row.type;
      if (!row.item && !core.isGreenTax(row)) messages.push(`${row.type}: item is empty.`);
      if (row.rate <= 0) messages.push(`${name}: rate is empty.`);
      if (row.qty <= 0) messages.push(`${name}: qty is zero.`);
      if (["ROOM", "MEAL", "EXTRA"].includes(row.type) && (!core.parseDate(row.from) || !core.parseDate(row.to))) messages.push(`${name}: dates are incomplete.`);
      if (row.type === "DINNER" && row.item && (!row.from || !row.to)) messages.push(`${name}: dinner date is outside stay dates.`);
    });

    return [...new Set(messages)].slice(0, 8);
  }

  function renderValidation() {
    const panel = $("validationPanel");
    if (!panel) return;
    const messages = validationMessages();
    panel.innerHTML = messages.length
      ? `<div class="validation-card">${messages.map((message) => `<span>${escapeHtml(message)}</span>`).join("")}</div>`
      : "";
  }

  function renderStaySummary() {
    const container = $("staySummary");
    const summaries = core.buildStaySummaries(currentRows()).filter((row) => row.total > 0);

    if (!summaries.length) {
      container.innerHTML = "";
      return;
    }

    const rows = summaries.map((row) => `
      <tr>
        <td>${escapeHtml(row.dates)}</td>
        <td>${escapeHtml(row.room)}</td>
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

  function addRow(data = {}) {
    const tr = el("tr");
    tr.dataset.followGlobal = "0";

    const typeCell = el("td");
    typeCell.appendChild(createTypeSelect(data.type || ""));

    const itemCell = el("td");
    const item = el("input", { className: "item", placeholder: "Choose or type manually", autocomplete: "off" });
    item.value = data.item || "";
    item.setAttribute("list", data.type ? `list_${data.type}` : "");
    itemCell.appendChild(item);

    const fromCell = el("td");
    const from = el("input", { className: "from", inputmode: "numeric", placeholder: "DD.MM.YYYY", autocomplete: "off" });
    from.value = core.formatDate(data.from || "");
    fromCell.appendChild(from);

    const toCell = el("td");
    const to = el("input", { className: "to", inputmode: "numeric", placeholder: "DD.MM.YYYY", autocomplete: "off" });
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
    const rate = el("input", { className: "rate", type: "number", min: "0", step: "0.01" });
    rate.value = data.rate ?? "";
    rateCell.appendChild(rate);

    const discountsCell = el("td", { className: "discounts" });
    setupDiscounts(discountsCell, data);

    const netCell = el("td", { className: "net", textContent: "0.00" });
    const deleteCell = el("td");
    deleteCell.appendChild(el("button", { className: "delete", type: "button", textContent: "x" }));

    [typeCell, itemCell, fromCell, toCell, nightsCell, qtyCell, rateCell, discountsCell, netCell, deleteCell].forEach((cell) => tr.appendChild(cell));
    rowsEl.appendChild(tr);

    const type = tr.querySelector(".type");
    type.addEventListener("change", () => {
      item.value = "";
      item.setAttribute("list", type.value ? `list_${type.value}` : "");
      tr.dataset.followGlobal = isGlobalDateRow(tr) ? "1" : "0";
      applyAutoQty(tr);
      clampRowDates(tr);
      updateRowState(tr);
      groupRowsByType();
      recalc();
    });

    item.addEventListener("input", () => {
      delete item.dataset.previousValue;
      if (isGlobalDateRow(tr)) tr.dataset.followGlobal = "1";
      applyAutoQty(tr);
      clampRowDates(tr);
      updateRowState(tr);
      recalc();
    });
    item.addEventListener("focus", () => prepareItemReselect(item, tr));
    item.addEventListener("click", () => prepareItemReselect(item, tr));
    item.addEventListener("blur", () => {
      restoreItemIfEmpty(item);
      applyAutoQty(tr);
      clampRowDates(tr);
      updateRowState(tr);
      recalc();
    });

    tr.querySelectorAll(".from,.to").forEach((input) => {
      input.addEventListener("input", () => cleanDateInput(input));
      input.addEventListener("blur", () => {
        normalizeDateInput(input);
        tr.dataset.followGlobal = "0";
        clampRowDates(tr);
        recalc();
      });
      input.addEventListener("focus", () => openPicker(input));
      input.addEventListener("click", () => {
        if (!picker || pickerInput !== input) openPicker(input);
      });
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
      recalc();
    });
    tr.querySelectorAll(".qty,.rate").forEach((input) => input.addEventListener("input", recalc));
    tr.querySelector(".discounts").addEventListener("input", recalc);
    tr.querySelector(".delete").addEventListener("click", () => {
      tr.remove();
      recalc();
    });

    tr.dataset.followGlobal = isGlobalDateRow(tr) ? "1" : "0";
    applyAutoQty(tr);
    clampRowDates(tr);
    updateRowState(tr);
    if (data.type) groupRowsByType();
    recalc();
  }

  function createDefaultRows() {
    rowsEl.innerHTML = "";
    addRow({ type: "ROOM", qty: 1 });
    addRow({ type: "MEAL", qty: Number(value("adults") || 0) });
    addRow({ type: "TRANSFER", qty: Number(value("adults") || 0) });
    addRow({ type: "GREEN_TAX", item: "Green Tax", qty: 0, rate: 12 });
  }

  function setCheckoutFromNights() {
    const nights = Number(value("nights") || 0);
    $("checkout").value = value("checkin") && nights > 0 ? core.addDays(value("checkin"), nights) : "";
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

    rowsEl.querySelectorAll("tr").forEach(clampRowDates);
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
      rows: currentRows(),
    };
  }

  function applyPayload(payload) {
    if (!payload) return false;
    suppressDraft = true;
    $("hotel").value = payload.hotel || "";
    $("checkin").value = core.formatDate(payload.checkin || "");
    $("checkout").value = core.formatDate(payload.checkout || "");
    $("adults").value = payload.guests?.adults ?? "0";
    $("children").value = payload.guests?.children ?? "0";
    $("infants").value = payload.guests?.infants ?? "0";
    $("ages").value = payload.guests?.ages || "";
    $("spo").value = payload.spo || "";
    updateRoomList();
    rowsEl.innerHTML = "";
    (Array.isArray(payload.rows) && payload.rows.length ? payload.rows : []).forEach(addRow);
    if (!rowsEl.children.length) createDefaultRows();
    suppressDraft = false;
    recalc();
    return true;
  }

  function calculationEntry() {
    const payload = sharePayload();
    const total = Number(String(value("topTotal") || "0").replace(/,/g, ""));
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
    recalc();
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
    $("shareText").innerHTML = shareHtml(shareText());
    $("shareModal").showModal();
  }

  async function copyShare() {
    const text = shareText();
    const html = `<pre style="font:14px/1.45 Consolas, monospace; white-space:pre-wrap;">${shareHtml(text)}</pre>`;
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
    const hotel = (value("hotel") || "Hotel").replace(/[^a-z0-9]+/gi, "_");
    downloadBlob(`${hotel}_calculation.txt`, text, "text/plain;charset=utf-8");
    toast("Short calculation downloaded");
  }

  function saveCalculation() {
    recalc();
    const entry = calculationEntry();
    storage.saveHistory(entry);
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

  function renderHistory() {
    const list = $("historyList");
    if (!list || !storage) return;
    const rows = historyRows();
    list.innerHTML = rows.length ? rows.map((entry) => `
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
    `).join("") : '<div class="history-empty">No saved calculations yet.</div>';
  }

  function showHistoryModal() {
    renderHistory();
    $("historyModal").showModal();
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
    ["hotel", "checkin", "checkout", "ages", "spo"].forEach((id) => {
      $(id).value = "";
    });
    ["adults", "children", "infants", "nights"].forEach((id) => {
      $(id).value = "0";
    });
    createDefaultRows();
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
    const head = el("div", { className: "calendar-head" });
    const prevYear = el("button", { type: "button", title: "Previous year", textContent: "<<" });
    const prevMonth = el("button", { type: "button", title: "Previous month", textContent: "<" });
    const nextMonth = el("button", { type: "button", title: "Next month", textContent: ">" });
    const nextYear = el("button", { type: "button", title: "Next year", textContent: ">>" });
    const monthSelect = el("select", { className: "calendar-month", title: "Month" });
    const yearInput = el("input", { className: "calendar-year", type: "number", min: "1900", max: "2100", step: "1", title: "Year" });

    MONTHS.forEach((month, index) => {
      const option = el("option", { value: index, textContent: month });
      option.selected = index === pickerMonth.getMonth();
      monthSelect.appendChild(option);
    });
    yearInput.value = pickerMonth.getFullYear();

    prevYear.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      pickerMonth = new Date(pickerMonth.getFullYear() - 1, pickerMonth.getMonth(), 1);
      renderPicker();
    });
    prevMonth.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      pickerMonth = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1, 1);
      renderPicker();
    });
    nextMonth.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      pickerMonth = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 1);
      renderPicker();
    });
    nextYear.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      pickerMonth = new Date(pickerMonth.getFullYear() + 1, pickerMonth.getMonth(), 1);
      renderPicker();
    });
    monthSelect.addEventListener("change", (event) => {
      event.stopPropagation();
      pickerMonth = new Date(pickerMonth.getFullYear(), Number(monthSelect.value), 1);
      renderPicker();
    });
    yearInput.addEventListener("change", (event) => {
      event.stopPropagation();
      const year = Math.max(1900, Math.min(2100, Number(yearInput.value) || new Date().getFullYear()));
      pickerMonth = new Date(year, pickerMonth.getMonth(), 1);
      renderPicker();
    });

    head.append(prevYear, prevMonth, monthSelect, yearInput, nextMonth, nextYear);
    picker.appendChild(head);

    const grid = el("div", { className: "calendar-grid" });
    ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].forEach((day) => grid.appendChild(el("span", { textContent: day })));

    const first = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    for (let index = 0; index < offset; index += 1) grid.appendChild(el("span", { className: "empty" }));

    const row = pickerInput.closest("tr");
    const minDate = pickerInput.id === "checkout" || pickerInput.classList.contains("to")
      ? core.parseDate(row?.querySelector(".from")?.value || value("checkin"))
      : pickerInput.classList.contains("from")
        ? core.parseDate(value("checkin"))
        : null;
    const maxDate = GLOBAL_DATE_IDS.has(pickerInput.id) ? null : core.parseDate(value("checkout"));
    const selected = core.parseDate(pickerInput.value);
    const today = new Date();
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

  function wireEvents() {
    $("hotel").addEventListener("input", () => {
      updateRoomList();
      recalc();
    });

    ["checkin", "checkout"].forEach((id) => {
      const input = $(id);
      input.addEventListener("input", () => cleanDateInput(input));
      input.addEventListener("blur", () => handleGlobalDate(input));
      input.addEventListener("focus", () => openPicker(input));
      input.addEventListener("click", () => {
        if (!picker || pickerInput !== input) openPicker(input);
      });
      input.addEventListener("keydown", (event) => handleDateKeydown(input, event, () => handleGlobalDate(input)));
    });

    $("nights").addEventListener("input", setCheckoutFromNights);
    ["adults", "children", "infants"].forEach((id) => {
      $(id).addEventListener("input", () => {
        rowsEl.querySelectorAll("tr").forEach(applyAutoQty);
        recalc();
      });
    });
    ["nights", "adults", "children", "infants"].forEach((id) => {
      const input = $(id);
      input.parentNode.appendChild(numberStepper(input));
    });
    ["ages", "spo"].forEach((id) => $(id).addEventListener("input", recalc));

    $("addRow").addEventListener("click", () => addRow());
    $("clearAll").addEventListener("click", clearAll);
    $("saveCalculation").addEventListener("click", saveCalculation);
    $("showHistory").addEventListener("click", showHistoryModal);
    $("showShare").addEventListener("click", showShare);
    $("copyShare").addEventListener("click", copyShare);
    $("downloadShare").addEventListener("click", downloadShare);
    $("downloadShareModal").addEventListener("click", downloadShare);
    $("closeShare").addEventListener("click", () => $("shareModal").close());
    $("closeHistory").addEventListener("click", () => $("historyModal").close());
    $("historySearch").addEventListener("input", renderHistory);
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
        applyPayload(entry.payload);
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
    });
    window.addEventListener("resize", closePicker);
    window.addEventListener("scroll", closePicker, true);
  }

  buildLists();
  wireEvents();
  $("appVersion").textContent = `v${APP_VERSION}`;
  if (!restoreDraft()) createDefaultRows();
  recalc();
  window.HotelCalculatorApp = { addRow, recalc, shareText, saveCalculation };
})();
