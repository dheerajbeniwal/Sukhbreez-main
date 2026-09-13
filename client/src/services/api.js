import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

let accessToken = localStorage.getItem("sukh_breeze_access_token");
let refreshPromise = null;
let onUnauthorized = () => {};

export const setAccessToken = (token) => {
  accessToken = token;
  if (token) localStorage.setItem("sukh_breeze_access_token", token);
  else localStorage.removeItem("sukh_breeze_access_token");
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
    if (error.response?.status !== 401 || original?._retry || original?.url?.endsWith("/auth/refresh")) {
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
