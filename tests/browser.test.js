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

test("imports a short Russian request with ages, meals, transfer and remembered price", async () => {
  const result = await page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    HotelCalculatorStorage.setRateAutofillEnabled(true);
    HotelCalculatorStorage.saveRateMemory({ hotel: "Finolhu", type: "ROOM", item: "Beach Villa", from: "22.11.2026", to: "28.11.2026", rate: 800, rateFormula: "800" });
    $("showSamoImport").click();
    $("samoImportText").value = "22-28.11.2026\nFinolhu\nBeach Villa\n2взр+ 2 детей (6,10 лет), All, гидросамолёт";
    $("parseSamoImport").click();
    $("applySamoImport").click();
    return {
      hotel: $("hotel").value, nights: $("nights").value,
      ages: [...document.querySelectorAll(".child-age-input")].map((input) => input.value),
      rows: [...document.querySelectorAll("#rows tr")].map((row) => [row.querySelector(".item").value, row.querySelector(".qty").value, row.querySelector(".rate").value]),
    };
  });
  assert.deepEqual(result, { hotel: "Finolhu", nights: "6", ages: ["6", "10"], rows: [["Beach Villa", "1", "800"], ["AI - Adult", "2", ""], ["AI - Child", "2", ""], ["Seaplane - Adult", "2", ""], ["Seaplane - Child", "2", ""]] });
});

test("imports Fuel Surcharge once for adults and children after transfers", async () => {
  const result = await page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    $("showSamoImport").click();
    $("samoImportText").value = `Hotel: Pullman Maldives Maamutaa 5*
Number of guest: 2 Adult, 1 Child
Arrival date: 11.12.2026
Departure date: 18.12.2026
Villa category: Beach Villa With Pool 2 Adl
Handling: Fuel Surcharge (11.12.2026 - 18.12.2026)
Handling fee: Maldives Green Tax (11.12.2026 - 18.12.2026)
Transfer: SPEEDBOAT Airport - Hotel - Airport`;
    $("parseSamoImport").click();
    $("applySamoImport").click();
    return [...document.querySelectorAll("#rows tr")].map((row) => ({
      type: row.querySelector(".type").value,
      item: row.querySelector(".item").value,
      qty: row.querySelector(".qty").value,
      from: row.querySelector(".from")?.value || "",
      to: row.querySelector(".to")?.value || "",
    }));
  });
  const fuelIndex = result.findIndex((row) => row.item === "Fuel Surcharge");
  const lastTransferIndex = result.reduce((index, row, current) => row.type === "TRANSFER" ? current : index, -1);
  assert.equal(fuelIndex, lastTransferIndex + 1);
  assert.deepEqual(result[fuelIndex], { type: "EXTRA", item: "Fuel Surcharge", qty: "3", from: "", to: "" });
});

test("dinner rows display and store only one date", async () => {
  const result = await page.evaluate(() => {
    document.getElementById("checkin").value = "26.12.2026";
    document.getElementById("checkout").value = "07.01.2027";
    const christmas = HotelCalculatorApp.addRow({ type: "DINNER", item: "Christmas Gala Dinner - Adult", qty: 2 });
    const newYear = HotelCalculatorApp.addRow({ type: "DINNER", item: "New Year Gala Dinner - Adult", from: "31.12.2026", to: "31.12.2026", qty: 2 });
    HotelCalculatorApp.recalc();
    return {
      christmas: christmas.querySelector(".from").value,
      newYear: newYear.querySelector(".from").value,
      to: christmas.querySelector(".to").value,
      toHidden: christmas.querySelector(".to").hidden,
    };
  });
  assert.deepEqual(result, { christmas: "24.12.2026", newYear: "31.12.2026", to: "", toHidden: true });
});

