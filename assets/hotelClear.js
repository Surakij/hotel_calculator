(function () {
  function initHotelClear() {
    const hotel = document.getElementById("hotel");
    const clear = document.getElementById("clearHotel");
    if (!hotel || !clear) return;

    const sync = () => {
      clear.classList.toggle("visible", Boolean(hotel.value.trim()));
    };

    hotel.addEventListener("input", sync);
    clear.addEventListener("click", () => {
      hotel.value = "";
      hotel.dispatchEvent(new Event("input", { bubbles: true }));
      hotel.focus();
      sync();
    });
    sync();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHotelClear);
  } else {
    initHotelClear();
  }
})();