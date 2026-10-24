(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HotelRequestRemarks = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const boundary = /^(?:Hotel|Guest name|Number of guests?|Guests|Pax|Arrival(?: date| flight)?|Departure(?: date| flight)?|Length of stay|Stay length|Villa(?: category)?|Room(?: category| quotation| quote|\s+\d+)?|Meal(?: plan)?|Drinks|Beverage package|Handling(?: fee)?|Service(?: text|s)?|Accommodation|Transfer|Gala dinner|Green tax|Fuel surcharge|SPO(?: code)?|Quotation|Flight details|Remarks?)(?:[ \t]*:|[ \t]*$)/i;
  function parseRemarks(source) {
    const lines = String(source || "").replace(/\r\n?/g, "\n").replace(/\u00a0/g, " ").split("\n");
    const start = lines.findIndex((line) => /^[ \t]*remarks?(?:[ \t]*:.*|[ \t]*)$/i.test(line));
    if (start < 0) return "";
    const inline = /^[ \t]*remarks?[ \t]*:?[ \t]*(.*)$/i.exec(lines[start])[1];
    const result = inline ? [inline.trim()] : [];
    for (const line of lines.slice(start + 1)) {
      const text = line.trim();
      if (boundary.test(text) || /^(?:IMPORTANT\b|PLEASE SHARE\b|In order to avoid\b|(?:With )?(?:Best|Kind) regards\b)/i.test(text)) break;
      if (/^(?:(?:ACC|TRF|GT|TOTAL)\b|.*\d[\d., ]*[ \t]*\*[ \t]*\d)/i.test(text)) break;
      result.push(line.trimEnd());
    }
    return result.join("\n").trim();
  }
  return { parseRemarks };
});
