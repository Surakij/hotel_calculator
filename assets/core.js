(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.HotelCalcCore = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const DAY = 24 * 60 * 60 * 1000;

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function parseDate(value) {
    const raw = String(value || "").trim();
    let match;
    let year;
    let month;
    let day;

    if ((match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw))) {
      day = Number(match[1]);
      month = Number(match[2]);
      year = Number(match[3]);
    } else if ((match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw))) {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    } else {
      return null;
    }

    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }

    return date;
  }

  function formatDate(value) {
    const date = value instanceof Date ? value : parseDate(value);
    return date ? `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}` : "";
  }

  function formatShort(value) {
    const date = parseDate(value);
    return date ? `${pad(date.getDate())}.${pad(date.getMonth() + 1)}` : "";
  }

  function addDays(value, nights) {
    const date = parseDate(value);
    if (!date) return "";
    date.setDate(date.getDate() + Number(nights || 0));
    return formatDate(date);
  }

  function nightsBetween(from, to) {
    const start = parseDate(from);
    const end = parseDate(to);
    if (!start || !end) return 0;
    return Math.max(0, Math.round((end - start) / DAY));
  }

  function money(value) {
    return Number(value || 0).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function normalizeMoney(value) {
    return money(value).replaceAll(",", "");
  }

  function normalizeRateFormula(value) {
    return String(value || "").trim().replaceAll(",", ".").replace(/\s+/g, "");
  }

  function parseRateExpression(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;

    const formula = normalizeRateFormula(value);
    if (!formula) return 0;
    if (!/^[\d.+\-*/()]+$/.test(formula)) return 0;

    let index = 0;

    function peek() {
      return formula[index];
    }

    function consume(char) {
      if (peek() === char) {
        index += 1;
        return true;
      }
      return false;
    }

    function parseNumber() {
      const start = index;
      while (/\d|\./.test(peek())) index += 1;
      if (start === index) return NaN;
      return Number(formula.slice(start, index));
    }

    function parseFactor() {
      if (consume("+")) return parseFactor();
      if (consume("-")) return -parseFactor();
      if (consume("(")) {
        const result = parseSum();
        if (!consume(")")) return NaN;
        return result;
      }
      return parseNumber();
    }

    function parseProduct() {
      let result = parseFactor();
      while (peek() === "*" || peek() === "/") {
        const operator = peek();
        index += 1;
        const next = parseFactor();
        result = operator === "*" ? result * next : result / next;
      }
      return result;
    }

    function parseSum() {
      let result = parseProduct();
      while (peek() === "+" || peek() === "-") {
        const operator = peek();
        index += 1;
        const next = parseProduct();
        result = operator === "+" ? result + next : result - next;
      }
      return result;
    }

    const result = parseSum();
    return index === formula.length && Number.isFinite(result) && result >= 0 ? result : 0;
  }

  function hasRateFormula(row) {
    return /[+\-*/()]/.test(normalizeRateFormula(row.rateFormula));
  }

  function isGreenTax(row) {
    return row.type === "GREEN_TAX" || (row.type === "EXTRA" && /^green tax$/i.test(row.item || ""));
  }

  function isStayBased(row) {
    return row.type === "ROOM" || row.type === "MEAL" || isGreenTax(row);
  }

  function isDiscountable(row) {
    return row.type !== "DINNER" && !isGreenTax(row);
  }

  function applyDiscounts(value, discounts) {
    return (discounts || []).reduce((result, discount) => result * (1 - Number(discount || 0) / 100), value);
  }

  function calculateRow(row) {
    const nights = nightsBetween(row.from, row.to);
    const qty = Number(row.qty || 0);
    const rate = parseRateExpression(row.rateFormula || row.rate);
    let base = qty * rate;

    if (isStayBased(row)) base *= nights;
    else if (row.type === "EXTRA" && row.from && row.to) base *= nights;

    const discounts = isDiscountable(row) ? (row.discounts || []).map(Number).filter((item) => item > 0) : [];
    return {
      ...row,
      qty,
      rate,
      rateFormula: normalizeRateFormula(row.rateFormula || row.rate),
      discounts,
      nights,
      net: applyDiscounts(base, discounts),
    };
  }

  function calculateRows(rows) {
    const calculatedRows = rows.map(calculateRow);
    const total = calculatedRows.reduce((sum, row) => sum + row.net, 0);
    return { rows: calculatedRows, total };
  }

  function dateRangeLabel(from, to) {
    const start = formatShort(from);
    const end = formatShort(to);
    return start && end ? `${start} - ${end}` : "";
  }

  function dateSortValue(value) {
    const date = parseDate(value);
    return date ? date.getTime() : Number.MAX_SAFE_INTEGER;
  }

  function compareDateRows(a, b) {
    return (
      dateSortValue(a.from) - dateSortValue(b.from)
      || dateSortValue(a.to) - dateSortValue(b.to)
      || String(a.item || "").localeCompare(String(b.item || ""))
    );
  }

  function compareShareEntries(a, b) {
    return (
      dateSortValue(a.from) - dateSortValue(b.from)
      || a.order - b.order
      || dateSortValue(a.to) - dateSortValue(b.to)
      || a.index - b.index
    );
  }

  function overlapNights(aFrom, aTo, bFrom, bTo) {
    const startA = parseDate(aFrom);
    const endA = parseDate(aTo);
    const startB = parseDate(bFrom);
    const endB = parseDate(bTo);
    if (!startA || !endA || !startB || !endB) return 0;
    const start = Math.max(startA.getTime(), startB.getTime());
    const end = Math.min(endA.getTime(), endB.getTime());
    return Math.max(0, Math.round((end - start) / DAY));
  }

  function baseLabel(item) {
    return String(item || "").replace(/\s*-\s*(Adult|Child|Infant)\s*$/i, "").trim();
  }

  function expression(row) {
    let formula = hasRateFormula(row)
      ? `(${normalizeRateFormula(row.rateFormula)})${row.qty === 1 ? "" : `*${row.qty}`}`
      : `${row.rate ? normalizeMoney(row.rate) : "0"}*${row.qty}`;
    if ((isStayBased(row) || row.type === "EXTRA") && row.nights > 0) formula += `*${row.nights}`;
    row.discounts.forEach((discount) => {
      formula += `-${discount}%`;
    });
    return formula;
  }

  function groupedRows(rows, type) {
    const groups = [];
    rows.filter((row) => row.type === type).forEach((row) => {
      const key = [baseLabel(row.item), row.from, row.to, row.discounts.join(",")].join("|");
      let group = groups.find((item) => item.key === key);
      if (!group) {
        group = { key, label: baseLabel(row.item), rows: [] };
        groups.push(group);
      }
      group.rows.push(row);
    });
    return groups;
  }

  function groupExpression(group) {
    const parts = group.rows.map((row) => (
      hasRateFormula(row)
        ? `(${normalizeRateFormula(row.rateFormula)})${row.qty === 1 ? "" : `*${row.qty}`}`
        : `${normalizeMoney(row.rate)}*${row.qty}`
    ));
    let formula = parts.length > 1 ? `(${parts.join("+")})` : parts[0];
    const first = group.rows[0];
    if ((isStayBased(first) || first.type === "EXTRA") && first.nights > 0) formula += `*${first.nights}`;
    first.discounts.forEach((discount) => {
      formula += `-${discount}%`;
    });
    return formula;
  }

  function buildStaySummaries(inputRows) {
    const rows = calculateRows(inputRows || []).rows
      .map((row, index) => ({ ...row, sourceIndex: index }))
      .filter((row) => row.type || row.item || row.rate);
    const rooms = rows.filter((row) => row.type === "ROOM");
    const roomCounts = rooms.reduce((counts, row) => {
      const label = row.item || "Room";
      counts[label] = (counts[label] || 0) + 1;
      return counts;
    }, {});
    const groups = [];

    rooms.forEach((room) => {
      const roomLabel = room.item || "Room";
      const key = roomCounts[roomLabel] > 1 ? `room:${roomLabel}` : `stay:${room.from}:${room.to}:${roomLabel}`;
      let group = groups.find((item) => item.key === key);
      if (!group) {
        group = {
          key,
          from: room.from,
          to: room.to,
          dates: new Set(),
          rooms: [],
          includedRows: new Set(),
          room: roomLabel,
          roomNet: 0,
          mealNet: 0,
          extraNet: 0,
          total: 0,
        };
        groups.push(group);
      }

      group.dates.add(dateRangeLabel(room.from, room.to));
      group.rooms.push(room);
      group.roomNet += room.net;
    });

    const extrasAndMeals = rows.filter((row) => row.type === "MEAL" || (row.type === "EXTRA" && /(adult|child)/i.test(row.item || "")));
    groups.forEach((group) => {
      extrasAndMeals.forEach((row) => {
        const overlap = group.rooms.reduce((sum, room) => sum + overlapNights(room.from, room.to, row.from, row.to), 0);
        if (overlap <= 0 || row.nights <= 0) return;
        if (group.includedRows.has(row.sourceIndex)) return;

        const amount = row.net * Math.min(1, overlap / row.nights);
        if (row.type === "MEAL") group.mealNet += amount;
        else group.extraNet += amount;
        group.includedRows.add(row.sourceIndex);
      });
    });

    return groups.map((group) => {
      const dates = [...group.dates].filter(Boolean).join("; ");
      const total = group.roomNet + group.mealNet + group.extraNet;
      return {
        dates,
        room: group.room,
        roomNet: group.roomNet,
        mealNet: group.mealNet,
        extraNet: group.extraNet,
        total,
      };
    });
  }

  function buildShareText(input) {
    const calculated = calculateRows(input.rows || []);
    const rows = calculated.rows.filter((row) => (row.type || row.item || row.rate) && row.rate > 0);
    const hotel = String(input.hotel || "Hotel").toUpperCase();
    const guests = input.guests || {};
    const ages = String(guests.ages || "").replace(/\s+/g, "");
    const spo = String(input.spo || "").trim();
    let pax = `${Number(guests.adults || 0)}ADL`;

    if (Number(guests.children || 0) > 0) pax += `+${Number(guests.children)}CHD${ages ? `(${ages})` : ""}`;
    if (Number(guests.infants || 0) > 0) pax += `+${Number(guests.infants)}INF`;

    const out = [
      hotel,
      `${formatDate(input.checkin)}-${formatDate(input.checkout)} · ${nightsBetween(input.checkin, input.checkout)}N · ${pax}`,
    ];

    if (spo) out.push(`SPO: ${spo}`);
    out.push("");

    const shareEntries = [];
    let entryIndex = 0;
    const rooms = rows.filter((row) => row.type === "ROOM").sort(compareDateRows);
    const extras = rows.filter((row) => row.type === "EXTRA" && !isGreenTax(row));
    const greenTax = rows.filter(isGreenTax).sort(compareDateRows);
    const usedExtras = new Set();

    function addEntry(row, order, text) {
      shareEntries.push({
        from: row.from,
        to: row.to,
        order,
        index: entryIndex,
        text,
      });
      entryIndex += 1;
    }

    rooms.forEach((room) => {
      addEntry(room, 0, `${formatShort(room.from)} - ${formatShort(room.to)} : ${room.item} : ${expression(room)} = ${money(room.net)}`);
      extras
        .filter((row) => row.from === room.from && row.to === room.to && !usedExtras.has(row))
        .sort((a, b) => Number(/child/i.test(a.item)) - Number(/child/i.test(b.item)))
        .forEach((row) => {
          addEntry(row, 1, `${baseLabel(row.item)} : ${expression(row)} = ${money(row.net)}`);
          usedExtras.add(row);
        });
    });

    extras.filter((row) => !usedExtras.has(row)).sort(compareDateRows).forEach((row) => {
      addEntry(row, 1, `${baseLabel(row.item)} : ${expression(row)} = ${money(row.net)}`);
    });

    groupedRows(rows, "MEAL").sort((a, b) => compareDateRows(a.rows[0], b.rows[0])).forEach((group) => {
      const total = group.rows.reduce((sum, row) => sum + row.net, 0);
      addEntry(group.rows[0], 2, `${formatShort(group.rows[0].from)} - ${formatShort(group.rows[0].to)} : ${group.label} : ${groupExpression(group)} = ${money(total)}`);
    });

    groupedRows(rows, "DINNER").sort((a, b) => compareDateRows(a.rows[0], b.rows[0])).forEach((group) => {
      const total = group.rows.reduce((sum, row) => sum + row.net, 0);
      addEntry(group.rows[0], 3, `${group.label} : ${groupExpression(group)} = ${money(total)}`);
    });

    groupedRows(rows, "TRANSFER").sort((a, b) => compareDateRows(a.rows[0], b.rows[0])).forEach((group) => {
      const total = group.rows.reduce((sum, row) => sum + row.net, 0);
      const prefix = /\bOW\b/i.test(group.label)
        ? `${formatShort(group.rows[0].from)} - ${formatShort(group.rows[0].to)} : `
        : "";
      addEntry(group.rows[0], 4, `${prefix}${group.label} : ${groupExpression(group)} = ${money(total)}`);
    });

    shareEntries.sort(compareShareEntries).forEach((entry) => out.push(entry.text));

    greenTax.forEach((row) => {
      out.push(`Green Tax : ${expression(row)} = ${money(row.net)}`);
    });

    out.push("", `TOTAL: ${money(calculated.total)} USD`);
    return out.join("\n");
  }

  return {
    addDays,
    applyDiscounts,
    buildShareText,
    buildStaySummaries,
    calculateRow,
    calculateRows,
    formatDate,
    formatShort,
    isGreenTax,
    isDiscountable,
    isStayBased,
    money,
    nightsBetween,
    parseDate,
  };
});
