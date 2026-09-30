<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/composables/useToast";
import axios from "axios";

const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const loginId = ref("");
const password = ref("");
const showPassword = ref(false);
const isSubmitting = ref(false);

// Platform stats
const platformStats = ref({
  tenants: "10+",
  users: "50+",
  clients: "100+"
});

const fetchPlatformStats = async () => {
  try {
    const res = await axios.get("/api/superadmin/public-stats");
    if (res.data?.success && res.data?.data) {
      platformStats.value = res.data.data;
    }
  } catch (err) {
    // Keep fallback defaults
  }
};

onMounted(() => {
  fetchPlatformStats();
});

// Forgot password workflow
const isForgotPassword = ref(false);
const resetStep = ref<1 | 2>(1);
const resetEmail = ref("");
const resetOtp = ref("");
const newPassword = ref("");
const isSendingOtp = ref(false);

const handleLogin = async () => {
  if (!loginId.value || !password.value) {
    toast.error("Please enter both Email and Password.");
    return;
  }
  isSubmitting.value = true;
  try {
    await authStore.login({
      email: loginId.value.trim(),
      password: password.value,
      remember: true
    });

    toast.success("Signed in successfully!");
    const redirectPath = (router.currentRoute.value.query.redirect as string) || "/";
    router.push(redirectPath);
  } catch (err: any) {
    toast.error(err?.message || "Invalid email or password. Please check your credentials.");
  } finally {
    isSubmitting.value = false;
  }
};

const handleRequestOtp = async () => {
  if (!resetEmail.value) {
    toast.error("Please enter your registered email address.");
    return;
  }
  isSendingOtp.value = true;
  try {
    const res = await axios.post("/api/auth/forgot-password-request", {
      email: resetEmail.value.trim()
    });
    if (res.data?.success) {
      toast.success(res.data?.message || "OTP sent to your email!");
      resetOtp.value = "";
      newPassword.value = "";
      resetStep.value = 2;
    } else {
      toast.error(res.data?.error || res.data?.message || "Failed to send OTP.");
    }
  } catch (err: any) {
    toast.error(err?.response?.data?.message || err?.message || "Error requesting OTP.");
  } finally {
    isSendingOtp.value = false;
  }
};

