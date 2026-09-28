<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import axios from "axios";
import SearchInput from "@/components/common/SearchInput.vue";

import { pulse } from "@/plugins/pulse";

const router = useRouter();
const authStore = useAuthStore();

const emit = defineEmits<{
  (e: "openRecharge"): void;
  (e: "openStorage"): void;
}>();

const isDropdownOpen = ref(false);
const showNotifications = ref(false);
const showStatsModal = ref(false);
const showStatsDropdown = ref(false);

const notifications = ref<any[]>([]);
const userStats = ref({
  active: 0,
  online: 0,
  users: [] as any[]
});

const activitySearch = ref("");
const activityFilter = ref<"all" | "active" | "online">("all");

const isSuperAdmin = computed(() => {
  const r = (authStore.user as any)?.role;
  return r === "superadmin" || (typeof r === "object" && (r?.name === "superadmin" || r?.slug === "superadmin"));
});

const isTenantAdmin = computed(() => {
  const r = (authStore.user as any)?.role;
  const roleName = typeof r === "object" ? r?.name || r?.slug : r;
  return roleName === "admin";
});

const isAdminOrSuperAdmin = computed(() => {
  return isTenantAdmin.value || isSuperAdmin.value;
});

const timeAgo = (dateStr?: string) => {
  if (!dateStr) return "Never";
  const seconds = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "Just now";
  const intervals: Record<string, number> = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };
  for (const [unit, secsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secsInUnit);
    if (interval >= 1) return `${interval} ${unit}${interval > 1 ? "s" : ""} ago`;
  }
  return "Just now";
};

const getRoleBadgeStyle = (role?: string) => {
  const r = (role || "").toLowerCase();
  if (r === "superadmin") {
    return "background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.35); font-size: 0.65rem; padding: 2px 6px;";
  }
  if (r === "admin") {
    return "background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.35); font-size: 0.65rem; padding: 2px 6px;";
  }
  return "background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.35); font-size: 0.65rem; padding: 2px 6px;";
};

const fetchStats = async () => {
  if (!authStore.user) return;
  try {
    const res = await axios.get("/api/auth/users-stats");
    if (res.data?.success && res.data?.stats) {
      userStats.value = res.data.stats;
    }
  } catch (e) {
    try {
      const fallbackRes = await axios.get("/api/users/stats");
      if (fallbackRes.data?.success && fallbackRes.data?.stats) {
        userStats.value = fallbackRes.data.stats;
      }
    } catch {}
  }
};

const fetchNotifications = async () => {
  if (!isSuperAdmin.value) return;
  try {
    const res = await axios.get("/api/superadmin/notifications");
    if (res.data?.success && Array.isArray(res.data?.data)) {
      notifications.value = res.data.data;
    }
  } catch (e) {
    try {
      const fallbackRes = await axios.get("/api/notifications");
      if (fallbackRes.data?.success && Array.isArray(fallbackRes.data?.data)) {
        notifications.value = fallbackRes.data.data;
      }
    } catch {}
  }
};

const approveSignup = async (notifId: any) => {
  const adminId = typeof notifId === "number" ? Math.abs(notifId) : Number(String(notifId).replace(/\D/g, ""));
  try {
    const res = await axios.post("/api/superadmin/approve-signup", { userId: adminId });
    if (res.data?.success) {
      notifications.value = notifications.value.filter((n) => n.id !== notifId && n.userId !== adminId);
      await fetchNotifications();
    } else {
      alert(res.data?.message || "Failed to approve");
    }
  } catch (e: any) {
    alert(e?.response?.data?.message || "Error approving admin");
  }
};

const rejectSignup = async (notifId: any) => {
  if (!confirm("Reject and delete this admin account?")) return;
  const adminId = typeof notifId === "number" ? Math.abs(notifId) : Number(String(notifId).replace(/\D/g, ""));
  try {
    const res = await axios.post("/api/superadmin/reject-signup", { userId: adminId });
    if (res.data?.success) {
      notifications.value = notifications.value.filter((n) => n.id !== notifId && n.userId !== adminId);
      await fetchNotifications();
    } else {
      alert(res.data?.message || "Failed to reject");
    }
  } catch (e: any) {
    alert(e?.response?.data?.message || "Error rejecting admin");
  }
};

