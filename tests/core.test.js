const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../assets/core.js");

test("parses and formats supported date formats", () => {
  assert.equal(core.formatDate("2026-08-17"), "17.08.2026");
  assert.equal(core.formatDate("17.08.2026"), "17.08.2026");
  assert.equal(core.formatDate("31.02.2026"), "");
});

test("calculates nights between dates", () => {
  assert.equal(core.nightsBetween("17.08.2026", "20.08.2026"), 3);
  assert.equal(core.nightsBetween("20.08.2026", "17.08.2026"), 0);
  assert.equal(core.addDays("17.08.2026", 4), "21.08.2026");
});

test("calculates stay-based and one-time rows", () => {
  assert.equal(core.calculateRow({ type: "ROOM", from: "01.09.2026", to: "04.09.2026", qty: 1, rate: 100 }).net, 300);
  assert.equal(core.calculateRow({ type: "TRANSFER", from: "01.09.2026", to: "04.09.2026", qty: 2, rate: 50 }).net, 100);
  assert.equal(core.calculateRow({ type: "EXTRA", item: "Green Tax", from: "01.09.2026", to: "04.09.2026", qty: 2, rate: 12 }).net, 72);
});

test("applies stacked discounts sequentially", () => {
  assert.equal(core.calculateRow({ type: "ROOM", from: "01.09.2026", to: "02.09.2026", qty: 1, rate: 100, discounts: [10, 10] }).net, 81);
});

test("builds share text with display-format dates", () => {
  const text = core.buildShareText({
    hotel: "Ozen",
    checkin: "01.09.2026",
    checkout: "04.09.2026",
    guests: { adults: 2, children: 1, ages: "6" },
    rows: [
      { type: "ROOM", item: "Beach Pool Villa", from: "01.09.2026", to: "04.09.2026", qty: 1, rate: 100 },
      { type: "EXTRA", item: "Green Tax", from: "01.09.2026", to: "04.09.2026", qty: 3, rate: 12 },
    ],
  });

  assert.match(text, /OZEN/);
  assert.match(text, /01\.09-04\.09 · 3N · 2ADL\+1CHD\(6\)/);
  assert.match(text, /Beach Pool Villa : 100\.00\*1\*3 = 300\.00/);
  assert.match(text, /Green Tax : 12\.00\*3\*3 = 108\.00/);
  assert.match(text, /TOTAL: 408\.00 USD/);
});

test("builds stay summaries by matching room dates", () => {
  const summaries = core.buildStaySummaries([
    { type: "ROOM", item: "Beach Pool Villa", from: "01.09.2026", to: "04.09.2026", qty: 1, rate: 100 },
    { type: "MEAL", item: "HB - Adult", from: "01.09.2026", to: "04.09.2026", qty: 2, rate: 30 },
    { type: "EXTRA", item: "Extra Adult", from: "01.09.2026", to: "04.09.2026", qty: 1, rate: 20 },
    { type: "EXTRA", item: "Green Tax", from: "01.09.2026", to: "04.09.2026", qty: 3, rate: 12 },
  ]);

  assert.equal(summaries.length, 1);
  assert.deepEqual(summaries[0], {
    dates: "01.09 - 04.09",
    room: "Beach Pool Villa",
    roomNet: 300,
    mealNet: 180,
    extraNet: 60,
    total: 540,
  });
});

test("combines repeated room categories across date ranges", () => {
  const summaries = core.buildStaySummaries([
    { type: "ROOM", item: "2 Bedroom Suite", from: "01.09.2026", to: "03.09.2026", qty: 1, rate: 100 },
    { type: "MEAL", item: "HB - Adult", from: "01.09.2026", to: "03.09.2026", qty: 2, rate: 20 },
    { type: "ROOM", item: "2 Bedroom Suite", from: "03.09.2026", to: "05.09.2026", qty: 1, rate: 150 },
    { type: "EXTRA", item: "Extra Child", from: "03.09.2026", to: "05.09.2026", qty: 1, rate: 10 },
  ]);

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].dates, "01.09 - 03.09; 03.09 - 05.09");
  assert.equal(summaries[0].room, "2 Bedroom Suite");
  assert.equal(summaries[0].roomNet, 500);
  assert.equal(summaries[0].mealNet, 80);
  assert.equal(summaries[0].extraNet, 20);
  assert.equal(summaries[0].total, 600);
});
