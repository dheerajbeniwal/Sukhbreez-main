import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

let accessToken = null;
let refreshPromise = null;
let onUnauthorized = () => {};

export const setAccessToken = (token) => {
  accessToken = token;
};

export const setUnauthorizedHandler = (handler) => {
  onUnauthorized = handler;
};

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const requestUrl = original?.url || "";
    const isAuthRequest =
      requestUrl.endsWith("/auth/login") ||
      requestUrl.endsWith("/auth/admin/login") ||
      requestUrl.endsWith("/auth/refresh");
    if (error.response?.status !== 401 || original?._retry || isAuthRequest) {
      return Promise.reject(error);
    }
    original._retry = true;
    refreshPromise ??= axios
      .post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true })
      .then(({ data }) => {
        setAccessToken(data.data.accessToken);
        return data.data.accessToken;
      })
      .catch((refreshError) => {
        setAccessToken(null);
        onUnauthorized();
        throw refreshError;
      })
      .finally(() => {
        refreshPromise = null;
      });
    const token = await refreshPromise;
    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  },
);

export default api;
