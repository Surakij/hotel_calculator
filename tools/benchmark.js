const { chromium } = require("playwright");
const { pathToFileURL } = require("node:url");
const { resolve } = require("node:path");

(async () => {
  const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || "msedge", headless: true });
  try {
    for (const count of [10, 50, 100]) {
      const context = await browser.newContext();
      await context.route("https://**/*", (route) => route.abort());
      const page = await context.newPage();
      await page.goto(pathToFileURL(resolve(__dirname, "../index.html")).href);
      const result = await page.evaluate((count) => {
        const rows = Array.from({ length: count }, (_, index) => ({
          type: index % 2 ? "MEAL" : "ROOM", item: index % 2 ? "HB - Adult" : `Villa ${index}`,
          from: "01.11.2026", to: "08.11.2026", qty: 1, rate: 100, rateFormula: "100", discounts: [10],
        }));
        HotelCalculatorStorage.saveHistory({ id: "benchmark", payload: { hotel: "Benchmark", rows } });
        document.getElementById("showHistory").click();
        const start = performance.now();
        document.querySelector('[data-id="benchmark"] .history-open').click();
        const restoreMs = performance.now() - start;
        const samples = [];
        for (let i = 0; i < 12; i++) {
          const before = performance.now();
          HotelCalculatorApp.recalc();
          if (i >= 2) samples.push(performance.now() - before);
        }
        samples.sort((a, b) => a - b);
        return { count, restoreMs, medianRecalcMs: samples[5], maxRecalcMs: samples.at(-1),
          valuesPreserved: [...document.querySelectorAll("#rows .rate")].every((input) => input.value === "100") };
      }, count);
      console.log(JSON.stringify(result));
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
