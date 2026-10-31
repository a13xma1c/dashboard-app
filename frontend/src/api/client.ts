import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** True when the frontend should answer API calls from the in-browser mock generator. */
export const USE_MOCK_API = import.meta.env.VITE_MOCK_API === "true";

/** Dispatched on `window` when the API rejects a request as unauthenticated. */
export const UNAUTHORIZED_EVENT = "ga:unauthorized";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send session cookie
});

// When the session expires mid-use, every widget would otherwise fail with its
// own red error. Broadcast once so AuthProvider can flip to "signed out" and
// the router sends the user back to the login page.
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && !error.config?.url?.startsWith("/auth/")) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    return Promise.reject(error);
  }
);

export default api;
