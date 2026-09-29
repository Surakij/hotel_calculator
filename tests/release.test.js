const test = require("node:test");
const assert = require("node:assert/strict");
const { join } = require("node:path");
const { prepareRelease } = require("../tools/set-version.js");

test("release preparation synchronizes visible versions and all asset builds", () => {
  for (const build of ["1.6.30", "1.6.29.2"]) {
    const files = prepareRelease(join(__dirname, ".."), build);
    const version = build.split(".").slice(0, 3).join(".");
    assert.equal(JSON.parse(files.get("package.json")).version, version);
    assert.equal(JSON.parse(files.get("version.json")).version, build);
    assert.ok(files.get("assets/app.js").includes(`const APP_BUILD = "${build}";`));
    assert.ok(files.get("assets/app.js").includes(`const APP_VERSION = "${version}";`));
    const html = files.get("index.html");
    assert.ok(html.includes(`id="appVersion">v${version}<`));
    const references = [...html.matchAll(/assets\/[^"\s?]+\?v=([\d.]+)/g)];
    assert.ok(references.length > 10);
    assert.ok(references.every((match) => match[1] === build));
  }
});

test("invalid release input is rejected before preparing writes", () => {
  for (const build of ["", "1.2", "1.02.3", "next", "1.2.3.4.5"]) {
    assert.throws(() => prepareRelease(join(__dirname, ".."), build), /Use a version/);
  }
});