const approveRecharge = async (notifOrId: any) => {
  let txId = typeof notifOrId === "object" ? (notifOrId?.transactionId || notifOrId?.id) : notifOrId;
  const cleanId = typeof txId === "number" ? txId : Number(String(txId || "").replace(/\D/g, ""));
  if (!cleanId || isNaN(cleanId)) {
    alert("Invalid transaction ID");
    return;
  }
  try {
    const res = await axios.post("/api/superadmin/approve-recharge", { transactionId: cleanId });
    if (res.data?.success) {
      notifications.value = notifications.value.filter((n) => n.transactionId !== cleanId && n.id !== `tx-${cleanId}` && n.id !== cleanId);
      await fetchNotifications();
    } else {
      alert(res.data?.message || "Failed to approve recharge");
    }
  } catch (e: any) {
    alert(e?.response?.data?.message || "Error approving recharge");
  }
};

const rejectRecharge = async (notifOrId: any) => {
  let txId = typeof notifOrId === "object" ? (notifOrId?.transactionId || notifOrId?.id) : notifOrId;
  const cleanId = typeof txId === "number" ? txId : Number(String(txId || "").replace(/\D/g, ""));
  if (!cleanId || isNaN(cleanId)) {
    alert("Invalid transaction ID");
    return;
  }
  if (!confirm("Reject this recharge transaction?")) return;
  try {
    const res = await axios.post("/api/superadmin/reject-recharge", { transactionId: cleanId });
    if (res.data?.success) {
      notifications.value = notifications.value.filter((n) => n.transactionId !== cleanId && n.id !== `tx-${cleanId}` && n.id !== cleanId);
      await fetchNotifications();
    } else {
      alert(res.data?.message || "Failed to reject recharge");
    }
  } catch (e: any) {
    alert(e?.response?.data?.message || "Error rejecting recharge");
  }
};

const deleteNotification = async (id: number) => {
  try {
    await axios.delete(`/api/notifications/${id}`);
    notifications.value = notifications.value.filter((n) => n.id !== id);
  } catch (e) {
    console.error(e);
  }
};

const clearOldData = async (notif: any) => {
  if (!confirm("Are you sure you want to delete all past purchase data for this client belonging to the old admin?")) return;
  try {
    const res = await axios.delete(`/api/notifications/clear-old-data/${notif.clientId}/${notif.oldAdminId}`);
    if (res.data?.success) {
      alert("Old data deleted successfully.");
      deleteNotification(notif.id);
    } else {
      alert(res.data?.message || "Failed to delete old data.");
    }
  } catch (e: any) {
    alert(e?.response?.data?.message || "An error occurred.");
  }
};

const handleLogout = async () => {
  try {
    await authStore.logout();
  } catch (e) {
    console.error(e);
  }
  isDropdownOpen.value = false;
  router.push("/login");
};

const filteredUsers = computed(() => {
  let list = userStats.value.users || [];
  if (activitySearch.value.trim()) {
    const query = activitySearch.value.toLowerCase().trim();
    list = list.filter((u: any) =>
      (u.name && u.name.toLowerCase().includes(query)) ||
      (u.email && u.email.toLowerCase().includes(query))
    );
  }
  if (activityFilter.value === "active") {
    list = list.filter((u: any) => u.isActive);
  } else if (activityFilter.value === "online") {
    list = list.filter((u: any) => u.isOnline && !u.isActive);
  }
  return list;
});

const closeAllDropdowns = () => {
  isDropdownOpen.value = false;
  showNotifications.value = false;
  showStatsDropdown.value = false;
};

const handleVisibilityChange = () => {
  if (!document.hidden && authStore.user) {
    fetchStats();
    if (isSuperAdmin.value) {
      fetchNotifications();
    }
  }
};

