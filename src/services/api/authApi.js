import {
  apiFormRequest,
  apiRequest,
  getStoredAnonymousAuth,
  getStoredAuth,
  setStoredAnonymousAuth,
  setStoredAuth,
} from "./client";

export const register = async (payload) => {
  const auth = await apiRequest("/auth/register", {
    method: "POST",
    body: payload,
  });
  setStoredAuth(auth);
  return auth;
};

export const login = async (payload) => {
  const auth = await apiRequest("/auth/login", {
    method: "POST",
    body: payload,
  });
  setStoredAuth(auth);
  return auth;
};

export const loginWithGoogle = async (credential) => {
  const body = typeof credential === "string" ? { credential } : credential;
  const auth = await apiRequest("/auth/google", {
    method: "POST",
    body,
  });
  setStoredAuth(auth);
  return auth;
};

export const refresh = async () => {
  const current = getStoredAuth();
  if (!current?.refreshToken) return null;
  const auth = await apiRequest("/auth/refresh", {
    method: "POST",
    body: { refreshToken: current.refreshToken },
  });
  setStoredAuth(auth);
  return auth;
};

export const logout = () => {
  setStoredAuth(null);
};

export const getMe = async () => {
  const auth = getStoredAuth();
  if (!auth?.accessToken) return null;

  try {
    return await apiRequest("/users/me", {
      token: auth.accessToken,
    });
  } catch (error) {
    if (error.status === 401) return null;
    throw error;
  }
};

export const updateMe = async (payload) => {
  const auth = getStoredAuth();
  if (!auth?.accessToken) throw new Error("No hay sesion activa.");

  const user = await apiRequest("/users/me", {
    method: "PATCH",
    body: payload,
    token: auth.accessToken,
  });
  setStoredAuth({
    ...auth,
    user,
  });
  return user;
};

export const getPublicProfile = (username) =>
  apiRequest(`/users/${encodeURIComponent(username)}`);

export const checkUsername = async (username) => {
  const auth = getStoredAuth();
  if (!auth?.accessToken) throw new Error("No hay sesion activa.");

  return apiRequest(`/users/me/username/${encodeURIComponent(username)}`, {
    token: auth.accessToken,
  });
};

export const uploadProfileImage = async (file) => {
  const auth = getStoredAuth();
  if (!auth?.accessToken) throw new Error("No hay sesion activa.");

  const formData = new FormData();
  formData.append("file", file);

  return apiFormRequest("/users/me/uploads", {
    method: "POST",
    body: formData,
    token: auth.accessToken,
  });
};

export const getAnonymousToken = async () => {
  const current = getStoredAnonymousAuth();
  if (current?.accessToken) return current;

  const auth = await apiRequest("/auth/anonymous", {
    method: "POST",
    body: {},
  });
  setStoredAnonymousAuth(auth);
  return auth;
};

export const getCurrentApiAuth = getStoredAuth;
