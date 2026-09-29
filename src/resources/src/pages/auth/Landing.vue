<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import axios from "axios";

const router = useRouter();

const plans = ref<any[]>([]);
const isLoadingPlans = ref(false);
const hasSuperAdmin = ref(true);
const isSuperAdminSignup = ref(false);
const showSignupModal = ref(false);
const selectedPlan = ref<any | null>(null);
const billingCycle = ref<"monthly" | "yearly">("monthly");

watch(billingCycle, () => {
  if (showSignupModal.value && selectedPlan.value) {
    paidAmount.value = recommendedPayableAmount.value;
  }
});

// Form Data
const name = ref("");
const email = ref("");
const mobile = ref("");
const password = ref("");
const confirmPassword = ref("");
const trxId = ref("");
const paidAmount = ref<number | null>(null);

const showPassword = ref(false);
const showConfirmPassword = ref(false);

const isSubmitting = ref(false);
const errorMsg = ref("");
const successMsg = ref("");

const basePlanFee = computed(() => {
  if (!selectedPlan.value) return 0;
  return billingCycle.value === "yearly" ? (selectedPlan.value.rateYearly || 0) : (selectedPlan.value.rateMonthly || 0);
});

const recommendedPayableAmount = computed(() => {
  const base = basePlanFee.value;
  if (!base) return 0;
  const percent = Number(paymentConfig.value?.bkashCharge || 1.8);
  return Math.ceil(base / (1 - percent / 100));
});

const calculatedCharge = computed(() => {
  const percent = Number(paymentConfig.value?.bkashCharge || 1.8);
  return Math.round(((paidAmount.value || 0) * percent) / 100);
});

const netWalletCredit = computed(() => {
  return Math.max(0, (paidAmount.value || 0) - calculatedCharge.value);
});

const shortageAmount = computed(() => {
  return Math.max(0, basePlanFee.value - netWalletCredit.value);
});

const excessAmount = computed(() => {
  return Math.max(0, netWalletCredit.value - basePlanFee.value);
});

const paymentConfig = ref({
  bkashNumber: "01719950891",
  bkashCharge: 1.8
});

const calculateDiscount = (monthly: number, yearly: number) => {
  if (!monthly || !yearly) return 0;
  return Math.round(((monthly * 12 - yearly) / (monthly * 12)) * 100);
};

const fetchStatusAndPlans = async () => {
  isLoadingPlans.value = true;
  try {
    try {
      const statusRes = await axios.get("/api/auth/system-status");
      if (statusRes.data?.success) {
        hasSuperAdmin.value = statusRes.data.hasSuperAdmin;
      }
    } catch {}

    const [plansRes, payRes] = await Promise.allSettled([
      axios.get("/api/superadmin/plans"),
      axios.get("/api/superadmin/payment-settings")
    ]);

    if (plansRes.status === "fulfilled" && plansRes.value.data?.success && plansRes.value.data.data?.length > 0) {
      plans.value = plansRes.value.data.data.map((p: any) => ({
        ...p,
        yearlyDiscountPercent: p.yearlyDiscountPercent || calculateDiscount(p.rateMonthly, p.rateYearly)
      }));
    }

    if (payRes.status === "fulfilled" && payRes.value.data?.success && payRes.value.data.data) {
      paymentConfig.value = payRes.value.data.data;
    }
  } catch (error) {
    console.error("Error loading plans:", error);
  } finally {
    isLoadingPlans.value = false;
  }
};

const openSignup = (plan: any) => {
  isSuperAdminSignup.value = false;
  selectedPlan.value = plan;
  paidAmount.value = recommendedPayableAmount.value;
  showSignupModal.value = true;
  errorMsg.value = "";
  successMsg.value = "";
};

