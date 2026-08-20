const { readFileSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

const root = join(__dirname, "..");
const filesToCheck = [
  "assets/core.js",
  "assets/hotelData.js",
  "assets/app.js",
  "assets/hotelClear.js",
  "tools/lint.js",
  "tests/core.test.js",
];

let failed = false;

function fail(message) {
  failed = true;
  console.error(message);
}

for (const file of filesToCheck) {
  execFileSync(process.execPath, ["--check", join(root, file)], { stdio: "inherit" });
}

const html = readFileSync(join(root, "index.html"), "utf8");
const scriptTags = [...html.matchAll(/<script\b/g)].length;
if (scriptTags !== 4) fail(`Expected exactly 4 script tags, found ${scriptTags}.`);
if (/onclick=|onchange=|oninput=/.test(html)) fail("Inline event handlers are not allowed.");
if (!html.includes("assets/core.js") || !html.includes("assets/hotelData.js") || !html.includes("assets/app.js") || !html.includes("assets/hotelClear.js")) {
  fail("HTML must load core.js, hotelData.js, app.js, and hotelClear.js.");
}

const app = readFileSync(join(root, "assets/app.js"), "utf8");
if (!/window\.HotelCalculatorApp/.test(app)) fail("App should expose a small debug/test surface.");

if (failed) process.exit(1);
console.log("Lint passed.");