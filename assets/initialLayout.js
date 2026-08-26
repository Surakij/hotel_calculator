(function () {
  const root = document.documentElement;
  const fallbackRows = 4;
  const discountBaseWidth = 152;
  const discountStepWidth = 140;
  const tableHeaderHeight = 42;
  const tableRowHeight = 48;
  const summaryBaseHeight = 88;
  const summaryRowHeight = 44;

  try {
    const draft = JSON.parse(localStorage.getItem("hotelCalculator.draft.v1") || "null");
    const rows = Array.isArray(draft?.payload?.rows) ? draft.payload.rows : [];
    const rowCount = Math.max(fallbackRows, rows.length || fallbackRows);
    const maxDiscounts = Math.max(1, ...rows.map((row) => {
      if (Array.isArray(row?.discounts) && row.discounts.length) return row.discounts.length;
      return [row?.d1, row?.d2, row?.d3, row?.d4].filter((value) => Number(value) > 0).length || 1;
    }));
    const pricedRoomRows = rows.filter((row) => row?.type === "ROOM" && (row.rateFormula || Number(row.rate) > 0)).length;

    root.style.setProperty("--discount-column-width", `${discountBaseWidth + (maxDiscounts - 1) * discountStepWidth}px`);
    root.style.setProperty("--table-wrap-min-height", `${Math.max(268, tableHeaderHeight + rowCount * tableRowHeight)}px`);
    root.style.setProperty("--initial-summary-height", pricedRoomRows ? `${summaryBaseHeight + Math.min(pricedRoomRows, 8) * summaryRowHeight}px` : "0px");
  } catch {
    root.style.setProperty("--table-wrap-min-height", "268px");
    root.style.setProperty("--initial-summary-height", "0px");
  }
})();
