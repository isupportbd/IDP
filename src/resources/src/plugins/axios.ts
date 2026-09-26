import axios, { type AxiosResponse, type AxiosError } from "axios";

if (import.meta.env.VITE_API_URL) {
  axios.defaults.baseURL = import.meta.env.VITE_API_URL;
}

axios.defaults.withCredentials = true;
axios.defaults.headers.common["X-Requested-With"] = "XMLHttpRequest";
axios.defaults.headers.common.Accept = "application/json";

// Attach Bearer token from localStorage to every outgoing API request
axios.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("idp_access_token");
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});

axios.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const status = error?.response?.status;
    const data = error?.response?.data as any;
    const configUrl: string = error?.config?.url || "";

    const isAuthPage =
      window.location.pathname === "/register" ||
      window.location.pathname === "/login" ||
      window.location.pathname === "/landing" ||
      window.location.pathname === "/" ||
      window.location.pathname === "/forget-password" ||
      window.location.pathname === "/reset-password" ||
      window.location.pathname === "/verify-email";

    // Skip redirect loop on bootstrap call
    const isBootstrapCall = configUrl.includes("/api/auth/me");

    const shouldRedirect =
      !isAuthPage &&
      !isBootstrapCall &&
      (status === 401 ||
        (status === 403 && typeof data?.message === "string" && data.message.toLowerCase().includes("inactive")));

    if (shouldRedirect) {
      try {
        localStorage.removeItem("idp_access_token");
        localStorage.removeItem("idp_refresh_token");
        localStorage.removeItem("idp_auth_user");
      } catch {}
      const redirect = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
      window.location.href = `/login?redirect=${redirect}`;
    }

    return Promise.reject(error);
  }
);

export default axios;
