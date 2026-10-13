import { useCallback, useEffect, useState } from "react";
import { type Alumna, ApiError, api } from "@/lib/api";

type SessionState =
  /** Still resolving. Avoids flashing the signed-out UI on every page load. */
  | { status: "loading"; alumna: null }
  | { status: "authenticated"; alumna: Alumna }
  | { status: "anonymous"; alumna: null };

/**
 * Resolve the current alumna session. A 401 means signed out, not broken, so
 * other failures are surfaced separately as `error`.
 */
export function useSession() {
  const [state, setState] = useState<SessionState>({
    status: "loading",
    alumna: null,
  });
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const alumna = await api.me(signal);
      setState({ status: "authenticated", alumna });
      setError(null);
    } catch (caught) {
      if (signal?.aborted) return;

      if (caught instanceof ApiError && caught.status === 401) {
        setState({ status: "anonymous", alumna: null });
        return;
      }

      setError(
        caught instanceof ApiError ? caught.detail : "Cannot reach the server.",
      );
      setState({ status: "anonymous", alumna: null });
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Clear local state regardless: a failed request must not leave someone
      // appearing signed in on a shared machine.
    }
    setState({ status: "anonymous", alumna: null });
  }, []);

  const setAlumna = useCallback((alumna: Alumna) => {
    setState({ status: "authenticated", alumna });
  }, []);

  return {
    ...state,
    error,
    isLoading: state.status === "loading",
    isAuthenticated: state.status === "authenticated",
    refresh,
    signOut,
    setAlumna,
  };
}
