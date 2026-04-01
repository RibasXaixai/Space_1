import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import * as authService from "../services/auth";
import type { AuthContextValue, LoginForm, RegisterForm, User } from "../types";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const STORAGE_KEY = "ai_wardrobe_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem(STORAGE_KEY);
    if (!savedToken) {
      setLoading(false);
      return;
    }

    authService
      .fetchCurrentUser(savedToken)
      .then((response) => {
        setToken(savedToken);
        setUser(response.data);
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (data: LoginForm) => {
    const response = await authService.loginUser(data);
    const accessToken = response.data.access_token;
    localStorage.setItem(STORAGE_KEY, accessToken);
    setToken(accessToken);

    const userResponse = await authService.fetchCurrentUser(accessToken);
    setUser(userResponse.data);
  };

  const register = async (data: RegisterForm) => {
    await authService.registerUser(data);
    await login(data);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
  };

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
