(function () {
  function initHotelReselect() {
    const input = document.getElementById("hotel");
    if (!input) return;

    let previousValue = "";
    let reselecting = false;
    let changedAfterOpen = false;

    function openNativePicker() {
      try {
        input.showPicker?.();
      } catch {
        // Some browsers only allow showPicker during direct user interaction.
      }
    }

    input.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || !input.value.trim()) return;
      previousValue = input.value;
      reselecting = true;
      changedAfterOpen = false;
      input.value = "";
      window.setTimeout(openNativePicker, 0);
    });

    input.addEventListener("focus", () => {
      if (!input.value.trim()) openNativePicker();
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