test("SPO import restores saved prices, discounts and Days Before", async () => {
  const result = await page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    HotelCalculatorStorage.setRateAutofillEnabled(true);
    HotelCalculatorStorage.saveRateMemory({
      hotel: "Angsana Velavaru", type: "ROOM", item: "Beachfront Family Pool Villa",
      from: "30.12.2026", to: "07.01.2027", spo: "EBO90", rate: 2410,
      rateFormula: "2410", discounts: [25],
    });
    HotelCalculatorStorage.saveHistory({
      id: "saved-spo", savedAt: new Date().toISOString(),
      payload: { hotel: "Angsana Velavaru", spo: "EBO90", eboDays: "90", rows: [] },
    });
    $("showSamoImport").click();
    $("samoImportText").value = `Hotel: Angsana Velavaru 5*
Number of guest: 2 Adult
Arrival date: 30.12.2026
Departure date: 07.01.2027
Villa category: Beachfront Family Villa With Pool 2 Adl
Meal Plan: AI - Dine
SPO code: EBO90
Room quotation: 8*1807.50[5926/Std/EBO90]`;
    $("parseSamoImport").click();
    $("applySamoImport").click();
    const room = [...document.querySelectorAll("#rows tr")].find((row) => row.querySelector(".type").value === "ROOM");
    return { days: $("eboDays").value, rate: room.querySelector(".rate").value, discounts: [...room.querySelectorAll(".discount")].map((input) => input.value) };
  });
  assert.deepEqual(result, { days: "90", rate: "2410", discounts: ["25"] });
});

test("SAMO quotation splits room periods without importing its prices", async () => {
  const result = await page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    $("showSamoImport").click();
    $("samoImportText").value = `Hotel: Angsana Velavaru 5*
Number of guest: 2 Adult
Arrival date: 30.12.2026
Departure date: 07.01.2027
Villa category: Beachfront Family Villa With Pool 2 Adl
Meal Plan: AI - Dine
Room quotation: 6*1807.50[5926/Std/EBO90]+2*1446.00[8920/Std/ANSPTA2607]`;
    $("parseSamoImport").click();
    $("applySamoImport").click();
    return [...document.querySelectorAll("#rows tr")]
      .filter((row) => row.querySelector(".type").value === "ROOM")
      .map((row) => ({
        from: row.querySelector(".from").value,
        to: row.querySelector(".to").value,
        rate: row.querySelector(".rate").value,
      }));
  });
  assert.deepEqual(result, [
    { from: "30.12.2026", to: "05.01.2027", rate: "" },
    { from: "05.01.2027", to: "07.01.2027", rate: "" },
  ]);
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
    rooms: [["29.09.2026", "01.10.2026", ""], ["01.10.2026", "06.10.2026", ""]],
    meals: [{ item: "AI - Adult", qty: "2" }, { item: "AI - Child", qty: "1" }],
  });
});

test("SAMO maps Heritance Aarah and its Premium AI meal", async () => {
  const result = await page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    $("showSamoImport").click();
    $("samoImportText").value = `Hotel: Heritance Aarah Maldives Resort 5*
Number of guest: 2 Adult, 0 Child
Arrival date: 14.01.2027
Departure date: 22.01.2027
Villa category: Beach Villa 2 Adl
Meal Plan: AI - Premium
Transfer: Seaplane`;
    $("parseSamoImport").click();
    const previewHotel = $("samoImportPreview").textContent;
    $("applySamoImport").click();
    const meal = [...document.querySelectorAll("#rows tr")].find((row) => row.querySelector(".type")?.value === "MEAL");
    return { hotel: $("hotel").value, meal: meal?.querySelector(".item").value || "", previewHotel };
  });
  assert.equal(result.hotel, "Heritance Aarah Maldives");
  assert.equal(result.meal, "Premium AI - Adult");
  assert.match(result.previewHotel, /Heritance Aarah MaldivesMapped/);
});

