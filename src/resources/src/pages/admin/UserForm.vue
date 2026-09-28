<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/composables/useToast";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const isEditMode = computed(() => !!route.params.id && route.params.id !== "create");
const userId = computed(() => Number(route.params.id) || 0);

const hasAccountsAccess = computed(() => {
  const user = authStore.user as any;
  if (!user) return false;
  if (user.role === "superadmin") return true;
  if (user.plan) {
    return user.plan.hasAccounts === true;
  }
  return false;
});

const allModulesList = [
  { id: "clients", name: "Clients Organization", icon: "bi-briefcase", desc: "Manage client profiles, TIN/BIN and details" },
  { id: "activity_filter", name: "Activity Filter", icon: "bi-funnel", desc: "Filter client activities and monthly operations" },
  { id: "submissions", name: "Submissions & Filing", icon: "bi-journal-text", desc: "Monthly VAT submissions and filing records" },
  { id: "bin_formatter", name: "BIN Formatter", icon: "bi-card-checklist", desc: "Batch validate and format 9-13 digit BIN numbers" },
  { id: "purchases", name: "Upload Purchases", icon: "bi-cart3", desc: "Upload and reconcile purchase registers" },
  { id: "sales_rates", name: "Sales Rates", icon: "bi-currency-dollar", desc: "Maintain product sales rates and VAT vatable value" },
  {
    id: "reports",
    name: "Audit & Analytics Reports",
    icon: "bi-file-earmark-bar-graph",
    desc: "Generate tenant audit reports and summaries"
  },
  {
    id: "billing",
    name: "Billing & Invoices",
    icon: "bi-receipt-cutoff",
    desc: "Create bills, track payments and ledger",
    requiresAccounts: true
  },
  { id: "settings", name: "Firm Settings", icon: "bi-sliders", desc: "Configure organization profile and preferences" }
];

const availableModules = computed(() => {
  return allModulesList.filter((m) => !m.requiresAccounts || hasAccountsAccess.value);
});

const isSubmitting = ref(false);
const isLoading = ref(false);
const showPassword = ref(false);

const form = ref({
  name: "",
  email: "",
  mobile: "",
  password: "",
  role: "user" as "user",
  status: "active" as "active" | "inactive",
  permissions: [] as string[]
});

const selectAllModules = () => {
  form.value.permissions = availableModules.value.map((m) => m.id);
};

const clearAllModules = () => {
  form.value.permissions = [];
};

const toggleModule = (modId: string) => {
  if (form.value.permissions.includes(modId)) {
    form.value.permissions = form.value.permissions.filter((id) => id !== modId);
  } else {
    form.value.permissions.push(modId);
  }
};

const isModuleSelected = (modId: string) => form.value.permissions.includes(modId);

// Default sub-user checked modules (Clients, BIN Formatter, Purchases, Settings are unchecked by default)
const DEFAULT_USER_PERMISSIONS = ["activity_filter", "submissions", "sales_rates", "reports"];

// Fetch user data if in edit mode
const fetchUserData = async () => {
  if (!isEditMode.value) {
    // Default create mode: check only designated routine modules
    form.value.permissions = [...DEFAULT_USER_PERMISSIONS];
    return;
  }

  isLoading.value = true;
  try {
    const res = await axios.get("/api/users");
    const list = res.data?.data || res.data || [];
    const target = list.find((u: any) => u.id === userId.value);
    if (target) {
      form.value = {
        name: target.name || "",
        email: target.email || "",
        mobile: target.mobile || "",
        password: "",
        role: "user",
        status: target.status || "active",
        permissions: Array.isArray(target.permissions) ? [...target.permissions] : [...DEFAULT_USER_PERMISSIONS]
      };
    } else {
      toast.error("User record not found.");
    }
  } catch (err: any) {
    toast.error("Failed to load user information.");
  } finally {
    isLoading.value = false;
  }
};

// Handle Submit
const handleSubmit = async () => {
  if (!form.value.name.trim()) {
    toast.warning("Full name is required.");
    return;
  }
  if (!form.value.email.trim() || !form.value.email.includes("@")) {
    toast.warning("A valid email address is required.");
    return;
  }
  if (!form.value.mobile.trim()) {
    toast.warning("Mobile number is required.");
    return;
  }
  if (!isEditMode.value && (!form.value.password || form.value.password.length < 6)) {
    toast.warning("Password is required and must be at least 6 characters long.");
    return;
  }

  isSubmitting.value = true;

  const payload: any = {
    name: form.value.name.trim(),
    email: form.value.email.trim(),
    mobile: form.value.mobile.trim(),
    role: "user",
    status: form.value.status,
    permissions: form.value.permissions
  };

  if (form.value.password) {
    payload.password = form.value.password;
  }

  try {
    if (isEditMode.value) {
      await axios.put(`/api/users/${userId.value}`, payload);
      toast.success("Sub-user updated successfully!");
    } else {
      await axios.post("/api/users", payload);
      toast.success("Sub-user created successfully and saved to database!");
    }

    setTimeout(() => {
      if (window.opener) {
        try {
          window.opener.location.reload();
        } catch (e) {}
      }
      router.push("/admin/users");
    }, 1000);
  } catch (err: any) {
    const errorMsg = err.response?.data?.message || err.response?.data?.error || "Failed to save user. Please try again.";
    toast.error(errorMsg);
  } finally {
    isSubmitting.value = false;
  }
};

