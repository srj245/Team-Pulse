import { loadApiBaseUrl } from "./runtime";
import { clearAuthSession, getStoredUser, setAuthSession } from "./session";

function createApiError(response, payload) {
  const error = new Error(payload.error || payload.message || "Request failed");
  error.status = response.status;
  error.payload = payload;
  return error;
}

export async function apiRequest(path, options = {}, config = {}) {
  const apiBaseUrl = await loadApiBaseUrl();

  if (!apiBaseUrl) {
    const error = new Error("Backend URL is not configured.");
    error.status = 500;
    throw error;
  }

  const { headers = {}, body, ...rest } = options;
  const authToken = config.authToken || "";
  const accessToken = config.accessToken || "";
  const isJsonBody = body && !(body instanceof FormData);
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...rest,
    body,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(isJsonBody ? { "Content-Type": "application/json" } : {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      ...(accessToken ? { "X-Idea-Token": accessToken } : {}),
      "X-Requested-With": "XMLHttpRequest",
      ...headers,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (config.auth && (response.status === 401 || response.status === 403)) {
      clearAuthSession();
    }

    throw createApiError(response, payload);
  }

  if (payload.authToken || (config.auth && payload.user)) {
    setAuthSession(payload.authToken || authToken || undefined, payload.user || getStoredUser());
  }

  return payload;
}

export function signupUser(input) {
  return apiRequest("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function signInUser(input) {
  return apiRequest(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
    { auth: true },
  );
}

export function verifyEmail(token) {
  return apiRequest(`/api/auth/verify-email?token=${encodeURIComponent(token)}`, { method: "GET" }, { auth: true });
}

export function resendVerificationEmail(email) {
  return apiRequest("/api/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function getProfile() {
  return apiRequest("/api/auth/profile", { method: "GET" }, { auth: true });
}

export function updateProfile(input) {
  return apiRequest(
    "/api/auth/profile",
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
    { auth: true },
  );
}

export function completeOnboarding() {
  return apiRequest("/api/auth/complete-onboarding", { method: "POST" }, { auth: true });
}

export function sendContactMessage(input) {
  return apiRequest("/api/contact", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function logoutUser() {
  try {
    await apiRequest("/api/auth/logout", { method: "POST" }, { auth: true });
  } finally {
    clearAuthSession();
  }
}
