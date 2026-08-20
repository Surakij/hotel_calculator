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

  function initHotelReselect() {
    const input = document.getElementById("hotel");
    const list = document.getElementById("hotelList");
    const letters = document.getElementById("hotelLetters");
    if (!input) return;

    let previousValue = "";
    let reselecting = false;
    let changedAfterOpen = false;
    let activeLetter = "";

    function setHotelOptions(items) {
      if (!list) return;
      list.innerHTML = items.map((hotel) => `<option value="${escapeHtml(hotel)}">`).join("");
    }

    function openNativePicker() {
      try {
        input.showPicker?.();
      } catch {
        // Some browsers only allow showPicker during direct user interaction.
      }
    }

    function filteredHotels() {
      if (!activeLetter) return HOTELS;
      return HOTELS.filter((hotel) => hotel[0]?.toUpperCase() === activeLetter);
    }

    function setActiveLetter(letter) {
      activeLetter = letter;
      setHotelOptions(filteredHotels());
      letters?.querySelectorAll(".hotel-letter").forEach((button) => {
        button.classList.toggle("active", button.dataset.letter === activeLetter);
      });
    }

    function buildLetterFilter() {
      if (!letters) return;
      const availableLetters = [...new Set(HOTELS.map((hotel) => hotel[0]?.toUpperCase()).filter(Boolean))];
      letters.innerHTML = [
        '<button class="hotel-letter active" type="button" data-letter="">All</button>',
        ...availableLetters.map((letter) => `<button class="hotel-letter" type="button" data-letter="${escapeHtml(letter)}">${escapeHtml(letter)}</button>`),
      ].join("");
      letters.addEventListener("click", (event) => {
        const button = event.target.closest(".hotel-letter");
        if (!button) return;
        setActiveLetter(button.dataset.letter || "");
        input.value = "";
        input.focus();
        openNativePicker();
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }

    buildLetterFilter();
    setHotelOptions(HOTELS);

    input.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !input.value.trim()) return;
      previousValue = input.value;
      reselecting = true;
      changedAfterOpen = false;
      input.value = "";
      setHotelOptions(filteredHotels());
      window.setTimeout(openNativePicker, 0);
    });

    input.addEventListener("focus", () => {
      if (!input.value.trim()) {
        setHotelOptions(filteredHotels());
        openNativePicker();
      }
    });

    input.addEventListener("input", () => {
      changedAfterOpen = true;
    });

    input.addEventListener("blur", () => {
      if (reselecting && !changedAfterOpen && !input.value.trim()) {
        input.value = previousValue;
      }
      reselecting = false;
      previousValue = "";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHotelReselect);
  } else {
    initHotelReselect();
  }
})();