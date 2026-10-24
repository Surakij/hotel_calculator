const { test, before, after, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { pathToFileURL } = require("node:url");
const { resolve } = require("node:path");
let browser, context, page, errors;
before(async () => { browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true }); });
after(async () => browser?.close());
beforeEach(async () => {
  context = await browser.newContext({ viewport: { width: 1366, height: 1000 } });
  await context.route("https://**/*", route => route.abort());
  page = await context.newPage();
  page.setDefaultTimeout(7000);
  errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("dialog", dialog => dialog.accept());
  await page.goto(pathToFileURL(resolve(__dirname, "../index.html")).href);
  await page.waitForFunction(() => Boolean(window.HotelCalculatorApp));
  await page.evaluate(() => {
    document.getElementById("rows").innerHTML = "";
    for (const [id, value] of Object.entries({ hotel: "Example Resort", checkin: "12.11.2026", checkout: "19.11.2026", adults: "2" })) document.getElementById(id).value = value;
    const dates = { from: "12.11.2026", to: "19.11.2026" };
    for (const data of [
      { type: "ROOM", item: "Beach Villa", qty: 1, rate: 800, discounts: [25] },
      { type: "MEAL", item: "HB - Adult", qty: 2, rate: 20 },
      { type: "GREEN_TAX", item: "Green Tax", qty: 2, rate: 12 },
    ]) HotelCalculatorApp.addRow({ ...data, ...dates }, { preserveValues: true, deferRender: true });
    HotelCalculatorApp.recalc();
  });
});
afterEach(async () => { await context.close(); assert.deepEqual(errors, []); });
const room = () => page.locator("#rows tr").first();
async function openEditor() {
  await room().locator(".discount-add").click();
  if (await page.locator(".discount-option-free").count()) await page.locator(".discount-option-free").click();
}
async function applyFree(value) {
  await openEditor();
  await page.locator(".free-nights-input").fill(String(value));
  await page.locator(".free-nights-apply").click();
}

test("free nights stay behind the ROOM discount plus and add no rows or column width", async () => {
  const before = await room().evaluate(el => ({ height: el.getBoundingClientRect().height, table: el.closest("table").getBoundingClientRect().width, count: el.cells.length }));
  assert.equal(await page.locator(".discount-options").count(), 0);
  assert.equal(await room().locator(".discount-add").innerText(), "+");
  await applyFree(2);
  const after = await room().evaluate(el => ({ height: el.getBoundingClientRect().height, table: el.closest("table").getBoundingClientRect().width, count: el.cells.length }));
  assert.deepEqual(after, before);
  assert.equal(await page.locator("#rows tr").count(), 3);
  assert.equal(await room().locator(".discount-add").innerText(), "2 free");
  assert.equal(await room().locator(".nights").inputValue(), "7");
  assert.equal(await room().locator(".to").inputValue(), "19.11.2026");
  assert.equal(await room().locator(".net").innerText(), "3,000.00");
  assert.equal(await page.locator("#grandTotal").innerText(), "$3,448.00");
  assert.equal(await page.locator("#rows tr").nth(1).locator(".net").innerText(), "280.00");
  assert.equal(await page.locator("#rows tr").nth(2).locator(".net").innerText(), "168.00");
  const fits = await room().evaluate(el => { const cell=el.querySelector(".discounts").getBoundingClientRect(); return [...el.querySelectorAll(".discounts button, .discounts input")].every(n=>{const r=n.getBoundingClientRect();return r.left>=cell.left&&r.right<=cell.right+1;}); });
  assert.equal(fits, true);
});

test("ordinary additional discounts still work and free nights remain available at four discounts", async () => {
  for (let count=1; count<4; count++) {
    await room().locator(".discount-add").click();
    await page.locator(".discount-option-add").click();
    assert.equal(await room().locator(".discount").count(), count+1);
  }
  await room().locator(".discount-add").click();
  assert.equal(await page.locator(".discount-option-add").isDisabled(), true);
  assert.equal(await page.locator(".discount-option-free").isEnabled(), true);
  await page.locator(".discount-option-free").click();
  await page.locator(".free-nights-input").fill("2");
  await page.locator(".free-nights-apply").click();
  assert.equal(await room().locator(".discount").count(), 4);
});

