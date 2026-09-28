<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import axios from "axios";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/composables/useToast";

const toast = useToast();

interface OrgUser {
  id: number;
  name: string;
  email: string;
  mobile: string;
  role: "admin" | "user";
  status: "active" | "inactive";
  permissions?: string[];
  createdAt: string;
  lastActive?: string;
  lastPage?: string;
}

// Master Sub-Users Database
const users = ref<OrgUser[]>([]);

const route = useRoute();
const authStore = useAuthStore();
const maxPlanUsers = computed(() => {
  const user = authStore.user as any;
  return user?.plan?.maxUsers || 5;
});

const hasAccountsAccess = computed(() => {
  const user = authStore.user as any;
  if (!user) return true;
  if (user.plan) {
    return user.plan.hasAccounts !== false;
  }
  return true;
});

const allModulesList = [
  { id: "clients", name: "Clients", icon: "bi-briefcase" },
  { id: "activity_filter", name: "Activity Filter", icon: "bi-funnel" },
  { id: "submissions", name: "Submissions", icon: "bi-journal-text" },
  { id: "bin_formatter", name: "BIN Formatter", icon: "bi-card-checklist" },
  { id: "purchases", name: "Upload Purchases", icon: "bi-cart3" },
  { id: "sales_rates", name: "Sales Rates", icon: "bi-currency-dollar" },
  { id: "reports", name: "Reports", icon: "bi-file-earmark-bar-graph" },
  { id: "billing", name: "Billing & Invoices", icon: "bi-receipt-cutoff", requiresAccounts: true },
  { id: "settings", name: "Firm Settings", icon: "bi-sliders" }
];

const availableModules = computed(() => {
  return allModulesList.filter(m => !m.requiresAccounts || hasAccountsAccess.value);
});

const searchQuery = ref("");
const roleFilter = ref<string>("all");
const statusFilter = ref<string>("all");
const currentPage = ref(1);
const itemsPerPage = ref(10);
const isLoading = ref(false);

// Modal state
const showModal = ref(false);
const isEditing = ref(false);
const showPasswordModal = ref(false);
const passwordForm = ref({ userId: 0, userName: "", newPassword: "" });
const formError = ref("");
const isSubmitting = ref(false);

const form = ref({
  id: 0,
  name: "",
  email: "",
  mobile: "",
  password: "",
  role: "user" as "admin" | "user",
  status: "active" as "active" | "inactive",
  permissions: [] as string[]
});

const toggleModulePermission = (modId: string) => {
  if (form.value.permissions.includes(modId)) {
    form.value.permissions = form.value.permissions.filter(id => id !== modId);
  } else {
    form.value.permissions.push(modId);
  }
};

const selectAllModules = () => {
  form.value.permissions = availableModules.value.map(m => m.id);
};

const clearAllModules = () => {
  form.value.permissions = [];
};

// Summary Stats
const totalUsersCount = computed(() => users.value.length);
const activeUsersCount = computed(() => users.value.filter((u) => u.status === "active").length);
const activeSubUsersCount = computed(() => users.value.filter((u) => u.role !== "admin" && u.status === "active").length);
const onlineNowCount = computed(() => {
  return users.value.filter((u) => u.lastActive === "Just now" || u.lastActive?.includes("min")).length;
});

// Format Date (e.g. 2026-09-15 -> 15 Sep 2026)
const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

// Filtered Users
const filteredUsers = computed(() => {
  let list = users.value;

  // Search Filter
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.mobile && u.mobile.includes(q))
    );
  }

  // Role Filter
  if (roleFilter.value !== "all") {
    list = list.filter((u) => u.role === roleFilter.value);
  }

  // Status Filter
  if (statusFilter.value !== "all") {
    list = list.filter((u) => u.status === statusFilter.value);
  }

  return list;
});

// Pagination
const totalPages = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / itemsPerPage.value)));
const paginatedUsers = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return filteredUsers.value.slice(start, start + itemsPerPage.value);
});

