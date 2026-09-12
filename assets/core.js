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

  function normalizeRateFormula(value) {
    return String(value || "").trim().replaceAll(",", ".").replace(/\s+/g, "");
  }

  function shareMoney(value) {
    const rounded = Math.round(Number(value || 0) * 100) / 100;
    const digits = Number.isInteger(rounded) ? 0 : 2;
    return rounded.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: 2,
    });
  }

  function shareRateFormula(value) {
    return normalizeRateFormula(value)
      .replace(/(\d+)\.00(?!\d)/g, "$1")
      .replace(/([+\-*/])/g, " $1 ")
      .replace(/\s+/g, " ")
      .trim();
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
    const valid = Number.isFinite(qty) && qty >= 0 && Number.isInteger(qty)
      && (!isDiscountable(row) || (row.discounts || []).every((discount) => Number.isFinite(Number(discount)) && Number(discount) >= 0 && Number(discount) <= 100));
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
      valid,
      net: valid ? applyDiscounts(base, discounts) : null,
    };
  }

  function calculateRows(rows) {
    const calculatedRows = rows.map(calculateRow);
    const total = calculatedRows.every((row) => row.valid) ? calculatedRows.reduce((sum, row) => sum + row.net, 0) : null;
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
      ? `(${shareRateFormula(row.rateFormula)})${row.qty === 1 ? "" : ` * ${row.qty}`}`
      : `${row.rate ? shareMoney(row.rate).replaceAll(",", "") : "0"} * ${row.qty}`;
    if ((isStayBased(row) || row.type === "EXTRA") && row.nights > 0) formula += ` * ${row.nights}`;
    row.discounts.forEach((discount) => {
      formula += ` - ${discount}%`;
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
        ? `(${shareRateFormula(row.rateFormula)})${row.qty === 1 ? "" : ` * ${row.qty}`}`
        : `${shareMoney(row.rate).replaceAll(",", "")} * ${row.qty}`
    ));
    let formula = parts.length > 1 ? `(${parts.join(" + ")})` : parts[0];
    const first = group.rows[0];
    if ((isStayBased(first) || first.type === "EXTRA") && first.nights > 0) formula += ` * ${first.nights}`;
    first.discounts.forEach((discount) => {
      formula += ` - ${discount}%`;
    });
    return formula;
  }

  function buildStaySummaries(inputRows, { calculated = false } = {}) {
    const rows = (calculated ? inputRows : calculateRows(inputRows || []).rows)
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
      const key = room.roomKey
        ? `room:${room.roomKey}`
        : (roomCounts[roomLabel] > 1 ? `room:${roomLabel}` : `stay:${room.from}:${room.to}:${roomLabel}`);
      let group = groups.find((item) => item.key === key);
      if (!group) {
        group = {
          key,
          roomKey: room.roomKey || "",
          from: room.from,
          to: room.to,
          dates: new Set(),
          rooms: [],
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
    extrasAndMeals.forEach((row) => {
      if (row.nights <= 0) return;
      let allocations = groups.map((group) => ({
        group,
        roomWeight: group.rooms.reduce((sum, room) => (
          sum + overlapNights(room.from, room.to, row.from, row.to) * Number(room.qty || 0)
        ), 0),
      })).filter((allocation) => allocation.roomWeight > 0);

      if (row.type === "EXTRA") {
        if (groups.length === 1) {
          allocations.forEach(({ group }) => { group.extraNet += row.net; });
        } else if (row.assignedRoomKey) {
          allocations = allocations.filter(({ group }) => group.roomKey === row.assignedRoomKey);
          allocations.forEach(({ group }) => { group.extraNet += row.net; });
        }
        return;
      }

      allocations.forEach((allocation) => {
        allocation.weight = allocation.roomWeight;
      });
      allocations = allocations.filter((allocation) => allocation.weight > 0);
      const coveredWeight = allocations.reduce((sum, allocation) => sum + allocation.weight, 0);
      const allocationBase = Math.max(row.nights, coveredWeight);

      allocations.forEach(({ group, weight }) => {
        const amount = row.net * weight / allocationBase;
        if (row.type === "MEAL") group.mealNet += amount;
        else group.extraNet += amount;
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
    if (calculated.total === null) return "";
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

    const cancellationDays = Number(input.eboDays || 0);
    if (Number.isFinite(cancellationDays) && cancellationDays > 0) {
      out.push(`Cancellation: ${cancellationDays} ${cancellationDays === 1 ? "day" : "days"} before arrival`);
    }
    if (spo) out.push(`SPO: ${spo}`);
    out.push("");

    const rooms = rows.filter((row) => row.type === "ROOM").sort(compareDateRows);
    const extras = rows.filter((row) => row.type === "EXTRA" && !isGreenTax(row));
    const personExtras = extras.filter((row) => /(adult|child)/i.test(row.item || ""));
    const otherExtras = extras.filter((row) => !personExtras.includes(row));
    const greenTax = rows.filter(isGreenTax).sort(compareDateRows);
    const mealGroups = groupedRows(rows, "MEAL").sort((a, b) => compareDateRows(a.rows[0], b.rows[0]));
    const usedExtras = new Set();
    const roomBlocks = [];

    rooms.forEach((room, index) => {
      const key = room.roomKey ? `room:${room.roomKey}` : `legacy:${index}`;
      let block = roomBlocks.find((item) => item.key === key);
      if (!block) {
        block = { key, roomKey: room.roomKey || "", rows: [] };
        roomBlocks.push(block);
      }
      block.rows.push(room);
    });

    function matchingRoomBlocks(extra) {
      if (extra.assignedRoomKey) {
        return roomBlocks.filter((block) => block.roomKey === extra.assignedRoomKey);
      }
      if (roomBlocks.length === 1) return roomBlocks;
      return roomBlocks.filter((block) => block.rows.some((room) => room.from === extra.from && room.to === extra.to));
    }

    function extraBelongsToBlock(extra, block) {
      const matches = matchingRoomBlocks(extra);
      return matches.length === 1 && matches[0] === block;
    }

    roomBlocks.forEach((block) => {
      block.rows.forEach((room) => {
        out.push(`${formatShort(room.from)} - ${formatShort(room.to)} : ${room.item} : ${expression(room)} = ${shareMoney(room.net)}`);
      });
      personExtras
        .filter((row) => !usedExtras.has(row) && extraBelongsToBlock(row, block))
        .sort((a, b) => Number(/child/i.test(a.item)) - Number(/child/i.test(b.item)))
        .forEach((row) => {
          out.push(`${baseLabel(row.item)} : ${expression(row)} = ${shareMoney(row.net)}`);
          usedExtras.add(row);
        });
    });

    [...personExtras.filter((row) => !usedExtras.has(row)), ...otherExtras]
      .sort(compareDateRows)
      .forEach((row) => {
        out.push(`${baseLabel(row.item)} : ${expression(row)} = ${shareMoney(row.net)}`);
      });

    const exactMealGroups = mealGroups.filter((group) => rooms.some((room) => (
      group.rows[0].from === room.from && group.rows[0].to === room.to
    )));
    const otherMealGroups = mealGroups.filter((group) => !exactMealGroups.includes(group));
    [...exactMealGroups, ...otherMealGroups].forEach((group) => {
      const total = group.rows.reduce((sum, row) => sum + row.net, 0);
      out.push(`${formatShort(group.rows[0].from)} - ${formatShort(group.rows[0].to)} : ${group.label} : ${groupExpression(group)} = ${shareMoney(total)}`);
    });

    groupedRows(rows, "DINNER").sort((a, b) => compareDateRows(a.rows[0], b.rows[0])).forEach((group) => {
      const total = group.rows.reduce((sum, row) => sum + row.net, 0);
      out.push(`${group.label} : ${groupExpression(group)} = ${shareMoney(total)}`);
    });

    groupedRows(rows, "TRANSFER").sort((a, b) => compareDateRows(a.rows[0], b.rows[0])).forEach((group) => {
      const total = group.rows.reduce((sum, row) => sum + row.net, 0);
      const prefix = /\bOW\b/i.test(group.label)
        ? `${formatShort(group.rows[0].from)} - ${formatShort(group.rows[0].to)} : `
        : "";
      out.push(`${prefix}${group.label} : ${groupExpression(group)} = ${shareMoney(total)}`);
    });

    greenTax.forEach((row) => {
      out.push(`Green Tax : ${expression(row)} = ${shareMoney(row.net)}`);
    });

    out.push("", `TOTAL: ${shareMoney(calculated.total)} USD`);
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
