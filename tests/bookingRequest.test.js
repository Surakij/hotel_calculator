const test = require("node:test");
const assert = require("node:assert/strict");
const booking = require("../assets/bookingRequest.js");
const core = require("../assets/core.js");
const { shareHtml } = require("../assets/sharePresentation.js");

test("empty remarks do not capture the following SPO label after repeated import", () => {
  const source = "Remarks\nSPO code:\nShoulder Season\nRoom quotation:\n100";
  assert.equal(booking.create({ rows: [] }, source).remarks, "");
  assert.equal(booking.create({ rows: [] }, booking.captureSource(source)).remarks, "");
});

test("booking separates room identities and expands quantities without guessing guest allocation", () => {
  const payload = { hotel: "Hotel", rows: [
    { type: "ROOM", roomKey: "a", item: "Beach", qty: 2, from: "01.11.2026", to: "04.11.2026" },
    { type: "ROOM", roomKey: "a", item: "Water", qty: 2, from: "04.11.2026", to: "07.11.2026" },
  ] };
  const draft = booking.create(payload, "MR TEST PERSON DOB 01.01.1980 PN 123456\nMR TEST PERSON DOB 01.01.1980 PN 123456");
  assert.deepEqual(draft.periods.map((period) => period.room), ["1", "2", "1", "2"]);
  assert.deepEqual(draft.guests, [{ name: "MR TEST PERSON", dob: "01.01.1980", passport: "123456", validTill: "", room: "" }]);
});

test("booking email escapes user input and orders split periods within rooms", () => {
  const draft = booking.create({ rows: [] });
  draft.hotel = '<img src=x onerror="bad()">';
  draft.spo = "ONLY-ONCE";
  draft.periods = [
    { room: "1", from: "04.11.2026", to: "07.11.2026", category: "Water", meal: "HB" },
    { room: "1", from: "01.11.2026", to: "04.11.2026", category: "Beach", meal: "HB" },
  ];
  const payload = { rows: [{ type: "ROOM", item: "Beach", from: "01.11.2026", to: "04.11.2026", qty: 1, rate: 100 }] };
  const html = booking.html(draft, "TOTAL: 300 USD", shareHtml, core, payload);
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.indexOf("Beach") < html.indexOf("Water"));
  assert.ok(html.includes("Calibri,Arial,sans-serif"));
  assert.ok(html.includes("Room quotation"));
  assert.ok(html.includes("300.00"));
  assert.ok(html.includes("<table"));
  assert.equal((html.match(/ONLY-ONCE/g) || []).length, 1);
  assert.ok(html.indexOf("SPO code") < html.indexOf("Room quotation"));
  assert.match(html, /ONLY-ONCE<\/td><\/tr><tr><th [^>]*>Room quotation/);
  assert.ok(html.includes("100 * 1 * 3"));
  assert.ok(!html.includes("contenteditable"));
  const editable = booking.html(draft, "", shareHtml, core, payload, true);
  assert.ok(editable.includes('data-booking-field="hotel"'));
  assert.ok(!editable.includes("<img"));
});

test("booking starts without company text or subject and omits empty message blocks", () => {
  const draft = booking.create({ rows: [] });
  assert.equal(draft.greeting, "");
  assert.equal(draft.closing, "");
  assert.equal(Object.hasOwn(draft, "subject"), false);
  const output = booking.html(draft, "", shareHtml, core);
  assert.ok(!output.includes("Maldiviana"));
  assert.ok(!output.includes("border-left:3px"));
  assert.ok(!output.includes("SPO code"));
});

test("booking guest details stay inline with a bold name and separated document fields", () => {
  const draft = booking.create({ rows: [] }, "MR EXAMPLE PERSON DOB 01.01.1980 PN 77 1234567 TILL 01.01.2035");
  const output = booking.html(draft, "", shareHtml, core);
  assert.ok(output.includes("<b>MR EXAMPLE PERSON</b>"));
  assert.equal((output.match(/&middot;/g) || []).length, 3);
  assert.ok(output.includes("PN</span>&nbsp;77 1234567"));
  assert.ok(output.includes("TILL</span>&nbsp;01.01.2035"));
});

test("booking signature and chosen color are included in copied email", () => {
  const draft = booking.create({ rows: [] });
  draft.signature = "Kind regards,\nExample <Company>";
  draft.textColor = "#123456";
  const output = booking.html(draft, "", shareHtml, core);
  assert.ok(output.includes("Kind regards,<br>Example &lt;Company&gt;"));
  assert.ok(output.includes("font:11pt/1.2 Calibri,Arial,sans-serif;color:#123456"));
  draft.textColor = 'red;" onmouseover="bad()';
  assert.ok(!booking.html(draft, "", shareHtml, core).includes("onmouseover"));
});

test("booking warns about missing assignments, overlaps and guest counts", () => {
  const draft = booking.create({ rows: [
    { type: "ROOM", item: "Beach", from: "01.11.2026", to: "04.11.2026", qty: 1 },
    { type: "ROOM", item: "Water", from: "02.11.2026", to: "05.11.2026", qty: 1 },
  ] });
  draft.periods[1].room = "1";
  const warnings = booking.warnings(draft, { guests: { adults: 2 } }, core);
  assert.ok(warnings.some((text) => text.includes("overlap")));
  assert.ok(warnings.some((text) => text.includes("Guest count")));
  assert.ok(warnings.some((text) => text.includes("assign every guest")));
});

test("booking captures reservation guest details and preserves period-specific meals", () => {
  const source = booking.captureSource("Guest name: MR TEST PERSON DOB 01.01.1980 PN 123456 TILL 01.01.2030\nMRS OTHER PERSON\nFlight details: AB123\nFlight details: CD456\nRemarks:\nQuiet room please\nSPO code: SPECIAL");
  assert.ok(source.includes("PN 123456 TILL 01.01.2030"));
  const draft = booking.create({ rows: [
    { type: "ROOM", item: "Beach", from: "01.11.2026", to: "04.11.2026" },
    { type: "ROOM", item: "Water", from: "04.11.2026", to: "07.11.2026" },
    { type: "MEAL", item: "HB - Adult", from: "01.11.2026", to: "04.11.2026" },
    { type: "MEAL", item: "FB - Adult", from: "04.11.2026", to: "07.11.2026" },
  ] }, source);
  assert.equal(draft.guests.length, 2);
  assert.equal(draft.guests[1].dob, "");
  assert.equal(draft.guests[0].passport, "123456");
  assert.equal(draft.guests[0].validTill, "01.01.2030");
  assert.equal(draft.arrival, "AB123");
  assert.equal(draft.departure, "CD456");
  assert.equal(draft.remarks, "Quiet room please");
  assert.deepEqual(draft.periods.map((period) => period.meal), ["HB", "FB"]);
});
