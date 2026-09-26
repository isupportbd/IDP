<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const isEditMode = computed(() => !!route.params.id && route.params.id !== "create");
const userId = computed(() => Number(route.params.id) || 0);

const hasAccountsAccess = computed(() => {
  const user = authStore.user as any;
  if (!user) return true;
  if (user.plan) {
    return user.plan.hasAccounts !== false;
  }
  return true;
});

const allModulesList = [
  { id: "clients", name: "Clients Organization", icon: "bi-briefcase", desc: "Manage client profiles, TIN/BIN and details" },
  { id: "activity_filter", name: "Activity Filter", icon: "bi-funnel", desc: "Filter client activities and monthly operations" },
  { id: "submissions", name: "Submissions & Filing", icon: "bi-journal-text", desc: "Monthly VAT submissions and filing records" },
  { id: "bin_formatter", name: "BIN Formatter", icon: "bi-card-checklist", desc: "Batch validate and format 9-13 digit BIN numbers" },
  { id: "purchases", name: "Upload Purchases", icon: "bi-cart3", desc: "Upload and reconcile purchase registers" },
  { id: "sales_rates", name: "Sales Rates", icon: "bi-currency-dollar", desc: "Maintain product sales rates and VAT vatable value" },
  { id: "reports", name: "Audit & Analytics Reports", icon: "bi-file-earmark-bar-graph", desc: "Generate tenant audit reports and summaries" },
  { id: "billing", name: "Billing & Invoices", icon: "bi-receipt-cutoff", desc: "Create bills, track payments and ledger", requiresAccounts: true },
  { id: "settings", name: "Firm Settings", icon: "bi-sliders", desc: "Configure organization profile and preferences" }
];

const availableModules = computed(() => {
  return allModulesList.filter(m => !m.requiresAccounts || hasAccountsAccess.value);
});

const isSubmitting = ref(false);
const isLoading = ref(false);
const formError = ref("");
const formSuccess = ref("");
const showPassword = ref(false);

const form = ref({
  name: "",
  email: "",
  mobile: "",
  password: "",
  role: "user" as "admin" | "user",
  status: "active" as "active" | "inactive",
  permissions: [] as string[]
});

const selectAllModules = () => {
  form.value.permissions = availableModules.value.map(m => m.id);
};

const clearAllModules = () => {
  form.value.permissions = [];
};

const toggleModule = (modId: string) => {
  if (form.value.permissions.includes(modId)) {
    form.value.permissions = form.value.permissions.filter(id => id !== modId);
  } else {
    form.value.permissions.push(modId);
  }
};

const isModuleSelected = (modId: string) => form.value.permissions.includes(modId);

// Fetch user data if in edit mode
const fetchUserData = async () => {
  if (!isEditMode.value) {
    // Default create mode: select ALL module permissions by default
    form.value.permissions = availableModules.value.map(m => m.id);
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
        role: target.role || "user",
        status: target.status || "active",
        permissions: target.permissions && target.permissions.length > 0
          ? [...target.permissions]
          : availableModules.value.map(m => m.id)
      };
    } else {
      formError.value = "User record not found.";
    }
  } catch (err: any) {
    formError.value = "Failed to load user information.";
  } finally {
    isLoading.value = false;
  }
};

