const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");

function fixture() {
  const requests = [];
  const root = {
    HotelCalculatorGoogleConfig: { clientId: "test.apps.googleusercontent.com" },
    google: { accounts: { oauth2: {
      initTokenClient(config) {
        return { requestAccessToken() { requests.push(config); } };
      },
    } } },
  };
  runInNewContext(readFileSync(join(__dirname, "../assets/googleDrive.js"), "utf8"), root);
  return { drive: root.HotelCalculatorGoogleDrive, requests };
}

test("a second Drive connection resolves with its own callback", { timeout: 1000 }, async () => {
  const { drive, requests } = fixture();
  const first = drive.connect();
  requests[0].callback({ access_token: "first-test-token" });
  await first;
  const second = drive.connect();
  requests[1].callback({ access_token: "second-test-token" });
  assert.equal((await second).signedIn, true);
});

test("concurrent Drive connections share one request and recover after cancellation", { timeout: 1000 }, async () => {
  const { drive, requests } = fixture();
  const first = drive.connect();
  const second = drive.connect();
  assert.equal(requests.length, 1);
  const a = assert.rejects(first, /closed or blocked/);
  const b = assert.rejects(second, /closed or blocked/);
  requests[0].error_callback();
  await Promise.all([a, b]);
  const retry = drive.connect();
  requests[1].callback({ access_token: "retry-test-token" });
  assert.equal((await retry).signedIn, true);
});
