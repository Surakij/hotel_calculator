(function () {
  const DEFAULT_HOTELS = ["Ozen Bolifushi", "Ozen Life Maadhoo"];
  const HOTEL_DATA = window.HotelCalculatorHotelData || {};
  const HOTELS = [...new Set([...DEFAULT_HOTELS, ...Object.keys(HOTEL_DATA)])].sort((a, b) => a.localeCompare(b));

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function firstLetter(hotel) {
    return (hotel[0] || "#").toUpperCase();
  }

  function highlightMatch(value, query) {
    const text = String(value || "");
    const needle = String(query || "").trim();
    if (!needle) return escapeHtml(text);

    const index = text.toLowerCase().indexOf(needle.toLowerCase());
    if (index < 0) return escapeHtml(text);

    return [
      escapeHtml(text.slice(0, index)),
      `<mark class="hotel-match">${escapeHtml(text.slice(index, index + needle.length))}</mark>`,
      escapeHtml(text.slice(index + needle.length)),
    ].join("");
  }

  function isKnownHotel(value) {
    return HOTELS.some((hotel) => hotel.toLowerCase() === String(value || "").trim().toLowerCase());
  }

  function initHotelPicker() {
    const input = document.getElementById("hotel");
    const picker = document.getElementById("hotelPicker");
    if (!input || !picker) return;

    let open = false;
    let query = "";

    function groupedHotels() {
      const needle = query.trim().toLowerCase();
      const visibleHotels = needle ? HOTELS.filter((hotel) => hotel.toLowerCase().includes(needle)) : HOTELS;

      return visibleHotels.reduce((groups, hotel) => {
        const letter = firstLetter(hotel);
        if (!groups.has(letter)) groups.set(letter, []);
        groups.get(letter).push(hotel);
        return groups;
      }, new Map());
    }

    function renderShell() {
      const letters = [...new Set(HOTELS.map(firstLetter))];
      picker.innerHTML = `
        <div class="hotel-picker-body">
          <div class="hotel-picker-letters">
            ${letters.map((letter) => `<button type="button" data-letter="${escapeHtml(letter)}">${escapeHtml(letter)}</button>`).join("")}
          </div>
          <div class="hotel-picker-list"></div>
        </div>
      `;
    }

    function renderList() {
      const groups = groupedHotels();
      const letters = [...groups.keys()];
      const list = picker.querySelector(".hotel-picker-list");
      if (!list) return;

      list.innerHTML = letters.length ? `
          ${letters.map((letter) => `
            <section class="hotel-group" data-group="${escapeHtml(letter)}">
              <h3>${escapeHtml(letter)}</h3>
              ${groups.get(letter).map((hotel) => `<button class="hotel-choice" type="button" data-hotel="${escapeHtml(hotel)}">${highlightMatch(hotel, query)}</button>`).join("")}
            </section>
          `).join("")}
      ` : '<div class="hotel-empty">No hotels found</div>';
    }

    function positionPicker() {
      const rect = input.getBoundingClientRect();
      const width = Math.min(Math.max(rect.width, 360), window.innerWidth - 16);
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
      const top = rect.bottom + 6;
      const height = Math.min(620, Math.max(360, window.innerHeight - top - 12));

      picker.style.left = `${left}px`;
      picker.style.top = `${top}px`;
      picker.style.width = `${width}px`;
      picker.style.height = `${height}px`;
    }

    function openPicker(options = {}) {
      if (!picker.innerHTML) renderShell();
      if (options.fromClick && isKnownHotel(input.value)) query = "";
      renderList();
      picker.classList.add("open");
      input.setAttribute("aria-expanded", "true");
      open = true;
      positionPicker();
    }

    function closePicker() {
      picker.classList.remove("open");
      input.setAttribute("aria-expanded", "false");
      open = false;
    }

    function chooseHotel(hotel) {
      input.value = hotel;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      closePicker();
      input.focus();
    }

    function scrollToLetter(letter) {
      query = "";
      renderList();
      const list = picker.querySelector(".hotel-picker-list");
      const group = [...picker.querySelectorAll(".hotel-group")].find((item) => item.dataset.group === letter);
      if (!list || !group) return;
      list.scrollTo({ top: group.offsetTop, behavior: "smooth" });
    }

    input.addEventListener("focus", () => openPicker({ fromClick: true }));
    input.addEventListener("click", () => openPicker({ fromClick: true }));
    input.addEventListener("input", () => {
      query = input.value;
      openPicker();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closePicker();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (!open) openPicker();
        picker.querySelector(".hotel-choice")?.focus();
      }
    });

    picker.addEventListener("click", (event) => {
      const letter = event.target.closest(".hotel-picker-letters button");
      if (letter) scrollToLetter(letter.dataset.letter);

      const choice = event.target.closest(".hotel-choice");
      if (choice) chooseHotel(choice.dataset.hotel);
    });

    picker.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closePicker();
        input.focus();
      }
    });

    document.addEventListener("click", (event) => {
      if (event.target !== input && !picker.contains(event.target)) closePicker();
    });
    window.addEventListener("resize", () => {
      if (open) positionPicker();
    });
    window.addEventListener("scroll", () => {
      if (open) positionPicker();
    }, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHotelPicker);
  } else {
    initHotelPicker();
  }
})();
