const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

function prepareRelease(root, build) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/.test(build)) {
    throw new Error("Use a version such as 1.6.30 or a build such as 1.6.29.2.");
  }
  const version = build.split(".").slice(0, 3).join(".");
  const read = (path) => readFileSync(join(root, path), "utf8");
  const pkg = JSON.parse(read("package.json"));
  pkg.version = version;
  let app = read("assets/app.js");
  for (const [name, value] of [["APP_VERSION", version], ["APP_BUILD", build]]) {
    const pattern = new RegExp(`const ${name} = "[^"]+";`, "g");
    if ([...app.matchAll(pattern)].length !== 1) throw new Error(`Expected one ${name} declaration.`);
    app = app.replace(pattern, `const ${name} = "${value}";`);
  }
  let html = read("index.html");
  if (!/id="appVersion">v[^<]+</.test(html)) throw new Error("Missing displayed version.");
  html = html.replace(/id="appVersion">v[^<]+</, `id="appVersion">v${version}<`)
    .replace(/(assets\/[^"\s?]+\?v=)[\d.]+/g, (_, prefix) => prefix + build);
  return new Map([
    ["package.json", JSON.stringify(pkg, null, 2) + "\n"],
    ["version.json", JSON.stringify({ version: build }, null, 2) + "\n"],
    ["assets/app.js", app],
    ["index.html", html],
  ]);
}

if (require.main === module) {
  try {
    const root = join(__dirname, "..");
    const changes = prepareRelease(root, process.argv[2] || "");
    for (const [path, content] of changes) writeFileSync(join(root, path), content);
    console.log(`Prepared ${process.argv[2]}. Update CHANGELOG.md and run checks before publishing.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { prepareRelease };
