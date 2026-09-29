const { readFileSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const { join } = require("node:path");

const root = join(__dirname, "..");
const filesToCheck = [
  "assets/core.js",
  "assets/hotelData.js",
  "assets/storage.js",
  "assets/appearanceInit.js",
  "assets/googleConfig.js",
  "assets/googleDrive.js",
  "assets/initialLayout.js",
  "assets/samoParser.js",
  "assets/app.js",
  "assets/updateManager.js",
  "assets/sharePresentation.js",
  "tests/sharePresentation.test.js",
  "assets/hotelReselect.js",
  "tools/lint.js",
  "tools/set-version.js",
  "tools/benchmark.js",
  "tests/core.test.js",
  "tests/release.test.js",
  "tests/updateManager.test.js",
  "tests/samoParser.test.js",
  "tests/googleDrive.test.js",
  "tests/browser.test.js",
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
if (scriptTags !== 14) fail(`Expected exactly 14 script tags, found ${scriptTags}.`);
if (!html.includes("assets/sharePresentation.js")) fail("HTML must load sharePresentation.js.");
if (!html.includes("assets/updateManager.js")) fail("HTML must load updateManager.js.");
if (/onclick=|onchange=|oninput=/.test(html)) fail("Inline event handlers are not allowed.");
if (!html.includes("assets/initialLayout.js") || !html.includes("assets/appearanceInit.js") || !html.includes("assets/core.js") || !html.includes("assets/hotelData.js") || !html.includes("assets/storage.js") || !html.includes("assets/googleConfig.js") || !html.includes("assets/googleDrive.js") || !html.includes("assets/samoParser.js") || !html.includes("assets/app.js") || !html.includes("assets/hotelReselect.js")) {
  fail("HTML must load initialLayout.js, appearanceInit.js, core.js, hotelData.js, storage.js, Google Drive modules, samoParser.js, app.js, and hotelReselect.js.");
}
if (!html.includes("https://static.cloudflareinsights.com/beacon.min.js") || !html.includes("data-cf-beacon")) {
  fail("HTML must load Cloudflare Web Analytics with the official beacon script.");
}

const app = readFileSync(join(root, "assets/app.js"), "utf8");
if (!/window\.HotelCalculatorApp/.test(app)) fail("App should expose a small debug/test surface.");

const packageVersion = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
const publishedVersion = JSON.parse(readFileSync(join(root, "version.json"), "utf8")).version;
const appVersion = /const APP_VERSION = "([^"]+)"/.exec(app)?.[1];
const appBuild = /const APP_BUILD = "([^"]+)"/.exec(app)?.[1];
if (!packageVersion || packageVersion !== appVersion || publishedVersion !== appBuild) {
  fail(`Version mismatch: package=${packageVersion}, manifest=${publishedVersion}, app=${appVersion}, build=${appBuild}.`);
}
if (!html.includes(`id="appVersion">v${packageVersion}<`) || !html.includes(`assets/app.js?v=${appBuild}`)) {
  fail(`index.html does not reference version ${packageVersion} and build ${appBuild}.`);
}
for (const match of html.matchAll(/(?:src|href)="(assets\/[^"?]+)(?:\?([^"#]*))?"/g)) {
  if (new URLSearchParams(match[2] || "").get("v") !== appBuild) {
    fail(`Asset build mismatch: ${match[1]}. Expected ${appBuild}.`);
  }
}

if (failed) process.exit(1);
console.log("Lint passed.");
