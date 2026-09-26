import axios from "axios";
import { defineStore } from "pinia";
import { ref } from "vue";
import { type AuthUser, clearUser, setUser } from "@/composables/useAuth";

type LoginPayload = { email: string; password: string; remember?: boolean };
type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
};
type VerifyEmailPayload = { email: string; token: string };
type ForgotPayload = { email: string };
type ResetPayload = {
  email: string;
  token: string;
  password: string;
  password_confirmation: string;
};

type ApiResponse<T> = { message: string; data?: T };
type AuthData = {
  user: AuthUser;
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
};

async function request<T>(method: "GET" | "POST", path: string, payload?: unknown): Promise<ApiResponse<T>> {
  try {
    const headers: Record<string, string> = {};
    try {
      const token = localStorage.getItem("idp_access_token");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch {}

    const response = await axios.request<ApiResponse<T>>({
      method,
      url: `/api/auth${path}`,
      data: payload,
      headers
    });

    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      throw new Error(String(error.response?.data?.message || error.message || "Request failed"));
    }
    throw new Error("Request failed");
  }
}

const MAX_BOOTSTRAP_ATTEMPTS = 5;
const BOOTSTRAP_BACKOFF_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthUser | null>(null);
  const isAuthenticated = ref(false);
  const processing = ref(false);
  const initialized = ref(false);

  const syncUser = (value: AuthUser | null) => {
    user.value = value;
    isAuthenticated.value = !!value;
    if (value) {
      setUser(value);
      try { localStorage.setItem("idp_auth_user", JSON.stringify(value)); } catch {}
    } else {
      clearUser();
      try {
        localStorage.removeItem("idp_auth_user");
        localStorage.removeItem("idp_access_token");
        localStorage.removeItem("idp_refresh_token");
      } catch {}
    }
  };

  const bootstrap = async (forceRefresh = false) => {
    if (initialized.value && !forceRefresh) return;

    // Load from localStorage immediately so page reloads don't flicker unauthenticated
    try {
      const cached = localStorage.getItem("idp_auth_user");
      if (cached && !user.value) {
        const parsed = JSON.parse(cached);
        user.value = parsed;
        isAuthenticated.value = true;
        setUser(parsed);
      }
    } catch {}

    try {
      const token = localStorage.getItem("idp_access_token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await axios.get<ApiResponse<AuthUser>>("/api/auth/me", { headers });
      if (response.data?.data) {
        syncUser(response.data.data as AuthUser);
      } else {
        syncUser(null);
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        syncUser(null);
      }
    }

    initialized.value = true;
  };

  const login = async (payload: LoginPayload) => {
    processing.value = true;
    try {
      const data = await request<AuthData>("POST", "/login", payload);
      if (data?.data?.access_token) {
        try { localStorage.setItem("idp_access_token", data.data.access_token); } catch {}
      }
      if (data?.data?.refresh_token) {
        try { localStorage.setItem("idp_refresh_token", data.data.refresh_token); } catch {}
      }
      syncUser((data?.data?.user || null) as AuthUser | null);
      initialized.value = true;
      return data.message || "Login successful";
    } finally {
      processing.value = false;
    }
  };

  const register = async (payload: RegisterPayload) => {
    processing.value = true;
    try {
      const data = await request<AuthData>("POST", "/register", payload);
      if (data?.data?.access_token) {
        try { localStorage.setItem("idp_access_token", data.data.access_token); } catch {}
      }
      if (data?.data?.refresh_token) {
        try { localStorage.setItem("idp_refresh_token", data.data.refresh_token); } catch {}
      }
      const createdUser = (data?.data?.user || null) as AuthUser | null;
      if (createdUser) {
        syncUser(createdUser);
        initialized.value = true;
      } else {
        syncUser(null);
      }
      return data.message || "Registration successful";
    } finally {
      processing.value = false;
    }
  };

  const verifyEmail = async (payload: VerifyEmailPayload) => {
    processing.value = true;
    try {
      const data = await request<unknown>("POST", "/verify-email", payload);
      return data.message || "Email verified successfully";
    } finally {
      processing.value = false;
    }
  };

  const forgotPassword = async (payload: ForgotPayload) => {
    processing.value = true;
    try {
      const data = await request<unknown>("POST", "/forgot-password", payload);
      return data.message || "If this email exists, a reset link has been sent";
    } finally {
      processing.value = false;
    }
  };

  const resetPassword = async (payload: ResetPayload) => {
    processing.value = true;
    try {
      const data = await request<unknown>("POST", "/reset-password", payload);
      return data.message || "Password reset successfully";
    } finally {
      processing.value = false;
    }
  };

  const logout = async () => {
    processing.value = true;
    try {
      await request<unknown>("POST", "/logout");
    } finally {
      syncUser(null);
      processing.value = false;
      initialized.value = false; // Reset so bootstrap() re-fetches after next login
    }
  };

  return {
    user,
    isAuthenticated,
    processing,
    initialized,
    syncUser,
    bootstrap,
    register,
    login,
    forgotPassword,
    resetPassword,
    verifyEmail,
    logout
  };
});
