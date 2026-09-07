const test = require("node:test");
const assert = require("node:assert/strict");
const parser = require("../assets/samoParser.js");

test("deduplicates repeated dinner events and child identities, not equal ages", () => {
  const guestLines = "CHD FIRST CHILD DOB 01.01.2020 PN TEST\nCHD SECOND CHILD DOB 01.01.2020 PN TEST";
  const result = parser.parseSamoRequest(`Hotel: Test\nArrival date: 20.12.2026\nDeparture date: 28.12.2026\nVilla category: Beach\n${guestLines}\nGala Dinner: Christmas Dinner (24.12.2026 - 24.12.2026)\n${guestLines}\nGala Dinner: Christmas Dinner (24.12.2026 - 24.12.2026)\nGala Dinner: New Year Dinner (31.12.2026 - 31.12.2026)`);
  assert.equal(result.children, 2);
  assert.deepEqual(result.childAges, [6, 6]);
  assert.equal(result.galaDinners.length, 2);
});

test("parses single SAMO stay", () => {
  const result = parser.parseSamoRequest(`
    Hotel: Niva Velassaru Maldives 5*
    Number of guest: 1 Adult, 0 Child
    Arrival date: 30.09.2026
    Departure date: 05.10.2026
    Length of stay: 5 Nights
    Villa category: Beach Villa With Pool 1 Adl
    Meal Plan: HB
    Handling fee: Maldives Green Tax (30.09.2026 - 05.10.2026)
    Transfer: SPEEDBOAT Airport - Hotel - Airport
    SPO code: VM2026/77 + VM2026/78
    Room quotation: 1*533.70+4*652.90
  `, { hotelNames: ["Niva Velassaru Maldives"] });

  assert.equal(result.mappedHotel, "Niva Velassaru Maldives");
  assert.equal(result.checkin, "30.09.2026");
  assert.equal(result.checkout, "05.10.2026");
  assert.equal(result.nights, 5);
  assert.equal(result.adults, 1);
  assert.equal(result.children, 0);
  assert.equal(result.rooms[0].item, "Beach Villa With Pool");
  assert.equal(result.mealPlan, "HB");
  assert.equal(result.transfer.mode, "SPEEDBOAT");
  assert.equal(result.greenTax, true);
  assert.equal(result.spo, "VM2026/77 + VM2026/78");
  assert.deepEqual(result.roomQuotation.components.map((item) => item.expression), ["1*533.70", "4*652.90"]);
});

test("parses split SAMO stay", () => {
  const result = parser.parseSamoRequest(`
    Hotel: Villa Park (Sun Island Resort) 5*
    Number of guest: 2 Adult, 2 Child
    Arrival date: 05.09.2026
    Departure date: 08.09.2026
    Length of stay: 3 Nights
    Villa category: Beach Villa with Whirlpool 2 Adl + 2 Chd
    Arrival date: 08.09.2026
    Departure date: 12.09.2026
    Length of stay: 4 Nights
    Villa category: Lagoon Beach Pool Villa 2 Adl + 2 Chd
    Meal Plan: AI
    Handling fee: Maldives Green Tax (05.09.2026 - 12.09.2026)
  `, { hotelNames: ["Villa Park Sun Island"] });

  assert.equal(result.mappedHotel, "Villa Park Sun Island");
  assert.equal(result.checkin, "05.09.2026");
  assert.equal(result.checkout, "12.09.2026");
  assert.equal(result.rooms.length, 2);
  assert.deepEqual(result.rooms.map((room) => room.item), ["Beach Villa with Whirlpool", "Lagoon Beach Pool Villa"]);
  assert.deepEqual(result.rooms.map((room) => `${room.from}-${room.to}`), ["05.09.2026-08.09.2026", "08.09.2026-12.09.2026"]);
  assert.equal(result.adults, 2);
  assert.equal(result.children, 2);
  assert.equal(result.mealPlan, "AI");
  assert.equal(result.greenTax, true);
});

test("calculates child age from DOB as of check-in", () => {
  const result = parser.parseSamoRequest(`
    Hotel: Niva Velassaru Maldives
    Number of guest: 2 Adult, 1 Child
    Arrival date: 05.09.2026
    Departure date: 10.09.2026
    CHD DOB 12.01.2016 Passport AA123
  `, { hotelNames: ["Niva Velassaru Maldives"] });

  assert.deepEqual(result.childAges, [10]);
});

test("marks unknown hotel as unresolved", () => {
  const result = parser.parseSamoRequest(`
    Hotel: Unknown Island Resort 5*
    Arrival date: 01.09.2026
    Departure date: 03.09.2026
  `, { hotelNames: ["Niva Velassaru Maldives"] });

  assert.equal(result.hotelStatus, "unresolved");
  assert.equal(result.mappedHotel, "");
  assert.match(result.warnings.join(" "), /not safely matched/);
});

