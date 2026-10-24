const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const core = require("../assets/core.js");
const storage = require("../assets/storage.js");
const { shareHtml } = require("../assets/sharePresentation.js");
const room = { type: "ROOM", item: "Beach Villa", from: "12.11.2026", to: "19.11.2026", qty: 1, rate: 800, discounts: [25] };
beforeEach(() => { global.localStorage = { data: new Map(), getItem(k) { return this.data.get(k) ?? null; }, setItem(k, v) { this.data.set(k, String(v)); }, removeItem(k) { this.data.delete(k); } }; });

test("ROOM free nights reduce paid nights before percentage discounts without changing the stay", () => {
  for (const count of [1, 2, 3, 7]) {
    const input = { ...room, freeNights: count };
    const saved = JSON.stringify(input);
    const row = core.calculateRow(input);
    assert.equal(row.nights, 7);
    assert.equal(row.freeNights, count);
    assert.equal(row.paidNights, 7 - count);
    assert.equal(row.net, 800 * (7 - count) * .75);
    assert.equal(JSON.stringify(input), saved);
  }
  assert.equal(core.calculateRow({ ...room, qty: 2, freeNights: 2, discounts: [25, 10] }).net, 5400);
});

test("legacy rows and explicit zero free nights retain their old price and quotation", () => {
  const legacy = core.calculateRow(room);
  assert.equal(legacy.freeNights, 0);
  assert.equal(legacy.net, 4200);
  assert.equal(core.expression(legacy), "800 * 1 * 7 - 25%");
  assert.equal(core.buildShareText({ rows: [room] }), core.buildShareText({ rows: [{ ...room, freeNights: 0 }] }));
});

test("invalid complimentary-night counts cannot produce a misleading or negative total", () => {
  for (const count of [-1, 8, 1.5, "bad", Infinity]) {
    const input = { ...room, freeNights: count };
    assert.equal(core.calculateRow(input).valid, false);
    assert.equal(core.calculateRows([input]).total, null);
    assert.equal(core.buildShareText({ rows: [input] }), "");
  }
  assert.equal(core.calculateRow({ ...room, freeNights: "2" }).net, 3000);
});

test("free nights affect ROOM only, leaving meals, drinks, extras and Green Tax on full dates", () => {
  for (const type of ["MEAL", "GREEN_TAX", "EXTRA", "TRANSFER", "DINNER"]) {
    const row = { ...room, type, item: type === "EXTRA" ? "Extra Adult" : type, rate: 10, discounts: [] };
    assert.equal(core.calculateRow({ ...row, freeNights: 2 }).net, core.calculateRow(row).net);
    assert.equal(core.calculateRow({ ...row, freeNights: 2 }).freeNights, 0);
  }
  const rows = [{ ...room, freeNights: 2 }, { ...room, type: "MEAL", item: "HB - Adult", rate: 20, qty: 2, discounts: [] }, { ...room, type: "GREEN_TAX", item: "Green Tax", rate: 12, qty: 2 }];
  assert.equal(core.calculateRows(rows).total, 3448);
  const summary = core.buildStaySummaries(rows)[0];
  assert.equal(summary.roomNet, 3000);
  assert.equal(summary.mealNet, 280);
});

test("Short Share and its HTML subtract nights inside the existing room formula only", () => {
  const text = core.buildShareText({ rows: [{ ...room, freeNights: 2 }] });
  assert.match(text, /Beach Villa : 800 \* 1 \* \(7 - 2\) - 25% = 3,000/);
  assert.equal(text.split("\n").filter((line) => /Beach Villa/.test(line)).length, 1);
  assert.doesNotMatch(text, /free nights|paid nights|complimentary/i);
  assert.match(shareHtml(text), /\(7 - 2\)/);
  assert.match(text, /TOTAL: 3,000 USD/);
});

test("arithmetic room rates retain parentheses and free-night subtraction", () => {
  const row = core.calculateRow({ ...room, rateFormula: "400+400", freeNights: 2 });
  assert.equal(row.net, 3000);
  assert.equal(core.expression(row), "(400 + 400) * (7 - 2) - 25%");
});

test("each split rate period has its own free nights while all stay dates remain intact", () => {
  const rows = [{ ...room, to: "16.11.2026", freeNights: 1 }, { ...room, item: "Water Villa", from: "16.11.2026", freeNights: 2, rate: 1000 }];
  assert.equal(core.calculateRows(rows).total, 2550);
  const text = core.buildShareText({ rows });
  assert.match(text, /12.11 - 16.11 : Beach Villa : 800 \* 1 \* \(4 - 1\) - 25% = 1,800/);
  assert.match(text, /16.11 - 19.11 : Water Villa : 1000 \* 1 \* \(3 - 2\) - 25% = 750/);
});

test("a fully complimentary room stays visible and does not require a separate room charge", () => {
  const input = { ...room, freeNights: 7, rate: 0 };
  assert.equal(core.calculateRow(input).net, 0);
  assert.equal(core.hasMissingRate(input), false);
  assert.equal(core.hasMissingRate({ ...input, freeNights: 6 }), true);
  assert.match(core.buildShareText({ rows: [input] }), /Beach Villa : 0 \* 1 \* \(7 - 7\) - 25% = 0/);
});

test("draft, saved history and JSON round trips preserve ROOM free nights", () => {
  const payload = { rows: [{ ...room, freeNights: 2 }] };
  storage.saveDraft(payload);
  assert.equal(storage.loadDraft().payload.rows[0].freeNights, 2);
  const entry = { id: "free-nights", savedAt: "2026-10-23", payload };
  storage.replaceHistory([entry]);
  const exported = JSON.parse(JSON.stringify(storage.history()));
  storage.replaceHistory([]);
  storage.mergeHistory(exported);
  assert.equal(storage.history()[0].payload.rows[0].freeNights, 2);
  assert.equal(core.calculateRows(storage.history()[0].payload.rows).total, 3000);
});
