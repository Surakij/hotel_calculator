const { test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { resolve } = require("node:path");
const { chromium } = require("playwright");

let browser;
let context;
let page;
let errors;
before(async () => {
  browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true });
});
after(async () => browser?.close());
beforeEach(async () => {
  context = await browser.newContext();
  await context.route("https://**/*", (route) => route.abort());
  page = await context.newPage();
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(pathToFileURL(resolve(__dirname, "../index.html")).href);
  await page.waitForFunction(() => Boolean(window.HotelCalculatorApp));
});
afterEach(async () => {
  await context?.close();
  assert.deepEqual(errors, []);
});

test("history restores manual quantities, child ages and Days Before exactly", async () => {
  const result = await page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    $("adults").value = "2";
    $("children").value = "1";
    $("children").dispatchEvent(new Event("input"));
    const age = document.querySelector(".child-age-input");
    age.value = "6";
    age.dispatchEvent(new Event("input"));
    $("eboDays").value = "60";
    const tr = HotelCalculatorApp.addRow({ type: "TRANSFER", item: "Seaplane - Adult", rate: 100 });
    tr.querySelector(".qty").value = "1";
    HotelCalculatorApp.saveCalculation();
    age.value = "9";
    age.dispatchEvent(new Event("input"));
    $("eboDays").value = "30";
    $("showHistory").click();
    document.querySelector(".history-open").click();
    return { age: $("ages").value, days: $("eboDays").value, total: $("grandTotal").textContent, saved: $("saveCalculation").disabled };
  });
  assert.deepEqual(result, { age: "6", days: "60", total: "$100.00", saved: true });
});

test("Undo and Redo preserve manual service quantities", async () => {
  const result = await page.evaluate(() => {
    document.getElementById("adults").value = "2";
    const tr = HotelCalculatorApp.addRow({ type: "TRANSFER", item: "Seaplane - Adult", rate: 100 });
    tr.querySelector(".qty").value = "1";
    HotelCalculatorApp.recalc();
    tr.querySelector(".add-same-service").click();
    HotelCalculatorApp.undoChange();
    HotelCalculatorApp.redoChange();
    return [...document.querySelectorAll("#rows tr")].find((row) => row.querySelector(".item").value === "Seaplane - Adult").querySelector(".qty").value;
  });
  assert.equal(result, "1");
});

test("failed save leaves Save available and history unchanged", async () => {
  const result = await page.evaluate(() => {
    Storage.prototype.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
    HotelCalculatorApp.saveCalculation();
    return { count: HotelCalculatorStorage.history().length, disabled: document.getElementById("saveCalculation").disabled };
  });
  assert.deepEqual(result, { count: 0, disabled: false });
});

test("restoring partially entered ages preserves their positions", async () => {
  const result = await page.evaluate(() => {
    const input = document.getElementById("children");
    input.value = "3";
    input.dispatchEvent(new Event("input"));
    const third = document.querySelectorAll(".child-age-input")[2];
    third.value = "6";
    third.dispatchEvent(new Event("input"));
    HotelCalculatorApp.saveCalculation();
    document.getElementById("showHistory").click();
    document.querySelector(".history-open").click();
    return [...document.querySelectorAll(".child-age-input")].map((field) => field.value);
  });
  assert.deepEqual(result, ["", "", "6"]);
});

