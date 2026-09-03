const test = require("node:test");
const assert = require("node:assert/strict");
const core = require("../assets/core.js");
const storage = require("../assets/storage.js");

global.localStorage = {
  data: new Map(),
  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null;
  },
  setItem(key, value) {
    this.data.set(key, String(value));
  },
  removeItem(key) {
    this.data.delete(key);
  },
};

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
  assert.equal(core.calculateRow({ type: "GREEN_TAX", item: "Green Tax", from: "01.09.2026", to: "04.09.2026", qty: 2, rate: 12 }).net, 72);
  assert.equal(core.calculateRow({ type: "EXTRA", item: "Manual Surcharge", from: "01.09.2026", to: "04.09.2026", qty: 2, rate: 12 }).net, 72);
});

test("applies stacked discounts sequentially", () => {
  assert.equal(core.calculateRow({ type: "ROOM", from: "01.09.2026", to: "02.09.2026", qty: 1, rate: 100, discounts: [10, 10] }).net, 81);
});

test("calculates simple rate formulas", () => {
  const row = core.calculateRow({ type: "ROOM", from: "01.09.2026", to: "08.09.2026", qty: 1, rateFormula: "200*2" });

  assert.equal(row.rate, 400);
  assert.equal(row.net, 2800);
});

test("stores and finds local rate memory by hotel, item, and dates", () => {
  storage.saveRateMemory({
    hotel: "Jawakara Islands Maldives",
    type: "ROOM",
    item: "Mabin Beach Villa",
    from: "01.09.2026",
    to: "05.09.2026",
    rate: 400,
    rateFormula: "200*2",
  });

  const match = storage.findRateMemory({
    hotel: "Jawakara Islands Maldives",
    type: "ROOM",
    item: "Mabin Beach Villa",
    from: "01.09.2026",
    to: "05.09.2026",
  });

  assert.equal(match.rateFormula, "200*2");
  assert.equal(match.rate, 400);
});

test("keeps rate auto-fill disabled until explicitly enabled", () => {
  assert.equal(storage.rateAutofillEnabled(), false);
  assert.equal(storage.setRateAutofillEnabled(true), true);
  assert.equal(storage.rateAutofillEnabled(), true);
  assert.equal(storage.setRateAutofillEnabled(false), false);
});

test("stores appearance settings locally", () => {
  const saved = storage.saveAppearanceSettings({
    theme: "dark",
    colors: {
      navy: "#0b3268",
      blue: "#62a8ff",
      green: "#42d57a",
    },
  });

  assert.equal(saved.theme, "dark");
  assert.deepEqual(storage.appearanceSettings().colors, {
    navy: "#0b3268",
    blue: "#62a8ff",
    green: "#42d57a",
  });

  const reset = storage.resetAppearanceSettings();
  assert.equal(reset.theme, "light");
  assert.equal(reset.colors.navy, "#082758");
});

test("ignores discounts for green tax and dinners", () => {
  assert.equal(core.calculateRow({ type: "GREEN_TAX", item: "Green Tax", from: "01.09.2026", to: "02.09.2026", qty: 2, rate: 12, discounts: [50] }).net, 24);
  assert.equal(core.calculateRow({ type: "DINNER", item: "New Year Gala Dinner - Adult", qty: 2, rate: 100, discounts: [50] }).net, 200);
});

test("builds share text with display-format dates", () => {
  const text = core.buildShareText({
    hotel: "Ozen",
    checkin: "01.09.2026",
    checkout: "04.09.2026",
    guests: { adults: 2, children: 1, ages: "6" },
    rows: [
      { type: "ROOM", item: "Beach Pool Villa", from: "01.09.2026", to: "04.09.2026", qty: 1, rateFormula: "50*2" },
      { type: "GREEN_TAX", item: "Green Tax", from: "01.09.2026", to: "04.09.2026", qty: 3, rate: 12 },
    ],
  });

  assert.match(text, /OZEN/);
  assert.match(text, /01\.09\.2026-04\.09\.2026 · 3N · 2ADL\+1CHD\(6\)/);
  assert.match(text, /Beach Pool Villa : \(50\*2\)\*3 = 300\.00/);
  assert.match(text, /Green Tax : 12\.00\*3\*3 = 108\.00/);
  assert.match(text, /TOTAL: 408\.00 USD/);
});

