import {
  apiFormRequest,
  apiRequest,
  ensureAccessToken,
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

export const LOGIN_NOTICE_KEY = "vmm_login_notice";

export const goToLogin = (notice = "passwordReset") => {
  window.sessionStorage.setItem(LOGIN_NOTICE_KEY, notice);
  window.history.pushState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
};

export const goToLoginAfterPasswordReset = () => goToLogin("passwordReset");

export const goToLoginAfterInvalidResetLink = () => goToLogin("resetLinkInvalid");

export const peekLoginNotice = () => window.sessionStorage.getItem(LOGIN_NOTICE_KEY);

export const consumeLoginNotice = () => {
  const notice = peekLoginNotice();
  if (notice) {
    window.sessionStorage.removeItem(LOGIN_NOTICE_KEY);
  }
  return notice;
};

export const requestPasswordReset = (payload) =>
  apiRequest("/auth/forgot-password", {
    method: "POST",
    body: payload,
  });

export const resetPassword = (payload) =>
  apiRequest("/auth/reset-password", {
    method: "POST",
    body: payload,
  });

export const checkResetToken = (token) =>
  apiRequest(`/auth/reset-password?token=${encodeURIComponent(token)}`);

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

let meRequestPromise = null;

export const getMe = async () => {
  const token = await ensureAccessToken();
  if (!token) return null;

  if (!meRequestPromise) {
    meRequestPromise = apiRequest("/users/me", { token })
      .catch((error) => {
        if (error.status === 401) {
          setStoredAuth(null);
          return null;
        }
        throw error;
      })
      .finally(() => {
        meRequestPromise = null;
      });
  }

  return meRequestPromise;
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
