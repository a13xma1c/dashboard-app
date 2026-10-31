import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** True when the frontend should answer API calls from the in-browser mock generator. */
export const USE_MOCK_API = import.meta.env.VITE_MOCK_API === "true";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send session cookie
});

export default api;
