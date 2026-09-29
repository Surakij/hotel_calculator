(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HotelCalculatorShare = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function shareHtml(text) {
    return text.split("\n").map((line) => {
      const escaped = escapeHtml(line);
      if (/^TOTAL:/i.test(line)) return `<strong class="share-total" style="text-decoration:underline;text-underline-offset:2px;">${escaped}</strong>`;
      const datedService = /^(\d{2}\.\d{2}(?:\s+-\s+\d{2}\.\d{2})?)\s+:\s+([^:]+)\s+:\s+(.*)$/.exec(line);
      if (datedService) {
        return `<strong>${escapeHtml(datedService[1])} : ${escapeHtml(datedService[2].trim())}</strong> : ${escapeHtml(datedService[3])}`;
      }
      const plainService = /^([^:]+)\s+:\s+(.*)$/.exec(line);
      if (plainService && !/^SPO$/i.test(plainService[1].trim())) {
        return `<strong>${escapeHtml(plainService[1].trim())}</strong> : ${escapeHtml(plainService[2])}`;
      }
      return escaped;
    }).join("\n");
  }

  return { shareHtml };
});
