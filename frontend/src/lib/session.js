const IDEA_ID_STORAGE_KEY = "validation_engine_idea_id";
const IDEA_TOKEN_STORAGE_KEY = "validation_engine_access_token";
const AUTH_TOKEN_STORAGE_KEY = "validation_engine_auth_token";
const AUTH_USER_STORAGE_KEY = "validation_engine_auth_user";

export const SESSION_EVENT = "validation-engine:session-change";

function emitSessionChange() {
  window.dispatchEvent(new Event(SESSION_EVENT));
}

export function getIdeaSession() {
  return {
    ideaId: Number(window.localStorage.getItem(IDEA_ID_STORAGE_KEY) || 0) || null,
    accessToken: window.localStorage.getItem(IDEA_TOKEN_STORAGE_KEY) || "",
  };
}

export function setIdeaSession(ideaId, accessToken) {
  if (ideaId) {
    window.localStorage.setItem(IDEA_ID_STORAGE_KEY, String(ideaId));
  } else {
    window.localStorage.removeItem(IDEA_ID_STORAGE_KEY);
  }

  if (accessToken) {
    window.localStorage.setItem(IDEA_TOKEN_STORAGE_KEY, accessToken);
  } else {
    window.localStorage.removeItem(IDEA_TOKEN_STORAGE_KEY);
  }

  emitSessionChange();
}

export function clearIdeaSession() {
  window.localStorage.removeItem(IDEA_ID_STORAGE_KEY);
  window.localStorage.removeItem(IDEA_TOKEN_STORAGE_KEY);
  emitSessionChange();
}

export function getAuthToken() {
  return "";
}

export function getStoredUser() {
  try {
    return JSON.parse(window.localStorage.getItem(AUTH_USER_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

export function setAuthSession(authToken, user) {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);

  if (user !== undefined) {
    if (user) {
      window.localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    }
  }

  emitSessionChange();
}

export function clearAuthSession() {
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  emitSessionChange();
}