test("SPO discounts are remembered after editing without requiring Save", async () => {
  await page.evaluate(() => {
    document.getElementById("hotel").value = "Test";
    document.getElementById("spo").value = "OFFER";
    const tr = HotelCalculatorApp.addRow({ type: "TRANSFER", item: "Seaplane - Adult", rate: 100 });
    tr.querySelector(".discount").value = "15";
    tr.querySelector(".discount").dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(() => HotelCalculatorStorage.rateMemory()[0]?.discounts?.[0] === 15);
});

test("Save remembers discounts entered after the rate", async () => {
  const result = await page.evaluate(() => {
    document.getElementById("hotel").value = "Test Hotel";
    document.getElementById("spo").value = "TEST";
    const tr = HotelCalculatorApp.addRow({ type: "TRANSFER", item: "Seaplane - Adult" });
    tr.querySelector(".rate").value = "100";
    tr.querySelector(".rate").dispatchEvent(new Event("blur"));
    tr.querySelector(".discount").value = "20";
    tr.querySelector(".discount").dispatchEvent(new Event("input", { bubbles: true }));
    HotelCalculatorApp.saveCalculation();
    return HotelCalculatorStorage.rateMemory()[0].discounts;
  });
  assert.deepEqual(result, [20]);
});

test("automatic prices follow ITEM while manual prices remain editable", async () => {
  const result = await page.evaluate(() => {
    document.getElementById("hotel").value = "Test";
    HotelCalculatorStorage.setRateAutofillEnabled(true);
    for (const [item, rate] of [["Seaplane - Adult", 100], ["Speedboat - Adult", 50]]) {
      HotelCalculatorStorage.saveRateMemory({ hotel: "Test", type: "TRANSFER", item, rate, rateFormula: String(rate) });
    }
    const tr = HotelCalculatorApp.addRow({ type: "TRANSFER" });
    const item = tr.querySelector(".item");
    const rate = tr.querySelector(".rate");
    item.value = "Seaplane - Adult";
    item.dispatchEvent(new Event("input"));
    item.value = "Speedboat - Adult";
    item.dispatchEvent(new Event("input"));
    const automatic = rate.value;
    rate.value = "75";
    rate.dispatchEvent(new Event("input"));
    item.value = "Seaplane - Adult";
    item.dispatchEvent(new Event("input"));
    return { automatic, manual: rate.value };
  });
  assert.deepEqual(result, { automatic: "50", manual: "75" });
});

test("deleted rows do not add permanent window blur handlers", async () => {
  const result = await page.evaluate(() => {
    const original = window.addEventListener;
    let added = 0;
    window.addEventListener = function (type, ...args) {
      if (type === "blur") added++;
      return original.call(this, type, ...args);
    };
    for (let i = 0; i < 30; i++) HotelCalculatorApp.addRow({ type: "ROOM" }).querySelector(".delete").click();
    return added;
  });
  assert.equal(result, 0);
});

test("invalid manual discounts cannot be saved or shared as a negative total", async () => {
  const result = await page.evaluate(() => {
    document.getElementById("adults").value = "1";
    const tr = HotelCalculatorApp.addRow({ type: "TRANSFER", item: "Seaplane - Adult", rate: 100 });
    tr.querySelector(".discount").value = "150";
    HotelCalculatorApp.saveCalculation();
    return { count: HotelCalculatorStorage.history().length, total: document.getElementById("grandTotal").textContent, share: HotelCalculatorApp.shareText() };
  });
  assert.deepEqual(result, { count: 0, total: "Check inputs", share: "" });
});

test("SAMO resolves room wording and fills empty rates from memory", async () => {
  const result = await page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    HotelCalculatorStorage.setRateAutofillEnabled(true);
    for (const [type, item, rate] of [["ROOM", "Deluxe Beach Pool Villa", 1230], ["MEAL", "AI - Adult", 50], ["TRANSFER", "Seaplane - Adult", 400]]) {
      HotelCalculatorStorage.saveRateMemory({ hotel: "Kuredhivaru Resort and Spa", type, item, rate, rateFormula: String(rate), spo: "MDBP40", discounts: [40], from: type === "TRANSFER" ? "" : "29.09.2026", to: type === "TRANSFER" ? "" : "06.10.2026" });
    }
    $("showSamoImport").click();
    $("samoImportText").value = "Hotel: Kuredhivaru Resort & Spa\nNumber of guest: 2 Adult\nArrival date: 29.09.2026\nDeparture date: 06.10.2026\nVilla category: Deluxe Beach Villa With Pool\nMeal Plan: AI\nTransfer: Seaplane\nSPO code: MDBP40";
    $("parseSamoImport").click();
    $("applySamoImport").click();
    return [...document.querySelectorAll("#rows tr")].map((row) => [row.querySelector(".item").value, row.querySelector(".rate").value, row.querySelector(".discount").value]);
  });
  assert.deepEqual(result, [["Deluxe Beach Pool Villa", "1230", "40"], ["AI - Adult", "50", "40"], ["Seaplane - Adult", "400", "40"]]);
});