onMounted(() => {
  fetchUserData();
});
</script>

<template>
  <div class="user-form-page container-fluid py-3">
    <!-- Breadcrumbs & Header -->
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-4">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/admin/users" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Team Users
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">{{ isEditMode ? 'Edit User' : 'Create New Sub-User' }}</span>
        </div>
        <h3 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
          <i class="bi bi-person-plus-fill text-primary"></i>
          <span>{{ isEditMode ? 'Edit Sub-User Account' : 'Add New Sub-User' }}</span>
        </h3>
        <span class="text-muted small">
          Configure sub-user credentials, contact info, and granular module permissions
        </span>
      </div>

      <div class="d-flex align-items-center gap-2 mt-2 mt-md-0">
        <router-link to="/admin/users" class="btn btn-outline-secondary btn-sm px-3">
          <i class="bi bi-x me-1"></i> Cancel
        </router-link>
        <button
          type="button"
          class="btn btn-primary btn-sm px-4 d-flex align-items-center gap-2 fw-semibold"
          :disabled="isSubmitting || isLoading"
          @click="handleSubmit"
        >
          <span v-if="isSubmitting" class="spinner-border spinner-border-sm"></span>
          <i v-else class="bi bi-check2-circle"></i>
          {{ isEditMode ? 'Update Sub-User' : 'Save Sub-User' }}
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="text-muted mt-2">Loading user details...</p>
    </div>

    <!-- Main Form Grid -->
    <div v-else class="row g-4">
      <!-- Left Column: User Profile & Credentials -->
      <div class="col-lg-5">
        <div class="card idp-form-card h-100 shadow-sm">
          <div class="card-header bg-transparent border-secondary border-opacity-25 py-3">
            <h5 class="card-title text-white mb-0 d-flex align-items-center gap-2 fs-6 fw-bold">
              <i class="bi bi-person-badge text-primary"></i> Account & Profile Information
            </h5>
          </div>

          <div class="card-body p-4">
            <!-- Full Name -->
            <div class="mb-3">
              <label class="form-label text-muted small fw-semibold mb-1">
                FULL NAME <span class="text-danger">*</span>
              </label>
              <div class="idp-input-wrap">
                <span class="input-icon">
                  <i class="bi bi-person"></i>
                </span>
                <input
                  v-model="form.name"
                  type="text"
                  class="form-control idp-field"
                  placeholder="e.g. Md. Ashiqur Rahman"
                  required
                />
              </div>
            </div>

            <!-- Email Address -->
            <div class="mb-3">
              <label class="form-label text-muted small fw-semibold mb-1">
                EMAIL ADDRESS <span class="text-danger">*</span>
              </label>
              <div class="idp-input-wrap">
                <span class="input-icon">
                  <i class="bi bi-envelope"></i>
                </span>
                <input
                  v-model="form.email"
                  type="email"
                  class="form-control idp-field"
                  placeholder="staff@firm.com"
                  required
                />
              </div>
            </div>

            <!-- Mobile Number -->
            <div class="mb-3">
              <label class="form-label text-muted small fw-semibold mb-1">
                MOBILE NUMBER <span class="text-danger">*</span>
              </label>
              <div class="idp-input-wrap">
                <span class="input-icon">
                  <i class="bi bi-telephone"></i>
                </span>
                <input
                  v-model="form.mobile"
                  type="tel"
                  class="form-control idp-field font-monospace"
                  placeholder="017XXXXXXXX"
                  required
                />
              </div>
            </div>

            <!-- Password -->
            <div class="mb-3">
              <label class="form-label text-muted small fw-semibold mb-1 d-flex justify-content-between">
                <span>PASSWORD {{ isEditMode ? '(Leave blank to keep unchanged)' : '*' }}</span>
                <span v-if="!isEditMode" class="text-muted fw-normal">Min 6 chars</span>
              </label>
              <div class="idp-input-wrap">
                <span class="input-icon">
                  <i class="bi bi-key"></i>
                </span>
                <input
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  class="form-control idp-field pe-5"
                  :placeholder="isEditMode ? '••••••••' : 'Enter login password'"
                  :required="!isEditMode"
                />
                <button
                  type="button"
                  class="btn-eye-toggle"
                  title="Toggle password visibility"
                  @click="showPassword = !showPassword"
                >
                  <i class="bi" :class="showPassword ? 'bi-eye-slash' : 'bi-eye'"></i>
                </button>
              </div>
            </div>

            <!-- Role Selection -->
            <div class="mb-3">
              <label class="form-label text-muted small fw-semibold mb-1">ACCOUNT ROLE</label>
              <div class="role-badge-card p-3 rounded d-flex align-items-center gap-3">
                <div class="role-icon-box">
                  <i class="bi bi-person-gear text-primary fs-4"></i>
                </div>
                <div>
                  <div class="text-white fw-bold">Staff / Sub-User</div>
                  <div class="text-muted small">Custom granular module permissions assigned below</div>
                </div>
              </div>
            </div>

            <!-- Account Status -->
            <div class="mb-2">
              <label class="form-label text-muted small fw-semibold mb-1">ACCOUNT STATUS</label>
              <select v-model="form.status" class="form-select idp-select">
                <option value="active">Active (Can log in immediately)</option>
                <option value="inactive">Inactive / Suspended (Access disabled)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Granular Module Permissions -->
      <div class="col-lg-7">
        <div class="card idp-form-card h-100 shadow-sm">
          <div class="card-header bg-transparent border-secondary border-opacity-25 py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <h5 class="card-title text-white mb-0 d-flex align-items-center gap-2 fs-6 fw-bold">
                <i class="bi bi-shield-lock text-primary"></i> Module Access & Permissions
              </h5>
              <span class="text-muted small">Select which features this sub-user can access (All selected by default)</span>
            </div>

            <div class="d-flex align-items-center gap-2">
              <button
                type="button"
                class="btn btn-sm btn-outline-primary px-2"
                @click="selectAllModules"
              >
                <i class="bi bi-check-all me-1"></i> Select All
              </button>
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary px-2"
                @click="clearAllModules"
              >
                <i class="bi bi-x me-1"></i> Clear All
              </button>
            </div>
          </div>

          <div class="card-body p-4">
            <div class="row g-3">
              <div
                v-for="mod in availableModules"
                :key="mod.id"
                class="col-md-6"
              >
                <div
                  class="permission-card p-3 rounded d-flex align-items-start gap-3 cursor-pointer"
                  :class="{ 'permission-card-active': isModuleSelected(mod.id) }"
                  @click="toggleModule(mod.id)"
                >
                  <div class="form-check pt-1 m-0">
                    <input
                      :id="'perm-' + mod.id"
                      type="checkbox"
                      class="form-check-input cursor-pointer"
                      :checked="isModuleSelected(mod.id)"
                      @click.stop="toggleModule(mod.id)"
                    />
                  </div>
                  <div class="flex-grow-1">
                    <label :for="'perm-' + mod.id" class="text-white fw-semibold mb-1 d-flex align-items-center gap-2 cursor-pointer">
                      <i :class="mod.icon" class="text-primary"></i>
                      {{ mod.name }}
                    </label>
                    <div class="text-muted small lh-sm">
                      {{ mod.desc }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="card-footer bg-transparent border-secondary border-opacity-25 py-3 d-flex justify-content-between align-items-center">
            <span class="text-muted small">
              Selected Modules: <strong class="text-white">{{ form.permissions.length }} / {{ availableModules.length }}</strong>
            </span>
            <button
              type="button"
              class="btn btn-primary px-4 fw-semibold d-flex align-items-center gap-2"
              :disabled="isSubmitting || isLoading"
              @click="handleSubmit"
            >
              <span v-if="isSubmitting" class="spinner-border spinner-border-sm"></span>
              <i v-else class="bi bi-check2-circle"></i>
              {{ isEditMode ? 'Update Sub-User' : 'Save Sub-User' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}

.idp-form-card {
  background: #1e242d;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

/* Unified Input Wrapper to Eliminate Broken Borders */
.idp-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.idp-input-wrap .input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  font-size: 1rem;
  pointer-events: none;
  z-index: 5;
}

.idp-field {
  width: 100%;
  height: 40px;
  padding: 8px 12px 8px 38px;
  background-color: #14181e !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 6px !important;
  color: #f8fafc !important;
  font-size: 0.88rem;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.idp-field:focus {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
  outline: none;
}

.idp-field::placeholder {
  color: #64748b;
}

.btn-eye-toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: #64748b;
  padding: 4px 6px;
  cursor: pointer;
  z-index: 5;
  transition: color 0.2s ease;
}

.btn-eye-toggle:hover {
  color: #f8fafc;
}

.idp-select {
  height: 40px;
  background-color: #14181e !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  border-radius: 6px !important;
  color: #f8fafc !important;
  font-size: 0.88rem;
}

.idp-select:focus {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
}

/* Role Card */
.role-badge-card {
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.role-icon-box {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  background: rgba(59, 130, 246, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Permission Cards */
.permission-card {
  background: #14181e;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.2s ease-in-out;
}

.permission-card:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(59, 130, 246, 0.4);
}

.permission-card-active {
  background: rgba(59, 130, 246, 0.1) !important;
  border-color: rgba(59, 130, 246, 0.45) !important;
}
</style>