let statsTimer: any = null;
onMounted(() => {
  fetchStats();
  if (isSuperAdmin.value) {
    fetchNotifications();
  }
  window.addEventListener("click", closeAllDropdowns);
  document.addEventListener("visibilitychange", handleVisibilityChange);

  pulse.channel("auth").listen("tenant:signup", () => {
    if (isSuperAdmin.value) fetchNotifications();
    fetchStats();
  });
  pulse.channel("role:superadmin").listen("tenant:signup", () => {
    fetchNotifications();
    fetchStats();
  });
  pulse.channel("role:superadmin").listen("tenant:recharge", () => {
    fetchNotifications();
    fetchStats();
  });
  pulse.channel("auth").listen("user:subscription-updated", async () => {
    await authStore.bootstrap(true);
  });
  pulse.channel("auth").listen("tenant:sms-updated", async (payload: any) => {
    if (authStore.user) {
      if (payload && typeof payload.smsBalance === "number") {
        (authStore.user as any).smsBalance = payload.smsBalance;
      } else {
        await authStore.bootstrap(true);
      }
    }
  });
  pulse.channel("role:admin").listen("tenant:sms-updated", async (payload: any) => {
    if (authStore.user) {
      if (payload && typeof payload.smsBalance === "number") {
        (authStore.user as any).smsBalance = payload.smsBalance;
      } else {
        await authStore.bootstrap(true);
      }
    }
  });

  statsTimer = setInterval(() => {
    if (!document.hidden && authStore.user) {
      fetchStats();
      if (isSuperAdmin.value) {
        fetchNotifications();
      }
    }
  }, 45000); // 45 seconds visibility-aware auto-refresh
});

onUnmounted(() => {
  window.removeEventListener("click", closeAllDropdowns);
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  if (statsTimer) clearInterval(statsTimer);
  pulse.channel("auth").stopListening("tenant:signup");
  pulse.channel("role:superadmin").stopListening("tenant:signup");
  pulse.channel("role:superadmin").stopListening("tenant:recharge");
  pulse.channel("auth").stopListening("user:subscription-updated");
  pulse.channel("auth").stopListening("tenant:sms-updated");
  pulse.channel("role:admin").stopListening("tenant:sms-updated");
});
</script>

