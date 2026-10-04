import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../services/api";

const AuthContext = createContext(null);
const roles = ["admin", "manager", "cashier", "inventory_staff"];

function readStoredSession() {
  const token = localStorage.getItem("stocksense_token");
  let user = null;

  try {
    user = JSON.parse(localStorage.getItem("stocksense_user"));
  } catch {
    user = null;
  }

  if (!token || !user || !roles.includes(user.role)) {
    localStorage.removeItem("stocksense_token");
    localStorage.removeItem("stocksense_user");
    return { token: null, user: null, isLoading: false };
  }

  return { token, user, isLoading: true };
}

function clearStoredSession() {
  localStorage.removeItem("stocksense_token");
  localStorage.removeItem("stocksense_user");
}

export function dashboardPathForRole(role) {
  return {
    admin: "/admin-dashboard",
    manager: "/manager-dashboard",
    cashier: "/cashier-dashboard",
    inventory_staff: "/inventory-dashboard",
  }[role] || "/login";
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(readStoredSession);

  const login = async (credentials) => {
    clearStoredSession();
    setSession({ token: null, user: null, isLoading: false });

    try {
      const result = await api.login(credentials);
      if (!result.token || !result.user || !roles.includes(result.user.role)) {
        throw new Error("Login response did not include a valid user role.");
      }

      localStorage.setItem("stocksense_token", result.token);
      
      localStorage.setItem("stocksense_user", JSON.stringify(result.user));
      setSession({ token: result.token, user: result.user, isLoading: false });
      return result;
    } catch (error) {
      clearStoredSession();
      setSession({ token: null, user: null, isLoading: false });
      throw error;
    }
  };
  const register = (details) => api.register(details);
  const logout = () => { clearStoredSession(); setSession({ token: null, user: null, isLoading: false }); };

  useEffect(() => {
    const tokenToValidate = session.token;
    if (tokenToValidate) {
      api.currentUser().then((result) => {
        if (localStorage.getItem("stocksense_token") !== tokenToValidate) return;
        if (!result.user || !roles.includes(result.user.role)) throw new Error("Invalid user session");
        localStorage.setItem("stocksense_user", JSON.stringify(result.user));
        setSession({ token: tokenToValidate, user: result.user, isLoading: false });
      }).catch(() => {
        if (localStorage.getItem("stocksense_token") !== tokenToValidate) return;
        clearStoredSession();
        setSession({ token: null, user: null, isLoading: false });
      });
    }

    const handleUnauthorized = () => { clearStoredSession(); setSession({ token: null, user: null, isLoading: false }); };
    const handleStorage = (event) => {
      if (!event.key || event.key === "stocksense_token" || event.key === "stocksense_user") {
        setSession(readStoredSession());
      }
    };
    window.addEventListener("stocksense:unauthorized", handleUnauthorized);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("stocksense:unauthorized", handleUnauthorized);
      window.removeEventListener("storage", handleStorage);
    };
  }, [session.token]);

  const { token, user, isLoading } = session;
  return <AuthContext.Provider value={{ token, user, isLoading, isAuthenticated: Boolean(token && user && !isLoading), login, register, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