test("omits unpriced services from share text", () => {
  const text = core.buildShareText({
    hotel: "Ozen",
    checkin: "01.09.2026",
    checkout: "04.09.2026",
    guests: { adults: 2 },
    rows: [
      { type: "ROOM", item: "Beach Pool Villa", from: "01.09.2026", to: "04.09.2026", qty: 1, rate: 100 },
      { type: "TRANSFER", item: "Seaplane - Adult", from: "", to: "", qty: 2, rate: 0 },
    ],
  });

  assert.doesNotMatch(text, /Seaplane/);
  assert.match(text, /Beach Pool Villa/);
});

test("orders short share date rows chronologically", () => {
  const text = core.buildShareText({
    hotel: "Villa Park",
    checkin: "27.08.2026",
    checkout: "05.09.2026",
    guests: { adults: 2 },
    rows: [
      { type: "ROOM", item: "Water Villa", from: "03.09.2026", to: "05.09.2026", qty: 1, rate: 482, discounts: [37] },
      { type: "ROOM", item: "Lagoon Beach Villa", from: "27.08.2026", to: "01.09.2026", qty: 1, rate: 340, discounts: [22] },
      { type: "ROOM", item: "Lagoon Beach Villa", from: "01.09.2026", to: "03.09.2026", qty: 1, rate: 306, discounts: [22] },
      { type: "EXTRA", item: "Extra Adult", from: "03.09.2026", to: "05.09.2026", qty: 1, rate: 100 },
      { type: "MEAL", item: "AI - Adult", from: "03.09.2026", to: "05.09.2026", qty: 2, rate: 60 },
      { type: "MEAL", item: "AI - Adult", from: "27.08.2026", to: "03.09.2026", qty: 2, rate: 60 },
    ],
  });

  const firstRoom = text.indexOf("27.08 - 01.09 : Lagoon Beach Villa");
  const firstMeal = text.indexOf("27.08 - 03.09 : AI");
  const secondRoom = text.indexOf("01.09 - 03.09 : Lagoon Beach Villa");
  const thirdRoom = text.indexOf("03.09 - 05.09 : Water Villa");
  const thirdExtra = text.indexOf("Extra Adult");
  const thirdMeal = text.indexOf("03.09 - 05.09 : AI");

  assert.ok(firstRoom < secondRoom);
  assert.ok(secondRoom < thirdRoom);
  assert.ok(thirdRoom < thirdExtra);
  assert.ok(thirdExtra < thirdMeal);
  assert.ok(thirdMeal < firstMeal);
});

test("keeps full-stay meals after split room date blocks in short share", () => {
  const text = core.buildShareText({
    hotel: "Jawakara Islands Maldives",
    checkin: "12.11.2026",
    checkout: "24.11.2026",
    guests: { adults: 2 },
    rows: [
      { type: "ROOM", item: "Dheru Beach Pool Villa", from: "15.11.2026", to: "24.11.2026", qty: 1, rate: 630, discounts: [40] },
      { type: "MEAL", item: "Premium AI - Adult", from: "12.11.2026", to: "24.11.2026", qty: 2, rate: 120 },
      { type: "ROOM", item: "Dheru Water Pool Villa", from: "12.11.2026", to: "15.11.2026", qty: 1, rate: 680, discounts: [40] },
      { type: "TRANSFER", item: "Seaplane - Adult", qty: 2, rate: 420 },
      { type: "GREEN_TAX", item: "Green Tax", from: "12.11.2026", to: "24.11.2026", qty: 2, rate: 12 },
    ],
  });

  const firstRoom = text.indexOf("12.11 - 15.11 : Dheru Water Pool Villa");
  const secondRoom = text.indexOf("15.11 - 24.11 : Dheru Beach Pool Villa");
  const fullStayMeal = text.indexOf("12.11 - 24.11 : Premium AI");
  const transfer = text.indexOf("Seaplane");
  const greenTax = text.indexOf("Green Tax");

  assert.ok(firstRoom > -1);
  assert.ok(secondRoom > firstRoom);
  assert.ok(fullStayMeal > secondRoom);
  assert.ok(transfer > fullStayMeal);
  assert.ok(greenTax > transfer);
});

