const { test, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const core = require("../assets/core.js");
const parser = require("../assets/samoParser.js");
const storage = require("../assets/storage.js");
const remarks = require("../assets/requestRemarks.js");
const window = {};
runInNewContext(readFileSync(join(__dirname, "../assets/hotelData.js"), "utf8"), { window });
const hotels = window.HotelCalculatorHotelData;
beforeEach(() => { global.localStorage = { data: new Map(), getItem(key) { return this.data.get(key) ?? null; }, setItem(key, value) { this.data.set(key, String(value)); }, removeItem(key) { this.data.delete(key); } }; });

test("OZEN LIFE and its former name match one canonical database hotel", () => {
  for (const name of ["OZEN LIFE Maadhoo 5*", "Ozen By Atmosphere At Maadhoo", "Ozen Life Maadhoo Maldives 5*"]) {
    const parsed = parser.parseSamoRequest(`Hotel: ${name}\nNumber of guest: 4 Adult\nArrival date: 09.03.2027\nDeparture date: 19.03.2027\nVilla category: 2 Bedroom Suite Earth Pavilion With Pool\nMeal Plan: Indulgence Plan\nTransfer: Speedboat`, { hotelNames: Object.keys(hotels) });
    assert.equal(parsed.mappedHotel, "Ozen Life Maadhoo");
    assert.equal(parsed.hotelStatus, "mapped");
    assert.equal(parsed.mealPlan, "Indulgence Plan");
    assert.equal(parsed.nights, 10);
  }
  assert.equal(parser.parseSamoRequest("Hotel: Ozen Unknown Island\nArrival date: 09.03.2027\nDeparture date: 19.03.2027", { hotelNames: Object.keys(hotels) }).hotelStatus, "unresolved");
});

test("Siyam World database uses WOW! All Inclusive for adults and children", () => {
  assert.deepEqual([...hotels["Siyam World Maldives"].meals], ["WOW! All Inclusive - Adult", "WOW! All Inclusive - Child"]);
  assert.equal(hotels["Ozen Life Maadhoo"].rooms.includes("Earth Pool Pavilion 2|BR"), true);
});

test("old hotel and meal names retain remembered rates and SPO discounts", () => {
  storage.saveRateMemory({ hotel: "Ozen By Atmosphere At Maadhoo", type: "ROOM", item: "Earth Villa", rate: 1000, rateFormula: "1000", spo: "TEST", discounts: [20] });
  assert.equal(storage.findRateMemory({ hotel: "Ozen Life Maadhoo", type: "ROOM", item: "Earth Villa", spo: "TEST" }).rate, 1000);
  storage.saveRateMemory({ hotel: "Siyam World Maldives", type: "MEAL", item: "WOW! Premium AI - Child", rate: 30, rateFormula: "30", spo: "TEST", discounts: [10] });
  const rate = storage.findRateMemory({ hotel: "Siyam World Maldives", type: "MEAL", item: "WOW! All Inclusive - Child", spo: "TEST" });
  assert.equal(rate.rate, 30);
  assert.deepEqual(rate.discounts, [10]);
});

test("adult and child transfers remain explicit for included, payable and one-way services", () => {
  const text = core.buildShareText({ rows: [
    { type: "TRANSFER", item: "Domestic - Adult", qty: 2, included: true },
    { type: "TRANSFER", item: "Domestic - Child", qty: 1, rate: 370 },
    { type: "TRANSFER", item: "Seaplane OW - Adult", from: "20.06.2027", qty: 1, rate: 100 },
  ] });
  assert.match(text, /Domestic - Adult : Included/);
  assert.match(text, /Domestic - Child : 370 \* 1 = 370/);
  assert.match(text, /20\.06 : Seaplane OW - Adult : 100 \* 1 = 100/);
  assert.match(text, /TOTAL: 470 USD/);
  const paid = core.buildShareText({ rows: [
    { type: "TRANSFER", item: "Domestic - Adult", qty: 2, rate: 500 },
    { type: "TRANSFER", item: "Domestic - Child", qty: 1, rate: 370 },
  ] });
  assert.match(paid, /Domestic - Adult : 500 \* 2 = 1,000/);
  assert.match(paid, /Domestic - Child : 370 \* 1 = 370/);
});

test("included pricing, legacy rows and storage remain compatible", () => {
  const meal = { type: "MEAL", item: "AI - Adult", from: "12.11.2026", to: "19.11.2026", qty: 2, rate: 0 };
  assert.equal(core.hasMissingRate(meal), true);
  assert.equal(core.hasMissingRate({ ...meal, included: true }), false);
  assert.equal(core.calculateRow({ ...meal, rate: 100, included: true }).net, 0);
  assert.equal(core.calculateRow({ ...meal, rate: 100 }).net, 1400);
  storage.saveDraft({ rows: [{ ...meal, included: true }] });
  assert.equal(storage.loadDraft().payload.rows[0].included, true);
});

test("shared remarks parser stops before SPO and quotation", () => {
  const text = "Remarks:\nQuiet room\nLate arrival\nSPO code: TEST\nRoom quotation: 7*100";
  assert.equal(remarks.parseRemarks(text), "Quiet room\nLate arrival");
  assert.equal(parser.parseSamoRequest(text).remarks, "Quiet room\nLate arrival");
});