test("does not fail when optional SAMO fields are missing", () => {
  const result = parser.parseSamoRequest(`
    Hotel: Niva Velassaru Maldives
    Number of guest: 1 Adult
    Arrival date: 01.09.2026
    Departure date: 02.09.2026
    Villa category: Beach Villa With Pool
  `, { hotelNames: ["Niva Velassaru Maldives"] });

  assert.equal(result.spo, "");
  assert.equal(result.transfer.status, "missing");
  assert.equal(result.greenTax, false);
  assert.equal(result.roomQuotation.components.length, 0);
});

test("parses Outlook-style labels on separate lines without storing personal data", () => {
  const result = parser.parseSamoRequest(`
    Hotel:
    Robinson Noonu 5*
    Guest name:
    MR GUEST ONE DOB 21.10.1988 PN XX TILL 10.12.2031
    MRS GUEST TWO DOB 06.06.1991 PN XX TILL 29.10.2029
    CHD GUEST CHILD DOB 26.05.2020 PN XX TILL 13.10.2031
    INF GUEST INFANT DOB 02.02.2025 PN XX TILL 26.09.2035
    Number of guest:
    2 Adult, 2 Child
    Arrival date:
    20.09.2026
    Flight details:
    TBA
    Departure date:
    28.09.2026
    Flight details:
    TBA
    Length of stay:
    8 Nights
    Villa category:
    Beach Villa Pool 2 Adl + 1 Chd(6-14,99)
    Meal Plan:
    AI
    Handling fee:
    Maldives Green Tax (20.09.2026 - 28.09.2026)
    Transfer:
    Seaplane Airport - Hotel - Airport (20.09.2026 - 28.09.2026)
    Remarks
    SPO code:
    SPOSEP+KIDSFREE
  `, { hotelNames: ["Robinson Noonu"] });

  assert.equal(result.hotel, "Robinson Noonu 5*");
  assert.equal(result.mappedHotel, "Robinson Noonu");
  assert.equal(result.hotelStatus, "mapped");
  assert.equal(result.checkin, "20.09.2026");
  assert.equal(result.checkout, "28.09.2026");
  assert.equal(result.nights, 8);
  assert.equal(result.rooms[0].item, "Beach Villa Pool");
  assert.equal(result.adults, 2);
  assert.equal(result.children, 1);
  assert.equal(result.infants, 1);
  assert.deepEqual(result.childAges, [6]);
  assert.equal(result.mealPlan, "AI");
  assert.equal(result.transfer.mode, "SEAPLANE");
  assert.equal(result.spo, "SPOSEP+KIDSFREE");
  assert.equal(result.greenTax, true);
});

test("parses repeated SAMO sections and extracts SPO from room quotation", () => {
  const result = parser.parseSamoRequest(`
    Hotel:
    Jawakara Islands Maldives 5*
    Guest name:
    MRS GUEST ONE DOB 14.10.1992 PN XX TILL 24.11.2028
    MR GUEST TWO DOB 03.06.1997 PN XX TILL 14.10.2030
    Number of guest:
    2 Adult, 0 Child
    Arrival date:
    16.09.2026
    Flight details:
    TBA
    Departure date:
    21.09.2026
    Flight details:
    TBA
    Length of stay:
    5 Nights
    Villa category:
    Mabin Beach Pool Villa 2 Adl
    Meal Plan:
    AI - Premium
    Handling fee:
    Maldives Green Tax (16.09.2026 - 25.09.2026)
    Transfer:
    Seaplane Airport - Hotel - Airport (16.09.2026 - 25.09.2026)
    SPO code:

    Room quotation:
    5*510.00[8646/Std/JWK-RM40-0526W26]
    Hotel:
    Jawakara Islands Maldives 5*
    Guest name:
    MRS GUEST ONE DOB 14.10.1992 PN XX TILL 24.11.2028
    MR GUEST TWO DOB 03.06.1997 PN XX TILL 14.10.2030
    Number of guest:
    2 Adult, 0 Child
    Arrival date:
    21.09.2026
    Flight details:
    TBA
    Departure date:
    25.09.2026
    Flight details:
    TBA
    Length of stay:
    4 Nights
    Villa category:
    Mabin Beach Villa 2 Adl
    Meal Plan:
    AI - Premium
    Handling fee:
    Maldives Green Tax (16.09.2026 - 25.09.2026)
    Transfer:
    Seaplane Airport - Hotel - Airport (16.09.2026 - 25.09.2026)
    SPO code:

    Room quotation:
    4*480.00[8646/Std/JWK-RM40-0526W26]
  `, { hotelNames: ["Jawakara Islands Maldives"] });

  assert.equal(result.mappedHotel, "Jawakara Islands Maldives");
  assert.equal(result.checkin, "16.09.2026");
  assert.equal(result.checkout, "25.09.2026");
  assert.equal(result.nights, 9);
  assert.equal(result.adults, 2);
  assert.equal(result.children, 0);
  assert.equal(result.infants, 0);
  assert.deepEqual(result.rooms.map((room) => room.item), ["Mabin Beach Pool Villa", "Mabin Beach Villa"]);
  assert.deepEqual(result.rooms.map((room) => `${room.from}-${room.to}`), ["16.09.2026-21.09.2026", "21.09.2026-25.09.2026"]);
  assert.equal(result.mealPlan, "AI - Premium");
  assert.equal(result.transfer.mode, "SEAPLANE");
  assert.equal(result.spo, "JWK-RM40-0526W26");
  assert.deepEqual(result.roomQuotation.components.map((item) => item.expression), ["5*510.00", "4*480.00"]);
});