test("SAMO maps Ritz-Carlton and creates its HB meal rows", async () => {
  const result = await page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    $("showSamoImport").click();
    $("samoImportText").value = `Hotel: The Ritz-Carlton Maldives, Fari Islands 5*Deluxe
Number of guest: 2 Adult, 2 Child
Arrival date: 26.10.2026
Departure date: 01.11.2026
Villa category: Ocean Pool Villa 2 Adl + 2 Chd
Meal Plan: HB
Transfer: Speedboat`;
    $("parseSamoImport").click();
    const preview = $("samoImportPreview").textContent;
    $("applySamoImport").click();
    const meals = [...document.querySelectorAll("#rows tr")]
      .filter((row) => row.querySelector(".type")?.value === "MEAL")
      .map((row) => [row.querySelector(".item").value, row.querySelector(".qty").value]);
    const room = [...document.querySelectorAll("#rows tr")]
      .find((row) => row.querySelector(".type")?.value === "ROOM")
      ?.querySelector(".item").value || "";
    return { hotel: $("hotel").value, meals, preview, room };
  });
  assert.equal(result.hotel, "The Ritz-Carlton Maldives, Fari Islands");
  assert.equal(result.room, "Ocean Pool Villa");
  assert.deepEqual(result.meals, [["HB - Adult", "2"], ["HB - Child", "2"]]);
  assert.match(result.preview, /The Ritz-Carlton Maldives, Fari IslandsMapped/);
});

test("SAMO maps Lily Beach, an official room and its Platinum Plan meals", async () => {
  const result = await page.evaluate(() => {
    const $ = (id) => document.getElementById(id);
    $("showSamoImport").click();
    $("samoImportText").value = `Hotel: Lily Beach Resort & Spa 5*
Number of guest: 2 Adult, 1 Child
Arrival date: 14.10.2026
Departure date: 21.10.2026
Villa category: Beach Suite with Pool 2 Adl + 1 Chd
Meal Plan: AI - Platinum
Transfer: Seaplane`;
    $("parseSamoImport").click();
    const preview = $("samoImportPreview").textContent;
    $("applySamoImport").click();
    const rows = [...document.querySelectorAll("#rows tr")];
    const room = rows.find((row) => row.querySelector(".type")?.value === "ROOM")?.querySelector(".item").value || "";
    const meals = rows
      .filter((row) => row.querySelector(".type")?.value === "MEAL")
      .map((row) => [row.querySelector(".item").value, row.querySelector(".qty").value]);
    return { hotel: $("hotel").value, meals, preview, room };
  });
  assert.equal(result.hotel, "Lily Beach Resort & Spa");
  assert.equal(result.room, "Beach Suite with Pool");
  assert.deepEqual(result.meals, [["Platinum Plan - Adult", "2"], ["Platinum Plan - Child", "1"]]);
  assert.match(result.preview, /Lily Beach Resort & SpaMapped/);
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

test("round-trip transfers hide dates while one-way transfers keep them", async () => {
  const result = await page.evaluate(() => {
    const roundTrip = HotelCalculatorApp.addRow({ type: "TRANSFER", item: "Seaplane - Adult" });
    const oneWay = HotelCalculatorApp.addRow({ type: "TRANSFER", item: "Seaplane OW - Adult" });
    return {
      roundTrip: {
        fromHidden: roundTrip.querySelector(".from").hidden,
        toHidden: roundTrip.querySelector(".to").hidden,
      },
      oneWay: {
        fromHidden: oneWay.querySelector(".from").hidden,
        toHidden: oneWay.querySelector(".to").hidden,
        fromDisabled: oneWay.querySelector(".from").disabled,
        toDisabled: oneWay.querySelector(".to").disabled,
      },
    };
  });
  assert.deepEqual(result, {
    roundTrip: { fromHidden: true, toHidden: true },
    oneWay: { fromHidden: false, toHidden: false, fromDisabled: false, toDisabled: false },
  });
});

test("short share preview uses Arial 10pt", async () => {
  const result = await page.evaluate(() => {
    const preview = document.getElementById("shareText");
    const style = getComputedStyle(preview);
    return { family: style.fontFamily, size: style.fontSize };
  });
  assert.match(result.family, /^Arial/i);
  assert.ok(Math.abs(Number.parseFloat(result.size) - (10 * 4 / 3)) < 0.1);
});
