(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HotelBookingRequest = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const escape = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const lines = (value) => escape(value).replace(/\r?\n/g, "<br>");
  const label = (value) => String(value || "").replace(/\s*-\s*(Adult|Child|Infant)$/i, "");
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
      if (!seen.has(key)) guests.push({ name, dob, room: "" });
      seen.add(key);
    }
    if (!guests.length) guests.push({ name: "", dob: "", room: "" });
    const flights = [...source.matchAll(/Flight details\s*:\s*([^\r\n]+)/gi)].map((match) => match[1].trim());
    const remarks = /Remarks\s*:?\s*\r?\n([\s\S]*?)(?=\r?\n\s*(?:SPO code|Room quotation|Hotel)\s*:|$)/i.exec(source)?.[1]?.trim() || "";
    return {
      hotel: payload.hotel || "", subject: `Booking request | ${payload.hotel || "Hotel"} | ${payload.checkin || ""} - ${payload.checkout || ""}`,
      guests, periods, transfer: service("TRANSFER"), arrival: flights[0] || "", departure: flights[1] || "", remarks,
      greeting: "Dear Reservations Team,\nPlease accept and confirm the following reservation:",
      closing: "Please confirm availability and provide the invoice.\n\nWith best regards,",
    };
  }
  function date(value) {
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value || "");
    return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
  }
  function captureSource(source) {
    const imported = create({ rows: [] }, source);
    return [
      ...imported.guests.filter((guest) => guest.name).map((guest) => `${guest.name}${guest.dob ? ` DOB ${guest.dob}` : ""}`),
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
    const cell = 'style="border:1px solid #ccd3dc;padding:8px;text-align:left;vertical-align:top;background:#ffffff;color:#172338;font:10pt Arial,sans-serif;text-transform:none;white-space:normal;"';
    let body = `<p>${lines(draft.greeting)}</p><p><b>Hotel: ${escape(draft.hotel)}</b></p>`;
    const rooms = [...new Set(draft.periods.map((period) => period.room))].sort((a, b) => Number(a) - Number(b));
    rooms.forEach((room) => {
      body += `<p><b>Room ${escape(room)}</b><br>${draft.guests.filter((guest) => guest.room === room).map((guest) => `${escape(guest.name)}${guest.dob ? ` &middot; DOB ${escape(guest.dob)}` : ""}`).join("<br>")}</p>`;
      body += '<table cellpadding="0" cellspacing="0" width="100%" style="width:100%;min-width:0;table-layout:fixed;border-collapse:collapse;font:10pt Arial,sans-serif;"><tr>';
      body += ["Check-in", "Check-out", "Villa category", "Meal plan", "Drinks"].map((title) => `<th ${cell}><b>${title}</b></th>`).join("") + "</tr>";
      draft.periods.filter((period) => period.room === room).sort((a, b) => core.parseDate(a.from) - core.parseDate(b.from)).forEach((period) => {
        body += `<tr>${[period.from, period.to, period.category, period.meal, period.drinks].map((value) => `<td ${cell}>${escape(value)}</td>`).join("")}</tr>`;
      });
      body += "</table>";
    });
    const unassigned = draft.guests.filter((guest) => !rooms.includes(guest.room) && guest.name.trim());
    if (unassigned.length) body += `<p><b>Guests - room assignment pending:</b><br>${unassigned.map((guest) => escape(guest.name)).join("<br>")}</p>`;
    for (const [title, value] of [["Transfer", draft.transfer], ["Arrival flight", draft.arrival], ["Departure flight", draft.departure], ["Remarks", draft.remarks]]) {
      if (value) body += `<p><b>${title}:</b> ${lines(value)}</p>`;
    }
    body += `<p><b>Calculation (USD)</b></p><div>${shareHtml(calculation).replace(/\n/g, "<br>")}</div><p>${lines(draft.closing)}</p>`;
    return `<div style="font:10pt/1.45 Arial,sans-serif;color:#172338;">${body}</div>`;
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
      field(header, "Hotel", draft, "hotel");
      field(header, "Opening", draft, "greeting", "textarea");
      const guests = section("Guests");
      draft.guests.forEach((guest, index) => {
        const row = document.createElement("div"); row.className = "booking-guest-row";
        field(row, "Title / full name", guest, "name"); field(row, "Date of birth", guest, "dob"); field(row, "Room", guest, "room", "number");
        button(row, "Remove", () => { draft.guests.splice(index, 1); persist(); render(); });
        guests.append(row);
      });
      button(guests, "+ Guest", () => { draft.guests.push({ name: "", dob: "", room: "" }); persist(); render(); });
      const stays = section("Accommodation");
      draft.periods.forEach((period, index) => {
        const row = document.createElement("div"); row.className = "booking-period-row";
        for (const [title, key] of [["Room", "room"], ["Check-in", "from"], ["Check-out", "to"], ["Villa category", "category"], ["Meal", "meal"], ["Drinks", "drinks"]]) field(row, title, period, key, key === "room" ? "number" : "text");
        button(row, "Remove", () => { draft.periods.splice(index, 1); persist(); render(); });
        stays.append(row);
      });
      button(stays, "+ Stay period", () => { draft.periods.push({ room: "1", from: "", to: "", category: "", meal: "", drinks: "" }); persist(); render(); });
      const details = section("Services & Notes");
      for (const [title, key] of [["Transfer", "transfer"], ["Arrival flight", "arrival"], ["Departure flight", "departure"], ["Remarks", "remarks"], ["Closing", "closing"]]) field(details, title, draft, key, ["remarks", "closing"].includes(key) ? "textarea" : "text");
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
      return { calculation, issues, html: html(draft, calculation, shareHtml, core) };
    }
    function show(isPreview) {
      preview.innerHTML = content().html;
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
    document.getElementById("bookingCopySubject").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(draft.subject); toast("Subject copied"); } catch { toast("Clipboard unavailable. Select and copy the subject field."); }
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