test("draft reload, history and Undo/Redo preserve free nights", async () => {
  await applyFree(2);
  await page.waitForFunction(() => HotelCalculatorStorage.loadDraft()?.payload?.rows?.[0]?.freeNights === 2);
  await page.locator("#undoChange").click();
  assert.equal(await room().locator(".discount-add").innerText(), "+");
  await page.locator("#redoChange").click();
  assert.equal(await room().locator(".discount-add").innerText(), "2 free");
  await page.evaluate(() => HotelCalculatorApp.saveCalculation());
  assert.equal(await page.evaluate(() => HotelCalculatorStorage.history()[0].payload.rows[0].freeNights), 2);
  await page.waitForFunction(() => HotelCalculatorStorage.loadDraft()?.payload?.rows?.[0]?.freeNights === 2);
  await page.reload();
  assert.equal(await room().locator(".discount-add").innerText(), "2 free");
  assert.equal(await page.locator("#grandTotal").innerText(), "$3,448.00");
  await openEditor();
  await page.locator(".free-nights-remove").click();
  assert.equal(await room().locator(".discount-add").innerText(), "+");
  assert.equal(await page.locator("#grandTotal").innerText(), "$4,648.00");
});

test("Short Share and clipboard use arithmetic subtraction with no separate promotion line", async () => {
  await applyFree(2);
  await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable:true,value:{write:async items=>{window.freeNightsHtml=await(await items[0].getType("text/html")).text();window.freeNightsText=await(await items[0].getType("text/plain")).text();}} }));
  await page.locator("#showShare").click();
  const text=await page.locator("#shareText").innerText();
  assert.match(text,/800 \* 1 \* \(7 - 2\) - 25% = 3,000/);
  assert.doesNotMatch(text,/free nights|paid nights/i);
  await page.locator("#copyShare").click();
  await page.waitForFunction(()=>Boolean(window.freeNightsHtml));
  const copied=await page.evaluate(()=>({html:window.freeNightsHtml,text:window.freeNightsText}));
  assert.match(copied.html,/\(7 - 2\)/);
  assert.match(copied.text,/TOTAL: 3,448 USD/);
  assert.doesNotMatch(copied.text,/free nights/i);
});

test("editor clamps to the stay, cancels safely and follows shortened room periods", async () => {
  await openEditor();
  await page.locator(".free-nights-input").fill("99");
  assert.equal(await page.locator(".free-nights-input").inputValue(), "7");
  await page.keyboard.press("Escape");
  assert.equal(await room().locator(".discount-add").innerText(), "+");
  await applyFree(3);
  await room().locator(".to").fill("14.11.2026");
  await room().locator(".to").press("Tab");
  assert.equal(await room().locator(".discount-add").innerText(), "2 free");
  assert.equal(await room().locator(".net").innerText(), "0.00");
  await openEditor();
  await page.locator(".free-nights-input").fill("-4");
  assert.equal(await page.locator(".free-nights-input").inputValue(), "0");
  await page.locator(".free-nights-apply").click();
  assert.equal(await room().locator(".discount-add").innerText(), "+");
});

test("free-night popover stays inside desktop and narrow viewports without adding page overflow", async () => {
  for(const width of [1366,1920,390]) {
    await page.setViewportSize({width,height:1000});
    await openEditor();
    const bounds=await page.locator(".discount-options").evaluate(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight};});
    assert.ok(bounds.left>=0&&bounds.right<=bounds.width+1&&bounds.top>=0&&bounds.bottom<=bounds.height+1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    await page.keyboard.press("Escape");
  }
});

test("services other than ROOM keep their normal discount plus with no complimentary-night option", async () => {
  const meal=page.locator("#rows tr").nth(1);
  await meal.locator(".discount-add").click();
  assert.equal(await meal.locator(".discount").count(),2);
  assert.equal(await page.locator(".discount-options").count(),0);
});
