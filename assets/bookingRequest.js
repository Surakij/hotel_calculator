(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HotelBookingRequest = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const escape = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const lines = (value) => escape(value).replace(/\r?\n/g, "<br>");
  const label = (value) => String(value || "").replace(/\s*-\s*(Adult|Child|Infant)$/i, "");
  const guestKind = (name) => /^\s*(CHD|INF)\b/i.test(name || "") ? (/^\s*INF\b/i.test(name || "") ? "Infant" : "Child") : "Adult";
  const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
  const guestSummary = (guests) => ["Adult", "Child", "Infant"].map((kind) => [guests.filter((guest) => guestKind(guest.name) === kind).length, kind]).filter(([count]) => count).map(([count, kind]) => plural(count, kind)).join(", ");
  function create(payload, source = "") {
    const rows = payload.rows || [];
    const service = (type, key = "item", period) => [...new Set(rows.filter((row) => row.type === type && (!period || !row.from || !row.to || (date(row.from) < date(period.to) && date(row.to) > date(period.from)))).map((row) => label(row[key])).filter(Boolean))].join(" / ");
    const roomKeys = new Map();
    const periods = [];
    rows.filter((row) => row.type === "ROOM").forEach((row, index) => {
      const key = row.roomKey || `row-${index}`;
      if (!roomKeys.has(key)) roomKeys.set(key, roomKeys.size + 1);
      const qty = Math.max(1, Math.floor(Number(row.qty) || 1));
      for (let unit = 0; unit < qty; unit++) {
        const unitKey = unit ? `${key}-unit-${unit}` : key;
        if (!roomKeys.has(unitKey)) roomKeys.set(unitKey, roomKeys.size + 1);
        periods.push({ room: String(roomKeys.get(unitKey)), from: row.from || "", to: row.to || "", category: row.item || "", meal: service("MEAL", "item", row), drinks: service("MEAL", "beveragePackage", row) });
      }
    });
    const guests = [];
    const seen = new Set();
    for (const match of source.matchAll(/(?:^|\n|Guest name\s*:)\s*(MRS|MR|MS|MISS|CHD|INF)\s+([^\r\n]+)/gi)) {
      const dob = /\bDOB\s+(\d{2}\.\d{2}\.\d{4})/i.exec(match[2])?.[1] || "";
      const name = `${match[1].toUpperCase()} ${match[2].split(/\s+(?:DOB|PN|PASSPORT)\b/i)[0].trim()}`;
      const key = `${name}|${dob}`;
      const passport = /\b(?:PN|PASSPORT(?:\s+NO\.?)?)\s*([A-Z0-9 ]+?)(?=\s+TILL\b|$)/i.exec(match[2])?.[1]?.trim() || "";
      const validTill = /\bTILL\s+(\d{2}\.\d{2}\.\d{4})/i.exec(match[2])?.[1] || "";
      if (!seen.has(key)) guests.push({ name, dob, passport, validTill, room: "" });
      seen.add(key);
    }
    if (!guests.length) guests.push({ name: "", dob: "", passport: "", validTill: "", room: "" });
    const flights = [...source.matchAll(/Flight details\s*:\s*([^\r\n]+)/gi)].map((match) => match[1].trim());
    const remarks = /Remarks[ \t]*:?[ \t]*\r?\n([\s\S]*?)(?=\r?\n[ \t]*(?:SPO code|Room quotation|Hotel)[ \t]*:|$)/i.exec(source)?.[1]?.trim() || "";
    if (new Set(periods.map((period) => period.room)).size === 1) guests.forEach((guest) => { guest.room = periods[0]?.room || "1"; });
    return {
      hotel: payload.hotel || "", subject: `Booking request | ${payload.hotel || "Hotel"} | ${payload.checkin || ""} - ${payload.checkout || ""}`,
      guests, periods, transfer: service("TRANSFER"), arrival: flights[0] || "", departure: flights[1] || "", remarks,
      meal: service("MEAL"), spo: payload.spo || "", checkin: payload.checkin || "", checkout: payload.checkout || "",
      greeting: "Please accept and confirm our new reservation:",
      closing: "If the exact category is unavailable, please advise the closest alternative.",
    };
  }
  function date(value) {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value || "");
    return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
  }
  function captureSource(source) {
    const imported = create({ rows: [] }, source);
    return [
      ...imported.guests.filter((guest) => guest.name).map((guest) => `${guest.name}${guest.dob ? ` DOB ${guest.dob}` : ""}${guest.passport ? ` PN ${guest.passport}` : ""}${guest.validTill ? ` TILL ${guest.validTill}` : ""}`),
      `Flight details: ${imported.arrival || "TBA"}`,
      `Flight details: ${imported.departure || "TBA"}`,
      `Remarks:\n${imported.remarks}\nSPO code:`,
    ].join("\n");
  }
  function warnings(draft, payload, core) {
    const result = [];
    if (!draft.hotel.trim()) result.push("Hotel is missing.");
    if (!draft.periods.length) result.push("No accommodation periods.");
    if (draft.guests.some((guest) => !guest.name.trim() || !draft.periods.some((period) => period.room === guest.room))) result.push("Check guest names and assign every guest to a room.");
    const expected = ["adults", "children", "infants"].reduce((sum, key) => sum + Number(payload.guests?.[key] || 0), 0);
    if (draft.guests.filter((guest) => guest.name.trim()).length !== expected) result.push("Guest count differs from the calculator.");
    if (draft.periods.some((period) => !period.category.trim() || !period.room || !core.parseDate(period.from) || !core.parseDate(period.to) || core.nightsBetween(period.from, period.to) <= 0)) result.push("Check room numbers, categories and stay dates.");
    for (const room of new Set(draft.periods.map((period) => period.room))) {
      const periods = draft.periods.filter((period) => period.room === room).sort((a, b) => core.parseDate(a.from) - core.parseDate(b.from));
      if (periods.some((period, index) => index && core.parseDate(period.from) < core.parseDate(periods[index - 1].to))) result.push(`Room ${room}: stay periods overlap.`);
      if (!draft.guests.some((guest) => guest.room === room && guest.name.trim())) result.push(`Room ${room}: no guests assigned.`);
    }
    if ((payload.rows || []).some((row) => !Number(row.rate) && !row.rateFormula && row.type !== "GREEN_TAX")) result.push("Some calculator rates are empty or zero. Check the calculation.");
    return [...new Set(result)];
  }
  function html(draft, calculation, shareHtml, core) {
    const payload = arguments[4] || { rows: [] };
    const calculated = core.calculateRows(payload.rows || []);
    const cell = 'style="border:1px solid #9fc4e5;padding:4px 7px;text-align:left;vertical-align:top;background:#ffffff;color:#172338;font:9pt Arial,sans-serif;text-transform:none;white-space:normal;"';
    const head = 'style="border:1px solid #78add7;padding:4px 7px;text-align:left;background:#dceefa;color:#092e61;font:bold 9pt Arial,sans-serif;"';
    const band = (title, right = "", colspan = 6) => `<tr><td colspan="${colspan}" style="border:1px solid #397cae;padding:4px 7px;background:#397cae;color:#ffffff;font:bold 9pt Arial,sans-serif;">${escape(title)}${right ? `<span style="float:right;">${escape(right)}</span>` : ""}</td></tr>`;
    const tableStart = '<table cellpadding="0" cellspacing="0" width="780" style="width:780px;max-width:100%;min-width:0;table-layout:fixed;border-collapse:collapse;font:9pt Arial,sans-serif;margin:0 0 5px;">';
    const roomNights = (period) => core.nightsBetween(period.from, period.to);
    let body = `<p style="margin:0 0 5px;">${lines(draft.greeting)}</p>`;
    body += `${tableStart}<tr>${["Hotel", "Stay dates", "Nights", "Guests"].map((title) => `<th ${head}>${title}</th>`).join("")}</tr>`;
    body += `<tr>${[draft.hotel, `${draft.checkin} - ${draft.checkout}`, `${core.nightsBetween(draft.checkin, draft.checkout)} Nights`, guestSummary(draft.guests)].map((value) => `<td ${cell}><b>${escape(value)}</b></td>`).join("")}</tr></table>`;
    const rooms = [...new Set(draft.periods.map((period) => period.room))].sort((a, b) => Number(a) - Number(b));
    const showPassport = draft.guests.some((guest) => guest.passport || guest.validTill);
    const showRoom = rooms.length > 1;
    const guestColumns = [["#", (_, index) => index + 1], ["Name", (guest) => guest.name], ["DOB", (guest) => guest.dob]];
    if (showPassport) guestColumns.push(["Passport No.", (guest) => guest.passport], ["Valid till", (guest) => guest.validTill]);
    if (showRoom) guestColumns.push(["Room", (guest) => guest.room]);
    body += `${tableStart}${band("Guest details", "", guestColumns.length)}<tr>${guestColumns.map(([title]) => `<th ${head}>${title}</th>`).join("")}</tr>`;
    draft.guests.filter((guest) => guest.name).forEach((guest, index) => {
      body += `<tr>${guestColumns.map(([, getter]) => `<td ${cell}>${escape(getter(guest, index))}</td>`).join("")}</tr>`;
    });
    body += "</table>";
    body += `${tableStart}${band("Reservation details", "", 4)}`;
    const detailRows = [
      ["Villa category", draft.periods.length > 1 ? "Split stay (see below)" : draft.periods[0]?.category || "", "Arrival flight", draft.arrival],
      ["Meal plan", draft.meal, "Departure flight", draft.departure],
      ["Transfer", draft.transfer, "SPO code", draft.spo],
      ["Remarks", draft.remarks, "", ""],
    ].filter((values) => values.slice(1).some(Boolean));
    for (const [leftTitle, leftValue, rightTitle, rightValue] of detailRows) body += `<tr><th ${head}>${escape(leftTitle)}</th><td ${cell}>${lines(leftValue)}</td><th ${head}>${escape(rightTitle)}</th><td ${cell}>${lines(rightValue)}</td></tr>`;
    body += "</table>";
    if (draft.periods.length > 1) {
      body += `${tableStart}${band("Split stay details", "", 4)}<tr><th ${head}>Period</th><th ${head}>Nights</th><th ${head}>Room / Villa category</th><th ${head}>Occupancy</th></tr>`;
      rooms.forEach((room) => {
        const occupancy = guestSummary(draft.guests.filter((guest) => guest.room === room));
        draft.periods.filter((period) => period.room === room).sort((a, b) => core.parseDate(a.from) - core.parseDate(b.from)).forEach((period) => {
          body += `<tr><td ${cell}>${escape(period.from)} - ${escape(period.to)}</td><td ${cell}>${roomNights(period)}</td><td ${cell}>${escape(period.category)}</td><td ${cell}>${escape(occupancy)}</td></tr>`;
        });
      });
      body += "</table>";
    }
    body += `${tableStart}${band("Quotation summary (USD)", draft.spo ? `SPO: ${draft.spo}` : "", 2)}<tr><th ${head}>Item</th><th ${head} style="width:125px;text-align:right;">Amount (USD)</th></tr>`;
    calculated.rows.filter((row) => row.net > 0).forEach((row) => {
      const period = row.from && row.to ? `${String(row.from).slice(0, 5)} - ${String(row.to).slice(0, 5)}: ` : "";
      body += `<tr><td ${cell}>${escape(`${period}${row.item}${row.nights ? ` (${row.nights} Nights)` : ""}`)}</td><td ${cell} style="width:125px;text-align:right;">${escape(core.money(row.net))}</td></tr>`;
    });
    body += `<tr><td ${head} style="font-size:10pt;">TOTAL (USD)</td><td ${head} style="width:125px;text-align:right;font-size:10pt;">${escape(core.money(calculated.total))}</td></tr></table>`;
    body += `<p style="margin:5px 0 0;padding:5px 7px;border:1px solid #9fc4e5;background:#edf7fd;">${lines(draft.closing)}</p>`;
    return `<div style="width:780px;max-width:100%;font:9pt/1.25 Arial,sans-serif;color:#172338;">${body}</div>`;
  }
  function mount({ getPayload, getSource, getDraft, saveDraft, core, shareHtml, toast }) {
    const dialog = document.getElementById("bookingModal");
    let draft;
    let payload;
    let signature;
    let accommodationSignature;
    const payloadSignature = (value) => JSON.stringify([value.hotel, value.checkin, value.checkout, value.guests, value.rows]);
    const editor = document.getElementById("bookingEditor");
    const preview = document.getElementById("bookingPreview");
    const warningBox = document.getElementById("bookingWarnings");
    function persist() { saveDraft(JSON.parse(JSON.stringify({ draft, signature, accommodationSignature }))); }
    function field(parent, title, obj, key, type = "text") {
      const labelNode = document.createElement("label");
      labelNode.className = `booking-field booking-field-${key}`;
      labelNode.textContent = title;
      const input = document.createElement(type === "textarea" ? "textarea" : "input");
      if (type !== "textarea") input.type = type;
      if (type === "number") { input.min = "1"; input.step = "1"; }
      input.value = obj[key] || "";
      input.addEventListener("input", () => { obj[key] = input.value; persist(); });
      labelNode.append(input);
      parent.append(labelNode);
    }
    function button(parent, title, action) {
      const node = document.createElement("button");
      node.type = "button";
      node.textContent = title;
      if (title === "Remove") { node.textContent = "\u00d7"; node.title = "Remove row"; node.setAttribute("aria-label", "Remove row"); node.className = "booking-remove"; }
      node.addEventListener("click", action);
      parent.append(node);
      return node;
    }
    function section(title) {
      const node = document.createElement("section");
      node.className = `booking-section booking-section-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
      const heading = document.createElement("h3");
      heading.textContent = title;
      node.append(heading);
      editor.append(node);
      return node;
    }
    function render() {
      editor.replaceChildren();
      const header = section("Request");
      field(header, "Subject", draft, "subject");
      const overview = document.createElement("div"); overview.className = "booking-overview-grid";
      field(overview, "Hotel", draft, "hotel"); field(overview, "Check-in", draft, "checkin"); field(overview, "Check-out", draft, "checkout");
      field(overview, "Meal plan", draft, "meal"); field(overview, "Transfer", draft, "transfer"); field(overview, "SPO code", draft, "spo");
      header.append(overview);
      field(header, "Opening", draft, "greeting", "textarea");
      const guests = section("Guests");
      draft.guests.forEach((guest, index) => {
        const row = document.createElement("div"); row.className = "booking-guest-row";
        field(row, "Title / full name", guest, "name"); field(row, "Date of birth", guest, "dob"); field(row, "Passport No.", guest, "passport"); field(row, "Valid till", guest, "validTill"); field(row, "Room", guest, "room", "number");
        button(row, "Remove", () => { draft.guests.splice(index, 1); persist(); render(); });
        guests.append(row);
      });
      button(guests, "+ Guest", () => { draft.guests.push({ name: "", dob: "", passport: "", validTill: "", room: "" }); persist(); render(); });
      const stays = section("Accommodation");
      draft.periods.forEach((period, index) => {
        const row = document.createElement("div"); row.className = "booking-period-row";
        for (const [title, key] of [["Room", "room"], ["Check-in", "from"], ["Check-out", "to"], ["Villa category", "category"], ["Meal", "meal"], ["Drinks", "drinks"]]) field(row, title, period, key, key === "room" ? "number" : "text");
        button(row, "Remove", () => { draft.periods.splice(index, 1); persist(); render(); });
        stays.append(row);
      });
      button(stays, "+ Stay period", () => { draft.periods.push({ room: "1", from: "", to: "", category: "", meal: "", drinks: "" }); persist(); render(); });
      const details = section("Services & Notes");
      const services = document.createElement("div"); services.className = "booking-overview-grid";
      for (const [title, key] of [["Arrival flight", "arrival"], ["Departure flight", "departure"]]) field(services, title, draft, key);
      details.append(services);
      for (const [title, key] of [["Remarks", "remarks"], ["Closing note", "closing"]]) field(details, title, draft, key, "textarea");
      show(false);
    }
    function content() {
      payload = getPayload();
      const calculation = core.buildShareText(payload);
      const issues = warnings(draft, payload, core);
      if (signature !== payloadSignature(payload)) issues.unshift("Calculator data changed. Check this request or reload calculator data.");
      if (accommodationSignature !== JSON.stringify(draft.periods.map(({ room, ...period }) => period))) issues.push("Accommodation was edited in the request. The calculation has not changed; reconcile it in the calculator before sending.");
      if (!calculation) issues.push("Calculation contains invalid values. Correct them before copying.");
      warningBox.textContent = issues.join("\n");
      warningBox.hidden = !issues.length;
      return { calculation, issues, html: html(draft, calculation, shareHtml, core, payload) };
    }
    function show(isPreview) {
      preview.innerHTML = content().html;
      dialog.classList.toggle("booking-preview-mode", isPreview);
      editor.hidden = isPreview;
      preview.hidden = !isPreview;
      document.getElementById("bookingEditTab").setAttribute("aria-selected", String(!isPreview));
      document.getElementById("bookingPreviewTab").setAttribute("aria-selected", String(isPreview));
    }
    document.getElementById("showBooking").addEventListener("click", () => {
      payload = getPayload();
      const saved = getDraft();
      draft = saved?.draft ? JSON.parse(JSON.stringify(saved.draft)) : create(payload, getSource());
      signature = saved?.signature || payloadSignature(payload);
      accommodationSignature = saved?.accommodationSignature || JSON.stringify(draft.periods.map(({ room, ...period }) => period));
      render(); dialog.showModal();
    });
    document.getElementById("closeBooking").addEventListener("click", () => dialog.close());
    document.getElementById("bookingEditTab").addEventListener("click", () => show(false));
    document.getElementById("bookingPreviewTab").addEventListener("click", () => show(true));
    document.getElementById("bookingReload").addEventListener("click", () => {
      if (!window.confirm("Replace request edits with current calculator data?")) return;
      payload = getPayload(); draft = create(payload, getSource()); signature = payloadSignature(payload); accommodationSignature = JSON.stringify(draft.periods.map(({ room, ...period }) => period)); persist(); render();
    });
    document.getElementById("bookingCopy").addEventListener("click", async () => {
      const result = content(); show(true);
      if (!result.calculation) return;
      if (result.issues.length && !window.confirm("The request has warnings. Copy it anyway?")) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([result.html], { type: "text/html" }), "text/plain": new Blob([preview.innerText], { type: "text/plain" }) })]);
        toast("Booking request copied for Outlook");
      } catch {
        const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(preview); selection.removeAllRanges(); selection.addRange(range);
        toast("Clipboard unavailable. Press Ctrl+C to copy the selected request.");
      }
    });
  }
  return { create, captureSource, warnings, html, mount };
});
