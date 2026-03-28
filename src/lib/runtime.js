const API_BASE_STORAGE_KEY = "validation_engine_api_base";

let cachedApiBaseUrl = "";
const envApiBaseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);

export function normalizeApiBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function getStoredApiBaseUrl() {
  return normalizeApiBaseUrl(window.localStorage.getItem(API_BASE_STORAGE_KEY));
}

export function setStoredApiBaseUrl(value) {
  const normalizedValue = normalizeApiBaseUrl(value);

  if (normalizedValue) {
    window.localStorage.setItem(API_BASE_STORAGE_KEY, normalizedValue);
  } else {
    window.localStorage.removeItem(API_BASE_STORAGE_KEY);
  }

  cachedApiBaseUrl = normalizedValue;
  return cachedApiBaseUrl;
}

function resolveLocalApiBaseUrl() {
  const hostname = window.location.hostname || "localhost";

  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
    return `http://${hostname || "localhost"}:4000`;
  }

  return "";
}

export async function loadApiBaseUrl() {
  if (cachedApiBaseUrl) {
    return cachedApiBaseUrl;
  }

  const storedValue = getStoredApiBaseUrl();
  if (storedValue) {
    cachedApiBaseUrl = storedValue;
    return cachedApiBaseUrl;
  }

  if (envApiBaseUrl) {
    cachedApiBaseUrl = envApiBaseUrl;
    return cachedApiBaseUrl;
  }

  try {
    const response = await fetch("/api/runtime-config", {
      headers: { Accept: "application/json" },
    });

    if (response.ok) {
      const payload = await response.json();
      const configuredValue = normalizeApiBaseUrl(payload.apiBaseUrl);
      if (configuredValue) {
        cachedApiBaseUrl = configuredValue;
        return cachedApiBaseUrl;
      }
    }
  } catch {
    // Fall back to local hostname inference when the runtime endpoint is unavailable.
  }

  cachedApiBaseUrl = resolveLocalApiBaseUrl();
  return cachedApiBaseUrl;
}