const formatApiError = (err: any): string => {
  const data = err?.response?.data;
  if (!data) return err?.message || "Registration failed. Please try again.";

  if (typeof data === "string") {
    try {
      const parsed = JSON.parse(data);
      if (parsed.issues && Array.isArray(parsed.issues)) {
        return parsed.issues.map((i: any) => i.message).filter(Boolean).join(", ") || "Invalid input data";
      }
      return parsed.message || parsed.error || data;
    } catch {
      return data;
    }
  }

  if (data.issues && Array.isArray(data.issues)) {
    return data.issues.map((i: any) => i.message).filter(Boolean).join(", ") || "Invalid input data";
  }

  if (data.error) {
    if (typeof data.error === "string") {
      try {
        const parsed = JSON.parse(data.error);
        if (parsed.issues && Array.isArray(parsed.issues)) {
          return parsed.issues.map((i: any) => i.message).filter(Boolean).join(", ");
        }
        return parsed.message || parsed.error || data.error;
      } catch {
        return data.error;
      }
    }
    if (typeof data.error === "object" && data.error.issues) {
      return data.error.issues.map((i: any) => i.message).filter(Boolean).join(", ");
    }
    return String(data.error);
  }

  if (data.message) {
    if (typeof data.message === "string") {
      try {
        const parsed = JSON.parse(data.message);
        if (parsed.issues && Array.isArray(parsed.issues)) {
          return parsed.issues.map((i: any) => i.message).filter(Boolean).join(", ");
        }
      } catch {}
      return data.message;
    }
    return String(data.message);
  }

  return "Registration failed. Please check the entered information.";
};

