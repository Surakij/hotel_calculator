const test = require("node:test");
const assert = require("node:assert/strict");
const booking = require("../assets/bookingRequest.js");
const core = require("../assets/core.js");
const { shareHtml } = require("../assets/sharePresentation.js");

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
  draft.periods = [
    { room: "1", from: "04.11.2026", to: "07.11.2026", category: "Water", meal: "HB" },
    { room: "1", from: "01.11.2026", to: "04.11.2026", category: "Beach", meal: "HB" },
  ];
  const payload = { rows: [{ type: "ROOM", item: "Beach", from: "01.11.2026", to: "04.11.2026", qty: 1, rate: 100 }] };
  const html = booking.html(draft, "TOTAL: 300 USD", shareHtml, core, payload);
  assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;img"));
  assert.ok(html.indexOf("Beach") < html.indexOf("Water"));
  assert.ok(html.includes("Quotation summary (USD)"));
  assert.ok(html.includes("300.00"));
  assert.ok(html.includes("<table"));
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
