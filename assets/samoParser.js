(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HotelCalculatorSamoParser = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DAY = 24 * 60 * 60 * 1000;

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function parseDate(value) {
    const match = /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/.exec(String(value || ""));
    if (!match) return null;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  function formatDate(value) {
    const date = value instanceof Date ? value : parseDate(value);
    return date ? `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}` : "";
  }

  function nightsBetween(from, to) {
    const start = parseDate(from);
    const end = parseDate(to);
    if (!start || !end) return 0;
    return Math.max(0, Math.round((end - start) / DAY));
  }

  function normalizeLines(text) {
    return String(text || "")
      .replace(/\u00a0/g, " ")
      .replace(/\\([*_])/g, "$1")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
  }

  function cleanLabelValue(value) {
    return String(value || "").replace(/^[\s:;-]+/, "").trim();
  }

  function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function allKnownLabels() {
    return [
      "Hotel",
      "Guest name",
      "Number of guest",
      "Number of guests",
      "Guests",
      "Pax",
      "Arrival date",
      "Arrival",
      "Departure date",
      "Departure",
      "Length of stay",
      "Stay length",
      "Villa category",
      "Room category",
      "Villa",
      "Meal Plan",
      "Meal",
      "Handling fee",
      "Service text",
      "Transfer",
      "Gala Dinner",
      "Remarks",
      "SPO code",
      "SPO",
      "Room quotation",
      "Room quote",
      "Quotation",
      "Flight details",
    ];
  }

  function labelMatch(line, labels) {
    const joined = labels.map(escapeRegex).join("|");
    return new RegExp(`^(?:${joined})\\s*(?::\\s*(.*))?$`, "i").exec(line);
  }

  function isKnownLabel(line) {
    return Boolean(labelMatch(line, allKnownLabels()));
  }

  function labelValue(line, labels) {
    const match = labelMatch(line, labels);
    return match && match[1] ? cleanLabelValue(match[1]) : "";
  }

  function valueAtLabel(lines, index, labels) {
    const match = labelMatch(lines[index], labels);
    if (!match) return "";
    const inlineValue = cleanLabelValue(match[1] || "");
    if (inlineValue) return inlineValue;
    for (let next = index + 1; next < lines.length; next += 1) {
      if (isKnownLabel(lines[next])) return "";
      return cleanLabelValue(lines[next]);
    }
    return "";
  }

  function firstLabel(lines, labels) {
    for (let index = 0; index < lines.length; index += 1) {
      const value = valueAtLabel(lines, index, labels);
      if (value) return value;
    }
    return "";
  }

  function allLabels(lines, labels) {
    const values = [];
    lines.forEach((line, index) => {
      if (!labelMatch(line, labels)) return;
      const value = valueAtLabel(lines, index, labels);
      if (value) values.push(value);
    });
    return values;
  }

  function normalizeHotelName(value) {
    return String(value || "")
      .replace(/[★☆]/g, "*")
      .replace(/\b[1-7]\s*\*+$/i, "")
      .replace(/&/g, " and ")
      .replace(/\(\s*ex\.?\s+[^)]*\)/gi, " ")
      .replace(/[()]/g, " ")
      .replace(/\bresort\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function matchHotel(rawHotel, hotelNames = []) {
    const normalized = normalizeHotelName(rawHotel);
    if (!normalized) return { mappedHotel: "", status: "unresolved" };
    const candidates = hotelNames
      .map((name) => ({ name, normalized: normalizeHotelName(name) }))
      .filter((item) => item.normalized);
    const exact = candidates.find((item) => item.normalized === normalized);
    if (exact) return { mappedHotel: exact.name, status: "mapped" };
    const soft = candidates.filter((item) => item.normalized.includes(normalized));
    return soft.length === 1 ? { mappedHotel: soft[0].name, status: "mapped" } : { mappedHotel: "", status: "unresolved" };
  }

  function parsePax(value) {
    const text = String(value || "");
    const find = (patterns) => {
      for (const pattern of patterns) {
        const match = pattern.exec(text);
        if (match) return Number(match[1]);
      }
      return 0;
    };
    return {
      adults: find([/(\d+)\s*(?:adult|adl)\b/i, /(?:adult|adl)\D+(\d+)/i]),
      children: find([/(\d+)\s*(?:child|children|chd)\b/i, /(?:child|children|chd)\D+(\d+)/i]),
      infants: find([/(\d+)\s*(?:infant|inf)\b/i, /(?:infant|inf)\D+(\d+)/i]),
    };
  }

  function parseLength(value) {
    const match = /(\d+)\s*(?:night|nights|nts|n)\b/i.exec(String(value || ""));
    return match ? Number(match[1]) : 0;
  }

  function parseGuestRoleCounts(lines) {
    const seen = new Set();
    return lines.reduce((counts, line) => {
      const guestLine = line.replace(/^guest\s+name\s*:\s*/i, "");
      const role = /^(MR|MRS|MS|CHD|INF)\b/i.exec(guestLine)?.[1]?.toUpperCase();
      if (!role) return counts;
      const dob = /\bDOB\b\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i.exec(guestLine)?.[1] || "";
      const key = `${role}|${dob}|${guestLine.replace(/\bPN\b.*$/i, "").trim().toLowerCase()}`;
      if (seen.has(key)) return counts;
      seen.add(key);
      if (["MR", "MRS", "MS"].includes(role)) counts.adults += 1;
      else if (role === "CHD") counts.children += 1;
      else if (role === "INF") counts.infants += 1;
      return counts;
    }, { adults: 0, children: 0, infants: 0 });
  }

  function cleanRoomName(value) {
    return String(value || "")
      .replace(/\b\d+\s*(?:adl|adult|adults|chd|child|children|inf|infant|infants)\b.*$/i, "")
      .replace(/\s+\+\s*$/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseRooms(lines) {
    const rooms = [];
    let current = {};

    function pushCurrent() {
      if (!current.item && !current.from && !current.to) return;
      const room = {
        item: cleanRoomName(current.item),
        from: formatDate(current.from),
        to: formatDate(current.to),
        nights: current.nights || nightsBetween(current.from, current.to),
      };
      if (room.item || room.from || room.to) rooms.push(room);
      current = {};
    }

    lines.forEach((line, index) => {
      const arrival = valueAtLabel(lines, index, ["Arrival date", "Arrival"]);
      if (arrival) {
        if (current.item) pushCurrent();
        current.from = arrival;
        return;
      }
      const departure = valueAtLabel(lines, index, ["Departure date", "Departure"]);
      if (departure) {
        current.to = departure;
        return;
      }
      const length = valueAtLabel(lines, index, ["Length of stay", "Stay length"]);
      if (length) {
        current.nights = parseLength(length);
        return;
      }
      const villa = valueAtLabel(lines, index, ["Villa category", "Room category", "Villa"]);
      if (villa) current.item = villa;
    });
    pushCurrent();
    return rooms.filter((room) => room.item || room.from || room.to);
  }

  function ageOnDate(dobValue, checkinValue) {
    const dob = parseDate(dobValue);
    const checkin = parseDate(checkinValue);
    if (!dob || !checkin || dob > checkin) return "";
    let age = checkin.getFullYear() - dob.getFullYear();
    const hadBirthday = checkin.getMonth() > dob.getMonth()
      || (checkin.getMonth() === dob.getMonth() && checkin.getDate() >= dob.getDate());
    if (!hadBirthday) age -= 1;
    return age >= 0 && age <= 17 ? age : "";
  }

  function parseChildAges(lines, checkin) {
    const uniqueLines = [...new Set(lines.map((line) => line.replace(/\bPN\b.*$/i, "").trim().toUpperCase()))];
    return uniqueLines
      .filter((line) => /\bchd\b|\bchild\b/i.test(line))
      .map((line) => {
        const match = /\bDOB\b\s*:?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i.exec(line);
        return match ? ageOnDate(match[1], checkin) : "";
      })
      .filter((age) => age !== "");
  }

  function parseTransfer(value) {
    const text = String(value || "").toUpperCase();
    const mode = /\bSPEED\s*BOAT\b|\bSPEEDBOAT\b/.test(text)
      ? "SPEEDBOAT"
      : /\bSEA\s*PLANE\b|\bSEAPLANE\b/.test(text)
        ? "SEAPLANE"
        : /\bDOMESTIC\b/.test(text)
          ? "DOMESTIC"
          : "";
    if (!mode) return { raw: value || "", mode: "", oneWay: false, status: value ? "unresolved" : "missing" };
    const oneWay = /\bOW\b|\bONE\s*-?\s*WAY\b|\b1\s*-?\s*WAY\b/.test(text);
    return { raw: value, mode, oneWay, status: "detected" };
  }

  function parseRoomQuotation(value) {
    const raw = Array.isArray(value) ? value.filter(Boolean).join(" + ") : String(value || "").trim();
    const components = [...raw.matchAll(/(\d+)\s*\*\s*(\d+(?:[.,]\d+)?)/g)].map((match) => ({
      nights: Number(match[1]),
      rate: Number(match[2].replace(",", ".")),
      expression: `${match[1]}*${match[2].replace(",", ".")}`,
    }));
    return { raw, components };
  }

  function spoFromRoomQuotation(quotation) {
    const raw = quotation?.raw || "";
    const bracketParts = [...raw.matchAll(/\[([^\]]+)\]/g)].map((match) => match[1]);
    const codes = [];
    for (const part of bracketParts) {
      const pieces = part.split(/[;/]/).map((item) => item.trim()).filter(Boolean);
      const code = [...pieces].reverse().find((item) => !/^\d+$/.test(item) && !/^std$/i.test(item));
      if (code && !codes.includes(code)) codes.push(code);
    }
    return codes.join(" + ");
  }

  function parseGalaDinner(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const normalized = raw.toLowerCase();
    const isNewYear = /\bnew\s+year\b|31[./-]12/i.test(raw);
    const isChristmas = /\bchristmas\b|\bxmas\b|24[./-]12/i.test(raw);
    const itemBase = isNewYear
      ? "New Year Gala Dinner"
      : isChristmas
        ? "Christmas Gala Dinner"
        : "";
    const dates = [...raw.matchAll(/\d{1,2}[./-]\d{1,2}[./-]\d{4}/g)].map((match) => formatDate(match[0]));
    return {
      raw,
      itemBase,
      from: dates[0] || "",
      to: dates[1] || dates[0] || "",
      status: itemBase ? "detected" : "unresolved",
    };
  }

  function parseSamoRequest(text, options = {}) {
    const lines = normalizeLines(text);
    const warnings = [];
    const rawHotel = firstLabel(lines, ["Hotel"]);
    const hotelMatch = matchHotel(rawHotel, options.hotelNames || []);
    if (rawHotel && hotelMatch.status === "unresolved") warnings.push("Hotel was detected but not safely matched to the database.");

    const pax = parsePax(firstLabel(lines, ["Number of guest", "Number of guests", "Guests", "Pax"]));
    const roleCounts = parseGuestRoleCounts(lines);
    const guests = {
      adults: roleCounts.adults || pax.adults,
      children: (roleCounts.children || roleCounts.infants) ? roleCounts.children : pax.children,
      infants: roleCounts.infants || pax.infants,
    };
    const rooms = parseRooms(lines);
    const labelCheckin = formatDate(firstLabel(lines, ["Arrival date", "Arrival"]));
    const labelCheckout = formatDate(firstLabel(lines, ["Departure date", "Departure"]));
    const checkin = rooms.find((room) => room.from)?.from || labelCheckin;
    const checkout = [...rooms].reverse().find((room) => room.to)?.to || labelCheckout;
    const nights = nightsBetween(checkin, checkout) || parseLength(firstLabel(lines, ["Length of stay", "Stay length"]));
    const childAges = parseChildAges(lines, checkin);
    const mealPlan = firstLabel(lines, ["Meal Plan", "Meal"]);
    const handlingFee = firstLabel(lines, ["Handling fee", "Service text"]);
    const transfer = parseTransfer(firstLabel(lines, ["Transfer"]));
    const galaDinners = [...new Map(allLabels(lines, ["Gala Dinner"]).map(parseGalaDinner).filter(Boolean)
      .map((gala) => [JSON.stringify([gala.itemBase || gala.raw, gala.from, gala.to]), gala])).values()];
    const roomQuotation = parseRoomQuotation(allLabels(lines, ["Room quotation", "Room quote", "Quotation"]));
    const explicitSpo = firstLabel(lines, ["SPO code", "SPO"]);
    const spo = explicitSpo || spoFromRoomQuotation(roomQuotation);
    const greenTax = /maldives\s+green\s+tax/i.test(`${handlingFee}\n${lines.join("\n")}`);

    if (!rawHotel) warnings.push("Hotel was not detected.");
    if (!checkin || !checkout) warnings.push("Stay dates were not fully detected.");
    if (guests.children > 0 && childAges.length < guests.children) warnings.push("Some child ages could not be detected safely.");

    return {
      hotel: rawHotel,
      mappedHotel: hotelMatch.mappedHotel,
      hotelStatus: rawHotel ? hotelMatch.status : "missing",
      checkin,
      checkout,
      nights,
      adults: guests.adults,
      children: guests.children,
      infants: guests.infants,
      childAges,
      rooms,
      mealPlan,
      transfer,
      galaDinners,
      greenTax,
      spo,
      roomQuotation,
      warnings,
    };
  }

  return {
    parseSamoRequest,
    normalizeHotelName,
    ageOnDate,
  };
});
