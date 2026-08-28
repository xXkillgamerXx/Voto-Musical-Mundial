import {
  apiFormRequest,
  apiRequest,
  ensureAccessToken,
  getStoredAnonymousAuth,
  getStoredAuth,
  setStoredAnonymousAuth,
  setStoredAuth,
} from "./client";
import { routePath } from "../../utils/localizedRoutes";
import { resolvePollLocale } from "../../utils/pollLocale";

export const register = async (payload) => {
  const auth = await apiRequest("/auth/register", {
    method: "POST",
    body: payload,
  });
  if (auth?.requiresEmailVerification) {
    return auth;
  }
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
export const PENDING_EMAIL_VERIFY_KEY = "vmm_pending_email_verify";

export const goToLogin = (notice = "passwordReset") => {
  window.sessionStorage.setItem(LOGIN_NOTICE_KEY, notice);
  window.history.pushState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
};

export const goToLoginAfterPasswordReset = () => goToLogin("passwordReset");

export const goToLoginAfterInvalidResetLink = () => goToLogin("resetLinkInvalid");

export const goToVerifyEmail = (email = "") => {
  const normalized = String(email || "").trim().toLowerCase();
  if (normalized) {
    window.sessionStorage.setItem(PENDING_EMAIL_VERIFY_KEY, normalized);
  }
  const storedLocale =
    window.localStorage.getItem("vmm-locale") ||
    window.document?.documentElement?.lang ||
    "es";
  const locale = resolvePollLocale(storedLocale);
  const path = routePath("verifyEmail", locale);
  const query = normalized ? `?email=${encodeURIComponent(normalized)}` : "";
  window.location.href = `${path}${query}`;
};

export const peekPendingVerifyEmail = () =>
  window.sessionStorage.getItem(PENDING_EMAIL_VERIFY_KEY) || "";

export const clearPendingVerifyEmail = () => {
  window.sessionStorage.removeItem(PENDING_EMAIL_VERIFY_KEY);
};

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

export const verifyEmailCode = async (payload) => {
  const auth = await apiRequest("/auth/verify-email", {
    method: "POST",
    body: payload,
  });
  setStoredAuth(auth);
  clearPendingVerifyEmail();
  return auth;
};

export const resendEmailVerification = (payload) =>
  apiRequest("/auth/resend-verification", {
    method: "POST",
    body: payload,
  });

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
