(function () {
  window.HotelCalculatorUpdates = { create };

  function create({ build, saveDraft }) {
    const VERSION_CHECK_INTERVAL = 5 * 60 * 1000;
    const REQUEST_TIMEOUT = 10000;
    function compareVersions(left, right) {
      const leftParts = String(left || "").split(".").map((part) => Number(part) || 0);
      const rightParts = String(right || "").split(".").map((part) => Number(part) || 0);
      const length = Math.max(leftParts.length, rightParts.length);
      for (let index = 0; index < length; index += 1) {
        const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
        if (difference) return Math.sign(difference);
      }
      return 0;
    }

    let updateCheckRunning = false;

    async function checkForAppUpdate() {
      if (!/^https?:$/.test(window.location.protocol) || updateCheckRunning) return false;
      updateCheckRunning = true;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      try {
        const versionUrl = new URL("version.json", window.location.href);
        versionUrl.searchParams.set("_", Date.now());
        const response = await fetch(versionUrl, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return false;
        const publishedVersion = String((await response.json())?.version || "").trim();
        if (!/^\d+(?:\.\d+){2,3}$/.test(publishedVersion)) return false;
        if (compareVersions(publishedVersion, build) <= 0) {
          try { sessionStorage.removeItem("hotelCalculator.pendingVersion"); } catch { /* Storage may be unavailable. */ }
          return false;
        }

        let attemptedVersion = "";
        try { attemptedVersion = sessionStorage.getItem("hotelCalculator.pendingVersion") || ""; } catch { /* Storage may be unavailable. */ }
        if (attemptedVersion === publishedVersion) return false;

        // Import text and partially edited fields are not represented by the draft.
        if (document.querySelector("dialog[open]") || document.activeElement?.matches("input, textarea, select, [contenteditable]")) return false;

        if (!saveDraft()) return false;
        try { sessionStorage.setItem("hotelCalculator.pendingVersion", publishedVersion); } catch { return false; }
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.set("v", publishedVersion);
        window.location.replace(nextUrl.href);
        return true;
      } catch {
        return false;
      } finally {
        window.clearTimeout(timeout);
        updateCheckRunning = false;
      }
    }

    function start() {
      if (!/^https?:$/.test(window.location.protocol)) return;
      window.setTimeout(checkForAppUpdate, 2000);
      window.setInterval(checkForAppUpdate, VERSION_CHECK_INTERVAL);
      window.addEventListener("focus", checkForAppUpdate);
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) checkForAppUpdate();
      });
    }

    return { check: checkForAppUpdate, start };
  }
})();
