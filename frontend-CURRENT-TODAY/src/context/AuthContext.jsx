import { createContext, useContext, useEffect, useRef, useState } from "react";
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
  const validatedToken = useRef(null);

  const login = async (credentials) => {
    clearStoredSession();
    validatedToken.current = null;
    setSession({ token: null, user: null, isLoading: false });
    let loginToken = null;

    try {
      const result = await api.login(credentials);
      if (!result.token || !result.user || !roles.includes(result.user.role)) {
        throw new Error("Login response did not include a valid user role.");
      }

      loginToken = result.token;
      localStorage.setItem("stocksense_token", result.token);
      const currentUser = await api.currentUser();
      if (!currentUser.user || !roles.includes(currentUser.user.role)) {
        throw new Error("Login session could not be verified.");
      }
      if (localStorage.getItem("stocksense_token") !== loginToken) {
        throw new Error("Login session changed before it could be verified.");
      }

      localStorage.setItem("stocksense_user", JSON.stringify(currentUser.user));
      validatedToken.current = loginToken;
      setSession({ token: loginToken, user: currentUser.user, isLoading: false });
      return { ...result, user: currentUser.user };
    } catch (error) {
      if (!loginToken || localStorage.getItem("stocksense_token") === loginToken) {
        clearStoredSession();
        setSession({ token: null, user: null, isLoading: false });
      }
      throw error;
    }
  };
  const register = (details) => api.register(details);
  const logout = () => {
    clearStoredSession();
    validatedToken.current = null;
    setSession({ token: null, user: null, isLoading: false });
  };

  useEffect(() => {
    const tokenToValidate = session.token;
    const handleUnauthorized = () => {
      clearStoredSession();
      validatedToken.current = null;
      setSession({ token: null, user: null, isLoading: false });
    };
    const handleStorage = (event) => {
      if (!event.key || event.key === "stocksense_token" || event.key === "stocksense_user") {
        const nextSession = readStoredSession();
        if (!nextSession.token) validatedToken.current = null;
        setSession(nextSession);
      }
    };

    window.addEventListener("stocksense:unauthorized", handleUnauthorized);
    window.addEventListener("storage", handleStorage);

    if (tokenToValidate && session.isLoading && validatedToken.current !== tokenToValidate) {
      validatedToken.current = tokenToValidate;
      api.currentUser().then((result) => {
        if (localStorage.getItem("stocksense_token") !== tokenToValidate) return;
        if (!result.user || !roles.includes(result.user.role)) {
          clearStoredSession();
          validatedToken.current = null;
          setSession({ token: null, user: null, isLoading: false });
          return;
        }
        localStorage.setItem("stocksense_user", JSON.stringify(result.user));
        setSession({ token: tokenToValidate, user: result.user, isLoading: false });
      }).catch(() => {
        if (localStorage.getItem("stocksense_token") !== tokenToValidate) return;
        clearStoredSession();
        validatedToken.current = null;
        setSession({ token: null, user: null, isLoading: false });
      });
    }

    return () => {
      window.removeEventListener("stocksense:unauthorized", handleUnauthorized);
      window.removeEventListener("storage", handleStorage);
    };
  }, [session]);

  const { token, user, isLoading } = session;
  return <AuthContext.Provider value={{ token, user, isLoading, isAuthenticated: Boolean(token && user && !isLoading), login, register, logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