test("keeps gala dinners after dated stay rows in short share", () => {
  const text = core.buildShareText({
    hotel: "Siyam World Maldives",
    checkin: "30.12.2026",
    checkout: "07.01.2027",
    guests: { adults: 5, children: 3, ages: "11/10/7" },
    rows: [
      { type: "ROOM", item: "Beach Suite with Pool", from: "30.12.2026", to: "05.01.2027", qty: 2, rate: 1837, discounts: [15] },
      { type: "EXTRA", item: "Extra Adult", from: "30.12.2026", to: "05.01.2027", qty: 1, rate: 360, discounts: [15] },
      { type: "EXTRA", item: "Extra Child", from: "30.12.2026", to: "05.01.2027", qty: 1, rate: 260, discounts: [15] },
      { type: "DINNER", item: "New Year Gala Dinner - Adult", from: "31.12.2026", to: "31.12.2026", qty: 5, rateFormula: "525*5+265*1" },
      { type: "ROOM", item: "Beach Suite with Pool", from: "05.01.2027", to: "07.01.2027", qty: 2, rate: 1837, discounts: [25] },
      { type: "EXTRA", item: "Extra Adult", from: "05.01.2027", to: "07.01.2027", qty: 1, rate: 360, discounts: [25] },
      { type: "EXTRA", item: "Extra Child", from: "05.01.2027", to: "07.01.2027", qty: 1, rate: 260, discounts: [25] },
      { type: "TRANSFER", item: "Seaplane - Adult", qty: 5, rateFormula: "515*5+310*3" },
      { type: "GREEN_TAX", item: "Green Tax", from: "30.12.2026", to: "07.01.2027", qty: 8, rate: 12 },
    ],
  });

  const secondRoom = text.indexOf("05.01 - 07.01 : Beach Suite with Pool");
  const dinner = text.indexOf("New Year Gala Dinner");
  const transfer = text.indexOf("Seaplane");
  const greenTax = text.indexOf("Green Tax");

  assert.ok(secondRoom > -1);
  assert.ok(dinner > secondRoom);
  assert.ok(transfer > dinner);
  assert.ok(greenTax > transfer);
});

test("builds stay summaries by matching room dates", () => {
  const summaries = core.buildStaySummaries([
    { type: "ROOM", item: "Beach Pool Villa", from: "01.09.2026", to: "04.09.2026", qty: 1, rate: 100 },
    { type: "MEAL", item: "HB - Adult", from: "01.09.2026", to: "04.09.2026", qty: 2, rate: 30 },
    { type: "EXTRA", item: "Extra Adult", from: "01.09.2026", to: "04.09.2026", qty: 1, rate: 20 },
    { type: "GREEN_TAX", item: "Green Tax", from: "01.09.2026", to: "04.09.2026", qty: 3, rate: 12 },
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

test("includes full-stay meals and person extras across split same-category rooms", () => {
  const summaries = core.buildStaySummaries([
    { type: "ROOM", item: "2 Bedroom Suite", from: "23.10.2026", to: "29.10.2026", qty: 1, rate: 500, discounts: [20] },
    { type: "ROOM", item: "2 Bedroom Suite", from: "29.10.2026", to: "31.10.2026", qty: 1, rate: 450, discounts: [10] },
    { type: "MEAL", item: "HB - Adult", from: "23.10.2026", to: "31.10.2026", qty: 3, rate: 140, discounts: [10] },
    { type: "MEAL", item: "HB - Child", from: "23.10.2026", to: "31.10.2026", qty: 1, rate: 80, discounts: [10] },
    { type: "EXTRA", item: "Extra Adult", from: "23.10.2026", to: "31.10.2026", qty: 1, rate: 150, discounts: [5] },
    { type: "EXTRA", item: "Extra Child", from: "23.10.2026", to: "31.10.2026", qty: 1, rate: 75, discounts: [5] },
  ]);

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].dates, "23.10 - 29.10; 29.10 - 31.10");
  assert.equal(summaries[0].roomNet, 3210);
  assert.equal(summaries[0].mealNet, 3600);
  assert.equal(summaries[0].extraNet, 1710);
  assert.equal(summaries[0].total, 8520);
});
