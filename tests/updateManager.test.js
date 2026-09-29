const test = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { runInNewContext } = require("node:vm");
const source = readFileSync(join(__dirname, "../assets/updateManager.js"), "utf8");

function setup() {
  const state = { calls: 0, saves: 0, timer: null, navigations: [], values: new Map(), editing: false, dialog: false };
  state.fetch = async () => ({ ok: true, json: async () => ({ version: "1.6.29.2" }) });
  const window = {
    location: { protocol: "https:", href: "https://example.test/calculator/?keep=yes#rows", replace: (url) => state.navigations.push(url) },
    setTimeout: (callback) => { state.timer = callback; return 1; },
    clearTimeout: () => { state.timer = null; },
  };
  runInNewContext(source, {
    window, URL, AbortController,
    document: { querySelector: () => state.dialog, activeElement: { matches: () => state.editing } },
    sessionStorage: {
      getItem: (key) => state.values.get(key),
      setItem: (key, value) => { if (state.storageFailure) throw new Error("Blocked"); state.values.set(key, value); },
      removeItem: (key) => state.values.delete(key),
    },
    fetch: (...args) => { state.calls++; return state.fetch(...args); },
  });
  state.manager = window.HotelCalculatorUpdates.create({ build: "1.6.29.1", saveDraft: () => { state.saves++; return !state.saveFailure; } });
  return state;
}

test("update reloads once and preserves URL parameters and fragment", async () => {
  const state = setup();
  assert.equal(await state.manager.check(), true);
  assert.equal(await state.manager.check(), false);
  assert.deepEqual(state.navigations, ["https://example.test/calculator/?keep=yes&v=1.6.29.2#rows"]);
  assert.equal(state.saves, 1);
  assert.equal(state.timer, null);
});

test("editing, open dialogs and storage failures prevent reload", async () => {
  for (const condition of ["editing", "dialog", "saveFailure", "storageFailure"]) {
    const state = setup();
    state[condition] = true;
    assert.equal(await state.manager.check(), false, condition);
    assert.equal(state.navigations.length, 0, condition);
    state[condition] = false;
    assert.equal(await state.manager.check(), true, condition);
  }
});

test("malformed and older versions do not save or reload", async () => {
  for (const version of ["", "next", "1.2", "1.6.28", "1.6.29.1", "1.2.3.4.5"]) {
    const state = setup();
    state.fetch = async () => ({ ok: true, json: async () => ({ version }) });
    assert.equal(await state.manager.check(), false);
    assert.equal(state.saves, 0);
    assert.equal(state.navigations.length, 0);
  }
});

test("a timed out request releases the check for retry and suppresses concurrent requests", async () => {
  const state = setup();
  const success = state.fetch;
  state.fetch = (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("Aborted")), { once: true });
  });
  const pending = state.manager.check();
  assert.equal(await state.manager.check(), false);
  assert.equal(state.calls, 1);
  state.timer();
  assert.equal(await pending, false);
  assert.equal(state.timer, null);
  state.fetch = success;
  assert.equal(await state.manager.check(), true);
});

test("network, HTTP and JSON failures allow later retries", async () => {
  for (const fetch of [
    async () => { throw new Error("Offline"); },
    async () => ({ ok: false }),
    async () => ({ ok: true, json: async () => { throw new Error("Invalid JSON"); } }),
  ]) {
    const state = setup();
    const success = state.fetch;
    state.fetch = fetch;
    assert.equal(await state.manager.check(), false);
    assert.equal(state.timer, null);
    state.fetch = success;
    assert.equal(await state.manager.check(), true);
  }
});