// Fetch Data from API
const fetchUsers = async () => {
  isLoading.value = true;
  try {
    const res = await axios.get("/api/users");
    if (res.data?.success && Array.isArray(res.data?.data)) {
      users.value = res.data.data;
    } else if (Array.isArray(res.data)) {
      users.value = res.data;
    } else {
      users.value = [];
    }
  } catch (e) {
    users.value = [];
  } finally {
    isLoading.value = false;
  }
};

// Open Add Modal
const DEFAULT_USER_PERMISSIONS = ["activity_filter", "submissions", "sales_rates", "reports"];

// Open Add Modal
const openAddModal = () => {
  isEditing.value = false;
  formError.value = "";
  form.value = {
    id: 0,
    name: "",
    email: "",
    mobile: "",
    password: "",
    role: "user",
    status: "active",
    permissions: [...DEFAULT_USER_PERMISSIONS]
  };
  showModal.value = true;
};

// Open Edit Modal
const openEditModal = (u: OrgUser) => {
  isEditing.value = true;
  formError.value = "";
  form.value = {
    id: u.id,
    name: u.name,
    email: u.email,
    mobile: u.mobile || "",
    password: "",
    role: u.role,
    status: u.status,
    permissions: Array.isArray(u.permissions) ? [...u.permissions] : [...DEFAULT_USER_PERMISSIONS]
  };
  showModal.value = true;
};

// Open Password Reset Modal
const openPasswordModal = (u: OrgUser) => {
  passwordForm.value = {
    userId: u.id,
    userName: u.name,
    newPassword: ""
  };
  formError.value = "";
  showPasswordModal.value = true;
};

// Save User (Create or Update)
const handleSaveUser = async () => {
  // 1. Validation
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
  if (!isEditing.value && (!form.value.password || form.value.password.length < 6)) {
    formError.value = "Initial password must be at least 6 characters long.";
    return;
  }

  isSubmitting.value = true;
  formError.value = "";

  const assignedPermissions = form.value.role === "admin"
    ? availableModules.value.map(m => m.id)
    : form.value.permissions;

  const payload = {
    name: form.value.name.trim(),
    email: form.value.email.trim(),
    mobile: form.value.mobile.trim(),
    password: form.value.password,
    role: form.value.role,
    status: form.value.status,
    permissions: assignedPermissions
  };

  try {
    if (isEditing.value) {
      await axios.put(`/api/users/${form.value.id}`, payload);
    } else {
      await axios.post("/api/users", payload);
    }
    await fetchUsers();
    showModal.value = false;
  } catch (e: any) {
    formError.value = e.response?.data?.message || "Failed to save user.";
  } finally {
    isSubmitting.value = false;
  }
};

// Quick Reset Password
const handleResetPassword = async () => {
  if (!passwordForm.value.newPassword || passwordForm.value.newPassword.length < 6) {
    toast.warning("Password must be at least 6 characters long.");
    return;
  }
  isSubmitting.value = true;
  try {
    await axios.put(`/api/users/${passwordForm.value.userId}/password`, {
      newPassword: passwordForm.value.newPassword
    });
    showPasswordModal.value = false;
    toast.success(`Password updated successfully for ${passwordForm.value.userName}`);
  } catch (e: any) {
    toast.error(e.response?.data?.message || "Failed to reset password.");
  } finally {
    isSubmitting.value = false;
  }
};

// Toggle User Status
const toggleUserStatus = async (u: OrgUser) => {
  const targetStatus = u.status === "active" ? "inactive" : "active";
  try {
    await axios.patch(`/api/users/${u.id}/status`, { status: targetStatus });
    u.status = targetStatus;
    toast.success(`User ${u.name} is now ${targetStatus}.`);
  } catch (e: any) {
    toast.error(e.response?.data?.message || "Failed to update user status.");
  }
};