test("parses new year gala dinner and SPO from quoted rates", () => {
  const result = parser.parseSamoRequest(`
    Hotel:
    Sun Siyam Olhuveli Maldives 4\\*
    Guest name:
    MRS GUEST ONE DOB 02.11.1985 PN XX TILL 0
    MR GUEST TWO DOB 13.12.1973 PN XX TILL 0
    CHD GUEST CHILD DOB 23.09.2015 PN XX TILL 0
    Number of guest:
    2 Adult, 1 Child
    Arrival date:
    26.12.2026
    Flight details:
    TBA
    Departure date:
    03.01.2027
    Flight details:
    TBA
    Length of stay:
    8 Nights
    Villa category:
    Beach Pavilion 2 Adl + 1 Chd(2-14,99)
    Meal Plan:
    AI
    Handling fee:
    Maldives Green Tax (26.12.2026 - 03.01.2027)
    Transfer:
    SPEEDBOAT Airport - Hotel - Airport (26.12.2026 - 03.01.2027)
    Gala Dinner:
    New Year Dinner (31.12.2026 - 31.12.2026)
    SPO code:

    Room quotation:
    1*942.00[8425/Std/SSO\\_ALL26E3]+7*987.75[8657/Std/EBO60]
  `, { hotelNames: ["Sun Siyam Olhuveli Maldives"] });

  assert.equal(result.mappedHotel, "Sun Siyam Olhuveli Maldives");
  assert.equal(result.checkin, "26.12.2026");
  assert.equal(result.checkout, "03.01.2027");
  assert.equal(result.adults, 2);
  assert.equal(result.children, 1);
  assert.deepEqual(result.childAges, [11]);
  assert.equal(result.transfer.mode, "SPEEDBOAT");
  assert.equal(result.spo, "SSO_ALL26E3 + EBO60");
  assert.deepEqual(result.galaDinners, [{
    raw: "New Year Dinner (31.12.2026 - 31.12.2026)",
    itemBase: "New Year Gala Dinner",
    from: "31.12.2026",
    to: "31.12.2026",
    status: "detected",
  }]);
  assert.deepEqual(result.roomQuotation.components.map((item) => item.expression), ["1*942.00", "7*987.75"]);
});

test("extracts text and code SPO values from room quotation brackets", () => {
  const result = parser.parseSamoRequest(`
    Hotel:
    Emerald Maldives Resort & Spa 5\\*
    Number of guest:
    2 Adult, 0 Child
    Arrival date:
    19.12.2026
    Departure date:
    26.12.2026
    Length of stay:
    7 Nights
    Villa category:
    Water Villa With Pool 2 Adl
    Meal Plan:
    AI - Deluxe
    Transfer:
    Seaplane Airport - Hotel - Airport (19.12.2026 - 26.12.2026)
    Gala Dinner:
    Christmas Dinner (24.12.2026 - 24.12.2026)
    SPO code:

    Room quotation:
    5*1117.20[8485/Std/Summer Offer]+2*1995.20[2269/Std/EM-EBB]
  `, { hotelNames: ["Emerald Maldives Resort & Spa Fasmendho"] });

  assert.equal(result.mappedHotel, "Emerald Maldives Resort & Spa Fasmendho");
  assert.equal(result.spo, "Summer Offer + EM-EBB");
  assert.deepEqual(result.galaDinners.map((gala) => gala.itemBase), ["Christmas Gala Dinner"]);
  assert.deepEqual(result.roomQuotation.components.map((item) => item.expression), ["5*1117.20", "2*1995.20"]);
});
