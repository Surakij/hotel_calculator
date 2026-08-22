(function (root, factory) {
  root.HotelCalculatorGoogleDrive = factory(root);
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const CONFIG = root.HotelCalculatorGoogleConfig || {};
  const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
  const API = "https://www.googleapis.com";
  const FILE_NAME = "hotel_calculator_history.json";
  let accessToken = "";
  let tokenClient = null;
  let fileId = "";

  function configured() {
    return Boolean(CONFIG.clientId && !/your|paste|client_id/i.test(CONFIG.clientId));
  }

  function status() {
    return {
      configured: configured(),
      signedIn: Boolean(accessToken),
      fileId,
    };
  }

  function ensureConfigured() {
    if (!configured()) throw new Error("Google Drive sync is not configured yet.");
    if (!root.google?.accounts?.oauth2) throw new Error("Google Identity Services is still loading. Try again in a moment.");
  }

  function token(prompt = "") {
    ensureConfigured();
    return new Promise((resolve, reject) => {
      if (!tokenClient) {
        tokenClient = root.google.accounts.oauth2.initTokenClient({
          client_id: CONFIG.clientId,
          scope: SCOPE,
          callback: (response) => {
            if (response.error) reject(new Error(response.error));
            else {
              accessToken = response.access_token;
              resolve(accessToken);
            }
          },
          error_callback: () => reject(new Error("Google sign-in was closed or blocked.")),
        });
      }
      tokenClient.requestAccessToken({ prompt });
    });
  }

  async function connect() {
    await token(accessToken ? "" : "consent");
    return status();
  }

  function signOut() {
    if (accessToken && root.google?.accounts?.oauth2) root.google.accounts.oauth2.revoke(accessToken);
    accessToken = "";
    fileId = "";
    return status();
  }

  async function driveFetch(path, options = {}) {
    if (!accessToken) await token("");
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options.headers || {}),
      },
    });
    if (!response.ok) throw new Error(`Google Drive request failed: ${response.status}`);
    return response;
  }

  async function findFile() {
    const query = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
    const fields = encodeURIComponent("files(id,name,modifiedTime)");
    const response = await driveFetch(`/drive/v3/files?spaces=appDataFolder&q=${query}&fields=${fields}`);
    const data = await response.json();
    fileId = data.files?.[0]?.id || "";
    return fileId;
  }

  async function loadHistory() {
    const id = fileId || await findFile();
    if (!id) return [];
    const response = await driveFetch(`/drive/v3/files/${id}?alt=media`);
    const data = await response.json();
    return Array.isArray(data.history) ? data.history : [];
  }

  async function createHistoryFile(history) {
    const boundary = `hotelcalc_${Date.now()}`;
    const metadata = {
      name: FILE_NAME,
      parents: ["appDataFolder"],
      mimeType: "application/json",
    };
    const body = [
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify(metadata),
      `--${boundary}`,
      "Content-Type: application/json; charset=UTF-8",
      "",
      JSON.stringify({ history }, null, 2),
      `--${boundary}--`,
    ].join("\r\n");
    const response = await driveFetch("/upload/drive/v3/files?uploadType=multipart&fields=id", {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    const data = await response.json();
    fileId = data.id;
    return fileId;
  }

  async function saveHistory(history) {
    const id = fileId || await findFile();
    if (!id) return createHistoryFile(history);
    await driveFetch(`/upload/drive/v3/files/${id}?uploadType=media`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ history }, null, 2),
    });
    return id;
  }

  async function sync(localHistory) {
    await connect();
    const remoteHistory = await loadHistory();
    const byId = new Map(remoteHistory.map((entry) => [entry.id, entry]));
    localHistory.forEach((entry) => {
      if (entry?.id) byId.set(entry.id, entry);
    });
    const merged = [...byId.values()].sort((left, right) => String(right.savedAt || "").localeCompare(String(left.savedAt || "")));
    await saveHistory(merged);
    return merged;
  }

  return {
    connect,
    configured,
    loadHistory,
    saveHistory,
    signOut,
    status,
    sync,
  };
});
