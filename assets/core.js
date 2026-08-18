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

  function isGreenTax(row) {
    return row.type === "EXTRA" && /^green tax$/i.test(row.item || "");
  }

  function isStayBased(row) {
    return row.type === "ROOM" || row.type === "MEAL" || isGreenTax(row);
  }

  function applyDiscounts(value, discounts) {
    return (discounts || []).reduce((result, discount) => result * (1 - Number(discount || 0) / 100), value);
  }

  function calculateRow(row) {
    const nights = nightsBetween(row.from, row.to);
    const qty = Number(row.qty || 0);
    const rate = Number(row.rate || 0);
    let base = qty * rate;

    if (isStayBased(row)) base *= nights;
    else if (row.type === "EXTRA" && row.from && row.to) base *= nights;

    const discounts = (row.discounts || []).map(Number).filter((item) => item > 0);
    return {
      ...row,
      qty,
      rate,
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
    let formula = `${row.rate ? normalizeMoney(row.rate) : "0"}*${row.qty}`;
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
    const parts = group.rows.map((row) => `${normalizeMoney(row.rate)}*${row.qty}`);
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
    const table = buildShareTable(input);
    const rows = table.rows;
    const out = [
      table.hotel,
      `${table.stay} · ${table.nights}N · ${table.pax}`,
    ];

    if (table.spo) out.push(`SPO: ${table.spo}`);
    out.push("");

    rows.forEach((row) => {
      const prefix = row.dates ? `${row.dates} : ` : "";
      out.push(`${prefix}${row.service} : ${row.formula} = ${money(row.net)}`);
    });

    out.push("", `TOTAL: ${money(table.total)} USD`);
    return out.join("\n");
  }

  function buildShareTable(input) {
    const calculated = calculateRows(input.rows || []);
    const rows = calculated.rows.filter((row) => (row.type || row.item || row.rate) && row.rate > 0);
    const hotel = String(input.hotel || "Hotel").toUpperCase();
    const guests = input.guests || {};
    const ages = String(guests.ages || "").replace(/\s+/g, "");
    const spo = String(input.spo || "").trim();
    let pax = `${Number(guests.adults || 0)}ADL`;

    if (Number(guests.children || 0) > 0) pax += `+${Number(guests.children)}CHD${ages ? `(${ages})` : ""}`;
    if (Number(guests.infants || 0) > 0) pax += `+${Number(guests.infants)}INF`;

    const shareRows = [];
    const rooms = rows.filter((row) => row.type === "ROOM");
    const extras = rows.filter((row) => row.type === "EXTRA" && !isGreenTax(row));
    const greenTax = rows.filter(isGreenTax);
    const usedExtras = new Set();

    rooms.forEach((room) => {
      shareRows.push({ dates: dateRangeLabel(room.from, room.to), service: room.item, formula: expression(room), net: room.net });
      extras
        .filter((row) => row.from === room.from && row.to === room.to && !usedExtras.has(row))
        .sort((a, b) => Number(/child/i.test(a.item)) - Number(/child/i.test(b.item)))
        .forEach((row) => {
          shareRows.push({ dates: dateRangeLabel(row.from, row.to), service: baseLabel(row.item), formula: expression(row), net: row.net });
          usedExtras.add(row);
        });
    });

    extras.filter((row) => !usedExtras.has(row)).forEach((row) => {
      shareRows.push({ dates: dateRangeLabel(row.from, row.to), service: baseLabel(row.item), formula: expression(row), net: row.net });
    });

    groupedRows(rows, "MEAL").forEach((group) => {
      const total = group.rows.reduce((sum, row) => sum + row.net, 0);
      shareRows.push({ dates: dateRangeLabel(group.rows[0].from, group.rows[0].to), service: group.label, formula: groupExpression(group), net: total });
    });

    groupedRows(rows, "DINNER").forEach((group) => {
      const total = group.rows.reduce((sum, row) => sum + row.net, 0);
      shareRows.push({ dates: "", service: group.label, formula: groupExpression(group), net: total });
    });

    groupedRows(rows, "TRANSFER").forEach((group) => {
      const total = group.rows.reduce((sum, row) => sum + row.net, 0);
      const dates = /\bOW\b/i.test(group.label) ? dateRangeLabel(group.rows[0].from, group.rows[0].to) : "";
      shareRows.push({ dates, service: group.label, formula: groupExpression(group), net: total });
    });

    greenTax.forEach((row) => {
      shareRows.push({ dates: "", service: "Green Tax", formula: expression(row), net: row.net });
    });

    return {
      hotel,
      stay: `${formatShort(input.checkin)}-${formatShort(input.checkout)}`,
      nights: nightsBetween(input.checkin, input.checkout),
      pax,
      spo,
      rows: shareRows,
      total: calculated.total,
    };
  }

  return {
    addDays,
    applyDiscounts,
    buildShareText,
    buildShareTable,
    buildStaySummaries,
    calculateRow,
    calculateRows,
    formatDate,
    formatShort,
    isGreenTax,
    isStayBased,
    money,
    nightsBetween,
    parseDate,
  };
});
