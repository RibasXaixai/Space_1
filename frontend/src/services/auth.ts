import { api } from "./api";
import type { AuthResponse, LoginForm, RegisterForm, User } from "../types";

export function registerUser(data: RegisterForm) {
  return api.post<User>("/auth/register", data);
}

export function loginUser(data: LoginForm) {
  return api.post<AuthResponse>("/auth/login", data);
}

export function fetchCurrentUser(token: string) {
  return api.get<User>("/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
