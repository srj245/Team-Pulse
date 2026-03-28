import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { loadApiBaseUrl } from "../lib/runtime";
import { clearIdeaSession, getIdeaSession, setIdeaSession } from "../lib/session";

export function useValidationEngine() {
  const [state, setState] = useState({
    ...getIdeaSession(),
    payload: null,
    apiBaseUrl: "",
    isLoading: false,
    error: null,
  });

  const persistSession = useCallback((ideaId, accessToken) => {
    setIdeaSession(ideaId, accessToken);
    setState((current) => ({ ...current, ideaId, accessToken }));
  }, []);

  const refreshIdeaState = useCallback(async (silent = true) => {
    if (!state.ideaId) {
      return;
    }

    if (!silent) {
      setState((current) => ({ ...current, isLoading: true, error: null }));
    }

    try {
      const payload = await apiRequest(
        `/api/ideas/${state.ideaId}`,
        { method: "GET" },
        { accessToken: state.accessToken },
      );
      setState((current) => ({ ...current, payload, isLoading: false, error: null }));
    } catch (error) {
      if (error.status === 401 || error.status === 403) {
        clearIdeaSession();
        setState((current) => ({
          ...current,
          ideaId: null,
          accessToken: "",
          payload: null,
          isLoading: false,
          error: error.message,
        }));
        return;
      }

      setState((current) => ({
        ...current,
        isLoading: false,
        error: error.message,
      }));
    }
  }, [state.accessToken, state.ideaId]);

  const submitIdea = async (ideaText) => {
    setState((current) => ({ ...current, isLoading: true, error: null }));

    try {
      const payload = await apiRequest("/api/ideas", {
        method: "POST",
        body: JSON.stringify({ ideaText }),
      });

      persistSession(payload.idea.id, payload.accessToken);
      setState((current) => ({
        ...current,
        ideaId: payload.idea.id,
        accessToken: payload.accessToken,
        payload,
        isLoading: false,
        error: null,
      }));
    } catch (error) {
      setState((current) => ({
        ...current,
        isLoading: false,
        error: error.message,
      }));
      throw error;
    }
  };

  useEffect(() => {
    let isMounted = true;

    loadApiBaseUrl().then((apiBaseUrl) => {
      if (!isMounted) {
        return;
      }

      setState((current) => ({ ...current, apiBaseUrl }));
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!state.ideaId || !state.accessToken) {
      return undefined;
    }

    refreshIdeaState(true);
    const interval = window.setInterval(() => refreshIdeaState(true), 5000);
    return () => window.clearInterval(interval);
  }, [refreshIdeaState, state.accessToken, state.ideaId]);

  return {
    ...state,
    submitIdea,
    refreshIdeaState,
  };
}
