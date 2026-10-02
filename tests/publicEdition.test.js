const test = require("node:test");
const assert = require("node:assert/strict");
const { existsSync, readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");

test("public edition ships no reservation editor code or entry points", () => {
  for (const file of ["assets/bookingRequest.js", "tests/bookingRequest.test.js"]) {
    assert.equal(existsSync(join(root, file)), false, file);
  }
  const files = ["index.html", ...readdirSync(join(root, "assets"))
    .filter((name) => /\.(?:js|css|html)$/.test(name)).map((name) => `assets/${name}`)];
  for (const file of files) {
    assert.doesNotMatch(readFileSync(join(root, file), "utf8"),
      /HotelBookingRequest|bookingRequest|bookingSource|bookingTemplate|Booking Request|Reservation Request|booking-modal|bookingEditor|bookingPreview|showBooking/,
      file);
  }
});

test("public edition retains calculator, import, share, history and Drive controls", () => {
  const html = readFileSync(join(root, "index.html"), "utf8");
  for (const id of ["rows", "staySummary", "grandTotal", "showSamoImport", "shareModal", "downloadShare", "showHistory", "connectDrive", "syncDrive", "rateAutofill"]) {
    assert.ok(html.includes(`id="${id}"`), id);
  }
  for (const file of ["core.js", "samoParser.js", "sharePresentation.js", "storage.js", "googleDrive.js", "hotelData.js"]) {
    assert.ok(html.includes(`assets/${file}?v=`), file);
  }
});
