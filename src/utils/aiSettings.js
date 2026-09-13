const KEY = "smapp:ai_settings:v1";
const DEFAULTS = { mode: "direct", apiType: "openai-compat", baseURL: "", model: "", key: "", backendURL: "", proxyKey: "" };

function storage() {
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  if (typeof globalThis !== "undefined" && globalThis.localStorage) return globalThis.localStorage;
  return null;
}

export function loadAiSettings() {
  try {
    const ls = storage();
    if (!ls) return { ...DEFAULTS };
    const raw = ls.getItem(KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch { return { ...DEFAULTS }; }
}

export function saveAiSettings(s) {
  const ls = storage();
  if (!ls) return;
  ls.setItem(KEY, JSON.stringify({ ...DEFAULTS, ...s }));
}

export function clearAiKey() {
  const s = loadAiSettings(); s.key = "";
  saveAiSettings(s);
}

export const AI_SETTINGS_KEY = KEY;
export const AI_SETTINGS_DEFAULTS = DEFAULTS;