test("editing SAMO text invalidates the old preview", async () => {
  const result = await page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    $("showSamoImport").click();
    $("samoImportText").value = "Hotel: First Hotel";
    $("parseSamoImport").click();
    $("samoImportText").value = "Hotel: Second Hotel";
    $("samoImportText").dispatchEvent(new Event("input"));
    return $("applySamoImport").disabled;
  });
  assert.equal(result, true);
});

test("SAMO imports inline guest names and meals after matching an ampersand hotel name", async () => {
  const result = await page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    $("showSamoImport").click();
    $("samoImportText").value = `
      Hotel: Kuredhivaru Resort & Spa (ex. Movenpick Resort Kuredhivaru) 5*
      Guest name: MRS GUEST ONE DOB 03.01.2001 PN XX
      MR GUEST TWO DOB 22.03.1996 PN XX
      CHD GUEST CHILD DOB 23.04.2022 PN XX
      Number of guest: 2 Adult, 1 Child
      Arrival date: 29.09.2026
      Departure date: 06.10.2026
      Villa category: Deluxe Beach Villa With Pool 2 Adl + 1 Chd(2-5,99)
      Meal Plan: AI
      SPO code:
      Room quotation: 2*1270.00[7169/Std/MDBP40]+5*1318.00[7169/Std/MDBP40]
    `;
    $("parseSamoImport").click();
    $("applySamoImport").click();
    return {
      hotel: $("hotel").value,
      adults: $("adults").value,
      children: $("children").value,
      spo: $("spo").value,
      rooms: [...document.querySelectorAll("#rows tr")]
        .filter((row) => row.querySelector(".type")?.value === "ROOM")
        .map((row) => [row.querySelector(".from").value, row.querySelector(".to").value, row.querySelector(".rate").value]),
      meals: [...document.querySelectorAll("#rows tr")]
        .filter((row) => row.querySelector(".type")?.value === "MEAL")
        .map((row) => ({ item: row.querySelector(".item").value, qty: row.querySelector(".qty").value })),
    };
  });
  assert.deepEqual(result, {
    hotel: "Kuredhivaru Resort and Spa",
    adults: "2",
    children: "1",
    spo: "MDBP40",
    rooms: [["29.09.2026", "01.10.2026", "1270"], ["01.10.2026", "06.10.2026", "1318"]],
    meals: [{ item: "AI - Adult", qty: "2" }, { item: "AI - Child", qty: "1" }],
  });
});

test("restoring a batch calculates once and keeps an empty service list", async () => {
  const result = await page.evaluate(() => {
    const payload = { hotel: "Test", guests: {}, rows: Array.from({ length: 40 }, () => ({ type: "ROOM", qty: 1 })) };
    HotelCalculatorStorage.saveHistory({ id: "batch", savedAt: new Date().toISOString(), payload });
    document.getElementById("showHistory").click();
    const original = HotelCalcCore.calculateRows;
    let count = 0;
    HotelCalcCore.calculateRows = (...args) => { count++; return original(...args); };
    document.querySelector(".history-open").click();
    const batchCount = count;
    HotelCalculatorStorage.saveHistory({ id: "empty", savedAt: new Date().toISOString(), payload: { ...payload, rows: [] } });
    document.getElementById("showHistory").click();
    document.querySelector('[data-id="empty"] .history-open').click();
    return { batchCount, rows: document.querySelectorAll("#rows tr").length };
  });
  assert.deepEqual(result, { batchCount: 1, rows: 0 });
});

test("transfer choices fit a narrow viewport", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  const result = await page.evaluate(() => {
    const tr = [...document.querySelectorAll("#rows tr")].find((row) => row.querySelector(".type").value === "TRANSFER");
    tr.scrollIntoView();
    tr.querySelector(".item").click();
    const picker = document.querySelector(".item-picker");
    return { client: picker.clientWidth, scroll: picker.scrollWidth };
  });
  assert.ok(result.scroll <= result.client, JSON.stringify(result));
});
