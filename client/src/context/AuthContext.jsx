import { useEffect, useState } from "react";
import api, { setAccessToken, setUnauthorizedHandler } from "../services/api";
import { AuthContext } from "./authContext";

const authResult = (response) => {
  const result = response.data.data;
  setAccessToken(result.accessToken);
  return result.user;
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    const token = localStorage.getItem("sukh_breeze_access_token");
    if (!token) {
      setLoading(false);
      return undefined;
    }
    api.get("/auth/me")
      .then(({ data }) => setUser(data.data.user))
      .catch(() => setAccessToken(null))
      .finally(() => setLoading(false));
    return () => setUnauthorizedHandler(() => {});
  }, []);

  const login = async (credentials, role = "customer") => {
    const endpoint = role === "admin" ? "/auth/admin/login" : "/auth/login";
    const nextUser = authResult(await api.post(endpoint, credentials));
    setUser(nextUser);
    return nextUser;
  };

  const register = async (payload, role = "customer") => {
    const endpoint = role === "provider" ? "/auth/register/provider" : "/auth/register/customer";
    return api.post(endpoint, payload);
  };

  const logout = async () => {
    try { await api.post("/auth/logout"); } finally {
      setAccessToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    const { data } = await api.get("/auth/me");
    setUser(data.data.user);
    return data.data.user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

