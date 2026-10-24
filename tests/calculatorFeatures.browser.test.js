const { test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { pathToFileURL } = require("node:url");
const { resolve } = require("node:path");
let browser;
let context;
let page;
let errors;
before(async () => { browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true }); });
after(async () => browser?.close());
beforeEach(async () => {
  context = await browser.newContext();
  await context.route("https://**/*", (route) => route.abort());
  page = await context.newPage();
  errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(pathToFileURL(resolve(__dirname, "../index.html")).href);
  await page.waitForFunction(() => Boolean(window.HotelCalculatorApp));
});
afterEach(async () => { await context.close(); assert.deepEqual(errors, []); });
async function importRequest(text) {
  await page.locator("#showSamoImport").click();
  await page.locator("#samoImportText").fill(text);
  await page.locator("#parseSamoImport").click();
  const preview = await page.locator("#samoImportPreview").innerText();
  await page.locator("#applySamoImport").click();
  return preview;
}
async function services(type) {
  return page.locator("#rows tr").evaluateAll((rows, type) => rows.filter((row) => row.querySelector(".type").value === type).map((row) => [row.querySelector(".item").value, row.querySelector(".qty").value]), type);
}

test("Included services and three-digit quantities persist without widening the calculator", async () => {
  await page.evaluate(() => {
    document.getElementById("rows").innerHTML = "";
    document.getElementById("hotel").value = "Example Resort";
    document.getElementById("checkin").value = "12.11.2026";
    document.getElementById("checkout").value = "19.11.2026";
    HotelCalculatorApp.addRow({ type: "ROOM", item: "Villa", from: "12.11.2026", to: "19.11.2026", qty: 1, rate: 100 }, { preserveValues: true, deferRender: true });
    HotelCalculatorApp.addRow({ type: "MEAL", item: "AI - Adult", from: "12.11.2026", to: "19.11.2026", qty: 2, rate: 20 }, { preserveValues: true, deferRender: true });
    HotelCalculatorApp.recalc();
  });
  const room = page.locator("#rows tr").first();
  const meal = page.locator("#rows tr").nth(1);
  assert.equal(await room.locator(".included").isVisible(), false);
  await meal.locator(".included").check();
  assert.equal(await meal.locator(".rate").inputValue(), "20");
  assert.equal(await meal.locator(".rate").isDisabled(), true);
  assert.equal(await meal.locator(".discount").isVisible(), true);
  assert.equal(await meal.locator(".discount").isDisabled(), true);
  assert.equal(await page.locator("#grandTotal").innerText(), "$700.00");
  await page.waitForFunction(() => HotelCalculatorStorage.loadDraft()?.payload?.rows?.[1]?.included === true);
  await page.reload();
  assert.equal(await meal.locator(".included").isChecked(), true);
  await room.locator(".qty").fill("123");
  assert.equal(await room.locator(".qty").inputValue(), "123");
  for (const width of [1366, 1600, 1920, 390]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    if (width >= 1366) assert.equal(await page.locator(".table-wrap").evaluate((el) => el.scrollWidth <= el.clientWidth + 1), true);
  }
  await room.locator(".qty").fill("1000");
  assert.equal(await room.locator(".qty").inputValue(), "999");
});

test("OZEN LIFE imports its hotel, Earth Pavilion and Indulgence meals", async () => {
  const preview = await importRequest(`Hotel: OZEN LIFE Maadhoo 5*
Number of guest: 4 Adult, 0 Child
Arrival date: 09.03.2027
Departure date: 19.03.2027
Villa category: 2 Bedroom Suite Earth Pavilion With Pool
Meal Plan: Indulgence Plan
Transfer: Speedboat
Handling fee: Maldives Green Tax
SPO code: 26-12`);
  assert.doesNotMatch(preview, /not safely mapped/);
  assert.equal(await page.locator("#hotel").inputValue(), "Ozen Life Maadhoo");
  assert.deepEqual(await services("ROOM"), [["Earth Pool Pavilion 2|BR", "1"]]);
  assert.deepEqual(await services("MEAL"), [["THE INDULGENCE Plan - Adult", "4"]]);
  assert.deepEqual(await services("TRANSFER"), [["Speedboat - Adult", "4"]]);
  assert.equal(await page.locator("#nights").inputValue(), "10");
});

test("Siyam World imports WOW! All Inclusive adults and children over split stays", async () => {
  const preview = await importRequest(`Hotel: Siyam World Maldives
Number of guest: 3 Adult, 2 Child
Guest name: CHD FIRST EXAMPLE DOB 01.01.2017
CHD SECOND EXAMPLE DOB 01.01.2016
Arrival date: 12.11.2026
Departure date: 16.11.2026
Villa category: Beach Suite with Pool
Arrival date: 16.11.2026
Departure date: 19.11.2026
Villa category: Two Bedroom Lagoon Villa with Pool + Slide
Meal Plan: WOW! All Inclusive
Transfer: Seaplane
Handling fee: Maldives Green Tax
SPO code: SW7B26`);
  assert.doesNotMatch(preview, /not safely mapped/);
  assert.deepEqual(await services("MEAL"), [["WOW! All Inclusive - Adult", "3"], ["WOW! All Inclusive - Child", "2"]]);
  assert.equal((await services("ROOM")).length, 2);
  assert.equal(await page.locator("#checkin").inputValue(), "12.11.2026");
  assert.equal(await page.locator("#checkout").inputValue(), "19.11.2026");
  assert.equal(await page.locator("#spo").inputValue(), "SW7B26");
});

test("transfer ages are explicit in Short Share and copied HTML without changing amounts", async () => {
  await page.evaluate(() => {
    document.getElementById("rows").innerHTML = "";
    HotelCalculatorApp.addRow({ type: "TRANSFER", item: "Domestic - Adult", qty: 2, included: true }, { preserveValues: true, deferRender: true });
    HotelCalculatorApp.addRow({ type: "TRANSFER", item: "Domestic - Child", qty: 1, rate: 370 }, { preserveValues: true, deferRender: true });
    HotelCalculatorApp.recalc();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { write: async (items) => {
      window.featureCopied = await (await items[0].getType("text/html")).text();
    } } });
  });
  await page.locator("#showShare").click();
  const text = await page.locator("#shareText").innerText();
  assert.match(text, /Domestic - Adult : Included/);
  assert.match(text, /Domestic - Child : 370 \* 1 = 370/);
  assert.match(text, /TOTAL: 370 USD/);
  await page.locator("#copyShare").click();
  await page.waitForFunction(() => Boolean(window.featureCopied));
  assert.match(await page.evaluate(() => window.featureCopied), /Domestic - Adult/);
  assert.match(await page.evaluate(() => window.featureCopied), /Domestic - Child/);
});