const handleSignup = async () => {
  errorMsg.value = "";
  successMsg.value = "";

  if (password.value !== confirmPassword.value) {
    errorMsg.value = "Passwords do not match!";
    return;
  }

  if (!name.value || !email.value || !mobile.value || !password.value) {
    errorMsg.value = "Please fill out all required fields.";
    return;
  }

  if (password.value.length < 6) {
    errorMsg.value = "Password must be at least 6 characters.";
    return;
  }

  const isSuperAdminMode = !hasSuperAdmin.value || isSuperAdminSignup.value;

  if (!isSuperAdminMode && !trxId.value) {
    errorMsg.value = "Please enter bKash TrxID.";
    return;
  }

  if (!isSuperAdminMode && (!paidAmount.value || paidAmount.value <= 0)) {
    errorMsg.value = "Please enter the amount you paid via bKash.";
    return;
  }

  isSubmitting.value = true;
  try {
    const res = await axios.post("/api/auth/register", {
      name: name.value,
      email: email.value,
      mobile: mobile.value,
      password: password.value,
      planId: selectedPlan.value?.id,
      billingCycle: billingCycle.value,
      trxId: isSuperAdminMode ? "" : trxId.value.trim(),
      paidAmount: Number(paidAmount.value || basePlanFee.value)
    });

    if (res.data?.success || res.status === 200 || res.status === 201) {
      successMsg.value =
        res.data?.role === "superadmin" || isSuperAdminMode
          ? "Registration successful! You are the Super Admin. You can log in now."
          : "Registration successful! Please wait for the Super Admin to approve your account.";

      name.value = "";
      email.value = "";
      mobile.value = "";
      password.value = "";
      confirmPassword.value = "";
      trxId.value = "";
      paidAmount.value = null;

      setTimeout(() => {
        showSignupModal.value = false;
        router.push("/login");
      }, 2500);
    } else {
      errorMsg.value = "Registration failed: " + (res.data?.error || res.data?.message || "Error");
    }
  } catch (error: any) {
    errorMsg.value = formatApiError(error);
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(fetchStatusAndPlans);
</script>

<template>
  <div class="min-vh-100 d-flex flex-column text-white" style="background-color: #0b0f19;">
    <!-- Top Header -->
    <header class="idp-navbar">
      <div class="idp-grid-container h-100 d-flex justify-content-between align-items-center px-0">
        <div class="d-flex align-items-center">
          <router-link to="/" class="idp-brand" style="font-size: 1.18rem;">
            <i class="bi bi-layers-half text-primary fs-4"></i>
            <span>IDP</span>
          </router-link>
        </div>
        <nav class="d-flex align-items-center">
          <router-link
            to="/login"
            class="btn btn-outline-light btn-sm px-3 py-1 fw-semibold"
            style="font-size: 0.85rem;"
          >
            Login
          </router-link>
        </nav>
      </div>
    </header>

    <main class="flex-grow-1 w-100 d-flex flex-column">
      <div class="idp-grid-container flex-grow-1 text-center px-3 px-md-5 pt-5 pb-5">
        <!-- Main Title -->
        <h1 class="display-4 fw-extrabold text-white mb-5">
          Importer Data Processor
        </h1>

      <!-- Super Admin First Setup (if no super admin exists) -->
      <div v-if="!hasSuperAdmin" class="idp-card max-w-2xl mx-auto p-4 p-md-5 shadow-lg text-start mb-5" style="max-width: 520px;">
        <h3 class="text-white fw-bold mb-2 text-center">Super Admin Setup</h3>
        <div class="alert alert-success py-2 small mb-4 text-center">
          Welcome! Create the first account to take full control of the system. No payment required.
        </div>

        <div v-if="errorMsg" class="alert alert-danger py-2 small mb-3">{{ errorMsg }}</div>
        <div v-if="successMsg" class="alert alert-success py-2 small mb-3 text-center">{{ successMsg }}</div>

        <form v-if="!successMsg" @submit.prevent="isSuperAdminSignup = true; handleSignup();">
          <div class="row g-3 mb-3">
            <div class="col-md-6">
              <label class="form-label">Full Name</label>
              <input v-model="name" type="text" class="form-control idp-input" required placeholder="John Doe" />
            </div>
            <div class="col-md-6">
              <label class="form-label">Mobile Number</label>
              <input v-model="mobile" type="text" class="form-control idp-input" required placeholder="01XXXXXXXXX" />
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label">Email Address</label>
            <input v-model="email" type="email" class="form-control idp-input" required placeholder="john@example.com" />
          </div>

          <div class="row g-3 mb-4">
            <div class="col-md-6">
              <label class="form-label">Password *</label>
              <div class="position-relative">
                <input
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  class="form-control idp-input"
                  style="padding-right: 42px !important;"
                  required
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  class="btn border-0 position-absolute d-flex align-items-center justify-content-center p-0"
                  style="right: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; width: 28px; height: 28px;"
                  @click="showPassword = !showPassword"
                >
                  <i :class="showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'" style="font-size: 1.1rem;"></i>
                </button>
              </div>
            </div>
            <div class="col-md-6">
              <label class="form-label">Confirm Password *</label>
              <div class="position-relative">
                <input
                  v-model="confirmPassword"
                  :type="showConfirmPassword ? 'text' : 'password'"
                  class="form-control idp-input"
                  style="padding-right: 42px !important;"
                  required
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  class="btn border-0 position-absolute d-flex align-items-center justify-content-center p-0"
                  style="right: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; width: 28px; height: 28px;"
                  @click="showConfirmPassword = !showConfirmPassword"
                >
                  <i :class="showConfirmPassword ? 'bi bi-eye-slash' : 'bi bi-eye'" style="font-size: 1.1rem;"></i>
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            class="btn btn-idp-primary w-100 py-3 fw-bold"
            :disabled="isSubmitting"
          >
            {{ isSubmitting ? 'Creating Account...' : 'Initialize Super Admin' }}
          </button>
        </form>
      </div>

      <!-- Pricing Plans Section -->
      <div v-else id="pricing-section" class="container py-4">
        <h2 class="text-white fw-bold mb-4">Choose Your Plan to Sign Up</h2>

        <!-- Monthly / Yearly Toggle -->
        <div class="d-flex justify-content-center mb-5">
          <div class="p-1 rounded-pill bg-dark border border-secondary d-flex align-items-center">
            <button
              type="button"
              class="btn btn-sm px-4 py-2 rounded-pill fw-semibold"
              :class="billingCycle === 'monthly' ? 'btn-primary' : 'text-muted border-0 bg-transparent'"
              @click="billingCycle = 'monthly'"
            >
              Monthly
            </button>
            <button
              type="button"
              class="btn btn-sm px-4 py-2 rounded-pill fw-semibold"
              :class="billingCycle === 'yearly' ? 'btn-primary' : 'text-muted border-0 bg-transparent'"
              @click="billingCycle = 'yearly'"
            >
              Yearly
            </button>
          </div>
        </div>

        <!-- Plans Cards Grid -->
        <div v-if="isLoadingPlans" class="py-5 text-center text-primary">
          <span class="spinner-border me-2"></span> Loading plans...
        </div>

        <div v-else class="row g-4 justify-content-center">
          <div
            v-for="plan in plans"
            :key="plan.id"
            class="col-12 col-md-6 col-lg-4"
          >
            <div class="idp-card p-4 p-md-5 h-100 d-flex flex-column text-start">
              <h3 class="text-white fw-bold mb-3">{{ plan.name }}</h3>
              <div class="mb-2">
                <span class="display-5 fw-extrabold text-white">
                  {{ billingCycle === 'monthly' ? plan.rateMonthly : plan.rateYearly }}
                </span>
                <span class="text-muted small">/{{ billingCycle === 'monthly' ? 'month' : 'year' }}</span>
              </div>

              <div
                class="small text-success fw-bold mb-4"
                :style="{ opacity: billingCycle === 'yearly' ? '1' : '0' }"
              >
                Billed annually (Save {{ plan.yearlyDiscountPercent }}%)
              </div>

              <ul class="list-unstyled mb-5 flex-grow-1 text-light small">
                <!-- 1. Max Sub-users -->
                <li class="d-flex align-items-center gap-2 mb-3">
                  <i class="bi bi-check-circle-fill text-success"></i>
                  <span>Up to <strong>{{ plan.maxUsers }}</strong> Sub-users Allowed</span>
                </li>

                <!-- 2. Max Clients -->
                <li class="d-flex align-items-center gap-2 mb-3">
                  <i class="bi bi-check-circle-fill text-success"></i>
                  <span>Up to <strong>{{ plan.maxClients || 50 }}</strong> Clients Allowed</span>
                </li>

                <!-- 3. Database Storage Space -->
                <li class="d-flex align-items-center gap-2 mb-3">
                  <i class="bi bi-check-circle-fill text-success"></i>
                  <span><strong>{{ (plan.maxStorageMB || 1024) >= 1024 ? ((plan.maxStorageMB || 1024) / 1024).toFixed((plan.maxStorageMB || 1024) % 1024 === 0 ? 0 : 1) + ' GB' : (plan.maxStorageMB || 1024) + ' MB' }}</strong> Database Space</span>
                </li>

                <!-- 4. Standard Plan Features (Excel File Upload, Excel Report Download, etc.) -->
                <li
                  v-for="(feature, idx) in ((plan.features || []).filter((f: string) => {
                    const l = f.toLowerCase();
                    return !l.includes('database space') && !l.includes('account access') && !l.includes('sub-user') && !l.includes('client') && !l.includes('priority');
                  }))"
                  :key="idx"
                  class="d-flex align-items-center gap-2 mb-3"
                >
                  <i class="bi bi-check-circle-fill text-success"></i>
                  <span>{{ feature }}</span>
                </li>

                <!-- 5. Account & Billing Access -->
                <li class="d-flex align-items-center gap-2 mb-3">
                  <i v-if="plan.hasAccounts" class="bi bi-check-circle-fill text-success"></i>
                  <i v-else class="bi bi-x-circle text-danger"></i>
                  <span :class="plan.hasAccounts ? 'text-light' : 'text-muted'">
                    Account & Billing Access
                  </span>
                </li>

                <!-- 6. Priority Dedicated Support (Extra at the very end for Last Card / Enterprise) -->
                <li
                  v-for="(feature, idx) in ((plan.features || []).filter((f: string) => {
                    const l = f.toLowerCase();
                    return l.includes('priority');
                  }))"
                  :key="'priority-' + idx"
                  class="d-flex align-items-center gap-2 mb-3"
                >
                  <i class="bi bi-check-circle-fill text-success"></i>
                  <span>{{ feature }}</span>
                </li>
              </ul>

              <button
                class="btn btn-idp-primary w-100 py-3 fw-bold"
                @click="openSignup(plan)"
              >
                Sign Up Now
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </main>

    <!-- Footer Grid Line -->
    <footer class="idp-footer">
      <div class="idp-grid-container h-100 d-flex align-items-center justify-content-between px-0">
        <span class="text-muted small">IDP &copy; 2026</span>
        <span class="text-muted small">Importer Data Processor</span>
      </div>
    </footer>

    <!-- Sign Up Modal with bKash Integration -->
    <div
      v-if="showSignupModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.8);"
    >
      <div class="modal-dialog modal-dialog-centered" style="max-width: 520px;">
        <div class="modal-content idp-card">
          <div class="modal-header">
            <h5 class="modal-title text-white">
              {{ isSuperAdminSignup ? 'Super Admin Setup' : `Sign Up for ${selectedPlan?.name}` }}
            </h5>
            <button type="button" class="btn-close" @click="showSignupModal = false"></button>
          </div>
          <div class="modal-body p-4">
            <div v-if="errorMsg" class="alert alert-danger py-2 small mb-3">{{ errorMsg }}</div>
            <div v-if="successMsg" class="alert alert-success py-2 small mb-3 text-center">{{ successMsg }}</div>

            <form v-if="!successMsg" @submit.prevent="handleSignup">
              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <label class="form-label">Full Name *</label>
                  <input v-model="name" type="text" class="form-control idp-input" required placeholder="John Doe" />
                </div>
                <div class="col-md-6">
                  <label class="form-label">Mobile Number *</label>
                  <input v-model="mobile" type="text" class="form-control idp-input" required placeholder="01XXXXXXXXX" />
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label">Email Address *</label>
                <input v-model="email" type="email" class="form-control idp-input" required placeholder="john@example.com" />
              </div>

              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <label class="form-label">Password *</label>
                  <div class="position-relative">
                    <input
                      v-model="password"
                      :type="showPassword ? 'text' : 'password'"
                      class="form-control idp-input"
                      style="padding-right: 42px !important;"
                      required
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      class="btn border-0 position-absolute d-flex align-items-center justify-content-center p-0"
                      style="right: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; width: 28px; height: 28px;"
                      @click="showPassword = !showPassword"
                    >
                      <i :class="showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'" style="font-size: 1.1rem;"></i>
                    </button>
                  </div>
                </div>
                <div class="col-md-6">
                  <label class="form-label">Confirm Password *</label>
                  <div class="position-relative">
                    <input
                      v-model="confirmPassword"
                      :type="showConfirmPassword ? 'text' : 'password'"
                      class="form-control idp-input"
                      style="padding-right: 42px !important;"
                      required
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      class="btn border-0 position-absolute d-flex align-items-center justify-content-center p-0"
                      style="right: 12px; top: 50%; transform: translateY(-50%); color: #94a3b8; width: 28px; height: 28px;"
                      @click="showConfirmPassword = !showConfirmPassword"
                    >
                      <i :class="showConfirmPassword ? 'bi bi-eye-slash' : 'bi bi-eye'" style="font-size: 1.1rem;"></i>
                    </button>
                  </div>
                </div>
              </div>

              <!-- bKash Payment & Amount Details -->
              <div v-if="!isSuperAdminSignup" class="mb-4">
                <!-- Payment Breakdown Card -->
                <div class="card bg-dark border-secondary p-3 mb-3" style="background-color: rgba(15, 23, 42, 0.6) !important;">
                  <div class="d-flex justify-content-between align-items-center mb-1 small">
                    <span class="text-muted">Plan Base Price ({{ billingCycle === 'yearly' ? 'Yearly' : 'Monthly' }}):</span>
                    <strong class="text-white font-monospace">৳ {{ basePlanFee.toLocaleString() }}</strong>
                  </div>
                  <div class="d-flex justify-content-between align-items-center mb-1 small">
                    <span class="text-muted">Required bKash Payment (inc. {{ paymentConfig.bkashCharge }}% fee):</span>
                    <strong class="text-warning font-monospace">৳ {{ recommendedPayableAmount.toLocaleString() }}</strong>
                  </div>
                  <div class="d-flex justify-content-between align-items-center mb-1 small">
                    <span class="text-muted">Amount Sent:</span>
                    <strong class="text-info font-monospace">৳ {{ (paidAmount || 0).toLocaleString() }}</strong>
                  </div>
                  <div class="d-flex justify-content-between align-items-center mb-2 small">
                    <span class="text-muted">bKash Fee ({{ paymentConfig.bkashCharge }}%):</span>
                    <strong class="text-warning font-monospace">-৳ {{ calculatedCharge.toLocaleString() }}</strong>
                  </div>
                  <div class="d-flex justify-content-between align-items-center pt-2 border-top border-secondary">
                    <span class="fw-bold text-white">Net Wallet Credit:</span>
                    <strong class="text-success fs-5 font-monospace">৳ {{ netWalletCredit.toLocaleString() }}</strong>
                  </div>
                </div>

                <div class="row g-3 mb-2">
                  <div class="col-md-6">
                    <label class="form-label">Amount Paid (৳) *</label>
                    <input
                      v-model.number="paidAmount"
                      type="number"
                      class="form-control idp-input font-monospace fw-bold text-white"
                      :placeholder="basePlanFee.toString()"
                      required
                      min="1"
                    />
                  </div>
                  <div class="col-md-6">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                      <label class="form-label mb-0">bKash TrxID *</label>
                      <span class="badge bg-danger text-white px-2 py-0.5 fw-bold" style="font-size: 0.72rem;">
                        Fee: {{ paymentConfig.bkashCharge }}%
                      </span>
                    </div>
                    <input
                      v-model="trxId"
                      type="text"
                      class="form-control idp-input font-monospace"
                      placeholder="e.g. 8N3A5B2C"
                      required
                    />
                  </div>
                </div>

                <!-- Balance Status Notice -->
                <div
                  v-if="shortageAmount > 0"
                  class="alert alert-warning py-2 px-3 mb-2 small d-flex align-items-center gap-2 border-warning bg-opacity-25"
                >
                  <i class="bi bi-info-circle-fill text-warning fs-5"></i>
                  <div>
                    <strong>Shortage Notice:</strong> After bKash fee, net ৳{{ netWalletCredit }} will be credited to your wallet (Shortage: <strong>৳{{ shortageAmount }}</strong>). You can recharge this shortage after verification to activate your plan.
                  </div>
                </div>

                <div
                  v-else-if="excessAmount > 0"
                  class="alert alert-info py-2 px-3 mb-2 small d-flex align-items-center gap-2 border-info bg-opacity-25"
                >
                  <i class="bi bi-wallet2 text-info fs-5"></i>
                  <div>
                    <strong>Advance Credit:</strong> Extra <strong>৳{{ excessAmount }}</strong> will stay in your wallet for future renewals!
                  </div>
                </div>

                <div class="text-muted small">
                  Send payment to bKash (Send Money) Number: <strong class="text-warning font-monospace">{{ paymentConfig.bkashNumber }}</strong>
                </div>
              </div>

              <button
                type="submit"
                class="btn btn-idp-primary w-100 py-3 fw-bold"
                :disabled="isSubmitting"
              >
                {{ isSubmitting ? 'Submitting Registration...' : 'Complete Sign Up' }}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
