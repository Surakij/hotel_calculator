(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HotelBookingRequest = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const escape = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
  const lines = (value) => escape(value).replace(/\r?\n/g, "<br>");
  const label = (value) => String(value || "").replace(/\s*-\s*(Adult|Child|Infant)$/i, "");
  const guestKind = (name) => /^\s*(CHD|INF)\b/i.test(name || "") ? (/^\s*INF\b/i.test(name || "") ? "Infant" : "Child") : "Adult";
  const plural = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;
  const cleanRemarks = (value) => String(value || "").split(/(?:^|\r?\n)[ \t]*(?:SPO code|Room quotation|Hotel)[ \t]*:/i)[0].trim();
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
    const remarks = cleanRemarks(/Remarks[ \t]*:?[ \t]*\r?\n([\s\S]*?)(?=\r?\n[ \t]*(?:SPO code|Room quotation|Hotel)[ \t]*:|$)/i.exec(source)?.[1]);
    if (new Set(periods.map((period) => period.room)).size === 1) guests.forEach((guest) => { guest.room = periods[0]?.room || "1"; });
    return {
      hotel: payload.hotel || "",
      guests, periods, transfer: service("TRANSFER"), arrival: flights[0] || "", departure: flights[1] || "", remarks,
      meal: service("MEAL"), spo: payload.spo || "", checkin: payload.checkin || "", checkout: payload.checkout || "",
      greeting: "",
      closing: "",
      signature: "",
      textColor: "#003366",
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
  function isSequentialStay(draft, core) {
    if (draft.periods.length < 2) return false;
    const start = core.parseDate(draft.checkin);
    const end = core.parseDate(draft.checkout);
    if (!start || !end || end <= start) return false;
    const periods = draft.periods.map((period) => ({ from: core.parseDate(period.from), to: core.parseDate(period.to) }));
    if (periods.some((period) => !period.from || !period.to || period.to <= period.from)) return false;
    periods.sort((a, b) => a.from - b.from);
    return +periods[0].from === +start && +periods.at(-1).to === +end
      && periods.every((period, index) => !index || +period.from === +periods[index - 1].to);
  }
  function warnings(draft, payload, core) {
    const result = [];
    const sharedStay = isSequentialStay(draft, core);
    if (!draft.hotel.trim()) result.push("Hotel is missing.");
    if (!core.parseDate(draft.checkin) || !core.parseDate(draft.checkout) || core.nightsBetween(draft.checkin, draft.checkout) <= 0) result.push("Check arrival and departure dates.");
    if (!draft.periods.length) result.push("No accommodation periods.");
    if (sharedStay) {
      if (draft.guests.some((guest) => !guest.name.trim())) result.push("Check guest names.");
    } else if (draft.guests.some((guest) => !guest.name.trim() || !draft.periods.some((period) => period.room === guest.room))) result.push("Check guest names and assign every guest to a room.");
    const expected = ["adults", "children", "infants"].reduce((sum, key) => sum + Number(payload.guests?.[key] || 0), 0);
    if (draft.guests.filter((guest) => guest.name.trim()).length !== expected) result.push("Guest count differs from the calculator.");
    if (draft.periods.some((period) => !period.category.trim() || !period.room || !core.parseDate(period.from) || !core.parseDate(period.to) || core.nightsBetween(period.from, period.to) <= 0)) result.push("Check room numbers, categories and stay dates.");
    for (const room of new Set(draft.periods.map((period) => period.room))) {
      const periods = draft.periods.filter((period) => period.room === room).sort((a, b) => core.parseDate(a.from) - core.parseDate(b.from));
      if (periods.some((period, index) => index && core.parseDate(period.from) < core.parseDate(periods[index - 1].to))) result.push(`Room ${room}: stay periods overlap.`);
      if (!sharedStay && !draft.guests.some((guest) => guest.room === room && guest.name.trim())) result.push(`Room ${room}: no guests assigned.`);
    }
    if ((payload.rows || []).some((row) => !Number(row.rate) && !row.rateFormula && row.type !== "GREEN_TAX")) result.push("Some calculator rates are empty or zero. Check the calculation.");
    return [...new Set(result)];
  }
  function html(draft, calculation, shareHtml, core, payload = { rows: [] }, editable = false) {
    const color = /^#[0-9a-f]{6}$/i.test(draft.textColor || "") ? draft.textColor : "#003366";
    const font = `font:11pt/1.2 Calibri,Arial,sans-serif;color:${color};`;
    const field = (path, value, title = path) => editable ? `<span contenteditable="plaintext-only" role="textbox" aria-label="${escape(title)}" data-booking-field="${escape(path)}" data-placeholder="${escape(title)}">${lines(value)}</span>` : lines(value);
    const calculated = core.calculateRows(payload.rows || []);
    const cell = `style="border:1px solid #bdd1e1;padding:3px 6px;height:auto;text-align:left;vertical-align:top;background:#ffffff;${font}white-space:normal;overflow-wrap:anywhere;"`;
    const head = `style="border:1px solid #bdd1e1;padding:3px 6px;height:auto;text-transform:none;text-align:left;vertical-align:top;background:#edf5fb;${font}font-weight:bold;white-space:normal;"`;
    const tableStart = (widths = [18, 32, 18, 32], className = "") => `<table${className ? ` class="${className}"` : ""} cellpadding="0" cellspacing="0" width="720" style="width:720px;max-width:100%;min-width:0;table-layout:fixed;border-collapse:collapse;${font}margin:0;"><colgroup>${widths.map((width) => `<col style="width:${width}%">`).join("")}</colgroup>`;
    const roomNights = (period) => core.nightsBetween(period.from, period.to);
    const rooms = [...new Set(draft.periods.map((period) => period.room))].sort((a, b) => Number(a) - Number(b));
    const guestRow = (guest) => {
      const path = `guests.${draft.guests.indexOf(guest)}`;
      return `<tr><td ${cell}><b>${field(`${path}.name`, guest.name, "Guest name")}</b></td><td ${cell}>${field(`${path}.dob`, guest.dob, "Date of birth")}</td><td ${cell}>${field(`${path}.passport`, guest.passport, "Passport")}</td><td ${cell}>${field(`${path}.validTill`, guest.validTill, "Valid till")}</td></tr>`;
    };
    const guestGroups = rooms.length > 1 && !isSequentialStay(draft, core) ? [...rooms, ...new Set(draft.guests.filter((guest) => !rooms.includes(guest.room)).map((guest) => guest.room))] : [null];
    const guestRows = guestGroups.map((room) => {
      const guests = draft.guests.filter((guest) => (guest.name || editable) && (room === null || guest.room === room));
      return guests.length ? `${room !== null ? `<tr><th colspan="4" ${head}>${room ? `Room ${escape(room)}` : "Unassigned guests"}</th></tr>` : ""}${guests.map(guestRow).join("")}` : "";
    }).join("");
    const stayLines = rooms.flatMap((room) => draft.periods.filter((period) => period.room === room)
      .sort((a, b) => core.parseDate(a.from) - core.parseDate(b.from))
      .map((period) => {
        const path = `periods.${draft.periods.indexOf(period)}`;
        return `${rooms.length > 1 ? `<b>Room ${escape(room)}:</b> ` : ""}${field(`${path}.from`, period.from, "Stay from")} - ${field(`${path}.to`, period.to, "Stay to")} &middot; ${field(`${path}.category`, period.category, "Villa category")} &middot; ${roomNights(period)} Nights${period.meal && period.meal !== draft.meal ? ` &middot; ${escape(period.meal)}` : ""}${period.drinks ? ` + ${escape(period.drinks)}` : ""}`;
      })).join("<br>");
    const greenTax = calculated.rows.find((row) => core.isGreenTax(row));
    const handling = greenTax ? "Maldives Green Tax" : "";
    const shortShare = core.buildShareText(payload).split("\n");
    const quotation = shortShare.slice(shortShare.indexOf("") + 1).join("\n");
    const calculationRows = shareHtml(quotation).replaceAll("\n", "<br>");
    let body = draft.greeting || editable ? `<div style="margin:0 0 4px;line-height:1.25;">${field("greeting", draft.greeting, "Opening")}</div>` : "";
    body += `${tableStart()}<tr><td colspan="4" style="border:1px solid #bdd1e1;padding:5px 6px;background:#dceefa;${font}font-weight:bold;">${field("hotel", draft.hotel, "Hotel")}</td></tr></table>`;
    body += `${tableStart([40, 20, 20, 20], "booking-guest-table")}<thead><tr>${["Guest name", "DOB", "Passport", "Valid till"].map((title) => `<th scope="col" ${head}>${title}</th>`).join("")}</tr></thead><tbody>${guestRows}</tbody></table>${tableStart()}`;
    const row = (title, value, rightTitle = "", rightValue = "") => `<tr><th ${head}>${escape(title)}</th><td ${cell}${rightTitle ? "" : ' colspan="3"'}>${value || ""}</td>${rightTitle ? `<th ${head}>${escape(rightTitle)}</th><td ${cell}>${rightValue || ""}</td>` : ""}</tr>`;
    body += row("Guests", escape(guestSummary(draft.guests.filter((guest) => guest.name.trim()))), "Length of stay", `${core.nightsBetween(draft.checkin, draft.checkout)} Nights`);
    body += row("Arrival date", field("checkin", draft.checkin, "Check-in"), "Flight details", field("arrival", draft.arrival || "TBA", "Arrival flight"));
    body += row("Departure date", field("checkout", draft.checkout, "Check-out"), "Flight details", field("departure", draft.departure || "TBA", "Departure flight"));
    body += row("Villa category", draft.periods.length > 1 ? stayLines : `${field("periods.0.category", draft.periods[0]?.category || "", "Villa category")}${draft.periods[0]?.drinks ? ` + ${escape(draft.periods[0].drinks)}` : ""}`);
    if (draft.meal || editable) body += row("Meal plan", field("meal", draft.meal, "Meal plan"));
    if (handling) body += row("Handling fee", escape(handling));
    if (draft.transfer || editable) body += row("Transfer", field("transfer", draft.transfer, "Transfer"));
    if (draft.remarks || editable) body += row("Remarks", field("remarks", draft.remarks, "Remarks"));
    if (draft.spo || editable) body += row("SPO code", field("spo", draft.spo, "SPO code"));
    body += row("Room quotation", calculationRows);
    body += "</table>";
    if (draft.closing || editable) body += `<table width="720" cellpadding="0" cellspacing="0" style="width:720px;max-width:100%;min-width:0;border-collapse:collapse;table-layout:fixed;"><tr><td style="padding:4px 6px;background:#edf7fd;${font}">${field("closing", draft.closing, "Closing note")}</td></tr></table>`;
    if (draft.signature || editable) body += `<div style="margin-top:8px;${font}">${field("signature", draft.signature, "Signature")}</div>`;
    return `<div style="width:720px;max-width:100%;${font}">${body}</div>`;
  }
  function mount({ getPayload, getSource, getDraft, saveDraft, getTemplate, saveTemplate, core, shareHtml, toast }) {
    const dialog = document.getElementById("bookingModal");
    let draft;
    let payload;
    let signature;
    let accommodationSignature;
    const payloadSignature = (value) => JSON.stringify([value.hotel, value.checkin, value.checkout, value.guests, value.rows]);
    const editor = document.getElementById("bookingEditor");
    const preview = document.getElementById("bookingPreview");
    const warningBox = document.getElementById("bookingWarnings");
    const templateKeys = ["greeting", "closing", "signature", "textColor"];
    function rememberTemplate() {
      const template = Object.fromEntries(templateKeys.map((key) => [key, draft[key] || ""]));
      if (!saveTemplate(template)) toast("Could not save booking template in this browser");
    }
    function persist() { saveDraft(JSON.parse(JSON.stringify({ draft, signature, accommodationSignature }))); }
    function field(parent, title, obj, key, type = "text") {
      const labelNode = document.createElement("label");
      labelNode.className = `booking-field booking-field-${key}`;
      labelNode.textContent = title;
      const input = document.createElement(type === "textarea" ? "textarea" : "input");
      if (type !== "textarea") input.type = type;
      if (type === "number") { input.min = "1"; input.step = "1"; }
      input.value = obj[key] || "";
      input.addEventListener("input", () => { obj[key] = input.value; if (obj === draft && templateKeys.includes(key)) rememberTemplate(); persist(); });
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
      field(header, "Text color", draft, "textColor", "color");
      const overview = document.createElement("div"); overview.className = "booking-overview-grid";
      field(overview, "Hotel", draft, "hotel"); field(overview, "Check-in", draft, "checkin"); field(overview, "Check-out", draft, "checkout");
      field(overview, "Meal plan", draft, "meal"); field(overview, "Transfer", draft, "transfer"); field(overview, "SPO code", draft, "spo");
      header.append(overview);
      field(header, "Opening", draft, "greeting", "textarea");
      const guests = section("Guests");
      const sharedStay = isSequentialStay(draft, core);
      draft.guests.forEach((guest, index) => {
        const row = document.createElement("div"); row.className = `booking-guest-row${sharedStay ? " booking-shared-guest-row" : ""}`;
        field(row, "Title / full name", guest, "name"); field(row, "Date of birth", guest, "dob"); field(row, "Passport No.", guest, "passport"); field(row, "Valid till", guest, "validTill");
        if (!sharedStay) field(row, "Room", guest, "room", "number");
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
      for (const [title, key] of [["Remarks", "remarks"], ["Closing note", "closing"], ["Signature", "signature"]]) field(details, title, draft, key, "textarea");
      show(false);
    }
    function content() {
      payload = getPayload();
      const calculation = core.buildShareText(payload);
      const issues = warnings(draft, payload, core);
      if (signature !== payloadSignature(payload)) issues.unshift("Calculator data changed. Check this request or reload calculator data.");
      if (draft.checkin !== payload.checkin || draft.checkout !== payload.checkout) issues.push("Request dates differ from the calculator. The calculation has not changed.");
      if (accommodationSignature !== JSON.stringify(draft.periods.map(({ room, ...period }) => period))) issues.push("Accommodation was edited in the request. The calculation has not changed; reconcile it in the calculator before sending.");
      if (!calculation) issues.push("Calculation contains invalid values. Correct them before copying.");
      warningBox.textContent = issues.join("\n");
      warningBox.hidden = !issues.length;
      return { calculation, issues, html: html(draft, calculation, shareHtml, core, payload) };
    }
    function show(isPreview) {
      content();
      preview.innerHTML = html(draft, null, shareHtml, core, payload, true);
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
      draft.signature ??= "";
      draft.textColor ??= "#003366";
      delete draft.subject;
      draft.remarks = cleanRemarks(draft.remarks);
      const template = getTemplate();
      if (template) Object.assign(draft, template);
      else rememberTemplate();
      signature = saved?.signature || payloadSignature(payload);
      accommodationSignature = saved?.accommodationSignature || JSON.stringify(draft.periods.map(({ room, ...period }) => period));
      render(); show(true); dialog.showModal();
    });
    document.getElementById("closeBooking").addEventListener("click", () => dialog.close());
    document.getElementById("bookingEditTab").addEventListener("click", () => render());
    document.getElementById("bookingPreviewTab").addEventListener("click", () => show(true));
    preview.addEventListener("input", (event) => {
      const field = event.target.closest("[data-booking-field]");
      if (!field) return;
      const path = field.dataset.bookingField.split(".");
      let target = draft;
      if (path.length === 3 && ["guests", "periods"].includes(path[0])) target = draft[path[0]][Number(path[1])];
      else if (path.length !== 1) return;
      const key = path.at(-1);
      if (!target || !Object.hasOwn(target, key) || typeof target[key] !== "string") return;
      target[key] = field.innerText.replace(/\r/g, "").trim();
      if (target === draft && templateKeys.includes(key)) rememberTemplate();
      persist();
      content();
    });
    document.getElementById("bookingReload").addEventListener("click", () => {
      if (!window.confirm("Replace request edits with current calculator data?")) return;
      const template = Object.fromEntries(templateKeys.map((key) => [key, draft[key] || ""]));
      payload = getPayload(); draft = { ...create(payload, getSource()), ...template }; signature = payloadSignature(payload); accommodationSignature = JSON.stringify(draft.periods.map(({ room, ...period }) => period)); persist(); render();
    });
    document.getElementById("bookingCopy").addEventListener("click", async () => {
      const result = content(); show(true);
      if (!result.calculation) return;
      if (result.issues.length && !window.confirm("The request has warnings. Copy it anyway?")) return;
      preview.innerHTML = result.html;
      try {
        await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([result.html], { type: "text/html" }), "text/plain": new Blob([preview.innerText], { type: "text/plain" }) })]);
        show(true);
        toast("Booking request copied for Outlook");
      } catch {
        const selection = window.getSelection(); const range = document.createRange(); range.selectNodeContents(preview); selection.removeAllRanges(); selection.addRange(range);
        toast("Clipboard unavailable. Press Ctrl+C to copy the selected request.");
      }
    });
  }
  return { create, captureSource, warnings, html, mount };
});
