const test = require("node:test");
const assert = require("node:assert/strict");
const { shareHtml } = require("../assets/sharePresentation.js");

test("share markup escapes manual text including service and total lines", () => {
  const html = shareHtml('<img src=x onerror="bad()">\n01.11 - 08.11 : Villa <script> : 100 & 2\nExtra <b> : 20\nTOTAL: <svg>');
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<svg>"));
  assert.ok(html.includes("&quot;bad()&quot;"));
  assert.ok(html.includes("100 &amp; 2"));
  assert.ok(html.includes("Extra &lt;b&gt;"));
});

test("share markup retains emphasis, blank lines and plain SPO codes", () => {
  const html = shareHtml("Hotel\nSPO: OFFER\n\n01.11 - 08.11 : Villa : 100\nExtra Adult : 20\nTOTAL: 120 USD");
  assert.ok(html.includes("SPO: OFFER\n\n<strong>01.11 - 08.11 : Villa</strong> : 100"));
  assert.ok(html.includes("<strong>Extra Adult</strong> : 20"));
  assert.ok(html.includes('class="share-total" style="text-decoration:underline;text-underline-offset:2px;">TOTAL: 120 USD</strong>'));
});