const handleResetPassword = async () => {
  const otpClean = resetOtp.value.trim();
  if (!otpClean || otpClean.length < 4) {
    toast.error("Please enter the 6-digit OTP code received in your email.");
    return;
  }
  if (!newPassword.value || newPassword.value.length < 6) {
    toast.error("Password must be at least 6 characters.");
    return;
  }
  isSubmitting.value = true;
  try {
    const res = await axios.post("/api/auth/forgot-password-reset", {
      email: resetEmail.value.trim(),
      otp: otpClean,
      newPassword: newPassword.value
    });
    if (res.data?.success) {
      toast.success(res.data?.message || "Password reset successfully! Please sign in.");
      isForgotPassword.value = false;
      resetStep.value = 1;
      resetOtp.value = "";
      newPassword.value = "";
      password.value = "";
    } else {
      toast.error(res.data?.error || res.data?.message || "Invalid OTP or reset failed.");
    }
  } catch (err: any) {
    toast.error(err?.response?.data?.message || err?.message || "Error resetting password.");
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="login-root">
    <div class="login-wrapper">
      <!-- Left Branding Panel -->
      <div class="login-left">
        <div class="login-left-inner">
          <!-- Logo -->
          <div class="brand-logo">
            <div class="brand-icon">
              <i class="bi bi-layers-half"></i>
            </div>
            <span class="brand-name">IDP</span>
          </div>

          <!-- Headline -->
          <div class="brand-headline">
            <h1>Intelligent VAT &amp;<br/>Account Management System</h1>
          </div>

          <!-- Feature list -->
          <ul class="feature-list">
            <li>
              <span class="feature-dot dot-blue"></span>
              <span>Automated VAT Calculations</span>
            </li>
            <li>
              <span class="feature-dot dot-purple"></span>
              <span>Multi-Tenant Architecture</span>
            </li>
            <li>
              <span class="feature-dot dot-cyan"></span>
              <span>Real-Time Client Invoicing &amp; Billing Tracker</span>
            </li>
            <li>
              <span class="feature-dot dot-emerald"></span>
              <span>Mushak 9.1 Return Ready</span>
            </li>
          </ul>

          <!-- Bottom stat strip -->
          <div class="stat-strip">
            <div class="stat-item">
              <span class="stat-value val-cyan">{{ platformStats.tenants }}</span>
              <span class="stat-label">Tenants</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-value val-warning">{{ platformStats.users }}</span>
              <span class="stat-label">Users</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-value val-success">{{ platformStats.clients }}</span>
              <span class="stat-label">Clients</span>
            </div>
            <div class="stat-divider"></div>
            <div class="stat-item">
              <span class="stat-value val-purple">24/7</span>
              <span class="stat-label">Live Support</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Center Divider (Card height) -->
      <div class="login-center-divider" aria-hidden="true"></div>

      <!-- Right Form Panel -->
      <div class="login-right">
        <!-- Mobile Brand Header (Visible only on mobile/small tablets) -->
        <div class="mobile-brand-header">
          <div class="d-inline-flex align-items-center gap-2 mb-1">
            <div class="brand-icon-sm">
              <i class="bi bi-layers-half"></i>
            </div>
            <span class="brand-name-sm">IDP System</span>
          </div>
          <p class="text-muted fs-8 mb-2">Smart VAT &amp; Account Management</p>
          <div class="d-flex flex-wrap justify-content-center gap-1 mb-3">
            <span class="badge bg-dark border border-secondary text-info fs-8">{{ platformStats.tenants }} Tenants</span>
            <span class="badge bg-dark border border-secondary text-warning fs-8">{{ platformStats.users }} Users</span>
            <span class="badge bg-dark border border-secondary text-success fs-8">{{ platformStats.clients }} Clients</span>
            <span class="badge bg-dark border border-secondary fs-8" style="color: #c084fc !important;">24/7 Live Support</span>
          </div>
        </div>

        <div class="form-panel">

          <!-- Login Form -->
          <template v-if="!isForgotPassword">
            <div class="form-header">
              <div class="form-step-badge">Secure System</div>
              <h2>Welcome back</h2>
              <p>Sign in to your dashboard</p>
            </div>

            <form @submit.prevent="handleLogin" class="login-form">
              <!-- Email Field -->
              <div class="field-group">
                <label class="field-label">Email address</label>
                <div class="field-wrap">
                  <span class="field-icon"><i class="bi bi-envelope-fill"></i></span>
                  <input
                    v-model="loginId"
                    type="email"
                    class="login-input"
                    placeholder="name@company.com"
                    autocomplete="username"
                    required
                  />
                </div>
              </div>

              <!-- Password Field -->
              <div class="field-group">
                <div class="field-label-row">
                  <label class="field-label">Password</label>
                  <a
                    href="javascript:void(0)"
                    class="forgot-link"
                    @click="isForgotPassword = true; resetStep = 1; resetOtp = ''; newPassword = '';"
                  >Forgot password?</a>
                </div>
                <div class="field-wrap">
                  <span class="field-icon"><i class="bi bi-lock-fill"></i></span>
                  <input
                    v-model="password"
                    :type="showPassword ? 'text' : 'password'"
                    class="login-input"
                    placeholder="••••••••"
                    autocomplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    class="field-eye-btn"
                    @click="showPassword = !showPassword"
                    tabindex="-1"
                  >
                    <i :class="showPassword ? 'bi bi-eye-slash-fill' : 'bi bi-eye-fill'"></i>
                  </button>
                </div>
              </div>

              <!-- Submit -->
              <button
                type="submit"
                class="btn-login"
                :disabled="isSubmitting"
              >
                <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2" role="status"></span>
                <i v-else class="bi bi-arrow-right-circle-fill me-2"></i>
                {{ isSubmitting ? 'Signing in...' : 'Sign in' }}
              </button>

              <!-- Sign up link -->
              <div class="signup-row">
                <span>Don't have an account?</span>
                <router-link to="/landing#pricing-section" class="signup-link">View Plans &amp; Sign Up</router-link>
              </div>
            </form>
          </template>

          <!-- Forgot Password Workflow -->
          <template v-else>
            <div class="form-header">
              <div class="form-step-badge">{{ resetStep === 1 ? 'Step 1 of 2' : 'Step 2 of 2' }}</div>
              <h2>Reset Password</h2>
              <p>{{ resetStep === 1 ? 'Enter your registered email address' : 'Enter the OTP sent to your email' }}</p>
            </div>

            <!-- Step 1: Email -->
            <div v-if="resetStep === 1" class="login-form">
              <div class="field-group">
                <label class="field-label">Registered Email</label>
                <div class="field-wrap">
                  <span class="field-icon"><i class="bi bi-envelope-fill"></i></span>
                  <input
                    v-model="resetEmail"
                    type="email"
                    class="login-input"
                    placeholder="you@example.com"
                    autocomplete="email"
                    required
                  />
                </div>
              </div>
              <button
                type="button"
                class="btn-login"
                :disabled="isSendingOtp"
                @click="handleRequestOtp"
              >
                <span v-if="isSendingOtp" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-send-fill me-2"></i>
                Send OTP
              </button>
            </div>

            <!-- Step 2: OTP + New Password -->
            <div v-else class="login-form">
              <div class="field-group">
                <label class="field-label" style="text-align:center; display:block;">6-Digit OTP</label>
                <input
                  v-model="resetOtp"
                  type="text"
                  class="login-input otp-input"
                  placeholder="——————"
                  maxlength="6"
                  autocomplete="one-time-code"
                  inputmode="numeric"
                  pattern="[0-9]*"
                  id="reset-otp-field"
                  name="reset-otp-field"
                  required
                />
              </div>
              <div class="field-group">
                <label class="field-label">New Password</label>
                <div class="field-wrap">
                  <span class="field-icon"><i class="bi bi-lock-fill"></i></span>
                  <input
                    v-model="newPassword"
                    type="password"
                    class="login-input"
                    placeholder="Minimum 6 characters"
                    autocomplete="new-password"
                    id="reset-new-password"
                    name="reset-new-password"
                    required
                  />
                </div>
              </div>
              <button
                type="button"
                class="btn-login"
                :disabled="isSubmitting"
                @click="handleResetPassword"
              >
                <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-shield-check-fill me-2"></i>
                Reset Password
              </button>
            </div>

            <button
              type="button"
              class="back-btn"
              @click="isForgotPassword = false; resetStep = 1; resetOtp = ''; newPassword = '';"
            >
              <i class="bi bi-arrow-left me-1"></i> Back to Sign In
            </button>
          </template>

        </div>

        <!-- Footer note -->
        <div class="login-footer-note">
          <i class="bi bi-shield-check text-success me-1"></i>
          Protected by TLS 1.3 encryption
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

/* ===== ROOT ===== */
.login-root {
  min-height: 100vh;
  width: 100%;
  background-color: #1a1d21;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  position: relative;
  overflow-x: hidden;
}

/* ===== WRAPPER ===== */
.login-wrapper {
  display: flex;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 3rem 2rem;
  align-items: center;
  justify-content: space-between;
  position: relative;
  z-index: 1;
}

/* ===== LEFT BRANDING PANEL ===== */
.login-left {
  flex: 1.15;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 1rem 2rem 1rem 1rem;
  background-color: transparent;
}

.login-left-inner {
  max-width: 440px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

/* Brand Logo */
.brand-logo {
  display: flex;
  align-items: center;
  gap: 12px;
}
.brand-icon {
  width: 44px; height: 44px;
  background: #3b8eed;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 1.3rem;
  color: #fff;
}
.brand-name {
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: 2px;
  color: #f8f9fa;
}

/* Headline */
.brand-headline h1 {
  font-size: 2.1rem;
  font-weight: 800;
  line-height: 1.25;
  color: #f8f9fa;
  margin: 0;
  letter-spacing: -0.4px;
}

/* Feature list */
.feature-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
}
.feature-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 0.88rem;
  color: #adb5bd;
  font-weight: 500;
}
.feature-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-blue   { background-color: #3b8eed; }
.dot-purple { background-color: #a855f7; }
.dot-cyan   { background-color: #0dcaf0; }
.dot-emerald{ background-color: #198754; }

/* Stat strip */
.stat-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  background: #212529;
  border: 1px solid #343a40;
  border-radius: 10px;
  max-width: 440px;
  width: 100%;
}
.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  flex: 1;
  text-align: center;
}
.stat-value {
  font-size: 1.15rem;
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.2px;
  white-space: nowrap;
  display: inline-block;
}
.val-cyan    { color: #38bdf8; }
.val-warning { color: #fbbf24; }
.val-success { color: #34d399; }
.val-purple  { color: #c084fc; }

.stat-label {
  font-size: 0.68rem;
  color: #94a3b8;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  white-space: nowrap;
}
.stat-divider {
  width: 1px;
  height: 38px;
  background: #343a40;
  flex-shrink: 0;
}

/* ===== CENTER DIVIDER ===== */
.login-center-divider {
  width: 1px;
  height: 380px;
  background: #2e343b;
  align-self: center;
  flex-shrink: 0;
}

/* ===== RIGHT FORM PANEL ===== */
.login-right {
  flex: 0.85;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem 0.5rem 1rem 2.5rem;
  gap: 1.25rem;
  background-color: transparent;
}

.form-panel {
  width: 100%;
  max-width: 360px;
  background: #212529;
  border: 1px solid #343a40;
  border-radius: 10px;
  padding: 2rem 1.85rem;
  box-shadow: 0 10px 30px rgba(0,0,0,0.4);
}

/* Form Header */
.form-header {
  margin-bottom: 1.5rem;
}
.form-step-badge {
  display: inline-flex;
  align-items: center;
  padding: 2.5px 9px;
  background: rgba(59,142,237,0.15);
  border: 1px solid rgba(59,142,237,0.3);
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 600;
  color: #0dcaf0;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-bottom: 0.65rem;
}
.form-header h2 {
  font-size: 1.5rem;
  font-weight: 800;
  color: #f8f9fa;
  margin: 0 0 0.3rem 0;
  letter-spacing: -0.3px;
}
.form-header p {
  font-size: 0.85rem;
  color: #adb5bd;
  margin: 0;
}

/* Alerts */
.login-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0.6rem 0.85rem;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 500;
  margin-bottom: 0.9rem;
}
.login-alert-error {
  background: rgba(220,53,69,0.12);
  border: 1px solid rgba(220,53,69,0.25);
  color: #fca5a5;
}
.login-alert-success {
  background: rgba(25,135,84,0.12);
  border: 1px solid rgba(25,135,84,0.25);
  color: #20c997;
}

/* Form */
.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Field group */
.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.field-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: #f8f9fa;
  letter-spacing: 0.2px;
}
.field-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.forgot-link {
  font-size: 0.78rem;
  font-weight: 600;
  color: #0dcaf0;
  text-decoration: none;
  transition: color 0.15s ease;
}
.forgot-link:hover {
  color: #6edff6;
}
.field-wrap {
  position: relative;
}
.field-icon {
  position: absolute;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  font-size: 0.88rem;
  pointer-events: none;
  z-index: 2;
  transition: color 0.2s ease;
}
.login-input {
  width: 100%;
  height: 42px;
  background: #1a1d21;
  border: 1px solid #343a40;
  border-radius: 6px;
  color: #f8f9fa;
  font-size: 0.88rem;
  font-family: inherit;
  padding: 0 40px;
  outline: none;
  transition: border-color 0.15s ease;
  box-sizing: border-box;
}
.login-input::placeholder {
  color: #6c757d;
}
.login-input:focus {
  border-color: #3b8eed;
  background: #262b30;
  box-shadow: 0 0 0 2px rgba(59, 142, 237, 0.25);
}
.login-input:focus + .field-icon,
.field-wrap:focus-within .field-icon {
  color: #0dcaf0;
}
.otp-input {
  padding: 0 1rem;
  text-align: center;
  letter-spacing: 9px;
  font-size: 1.15rem;
  font-weight: 700;
  font-family: 'Inter', monospace;
}
.field-eye-btn {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: color 0.15s ease;
  font-size: 0.88rem;
  z-index: 2;
}
.field-eye-btn:hover {
  color: #f8f9fa;
}

/* Submit Button */
.btn-login {
  height: 42px;
  background: #3b8eed;
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;
  margin-top: 0.25rem;
  letter-spacing: 0.2px;
}
.btn-login:hover:not(:disabled) {
  background: #2575d0;
}
.btn-login:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Sign up row */
.signup-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 0.82rem;
  color: #6c757d;
  padding-top: 0.75rem;
  border-top: 1px solid #343a40;
  margin-top: 0.25rem;
}
.signup-link {
  color: #0dcaf0;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.15s ease;
}
.signup-link:hover {
  color: #6edff6;
}

/* Back button */
.back-btn {
  background: none;
  border: none;
  color: #6c757d;
  font-size: 0.85rem;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  padding: 0.5rem 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  margin-top: 0.5rem;
  transition: color 0.15s ease;
}
.back-btn:hover {
  color: #f8f9fa;
}

.mobile-brand-header {
  display: none;
  text-align: center;
  width: 100%;
}
.brand-icon-sm {
  width: 32px;
  height: 32px;
  background: #3b8eed;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.1rem;
  color: #fff;
}
.brand-name-sm {
  font-size: 1.25rem;
  font-weight: 800;
  color: #f8f9fa;
  letter-spacing: 1px;
}
.fs-8 {
  font-size: 0.75rem !important;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 992px) {
  .login-wrapper {
    max-width: 920px;
  }
  .brand-headline h1 {
    font-size: 1.9rem;
  }
  .stat-strip {
    padding: 0.8rem 1rem;
    gap: 0.75rem;
  }
  .stat-value {
    font-size: 0.85rem;
  }
}

@media (max-width: 768px) {
  .login-root {
    padding: 1rem;
    align-items: flex-start;
    min-height: 100vh;
  }
  .login-left {
    display: none;
  }
  .login-wrapper {
    max-width: 460px;
    margin: 1.5rem auto;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }
  .login-right {
    width: 100%;
    padding: 1.75rem 1.25rem;
  }
  .mobile-brand-header {
    display: block;
  }
  .form-panel {
    padding: 1.75rem 1.25rem;
    border-radius: 8px;
  }
  .form-header h2 {
    font-size: 1.45rem;
  }
}

@media (max-width: 480px) {
  .login-root {
    padding: 0.5rem;
  }
  .login-wrapper {
    margin: 0.5rem auto;
    border: 1px solid #343a40;
  }
  .login-right {
    padding: 1.25rem 0.75rem;
  }
  .form-panel {
    padding: 1.25rem 1rem;
    box-shadow: none;
  }
}
</style>