// Handle Submit
const handleSubmit = async () => {
  formError.value = "";
  formSuccess.value = "";

  if (!form.value.name.trim()) {
    formError.value = "Full name is required.";
    return;
  }
  if (!form.value.email.trim() || !form.value.email.includes("@")) {
    formError.value = "A valid email address is required.";
    return;
  }
  if (!form.value.mobile.trim()) {
    formError.value = "Mobile number is required.";
    return;
  }
  if (!isEditMode.value && (!form.value.password || form.value.password.length < 6)) {
    formError.value = "Password is required and must be at least 6 characters long.";
    return;
  }

  isSubmitting.value = true;

  const assignedPermissions = form.value.role === "admin"
    ? availableModules.value.map(m => m.id)
    : form.value.permissions;

  const payload: any = {
    name: form.value.name.trim(),
    email: form.value.email.trim(),
    mobile: form.value.mobile.trim(),
    role: form.value.role,
    status: form.value.status,
    permissions: assignedPermissions
  };

  if (form.value.password) {
    payload.password = form.value.password;
  }

  try {
    if (isEditMode.value) {
      await axios.put(`/api/users/${userId.value}`, payload);
      formSuccess.value = "Sub-user updated successfully!";
    } else {
      await axios.post("/api/users", payload);
      formSuccess.value = "Sub-user created successfully and saved to database!";
    }

    setTimeout(() => {
      // If opened in standalone tab or router
      if (window.opener) {
        try {
          window.opener.location.reload();
        } catch (e) {}
      }
      router.push("/admin/users");
    }, 1200);
  } catch (err: any) {
    formError.value = err.response?.data?.message || err.response?.data?.error || "Failed to save user. Please try again.";
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
        <h3 class="text-white fw-bold mb-0">
          <i class="bi bi-person-plus-fill text-primary me-2"></i>
          {{ isEditMode ? 'Edit Sub-User Account' : 'Add New Sub-User' }}
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

    <!-- Alert Notifications -->
    <div v-if="formError" class="alert alert-danger d-flex align-items-center gap-2 mb-4">
      <i class="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
      <div>{{ formError }}</div>
    </div>

    <div v-if="formSuccess" class="alert alert-success d-flex align-items-center gap-2 mb-4">
      <i class="bi bi-check-circle-fill flex-shrink-0"></i>
      <div>{{ formSuccess }}</div>
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
        <div class="card bg-dark border-secondary h-100 shadow-sm">
          <div class="card-header bg-transparent border-secondary py-3">
            <h5 class="card-title text-white mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-person-badge text-primary"></i> Account & Profile Information
            </h5>
          </div>

          <div class="card-body p-4">
            <!-- Full Name -->
            <div class="mb-3">
              <label class="form-label text-muted small fw-semibold">
                FULL NAME <span class="text-danger">*</span>
              </label>
              <div class="input-group">
                <span class="input-group-text bg-dark border-secondary text-muted">
                  <i class="bi bi-person"></i>
                </span>
                <input
                  v-model="form.name"
                  type="text"
                  class="form-control bg-dark text-white border-secondary"
                  placeholder="e.g. Md. Ashiqur Rahman"
                  required
                />
              </div>
            </div>

            <!-- Email Address -->
            <div class="mb-3">
              <label class="form-label text-muted small fw-semibold">
                EMAIL ADDRESS <span class="text-danger">*</span>
              </label>
              <div class="input-group">
                <span class="input-group-text bg-dark border-secondary text-muted">
                  <i class="bi bi-envelope"></i>
                </span>
                <input
                  v-model="form.email"
                  type="email"
                  class="form-control bg-dark text-white border-secondary"
                  placeholder="staff@firm.com"
                  required
                />
              </div>
            </div>

            <!-- Mobile Number -->
            <div class="mb-3">
              <label class="form-label text-muted small fw-semibold">
                MOBILE NUMBER <span class="text-danger">*</span>
              </label>
              <div class="input-group">
                <span class="input-group-text bg-dark border-secondary text-muted">
                  <i class="bi bi-telephone"></i>
                </span>
                <input
                  v-model="form.mobile"
                  type="tel"
                  class="form-control bg-dark text-white border-secondary"
                  placeholder="017XXXXXXXX"
                  required
                />
              </div>
            </div>

            <!-- Password -->
            <div class="mb-3">
              <label class="form-label text-muted small fw-semibold d-flex justify-content-between">
                <span>PASSWORD {{ isEditMode ? '(Leave blank to keep unchanged)' : '*' }}</span>
                <span v-if="!isEditMode" class="text-muted fw-normal">Min 6 chars</span>
              </label>
              <div class="input-group">
                <span class="input-group-text bg-dark border-secondary text-muted">
                  <i class="bi bi-key"></i>
                </span>
                <input
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  class="form-control bg-dark text-white border-secondary"
                  :placeholder="isEditMode ? '••••••••' : 'Enter login password'"
                  :required="!isEditMode"
                />
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  @click="showPassword = !showPassword"
                >
                  <i class="bi" :class="showPassword ? 'bi-eye-slash' : 'bi-eye'"></i>
                </button>
              </div>
            </div>

            <!-- Role Selection -->
            <div class="mb-3">
              <label class="form-label text-muted small fw-semibold">ACCOUNT ROLE</label>
              <div class="d-flex gap-3">
                <div class="form-check custom-radio-card flex-fill p-3 border border-secondary rounded" :class="{ 'border-primary bg-primary-subtle': form.role === 'user' }">
                  <input
                    id="roleUser"
                    v-model="form.role"
                    class="form-check-input me-2"
                    type="radio"
                    value="user"
                  />
                  <label class="form-check-label text-white fw-semibold cursor-pointer" for="roleUser">
                    Staff / Sub-User
                    <div class="text-muted small fw-normal">Custom granular module permissions</div>
                  </label>
                </div>
                <div class="form-check custom-radio-card flex-fill p-3 border border-secondary rounded" :class="{ 'border-primary bg-primary-subtle': form.role === 'admin' }">
                  <input
                    id="roleAdmin"
                    v-model="form.role"
                    class="form-check-input me-2"
                    type="radio"
                    value="admin"
                  />
                  <label class="form-check-label text-white fw-semibold cursor-pointer" for="roleAdmin">
                    Admin
                    <div class="text-muted small fw-normal">Unrestricted access to all firm modules</div>
                  </label>
                </div>
              </div>
            </div>

            <!-- Account Status -->
            <div class="mb-2">
              <label class="form-label text-muted small fw-semibold">ACCOUNT STATUS</label>
              <select v-model="form.status" class="form-select bg-dark text-white border-secondary">
                <option value="active">Active (Can log in immediately)</option>
                <option value="inactive">Inactive / Suspended (Access disabled)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Granular Module Permissions -->
      <div class="col-lg-7">
        <div class="card bg-dark border-secondary h-100 shadow-sm">
          <div class="card-header bg-transparent border-secondary py-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <h5 class="card-title text-white mb-0 d-flex align-items-center gap-2">
                <i class="bi bi-shield-lock text-primary"></i> Module Access & Permissions
              </h5>
              <span class="text-muted small">Select which features this sub-user can access (All selected by default)</span>
            </div>

            <div v-if="form.role !== 'admin'" class="d-flex align-items-center gap-2">
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
            <div v-if="form.role === 'admin'" class="p-4 border border-info rounded text-center my-3 bg-opacity-10 bg-info">
              <i class="bi bi-info-circle-fill text-info fs-3 mb-2 d-block"></i>
              <h6 class="text-white fw-semibold mb-1">Organization Administrator</h6>
              <p class="text-muted small mb-0">
                Admin users have full unrestricted access to all modules and configurations automatically.
              </p>
            </div>

            <div v-else class="row g-3">
              <div
                v-for="mod in availableModules"
                :key="mod.id"
                class="col-md-6"
              >
                <div
                  class="permission-card p-3 rounded border border-secondary d-flex align-items-start gap-3 cursor-pointer transition-all"
                  :class="{ 'border-primary bg-primary bg-opacity-10': isModuleSelected(mod.id) }"
                  @click="toggleModule(mod.id)"
                >
                  <div class="form-check pt-1">
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

          <div class="card-footer bg-transparent border-secondary py-3 d-flex justify-content-between align-items-center">
            <span class="text-muted small">
              Selected Modules: <strong class="text-white">{{ form.role === 'admin' ? availableModules.length : form.permissions.length }} / {{ availableModules.length }}</strong>
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
.permission-card {
  background: rgba(255, 255, 255, 0.02);
  transition: all 0.2s ease-in-out;
}
.permission-card:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(99, 102, 241, 0.5) !important;
}
.custom-radio-card {
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: all 0.2s ease;
}
.custom-radio-card:hover {
  background: rgba(255, 255, 255, 0.05);
}
.bg-primary-subtle {
  background-color: rgba(99, 102, 241, 0.15) !important;
}
</style>