<template>
  <header class="idp-navbar">
    <div class="idp-grid-container h-100 d-flex align-items-center justify-content-between px-0">
      <!-- Left: Brand (No Sidebar Toggle) -->
      <div class="d-flex align-items-center gap-2">
        <router-link to="/" class="idp-brand" style="font-size: 1.18rem;">
          <i class="bi bi-layers-half text-primary fs-4"></i>
          <span>IDP</span>
        </router-link>
      </div>

      <!-- Center: Spacing -->
      <div class="flex-grow-1"></div>

      <!-- Right: Header Actions -->
      <div class="d-flex align-items-center gap-3">
        <!-- Tenant Wallet & SMS Balance & Quick Recharge -->
        <div v-if="!isSuperAdmin && authStore.user" class="d-flex align-items-center gap-2">
          <!-- Wallet Balance Card -->
          <div
            class="d-flex align-items-center rounded bg-dark border border-secondary"
            style="font-size: 0.85rem; padding: 6px 14px !important; gap: 8px; min-width: 120px;"
            :title="'Wallet Balance: ৳' + (authStore.user?.advanceBalance || 0)"
          >
            <i class="bi bi-wallet2 text-primary"></i>
            <span class="text-muted d-none d-sm-inline">Wallet:</span>
            <strong class="text-success font-monospace d-inline-flex align-items-baseline">
              <span class="currency-symbol">৳</span>{{ ((authStore.user as any)?.advanceBalance || 0).toLocaleString() }}
            </strong>
          </div>

          <!-- SMS Balance Card -->
          <div
            class="d-flex align-items-center rounded bg-dark border border-secondary"
            style="font-size: 0.85rem; padding: 6px 14px !important; gap: 8px; min-width: 120px;"
            :title="'SMS Balance: ৳ ' + Number((authStore.user as any)?.smsBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })"
          >
            <i class="bi bi-chat-left-text text-info"></i>
            <span class="text-muted d-none d-sm-inline">SMS:</span>
            <strong class="text-info font-monospace d-inline-flex align-items-baseline">
              <span class="currency-symbol">৳</span>{{ Number((authStore.user as any)?.smsBalance || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
            </strong>
          </div>

          <!-- Storage Usage Card (Clickable to open Buy Storage Modal) -->
          <div
            class="d-flex align-items-center rounded bg-dark border border-secondary cursor-pointer"
            style="font-size: 0.85rem; padding: 6px 14px !important; gap: 8px; min-width: 130px;"
            :title="'Storage Usage: ' + ((authStore.user as any)?.usedStorageMB || 0) + ' MB / ' + ((authStore.user as any)?.totalStorageMB || 1024) + ' MB (' + ((authStore.user as any)?.storageUsagePercent || 0) + '%)'"
            @click="emit('openStorage')"
          >
            <i
              class="bi bi-hdd-stack"
              :class="((authStore.user as any)?.storageUsagePercent || 0) >= 90 ? 'text-danger' : 'text-warning'"
            ></i>
            <span class="text-muted d-none d-sm-inline">Storage:</span>
            <strong class="text-white font-monospace d-inline-flex align-items-baseline">
              {{ (authStore.user as any)?.usedStorageMB || 0 }} <span class="text-muted small fw-normal ms-1">/ {{ (authStore.user as any)?.totalStorageMB || 1024 }} MB</span>
            </strong>
          </div>

          <!-- Recharge Button -->
          <button
            type="button"
            class="btn btn-sm recharge-btn d-inline-flex align-items-center justify-content-center rounded"
            @click="emit('openRecharge')"
            title="Recharge Wallet / SMS Balance"
          >
            <i class="bi bi-plus-circle"></i>
            <span>Recharge</span>
          </button>
        </div>

        <!-- Superadmin Notifications -->
        <div v-if="isSuperAdmin" class="position-relative" @click.stop>
        <button
          type="button"
          class="btn btn-dark p-0 rounded border border-secondary d-flex align-items-center justify-content-center position-relative"
          style="width: 36px; height: 36px;"
          @click="showNotifications = !showNotifications"
          title="Notifications"
        >
          <i class="bi bi-bell text-light fs-5"></i>
          <span
            v-if="notifications.length > 0"
            class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
            style="font-size: 0.65rem; padding: 2px 5px;"
          >
            {{ notifications.length }}
          </span>
        </button>

        <!-- Notifications Dropdown -->
        <div
          v-if="showNotifications"
          class="position-absolute end-0 mt-2 idp-card shadow-lg"
          style="width: 360px; z-index: 1050; max-height: 80vh; overflow-y: auto;"
        >
          <div class="idp-card-header d-flex justify-content-between align-items-center py-2 px-3">
            <span class="fw-bold text-white fs-6">Notifications</span>
            <span class="badge bg-primary rounded-pill">{{ notifications.length }} New</span>
          </div>
          <div class="p-2">
            <div v-if="notifications.length > 0">
              <div
                v-for="notif in notifications"
                :key="notif.id"
                class="p-3 mb-2 rounded bg-dark border border-secondary"
              >
                <div class="d-flex align-items-center justify-content-between mb-1">
                  <span
                    v-if="notif.type === 'storage_request'"
                    class="badge text-white px-2 py-0.5"
                    style="font-size: 0.7rem; background-color: #7952b3 !important;"
                  >
                    <i class="bi bi-hdd-network me-1"></i>Extra Storage
                  </span>
                  <span
                    v-else-if="notif.type === 'recharge_request'"
                    class="badge bg-info text-dark px-2 py-0.5"
                    style="font-size: 0.7rem;"
                  >
                    <i class="bi bi-wallet2 me-1"></i>Wallet Recharge
                  </span>
                  <span
                    v-else-if="notif.type === 'signup_request' || notif.id < 0"
                    class="badge bg-warning text-dark px-2 py-0.5"
                    style="font-size: 0.7rem;"
                  >
                    <i class="bi bi-person-plus-fill me-1"></i>New Signup
                  </span>
                  <span class="text-muted small" style="font-size: 0.72rem;">
                    {{ notif.createdAt ? notif.createdAt.slice(0, 10) : '' }}
                  </span>
                </div>
                <p class="mb-2 text-light small">{{ notif.message }}</p>
                <div class="d-flex gap-2 justify-content-end">
                  <!-- Wallet Recharge & Storage Purchase Actions -->
                  <template v-if="notif.type === 'recharge_request' || notif.type === 'storage_request'">
                    <button
                      class="btn btn-sm btn-success px-2 py-1 small d-inline-flex align-items-center gap-1"
                      @click="approveRecharge(notif.transactionId)"
                    >
                      <i class="bi bi-check-lg"></i>Approve
                    </button>
                    <button
                      class="btn btn-sm btn-danger px-2 py-1 small d-inline-flex align-items-center gap-1"
                      @click="rejectRecharge(notif.transactionId)"
                    >
                      <i class="bi bi-x-lg"></i>Reject
                    </button>
                  </template>

                  <!-- Signup Registration Actions -->
                  <template v-else-if="notif.type === 'signup_request' || notif.id < 0">
                    <button
                      class="btn btn-sm btn-success px-2 py-1 small d-inline-flex align-items-center gap-1"
                      @click="approveSignup(notif.userId || notif.id)"
                    >
                      <i class="bi bi-check-lg"></i>Approve
                    </button>
                    <button
                      class="btn btn-sm btn-danger px-2 py-1 small d-inline-flex align-items-center gap-1"
                      @click="rejectSignup(notif.userId || notif.id)"
                    >
                      <i class="bi bi-x-lg"></i>Reject
                    </button>
                  </template>

                  <!-- Generic Actions -->
                  <template v-else>
                    <button
                      class="btn btn-sm btn-outline-secondary px-2 py-1 small"
                      @click="deleteNotification(notif.id)"
                    >
                      Dismiss
                    </button>
                    <button
                      class="btn btn-sm btn-danger px-2 py-1 small"
                      @click="clearOldData(notif)"
                    >
                      Delete Old Data
                    </button>
                  </template>
                </div>
              </div>
            </div>
            <div v-else class="text-center py-4 text-muted small">
              <i class="bi bi-bell-slash fs-4 d-block mb-1"></i>
              No new notifications
            </div>
          </div>
        </div>
      </div>

      <!-- Live Online & Active User Stats Badge & Dropdown -->
      <div
        v-if="authStore.user"
        class="position-relative"
        @click.stop
      >
        <button
          type="button"
          class="btn btn-sm btn-dark border border-secondary rounded d-flex align-items-center"
          style="font-size: 0.85rem; padding: 6px 14px !important; gap: 8px; cursor: pointer;"
          @click="showStatsDropdown = !showStatsDropdown; if (showStatsDropdown) fetchStats(); isDropdownOpen = false; showNotifications = false"
          title="Click to view online & active users"
        >
          <span
            class="d-inline-block rounded-circle bg-success flex-shrink-0 dot-active-pulse"
            style="width: 8px; height: 8px;"
          ></span>
          <span class="text-light fw-medium">
            Active <strong class="text-success">{{ userStats.active }}</strong>,
            Online <strong class="text-warning">{{ userStats.online }}</strong>
          </span>
        </button>

        <!-- Rich Direct User List Dropdown (Original App Style) -->
        <div
          v-if="showStatsDropdown"
          class="position-absolute end-0 mt-2 idp-card p-3 shadow-lg"
          style="width: 380px; max-width: 90vw; z-index: 1060; border-radius: 8px;"
        >
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="fw-bold text-white fs-6">
              <strong class="text-warning">{{ userStats.online }}</strong> Online / <strong class="text-success">{{ userStats.active }}</strong> Active
            </span>
            <span class="badge border border-secondary text-muted fw-normal px-2 py-1" style="background: rgba(255, 255, 255, 0.05); font-size: 0.72rem;">
              {{ userStats.users?.length || 0 }} total
            </span>
          </div>
          <div class="text-muted small mb-2" style="font-size: 0.72rem; line-height: 1.3;">
            Online = last 30 min heartbeat • Active = worked in last 5 min
          </div>
          <div class="border-bottom border-secondary mb-2"></div>

          <!-- User Rows List (Up to 5) -->
          <div class="d-flex flex-column gap-2 mb-3" style="max-height: 320px; overflow-y: auto;">
            <div
              v-for="u in (userStats.users || []).slice(0, 5)"
              :key="u.id"
              class="p-2 rounded bg-dark border border-secondary d-flex align-items-center justify-content-between gap-2"
            >
              <div class="d-flex align-items-center gap-2 min-w-0 flex-grow-1">
                <span
                  class="d-inline-block rounded-circle flex-shrink-0"
                  :class="u.isActive ? 'bg-success dot-active-pulse' : u.isOnline ? 'bg-warning' : 'bg-secondary'"
                  style="width: 10px; height: 10px;"
                ></span>
                <div class="min-w-0">
                  <div class="d-flex align-items-center gap-1">
                    <span class="text-white fw-semibold small text-truncate">{{ u.name }}</span>
                    <span class="badge text-uppercase fw-semibold" :style="getRoleBadgeStyle(u.role)">
                      {{ u.role }}
                    </span>
                  </div>
                  <div class="text-muted text-truncate" style="font-size: 0.75rem;">
                    {{ u.email }}
                  </div>
                  <div v-if="u.lastPage" class="text-muted text-truncate" style="font-size: 0.7rem;">
                    📍 {{ u.lastPage }}
                  </div>
                </div>
              </div>

              <!-- Right-side status tag & timestamp -->
              <div class="text-end flex-shrink-0">
                <div v-if="u.isActive" class="text-success fw-bold small" style="font-size: 0.75rem;">
                  Active now
                </div>
                <div v-else-if="u.isOnline" class="text-warning small" style="font-size: 0.75rem;">
                  Online
                  <div class="text-muted" style="font-size: 0.68rem;">
                    {{ timeAgo(u.updatedAt) }}
                  </div>
                </div>
                <div v-else class="text-muted small" style="font-size: 0.75rem;">
                  Offline
                  <div class="text-muted" style="font-size: 0.68rem;">
                    {{ timeAgo(u.updatedAt) }}
                  </div>
                </div>
              </div>
            </div>

            <div v-if="!userStats.users || userStats.users.length === 0" class="text-center py-3 text-muted small">
              No active users found
            </div>
          </div>

          <!-- Bottom Actions -->
          <div class="d-flex flex-column gap-2">
            <button
              type="button"
              class="btn btn-sm btn-idp-primary w-100 py-1 small text-center d-flex align-items-center justify-content-center gap-1"
              @click="showStatsModal = true; showStatsDropdown = false"
            >
              <i class="bi bi-people-fill me-1"></i> View All User Details ({{ userStats.users?.length || 0 }})
            </button>
            <router-link
              v-if="isTenantAdmin"
              to="/admin/users?action=create"
              target="_blank"
              class="btn btn-sm btn-idp-primary w-100 py-1 small text-center text-decoration-none d-flex align-items-center justify-content-center gap-1"
              @click="showStatsDropdown = false"
            >
              <i class="bi bi-person-plus-fill me-1"></i> Add New Sub-User
            </router-link>
            <router-link
              v-if="isTenantAdmin"
              to="/admin/users"
              target="_blank"
              class="btn btn-sm btn-dark border-secondary w-100 py-1 small text-center text-decoration-none text-muted d-flex align-items-center justify-content-center gap-1"
              @click="showStatsDropdown = false"
            >
              <i class="bi bi-person-lines-fill me-1"></i> Manage Team Users
            </router-link>
            <router-link
              v-else-if="isSuperAdmin"
              to="/superadmin/tenants"
              class="btn btn-sm btn-dark border-secondary w-100 py-1 small text-center text-decoration-none text-muted d-flex align-items-center justify-content-center gap-1"
              @click="showStatsDropdown = false"
            >
              <i class="bi bi-buildings me-1"></i> Manage Tenants & Accounts
            </router-link>
          </div>
        </div>
      </div>

      <!-- User Profile Dropdown -->
      <div class="position-relative" @click.stop>
        <button
          type="button"
          class="btn btn-dark border border-secondary p-0 rounded d-flex align-items-center justify-content-center"
          style="width: 36px; height: 36px;"
          @click="isDropdownOpen = !isDropdownOpen"
          title="Account Menu"
        >
          <i class="bi bi-person-fill fs-5 text-primary"></i>
        </button>

        <div
          v-if="isDropdownOpen"
          class="dropdown-menu show dropdown-menu-end position-absolute mt-2 shadow-lg"
          style="min-width: 220px; z-index: 1060; right: 0 !important; left: auto !important;"
        >
          <div class="px-3 py-2 border-bottom border-secondary mb-1">
            <div class="fw-bold text-white text-capitalize">
              {{ (authStore.user as any)?.name || 'User' }}
            </div>
            <div class="text-muted small text-truncate">
              {{ (authStore.user as any)?.email || '' }}
            </div>
            <span 
              class="badge mt-1 text-uppercase font-monospace border" 
              :class="isSuperAdmin ? 'bg-danger text-white border-danger' : isAdminOrSuperAdmin ? 'bg-primary text-white border-primary' : 'bg-secondary text-light border-secondary'"
              style="font-size: 0.65rem; padding: 2px 6px;"
            >
              {{ (authStore.user as any)?.role?.name || (authStore.user as any)?.role || 'User' }}
            </span>
          </div>
          <router-link
            v-if="isSuperAdmin"
            to="/superadmin/settings"
            class="dropdown-item d-flex align-items-center gap-2"
            @click="isDropdownOpen = false"
          >
            <i class="bi bi-sliders text-danger"></i> Master Settings
          </router-link>
          <router-link
            v-else-if="isTenantAdmin"
            to="/admin/settings"
            class="dropdown-item d-flex align-items-center gap-2"
            @click="isDropdownOpen = false"
          >
            <i class="bi bi-building-gear text-primary"></i> Firm Settings
          </router-link>
          <router-link
            to="/profile"
            class="dropdown-item d-flex align-items-center gap-2"
            @click="isDropdownOpen = false"
          >
            <i class="bi bi-gear text-info"></i> Profile Settings
          </router-link>
          <button
            v-if="!isSuperAdmin && isTenantAdmin"
            type="button"
            class="dropdown-item d-flex align-items-center gap-2"
            @click="isDropdownOpen = false; emit('openStorage')"
          >
            <i class="bi bi-hdd-stack text-warning"></i> Buy Extra Storage
          </button>
          <div class="dropdown-divider border-secondary my-1"></div>
          <button
            class="dropdown-item text-danger d-flex align-items-center gap-2"
            @click="handleLogout"
          >
            <i class="bi bi-box-arrow-right"></i> Logout
          </button>
        </div>
      </div>
    </div>
    </div>

    <!-- Online Activity Modal -->
    <div
      v-if="showStatsModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.7);"
    >
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content idp-card">
          <div class="modal-header">
            <h5 class="modal-title text-white d-flex align-items-center gap-2">
              <i class="bi bi-activity text-primary"></i> All Online Activity
            </h5>
            <button
              type="button"
              class="btn-close"
              @click="showStatsModal = false"
            ></button>
          </div>
          <div class="modal-body p-3">
            <!-- Filter & Search Toolbar -->
            <div class="d-flex flex-wrap gap-2 justify-content-between align-items-center mb-3">
              <div class="btn-group" role="group">
                <button
                  type="button"
                  class="btn btn-sm"
                  :class="activityFilter === 'all' ? 'btn-primary' : 'btn-dark border-secondary text-muted'"
                  @click="activityFilter = 'all'"
                >
                  All
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  :class="activityFilter === 'active' ? 'btn-success' : 'btn-dark border-secondary text-muted'"
                  @click="activityFilter = 'active'"
                >
                  Active Only
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  :class="activityFilter === 'online' ? 'btn-warning' : 'btn-dark border-secondary text-muted'"
                  @click="activityFilter = 'online'"
                >
                  Online Only
                </button>
              </div>

              <SearchInput
                v-model="activitySearch"
                placeholder="Search user or email..."
                max-width="260px"
              />
            </div>

            <!-- Users Grid / List -->
            <div style="max-height: 420px; overflow-y: auto;">
              <div v-if="filteredUsers.length > 0" class="row g-2">
                <div
                  v-for="u in filteredUsers"
                  :key="u.id"
                  class="col-md-6"
                >
                  <div class="p-3 bg-dark border border-secondary rounded d-flex align-items-start justify-content-between gap-2">
                    <div class="d-flex align-items-start gap-2 min-w-0 flex-grow-1">
                      <span
                        class="mt-1 d-inline-block rounded-circle flex-shrink-0"
                        :class="u.isActive ? 'bg-success dot-active-pulse' : u.isOnline ? 'bg-warning' : 'bg-secondary'"
                        style="width: 10px; height: 10px;"
                      ></span>
                      <div class="flex-grow-1 min-w-0">
                        <div class="d-flex justify-content-between align-items-center gap-1">
                          <span class="text-white fw-semibold small text-truncate">{{ u.name }}</span>
                          <span class="badge text-uppercase fw-semibold" :style="getRoleBadgeStyle(u.role)">
                            {{ u.role }}
                          </span>
                        </div>
                        <div class="text-muted small text-truncate">{{ u.email }}</div>
                        <div v-if="u.lastPage" class="text-muted small mt-1" style="font-size: 0.75rem;">
                          📍 {{ u.lastPage }}
                        </div>
                      </div>
                    </div>
                    <div class="text-end flex-shrink-0">
                      <div v-if="u.isActive" class="text-success fw-bold small" style="font-size: 0.75rem;">
                        Active now
                      </div>
                      <div v-else-if="u.isOnline" class="text-warning small" style="font-size: 0.75rem;">
                        Online
                        <div class="text-muted" style="font-size: 0.68rem;">
                          {{ timeAgo(u.updatedAt) }}
                        </div>
                      </div>
                      <div v-else class="text-muted small" style="font-size: 0.75rem;">
                        Offline
                        <div class="text-muted" style="font-size: 0.68rem;">
                          {{ timeAgo(u.updatedAt) }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="text-center py-5 text-muted">
                No users found matching current filters.
              </div>
            </div>
          </div>
          <div class="modal-footer d-flex justify-content-between">
            <router-link
              v-if="isTenantAdmin"
              to="/admin/users"
              target="_blank"
              class="btn btn-outline-secondary btn-sm"
              @click="showStatsModal = false"
            >
              <i class="bi bi-people me-1"></i> Manage Team Users
            </router-link>
            <router-link
              v-else-if="isSuperAdmin"
              to="/superadmin/tenants"
              class="btn btn-outline-secondary btn-sm"
              @click="showStatsModal = false"
            >
              <i class="bi bi-buildings me-1"></i> Manage Tenants & Accounts
            </router-link>
            <div v-else></div>
            <button
              type="button"
              class="btn btn-idp-secondary btn-sm"
              @click="showStatsModal = false"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>
</template>

<style scoped>
.dot-active-pulse {
  animation: dot-pulse-anim 1.8s ease-in-out infinite;
}

@keyframes dot-pulse-anim {
  0%, 100% {
    transform: scale(0.85);
    opacity: 0.65;
  }
  50% {
    transform: scale(1.3);
    opacity: 1;
  }
}

.recharge-btn {
  background: rgba(245, 158, 11, 0.12);
  border: 1px solid rgba(245, 158, 11, 0.5);
  color: #ffc107;
  font-size: 0.82rem;
  padding: 6px 14px !important;
  gap: 8px;
  min-width: 110px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.recharge-btn:hover {
  background: rgba(245, 158, 11, 0.25);
  border-color: #ffc107;
  color: #ffc107;
}

.recharge-btn:focus,
.recharge-btn:active {
  background: rgba(245, 158, 11, 0.2);
  border-color: #ffc107;
  color: #ffc107;
  box-shadow: none;
}

.currency-symbol {
  font-size: 0.72em;
  font-weight: 600;
  margin-right: 2px;
  opacity: 0.85;
}
</style>
