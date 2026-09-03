(function () {
  const KEY = "hotelCalculator.appearance.v1";
  const DEFAULT_COLORS = {
    navy: "#082758",
    blue: "#2563eb",
    green: "#24a148",
  };

  function isColor(value) {
    return /^#[0-9a-f]{6}$/i.test(String(value || ""));
  }

  try {
    const settings = JSON.parse(localStorage.getItem(KEY) || "{}");
    const theme = settings.theme === "dark" ? "dark" : "light";
    const colors = { ...DEFAULT_COLORS, ...(settings.colors || {}) };
    document.documentElement.dataset.theme = theme;

    Object.entries(colors).forEach(([name, value]) => {
      if (isColor(value)) document.documentElement.style.setProperty(`--${name}`, value);
    });
  } catch {
    document.documentElement.dataset.theme = "light";
  }
})();
