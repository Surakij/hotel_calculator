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

  function initHotelSelect() {
    const input = document.getElementById("hotel");
    const menu = document.getElementById("hotelMenu");
    if (!input || !menu) return;

    function matches() {
      const query = input.value.trim().toLowerCase();
      if (!query) return HOTELS;
      return HOTELS.filter((hotel) => hotel.toLowerCase().includes(query));
    }

    function render(items) {
      const visibleItems = items.slice(0, 80);
      if (!visibleItems.length) {
        menu.innerHTML = `<div class="hotel-option empty">No matches</div>`;
        return;
      }

      menu.innerHTML = visibleItems.map((hotel) => (
        `<button class="hotel-option" type="button" role="option" data-hotel="${escapeHtml(hotel)}">${escapeHtml(hotel)}</button>`
      )).join("");
    }

    function open(showAll = true) {
      render(showAll ? HOTELS : matches());
      menu.classList.add("open");
      input.setAttribute("aria-expanded", "true");
    }

    function close() {
      menu.classList.remove("open");
      input.setAttribute("aria-expanded", "false");
    }

    function choose(hotel) {
      input.value = hotel;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.focus();
      close();
    }

    input.addEventListener("focus", () => open(true));
    input.addEventListener("click", () => open(true));
    input.addEventListener("input", () => open(false));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Escape") close();
      if (event.key === "ArrowDown") {
        event.preventDefault();
        open(true);
        menu.querySelector(".hotel-option:not(.empty)")?.focus();
      }
    });

    menu.addEventListener("mousedown", (event) => {
      event.preventDefault();
      const option = event.target.closest(".hotel-option:not(.empty)");
      if (option) choose(option.dataset.hotel);
    });
    menu.addEventListener("keydown", (event) => {
      const options = [...menu.querySelectorAll(".hotel-option:not(.empty)")];
      const index = options.indexOf(document.activeElement);
      if (event.key === "Escape") {
        close();
        input.focus();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (document.activeElement?.dataset?.hotel) choose(document.activeElement.dataset.hotel);
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const next = event.key === "ArrowDown" ? index + 1 : index - 1;
        options[Math.max(0, Math.min(options.length - 1, next))]?.focus();
      }
    });
    document.addEventListener("click", (event) => {
      if (event.target !== input && !menu.contains(event.target)) close();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHotelSelect);
  } else {
    initHotelSelect();
  }
})();