// Delete User
const handleDeleteUser = async (u: OrgUser) => {
  if (u.role === "admin" && users.value.filter((x) => x.role === "admin").length <= 1) {
    toast.warning("You cannot delete the primary Organization Admin.");
    return;
  }
  if (!confirm(`Are you sure you want to remove user "${u.name}"?`)) return;
  try {
    await axios.delete(`/api/users/${u.id}`);
    await fetchUsers();
    toast.success(`User "${u.name}" removed successfully.`);
  } catch (e: any) {
    toast.error(e.response?.data?.message || "Failed to delete user.");
  }
};

onMounted(async () => {
  await fetchUsers();
  if (route.query.action === "create" || route.query.create === "true" || route.query.new === "true") {
    openAddModal();
  }
});
</script>

<template>
  <div class="users-page">
    <!-- Header -->
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-3">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Dashboard
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">Users</span>
        </div>
        <h4 class="text-white fw-bold mb-0">Organization Team & Sub-Users</h4>
        <span class="text-muted small">Manage staff access, roles, mobile contacts, and track live activity</span>
      </div>

      <router-link
        to="/admin/users/create"
        target="_blank"
        class="btn btn-idp-primary btn-sm d-flex align-items-center gap-2 text-decoration-none"
      >
        <i class="bi bi-person-plus-fill"></i> Add Sub-User
      </router-link>
    </div>

    <!-- 3 Summary KPI Cards -->
    <div class="row g-3 mb-4">
      <!-- 1. Total Team -->
      <div class="col-md-4">
        <div class="summary-card">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <div class="d-flex align-items-baseline gap-2">
              <span class="card-label text-muted mb-0">Total Team:</span>
              <span class="card-value text-white">{{ totalUsersCount }}</span>
            </div>
            <div class="card-icon-wrap icon-blue">
              <i class="bi bi-people-fill"></i>
            </div>
          </div>
          <div class="card-sub text-muted">
            <i class="bi bi-person-check me-1"></i> {{ activeUsersCount }} active members in organization
          </div>
        </div>
      </div>

      <!-- 2. Online & Active Now -->
      <div class="col-md-4">
        <div class="summary-card">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <div class="d-flex align-items-baseline gap-2">
              <span class="card-label text-success mb-0">Online Now:</span>
              <span class="card-value text-success">{{ onlineNowCount }}</span>
            </div>
            <div class="card-icon-wrap icon-green">
              <i class="bi bi-activity"></i>
            </div>
          </div>
          <div class="card-sub text-success">
            <i class="bi bi-broadcast me-1"></i> Live heartbeat activity within last 30m
          </div>
        </div>
      </div>

      <!-- 3. Plan Quota -->
      <div class="col-md-4">
        <div class="summary-card">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <div class="d-flex align-items-baseline gap-2">
              <span class="card-label text-muted mb-0">Sub-User Quota:</span>
              <span class="card-value text-info">{{ activeSubUsersCount }} / {{ maxPlanUsers }}</span>
            </div>
            <div class="card-icon-wrap icon-gray">
              <i class="bi bi-shield-lock"></i>
            </div>
          </div>
          <div class="card-sub text-muted">
            <i class="bi bi-info-circle me-1"></i> {{ Math.max(0, maxPlanUsers - activeSubUsersCount) }} staff seats available in current plan
          </div>
        </div>
      </div>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <!-- Left: Search Input, Role Filter, Status Filter -->
      <div class="d-flex flex-wrap align-items-center gap-2 flex-grow-1" style="max-width: 800px;">
        <!-- Search Input -->
        <div class="position-relative flex-grow-1" style="min-width: 220px;">
          <i class="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
          <input
            v-model="searchQuery"
            type="text"
            class="form-control form-control-sm idp-input"
            style="padding: 0 14px 0 40px !important; height: 38px;"
            placeholder="Search name, email, mobile..."
          />
        </div>

        <!-- Role Filter Dropdown -->
        <div style="min-width: 150px;">
          <select v-model="roleFilter" class="form-select form-select-sm idp-input" style="height: 38px;">
            <option value="all">All Roles</option>
            <option value="admin">Admin</option>
            <option value="user">Staff / Sub-User</option>
          </select>
        </div>

        <!-- Status Filter Dropdown -->
        <div style="min-width: 150px;">
          <select v-model="statusFilter" class="form-select form-select-sm idp-input" style="height: 38px;">
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      <!-- Right: Rows per page -->
      <div class="d-flex align-items-center gap-2">
        <label class="text-muted small mb-0">Rows:</label>
        <select v-model="itemsPerPage" class="form-select form-select-sm idp-input" style="width: 75px; height: 38px;">
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
        </select>
      </div>
    </div>

    <!-- Users Table Card -->
    <div class="table-card">
      <table class="table-custom">
        <thead>
          <tr>
            <th style="width: 50px;">#</th>
            <th>Name & Email</th>
            <th style="width: 150px;">Mobile</th>
            <th style="width: 120px;">Role</th>
            <th style="width: 110px;">Status</th>
            <th style="width: 135px;">Created Date</th>
            <th style="width: 140px;">Last Active</th>
            <th class="text-end" style="width: 140px;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <!-- Loading State -->
          <tr v-if="isLoading">
            <td colspan="8" class="text-center py-5 text-muted">
              <span class="spinner-border spinner-border-sm text-primary me-2"></span>
              Loading team members...
            </td>
          </tr>

          <!-- Empty State -->
          <tr v-else-if="filteredUsers.length === 0">
            <td colspan="8" class="text-center py-5 text-muted">
              <i class="bi bi-people fs-3 d-block mb-2 text-secondary"></i>
              No team members found matching current filters.
            </td>
          </tr>

          <!-- Data Rows -->
          <tr v-for="(u, index) in paginatedUsers" :key="u.id">
            <!-- 1. Serial # -->
            <td class="text-muted font-monospace">
              {{ (currentPage - 1) * itemsPerPage + index + 1 }}
            </td>

            <!-- 2. Name & Email -->
            <td>
              <div class="d-flex align-items-center gap-2">
                <span
                  class="status-indicator-dot"
                  :class="u.status === 'active' && (u.lastActive === 'Just now' || u.lastActive?.includes('min')) ? 'dot-active' : 'dot-inactive'"
                ></span>
                <div>
                  <div class="text-white fw-semibold">{{ u.name }}</div>
                  <div class="text-muted small font-monospace" style="font-size: 0.77rem;">
                    {{ u.email }}
                  </div>
                </div>
              </div>
            </td>

            <!-- 3. Mobile -->
            <td>
              <span v-if="u.mobile" class="text-light font-monospace small">
                <i class="bi bi-telephone text-muted me-1 small"></i>
                {{ u.mobile }}
              </span>
              <span v-else class="text-muted small">—</span>
            </td>

            <!-- 4. Role & Permissions -->
            <td>
              <div>
                <span
                  class="badge text-uppercase font-monospace mb-1"
                  :class="u.role === 'admin' ? 'bg-primary text-white border border-primary' : 'bg-dark text-light border border-secondary'"
                  style="font-size: 0.72rem; padding: 3px 7px;"
                >
                  {{ u.role === 'admin' ? 'Admin' : 'Sub-User' }}
                </span>
                <div class="text-muted small" style="font-size: 0.73rem;">
                  <i class="bi bi-shield-lock me-1 text-primary"></i>
                  {{ u.role === 'admin' ? 'All Modules' : `${(u.permissions || []).length} Modules` }}
                </div>
              </div>
            </td>

            <!-- 5. Status -->
            <td>
              <span
                class="badge cursor-pointer"
                :class="u.status === 'active' ? 'bg-success bg-opacity-25 text-success border border-success' : 'bg-danger bg-opacity-25 text-danger border border-danger'"
                style="font-size: 0.72rem; padding: 4px 8px;"
                title="Click to toggle status"
                @click="toggleUserStatus(u)"
              >
                <i class="bi" :class="u.status === 'active' ? 'bi-check-circle-fill me-1' : 'bi-x-circle-fill me-1'"></i>
                {{ u.status === 'active' ? 'Active' : 'Inactive' }}
              </span>
            </td>

            <!-- 6. Created Date (Requested Column) -->
            <td>
              <span class="text-light font-monospace small">
                <i class="bi bi-calendar3 text-muted me-1 small"></i>
                {{ formatDate(u.createdAt) }}
              </span>
            </td>

            <!-- 7. Last Active -->
            <td>
              <div>
                <span class="text-muted small">{{ u.lastActive || 'Never' }}</span>
                <div v-if="u.lastPage" class="text-info text-truncate font-monospace" style="font-size: 0.72rem; max-width: 130px;">
                  📍 {{ u.lastPage }}
                </div>
              </div>
            </td>

            <!-- 8. Actions -->
            <td class="text-end">
              <div class="d-inline-flex align-items-center gap-1">
                <router-link
                  :to="'/admin/users/' + u.id + '/edit'"
                  target="_blank"
                  class="btn btn-dark border-secondary btn-sm p-1 px-2 text-info text-decoration-none"
                  title="Edit User in New Tab"
                >
                  <i class="bi bi-pencil-square"></i>
                </router-link>
                <button
                  type="button"
                  class="btn btn-dark border-secondary btn-sm p-1 px-2 text-warning"
                  title="Reset Password"
                  @click="openPasswordModal(u)"
                >
                  <i class="bi bi-key-fill"></i>
                </button>
                <button
                  type="button"
                  class="btn btn-dark border-secondary btn-sm p-1 px-2 text-danger"
                  title="Delete User"
                  @click="handleDeleteUser(u)"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="filteredUsers.length > 0" class="d-flex flex-wrap justify-content-between align-items-center mt-3 pt-2">
      <span class="text-muted small">
        Showing <strong>{{ (currentPage - 1) * itemsPerPage + 1 }}</strong> to
        <strong>{{ Math.min(currentPage * itemsPerPage, filteredUsers.length) }}</strong> of
        <strong>{{ filteredUsers.length }}</strong> team members
      </span>

      <div v-if="totalPages > 1" class="d-flex align-items-center gap-1">
        <button
          class="btn btn-dark border-secondary btn-sm"
          :disabled="currentPage <= 1"
          @click="currentPage--"
        >
          <i class="bi bi-chevron-left"></i> Prev
        </button>

        <button
          v-for="p in totalPages"
          :key="p"
          class="btn btn-sm"
          :class="currentPage === p ? 'btn-primary' : 'btn-dark border-secondary text-muted'"
          style="min-width: 32px;"
          @click="currentPage = p"
        >
          {{ p }}
        </button>

        <button
          class="btn btn-dark border-secondary btn-sm"
          :disabled="currentPage >= totalPages"
          @click="currentPage++"
        >
          Next <i class="bi bi-chevron-right"></i>
        </button>
      </div>
    </div>

    <!-- Add / Edit User Modal -->
    <div v-if="showModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0, 0, 0, 0.7);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content idp-card">
          <div class="modal-header border-secondary">
            <h5 class="modal-title text-white fw-bold">
              <i class="bi bi-person-fill text-primary me-1"></i>
              {{ isEditing ? 'Edit Team Member' : 'Add New Sub-User' }}
            </h5>
            <button type="button" class="btn-close btn-close-white" @click="showModal = false"></button>
          </div>
          <div class="modal-body p-4">
            <div v-if="formError" class="alert alert-danger py-2 small mb-3">
              <i class="bi bi-exclamation-triangle-fill me-1"></i>
              {{ formError }}
            </div>

            <div class="mb-3">
              <label class="form-label text-muted small fw-semibold">Full Name *</label>
              <input v-model="form.name" type="text" class="form-control idp-input" placeholder="e.g. Tanvir Ahmed" />
            </div>

            <div class="mb-3">
              <label class="form-label text-muted small fw-semibold">Email Address *</label>
              <input v-model="form.email" type="email" class="form-control idp-input" placeholder="user@company.com" />
            </div>

            <div class="mb-3">
              <label class="form-label text-muted small fw-semibold">Mobile Number *</label>
              <input v-model="form.mobile" type="text" class="form-control idp-input font-monospace" placeholder="01711XXXXXX" />
            </div>

            <div v-if="!isEditing" class="mb-3">
              <label class="form-label text-muted small fw-semibold">Initial Password * (Min 6 chars)</label>
              <input v-model="form.password" type="password" class="form-control idp-input font-monospace" placeholder="••••••••" />
            </div>

            <div class="row g-2 mb-3">
              <div class="col-6">
                <label class="form-label text-muted small fw-semibold">Role</label>
                <select v-model="form.role" class="form-select idp-input">
                  <option value="user">Sub-User (Standard Operator)</option>
                  <option value="admin">Admin (Full Control)</option>
                </select>
              </div>
              <div class="col-6">
                <label class="form-label text-muted small fw-semibold">Account Status</label>
                <select v-model="form.status" class="form-select idp-input">
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <!-- Module Permissions Selection (Granular Control) -->
            <div v-if="form.role === 'user'" class="mb-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="form-label text-light small fw-bold mb-0">
                  <i class="bi bi-shield-lock-fill text-primary me-1"></i> Module Access & Permissions
                </label>
                <div class="d-flex gap-2">
                  <button type="button" class="btn btn-link p-0 text-primary text-decoration-none small" @click="selectAllModules">
                    Select All
                  </button>
                  <span class="text-muted small">|</span>
                  <button type="button" class="btn btn-link p-0 text-muted text-decoration-none small" @click="clearAllModules">
                    Clear
                  </button>
                </div>
              </div>

              <div class="p-2.5 rounded bg-dark border border-secondary border-opacity-50">
                <div class="row g-2">
                  <div v-for="mod in availableModules" :key="mod.id" class="col-6">
                    <div
                      class="p-2 rounded border transition-all cursor-pointer d-flex align-items-center gap-2 user-select-none"
                      :class="form.permissions.includes(mod.id) ? 'border-primary bg-primary bg-opacity-10 text-white' : 'border-secondary border-opacity-50 text-muted'"
                      style="font-size: 0.82rem;"
                      @click="toggleModulePermission(mod.id)"
                    >
                      <input
                        type="checkbox"
                        class="form-check-input mt-0 cursor-pointer"
                        :checked="form.permissions.includes(mod.id)"
                        @click.stop="toggleModulePermission(mod.id)"
                      />
                      <i :class="`bi ${mod.icon} ${form.permissions.includes(mod.id) ? 'text-primary' : 'text-muted'}`"></i>
                      <span class="fw-semibold text-truncate">{{ mod.name }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="text-muted small mt-1.5" style="font-size: 0.76rem;">
                <i class="bi bi-info-circle me-1"></i>
                This staff member will only be able to view and operate the checked modules.
              </div>
            </div>

            <div v-else class="p-3 mb-3 rounded bg-primary bg-opacity-10 border border-primary border-opacity-25 d-flex align-items-center gap-2 small text-primary">
              <i class="bi bi-shield-check fs-5"></i>
              <span>Admins have full unrestricted access to all organization modules and settings.</span>
            </div>
          </div>
          <div class="modal-footer border-secondary">
            <button type="button" class="btn btn-idp-secondary btn-sm" @click="showModal = false">Cancel</button>
            <button type="button" class="btn btn-idp-primary btn-sm" :disabled="isSubmitting" @click="handleSaveUser">
              <i class="bi bi-check-lg me-1"></i>
              {{ isSubmitting ? 'Saving...' : isEditing ? 'Update User' : 'Register Sub-User' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Password Reset Modal -->
    <div v-if="showPasswordModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0, 0, 0, 0.7);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content idp-card">
          <div class="modal-header border-secondary">
            <h5 class="modal-title text-white fw-bold">
              <i class="bi bi-key-fill text-warning me-1"></i>
              Reset Password: {{ passwordForm.userName }}
            </h5>
            <button type="button" class="btn-close btn-close-white" @click="showPasswordModal = false"></button>
          </div>
          <div class="modal-body p-4">
            <div v-if="formError" class="alert alert-danger py-2 small mb-3">
              <i class="bi bi-exclamation-triangle-fill me-1"></i>
              {{ formError }}
            </div>

            <div class="mb-3">
              <label class="form-label text-muted small fw-semibold">New Password * (Min 6 chars)</label>
              <input v-model="passwordForm.newPassword" type="password" class="form-control idp-input font-monospace" placeholder="Enter new password" />
            </div>
          </div>
          <div class="modal-footer border-secondary">
            <button type="button" class="btn btn-idp-secondary btn-sm" @click="showPasswordModal = false">Cancel</button>
            <button type="button" class="btn btn-warning text-dark fw-semibold btn-sm" :disabled="isSubmitting" @click="handleResetPassword">
              <i class="bi bi-shield-check me-1"></i>
              {{ isSubmitting ? 'Updating...' : 'Set New Password' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.users-page {
  font-family: 'Inter', sans-serif;
  color: #f8f9fa;
}

/* 3 Clickable Compact Summary Cards */
.summary-card {
  background: #212529;
  border: 1px solid #3b424b;
  border-radius: 8px;
  padding: 0.95rem 1.15rem;
  transition: all 0.2s ease;
  user-select: none;
}
.summary-card:hover {
  background: #282d33;
  border-color: #49515a;
  transform: translateY(-2px);
}

.card-label {
  font-size: 0.88rem;
  font-weight: 600;
}
.card-value {
  font-size: 1.45rem;
  font-weight: 800;
  line-height: 1;
}
.card-sub {
  font-size: 0.74rem;
}

.card-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
}
.icon-blue {
  background: rgba(59, 142, 237, 0.12);
  color: #3b8eed;
  border: 1px solid rgba(59, 142, 237, 0.25);
}
.icon-green {
  background: rgba(32, 201, 151, 0.12);
  color: #20c997;
  border: 1px solid rgba(32, 201, 151, 0.25);
}
.icon-gray {
  background: rgba(108, 117, 125, 0.12);
  color: #adb5bd;
  border: 1px solid rgba(108, 117, 125, 0.25);
}

/* Status Indicator Dot */
.status-indicator-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}
.dot-active {
  background: #20c997;
  box-shadow: 0 0 6px rgba(32, 201, 151, 0.6);
}
.dot-inactive {
  background: #6c757d;
}

/* Table Card & Styles */
.table-card {
  background: #212529;
  border: 1px solid #3b424b;
  border-radius: 8px;
  overflow: hidden;
}
.table-custom {
  width: 100%;
  border-collapse: collapse;
}
.table-custom thead tr {
  background: #1a1d21;
  border-bottom: 1px solid #3b424b;
}
.table-custom th {
  padding: 12px 16px;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #adb5bd;
  text-align: left;
}
.table-custom td {
  padding: 12px 16px;
  font-size: 0.88rem;
  border-bottom: 1px solid #2e343b;
  vertical-align: middle;
}
.table-custom tbody tr:hover td {
  background: #282d33;
}

.cursor-pointer {
  cursor: pointer;
}
</style>
