<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter } from "vue-router";
import { pulse } from "@/plugins/pulse";
import {
  useSuperAdminApi,
  type Tenant,
  type PendingSignup
} from "@/composables/useSuperAdminApi";
import SearchInput from "@/components/common/SearchInput.vue";

const router = useRouter();

const {
  tenants,
  pendingSignups,
  pendingRecharges,
  isLoadingTenants,
  isLoadingPending,
  fetchTenants,
  fetchPendingSignups,
  fetchPendingRecharges,
  approveSignup,
  rejectSignup,
  approveRecharge,
  rejectRecharge,
  extendTenant,
  toggleTenantStatus,
  deleteTenant
} = useSuperAdminApi();

const searchTerm = ref("");
const statusFilter = ref<"all" | "active" | "suspended">("all");
const approveDays = ref<{ [key: number]: number | undefined }>({});
const showExtendModal = ref(false);
const selectedTenant = ref<Tenant | null>(null);
const extendDaysCount = ref(30);
const isSubmittingAction = ref(false);

// Pagination State for 1,000+ Tenants
const currentPage = ref(1);
const perPage = ref(15);
const perPageOptions = [10, 15, 25, 50, 100];

const activeCount = computed(() => tenants.value.filter(t => t.status === "active").length);
const suspendedCount = computed(() => tenants.value.filter(t => t.status === "suspended").length);

const filteredTenants = computed(() => {
  let list = tenants.value.filter(t => t.roleName !== "superadmin" && (t as any).role !== "superadmin");
  if (statusFilter.value !== "all") {
    list = list.filter(t => t.status === statusFilter.value);
  }
  if (!searchTerm.value.trim()) return list;
  const q = searchTerm.value.toLowerCase();
  return list.filter(
    t =>
      t.name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      (t.mobile && t.mobile.includes(q)) ||
      (t.planName && t.planName.toLowerCase().includes(q))
  );
});

// Paginated view for 1,000+ tenants
const totalPages = computed(() => Math.max(1, Math.ceil(filteredTenants.value.length / perPage.value)));
const startIndex = computed(() => (currentPage.value - 1) * perPage.value);
const endIndex = computed(() => Math.min(startIndex.value + perPage.value, filteredTenants.value.length));

const paginatedTenants = computed(() => {
  return filteredTenants.value.slice(startIndex.value, startIndex.value + perPage.value);
});

watch([searchTerm, statusFilter, perPage], () => {
  currentPage.value = 1;
});

const openLedgerTab = (t: Tenant) => {
  const routeData = router.resolve({
    name: "superadmin-tenant-ledger",
    params: { id: t.id }
  });
  window.open(routeData.href, "_blank");
};

const handleApprove = async (p: PendingSignup) => {
  isSubmittingAction.value = true;
  try {
    const rawDays = approveDays.value[p.id];
    const days = rawDays && Number(rawDays) > 0 ? Number(rawDays) : undefined;
    await approveSignup(p.id, days);
    delete approveDays.value[p.id];
  } catch (e: any) {
    const err = e?.response?.data?.error;
    const msg = typeof err === "string" ? err : (e?.response?.data?.message || e?.message || "Approval failed");
    alert(msg);
  } finally {
    isSubmittingAction.value = false;
  }
};

const handleReject = async (p: PendingSignup) => {
  if (!confirm(`Are you sure you want to reject and delete registration for "${p.name}"?`)) return;
  isSubmittingAction.value = true;
  try {
    await rejectSignup(p.id);
  } catch (e: any) {
    const err = e?.response?.data?.error;
    const msg = typeof err === "string" ? err : (e?.response?.data?.message || e?.message || "Rejection failed");
    alert(msg);
  } finally {
    isSubmittingAction.value = false;
  }
};

const handleApproveRechargeAction = async (txId: number) => {
  isSubmittingAction.value = true;
  try {
    const res = await approveRecharge(txId);
    if (res?.message) {
      alert(res.message);
    }
  } catch (e: any) {
    alert(e?.response?.data?.message || "Failed to approve recharge");
  } finally {
    isSubmittingAction.value = false;
  }
};

const handleRejectRechargeAction = async (txId: number) => {
  if (!confirm("Are you sure you want to reject this recharge request?")) return;
  isSubmittingAction.value = true;
  try {
    await rejectRecharge(txId);
  } catch (e: any) {
    alert(e?.response?.data?.message || "Failed to reject recharge");
  } finally {
    isSubmittingAction.value = false;
  }
};

const openExtendModal = (t: Tenant) => {
  selectedTenant.value = t;
  extendDaysCount.value = 30;
  showExtendModal.value = true;
};

const handleConfirmExtend = async () => {
  if (!selectedTenant.value || extendDaysCount.value < 1) return;
  isSubmittingAction.value = true;
  try {
    await extendTenant(selectedTenant.value.id, extendDaysCount.value);
    showExtendModal.value = false;
    selectedTenant.value = null;
  } catch (e: any) {
    alert(e?.response?.data?.error || "Failed to extend subscription");
  } finally {
    isSubmittingAction.value = false;
  }
};

const handleToggleStatus = async (t: Tenant) => {
  const actionText = t.status === "active" ? "suspend" : "activate";
  if (!confirm(`Are you sure you want to ${actionText} tenant "${t.name}"?`)) return;
  try {
    await toggleTenantStatus(t.id);
  } catch (e: any) {
    alert(e?.response?.data?.error || "Failed to toggle status");
  }
};

const handleDeleteTenant = async (t: Tenant) => {
  if (!confirm(`Are you sure you want to permanently delete tenant "${t.name}"? This action cannot be undone.`)) return;
  isSubmittingAction.value = true;
  try {
    await deleteTenant(t.id);
  } catch (e: any) {
    alert(e?.response?.data?.error || "Failed to delete tenant");
  } finally {
    isSubmittingAction.value = false;
  }
};

const getDaysRemaining = (expDate?: string) => {
  if (!expDate) return { text: "Pending Activation", badgeClass: "bg-warning text-dark fw-semibold" };
  const exp = new Date(expDate);
  const now = new Date();
  const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: `Expired (${Math.abs(diffDays)}d ago)`, badgeClass: "bg-danger text-white" };
  } else if (diffDays <= 7) {
    return { text: `${diffDays} days left`, badgeClass: "bg-warning text-dark" };
  } else {
    return { text: `${diffDays} days left`, badgeClass: "bg-success text-white" };
  }
};

const extractRawTrxId = (trx?: string) => {
  if (!trx) return "N/A";
  return trx
    .replace(/\s*\((monthly|yearly|m|y)\)/gi, "")
    .trim();
};

const getBillingCycleText = (trx?: string, cycle?: string) => {
  if (cycle) return cycle === "yearly" ? "Yearly" : "Monthly";
  if (!trx) return "Monthly";
  const lower = trx.toLowerCase();
  if (lower.includes("yearly") || lower.includes("(y)")) {
    return "Yearly";
  }
  return "Monthly";
};

const handleRealtimeSignup = () => {
  fetchPendingSignups();
  fetchPendingRecharges();
  fetchTenants();
};

onMounted(async () => {
  await Promise.all([fetchTenants(), fetchPendingSignups(), fetchPendingRecharges()]);
  pulse.channel("auth").listen("tenant:signup", handleRealtimeSignup);
  pulse.channel("role:superadmin").listen("tenant:signup", handleRealtimeSignup);
  pulse.channel("role:superadmin").listen("tenant:recharge", handleRealtimeSignup);
});

onUnmounted(() => {
  pulse.channel("auth").stopListening("tenant:signup", handleRealtimeSignup);
  pulse.channel("role:superadmin").stopListening("tenant:signup", handleRealtimeSignup);
  pulse.channel("role:superadmin").stopListening("tenant:recharge", handleRealtimeSignup);
});
</script>

<template>
  <div class="tenants-page py-2">
    <!-- Header -->
    <div class="d-flex align-items-center justify-content-between mb-4">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Dashboard
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">Tenants</span>
        </div>
        <h4 class="text-white fw-bold mb-0">Tenants & Admin Approvals</h4>
      </div>
      <div class="d-flex align-items-center gap-2">
        <button class="btn btn-outline-secondary btn-sm" @click="fetchTenants(); fetchPendingSignups(); fetchPendingRecharges();">
          <i class="bi bi-arrow-clockwise me-1"></i> Refresh
        </button>
      </div>
    </div>

    <!-- 0. PENDING WALLET RECHARGES & STORAGE REQUESTS QUEUE -->
    <div v-if="pendingRecharges.length > 0" class="table-card p-4 mb-4 border-info shadow-lg">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="text-info fw-bold mb-0 d-flex align-items-center gap-2">
          <i class="bi bi-wallet2 fs-5"></i> Pending Recharges & Storage Requests (bKash TrxID Verification)
        </h6>
        <span class="badge bg-info text-dark px-3 py-1.5 fw-bold rounded-pill">
          {{ pendingRecharges.length }} Awaiting Verification
        </span>
      </div>

      <div class="table-responsive">
        <table class="table-custom mb-0">
          <thead>
            <tr>
              <th>Tenant / Request Type</th>
              <th>Contact Info</th>
              <th>Amount Sent (Gross)</th>
              <th>bKash Fee & Net Credit</th>
              <th>bKash Trx ID</th>
              <th>Submission Date</th>
              <th class="text-end">Verification Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in pendingRecharges" :key="r.id">
              <td>
                <div class="d-flex align-items-center gap-2">
                  <div class="fw-bold text-white fs-6">{{ r.userName || 'Tenant' }}</div>
                  <span
                    v-if="r.type === 'storage_addon'"
                    class="badge text-white px-2 py-0.5"
                    style="font-size: 0.68rem; background-color: #7952b3 !important;"
                  >
                    <i class="bi bi-hdd-network me-1"></i>Extra Storage
                  </span>
                  <span
                    v-else
                    class="badge bg-info text-dark px-2 py-0.5"
                    style="font-size: 0.68rem;"
                  >
                    <i class="bi bi-wallet2 me-1"></i>Recharge
                  </span>
                </div>
                <span class="badge bg-secondary bg-opacity-25 text-light border border-secondary" style="font-size: 0.7rem;">
                  Tenant ID: #{{ r.userId }}
                </span>
              </td>
              <td>
                <div class="text-light small">{{ r.userEmail }}</div>
                <div class="text-muted small font-monospace">{{ r.userMobile || 'No mobile' }}</div>
              </td>
              <td>
                <span class="text-white fw-bold font-monospace fs-6">
                  ৳ {{ (r.grossAmount || r.paidAmount || 0).toLocaleString() }}
                </span>
              </td>
              <td>
                <div class="d-flex flex-column gap-0.5">
                  <span class="text-muted small" style="font-size: 0.74rem;">
                    bKash Fee: <strong class="text-danger">-৳{{ r.gatewayCharge || 0 }}</strong>
                  </span>
                  <span class="text-success fw-bold font-monospace fs-6">
                    Net Credit: +৳{{ (r.netAmount || ((r.grossAmount || r.paidAmount || 0) - (r.gatewayCharge || 0))).toLocaleString() }}
                  </span>
                </div>
              </td>
              <td>
                <span class="badge bg-dark border border-secondary font-monospace text-light fs-6 px-2 py-1">
                  {{ extractRawTrxId(r.trxId) }}
                </span>
              </td>
              <td>
                <div class="text-light font-monospace small">
                  {{ r.createdAt ? r.createdAt.slice(0, 10) : 'Just now' }}
                </div>
                <div class="text-muted small" style="font-size: 0.72rem;">
                  {{ r.createdAt ? r.createdAt.slice(11, 16) : '' }}
                </div>
              </td>
              <td class="text-end">
                <div class="d-flex gap-2 justify-content-end align-items-center">
                  <button
                    class="btn btn-sm btn-success d-inline-flex align-items-center gap-1"
                    title="Approve Recharge"
                    :disabled="isSubmittingAction"
                    @click="handleApproveRechargeAction(r.id)"
                  >
                    <i class="bi bi-check-lg"></i>
                    <span>Approve & Credit</span>
                  </button>
                  <button
                    class="btn btn-sm btn-outline-danger d-inline-flex align-items-center gap-1"
                    title="Reject Recharge"
                    :disabled="isSubmittingAction"
                    @click="handleRejectRechargeAction(r.id)"
                  >
                    <i class="bi bi-x-lg"></i>
                    <span>Reject</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 1. PENDING REGISTRATIONS QUEUE -->
    <div v-if="pendingSignups.length > 0" class="table-card p-4 mb-4 border-warning shadow-lg">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="text-warning fw-bold mb-0 d-flex align-items-center gap-2">
          <i class="bi bi-exclamation-diamond-fill fs-5"></i> Pending Registrations & bKash TrxID Approvals
        </h6>
        <span class="badge bg-warning text-dark px-3 py-1.5 fw-bold rounded-pill">
          {{ pendingSignups.length }} Awaiting Verification
        </span>
      </div>

      <div class="table-responsive">
        <table class="table-custom mb-0">
          <thead>
            <tr>
              <th>Organization / Name</th>
              <th>Contact Info</th>
              <th>Selected Plan</th>
              <th>Paid Amount</th>
              <th>bKash Trx ID</th>
              <th class="text-end">Verification Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in pendingSignups" :key="p.id">
              <td>
                <div class="fw-bold text-white fs-6">{{ p.name }}</div>
                <div class="text-muted small">Registered: {{ p.createdAt ? p.createdAt.slice(0, 10) : 'Just now' }}</div>
              </td>
              <td>
                <div class="text-light small">{{ p.email }}</div>
                <div class="text-muted small font-monospace">{{ p.mobile || 'No mobile' }}</div>
              </td>
              <td>
                <div class="text-light fw-semibold">{{ p.planName }}</div>
                <div class="text-muted small">{{ getBillingCycleText(p.trxId, p.billingCycle) }}</div>
              </td>
              <td>
                <div class="d-flex flex-column gap-1">
                  <div class="d-flex align-items-center gap-1.5">
                    <span class="text-white fw-bold font-monospace fs-6">
                      ৳ {{ (p.grossAmount || p.paidAmount || 0).toLocaleString() }}
                    </span>
                    <span class="text-muted small" style="font-size: 0.72rem;">
                      (Fee: -৳{{ p.gatewayCharge || 0 }})
                    </span>
                  </div>
                  <div class="text-info font-monospace small" style="font-size: 0.76rem;">
                    Net Wallet: <strong>৳{{ (p.netAmount || 0).toLocaleString() }}</strong> / Plan: ৳{{ (p.planPrice || p.requiredFee || 0).toLocaleString() }}
                  </div>
                  <div>
                    <span
                      v-if="p.willActivate"
                      class="badge bg-success text-white px-2 py-1 shadow-sm"
                      style="font-size: 0.75rem;"
                    >
                      <i class="bi bi-check-circle-fill me-1"></i>Activates Plan <span v-if="p.excessCredit && p.excessCredit > 0">(+৳{{ p.excessCredit }} Wallet)</span>
                    </span>
                    <span
                      v-else
                      class="badge bg-warning text-dark px-2 py-1 fw-bold shadow-sm"
                      style="font-size: 0.75rem;"
                    >
                      <i class="bi bi-exclamation-circle-fill me-1"></i>Shortage -৳{{ p.shortage }} (Needs Recharge)
                    </span>
                  </div>
                </div>
              </td>
              <td>
                <div class="text-light font-monospace">{{ extractRawTrxId(p.trxId) }}</div>
              </td>
              <td class="text-end">
                <div class="d-flex gap-2 justify-content-end align-items-center">
                  <button
                    class="btn btn-sm btn-success uniform-icon-btn d-inline-flex align-items-center justify-content-center"
                    title="Approve Registration"
                    :disabled="isSubmittingAction"
                    @click="handleApprove(p)"
                  >
                    <i class="bi bi-check-lg fs-5"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-outline-danger uniform-icon-btn d-inline-flex align-items-center justify-content-center"
                    title="Reject Registration"
                    :disabled="isSubmittingAction"
                    @click="handleReject(p)"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 2. ORGANIZATION TENANTS DIRECTORY -->
    <div class="table-card shadow-sm mb-4">
      <div class="p-3 border-bottom border-secondary border-opacity-50 d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3" style="background: #181b1f;">
        <div class="d-flex align-items-center gap-2.5">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-buildings text-primary fs-5"></i>
            <h6 class="text-white fw-bold mb-0">Organization Tenants</h6>
          </div>
          <span class="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-25 px-2.5 py-1 fw-bold rounded-pill">
            {{ filteredTenants.length }} Found
          </span>
          <span v-if="suspendedCount > 0" class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25 px-2.5 py-1 fw-bold rounded-pill">
            {{ suspendedCount }} Suspended
          </span>
        </div>

        <div class="d-flex align-items-center gap-3 flex-nowrap">
          <!-- Status Filter Tabs (Modern Segmented Pill Control) -->
          <div class="d-inline-flex align-items-center p-1 rounded-3" style="background-color: #121417; border: 1px solid #2d3239;">
            <button
              type="button"
              class="btn btn-sm py-1 px-3 rounded-2 text-nowrap fw-semibold transition-all"
              style="font-size: 0.82rem;"
              :class="statusFilter === 'all' ? 'btn-primary shadow-sm' : 'text-light border-0 bg-transparent opacity-75'"
              @click="statusFilter = 'all'"
            >
              All <span class="opacity-75">({{ tenants.length }})</span>
            </button>
            <button
              type="button"
              class="btn btn-sm py-1 px-3 rounded-2 text-nowrap fw-semibold transition-all"
              style="font-size: 0.82rem;"
              :class="statusFilter === 'active' ? 'btn-success shadow-sm' : 'text-light border-0 bg-transparent opacity-75'"
              @click="statusFilter = 'active'"
            >
              Active <span class="opacity-75">({{ activeCount }})</span>
            </button>
            <button
              type="button"
              class="btn btn-sm py-1 px-3 rounded-2 text-nowrap fw-semibold transition-all"
              style="font-size: 0.82rem;"
              :class="statusFilter === 'suspended' ? 'btn-danger shadow-sm' : 'text-light border-0 bg-transparent opacity-75'"
              @click="statusFilter = 'suspended'"
            >
              Suspended <span class="opacity-75">({{ suspendedCount }})</span>
            </button>
          </div>

          <!-- Search Box -->
          <SearchInput
            v-model="searchTerm"
            placeholder="Search tenant or email..."
            max-width="280px"
            min-width="200px"
          />
        </div>
      </div>

      <div class="table-responsive">
        <table class="table-custom mb-0">
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>Organization Tenant</th>
              <th>Contact Details</th>
              <th>Plan & Limit</th>
              <th>Advance Credit</th>
              <th>Managed Clients</th>
              <th>Subscription Expiry</th>
              <th>Status</th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoadingTenants">
              <td colspan="9" class="text-center py-5 text-muted">
                <span class="spinner-border spinner-border-sm text-primary me-2"></span>
                Loading tenants database...
              </td>
            </tr>
            <tr v-else-if="filteredTenants.length === 0">
              <td colspan="9" class="text-center py-5 text-muted">
                No tenants matching your search or filter.
              </td>
            </tr>
            <tr
              v-for="(t, idx) in paginatedTenants"
              :key="t.id"
              class="tenant-row"
              title="Click row to open dedicated payment ledger in new tab"
              @click="openLedgerTab(t)"
            >
              <td class="text-muted small">{{ startIndex + idx + 1 }}</td>
              <td>
                <div class="fw-bold text-white fs-6 d-flex align-items-center gap-1.5">
                  {{ t.name }}
                  <i class="bi bi-box-arrow-up-right text-muted small opacity-50" title="Open full statement ledger"></i>
                </div>
                <div class="text-muted small">Tenant ID: #{{ t.id }}</div>
              </td>
              <td>
                <div class="text-light">{{ t.email }}</div>
                <div class="text-muted small font-monospace">{{ t.mobile || '—' }}</div>
              </td>
              <td>
                <div class="text-light">{{ t.planName || 'Standard Plan' }}</div>
                <div class="text-muted small">Max {{ t.planMaxUsers || 5 }} Sub-users</div>
              </td>
              <td>
                <span
                  v-if="t.advanceBalance && t.advanceBalance > 0"
                  class="badge bg-success text-white px-2.5 py-1.5 fw-bold font-monospace shadow-sm d-inline-flex align-items-center"
                  title="Click to view statement ledger"
                >
                  <i class="bi bi-wallet2 me-1"></i> ৳ {{ Number(t.advanceBalance).toLocaleString() }}
                </span>
                <span
                  v-else
                  class="badge bg-dark border border-secondary text-muted px-2.5 py-1 font-monospace d-inline-flex align-items-center"
                  title="Click to view statement ledger"
                >
                  ৳ 0
                </span>
              </td>
              <td>
                <span class="badge bg-secondary bg-opacity-50 text-light px-2.5 py-1">
                  {{ t.clientsCount || 0 }} Clients
                </span>
              </td>
              <td>
                <div class="d-flex flex-column gap-1">
                  <span class="text-light small font-monospace">
                    {{ t.expDate ? t.expDate.slice(0, 10) : '—' }}
                  </span>
                  <span class="badge rounded-pill px-2 py-0.5 small" :class="getDaysRemaining(t.expDate).badgeClass" style="width: fit-content;">
                    {{ getDaysRemaining(t.expDate).text }}
                  </span>
                </div>
              </td>
              <td @click.stop>
                <div
                  class="d-inline-flex align-items-center status-toggle-wrapper"
                  role="button"
                  :title="t.status === 'active' ? 'Active: Click to Suspend' : 'Suspended: Click to Activate'"
                  @click="handleToggleStatus(t)"
                >
                  <div
                    class="custom-switch"
                    :class="t.status === 'active' ? 'switch-on' : 'switch-off'"
                  >
                    <div class="switch-handle"></div>
                  </div>
                </div>
              </td>
              <td class="text-end" @click.stop>
                <div class="d-flex gap-1.5 justify-content-end align-items-center">
                  <button
                    class="btn btn-sm btn-outline-info uniform-icon-btn d-inline-flex align-items-center justify-content-center"
                    title="Open Full-Page Payment Ledger"
                    @click="openLedgerTab(t)"
                  >
                    <i class="bi bi-clock-history"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-outline-light uniform-icon-btn d-inline-flex align-items-center justify-content-center"
                    title="Extend Subscription"
                    @click="openExtendModal(t)"
                  >
                    <i class="bi bi-calendar-plus"></i>
                  </button>
                  <button
                    class="btn btn-sm btn-outline-danger uniform-icon-btn d-inline-flex align-items-center justify-content-center"
                    title="Delete Tenant Permanently"
                    :disabled="isSubmittingAction"
                    @click="handleDeleteTenant(t)"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer for 1000+ Tenants -->
      <div v-if="filteredTenants.length > 0" class="p-3 border-top border-secondary d-flex flex-column flex-sm-row justify-content-between align-items-center gap-3" style="background: #181b1f;">
        <div class="text-muted small">
          Showing <span class="text-white fw-bold">{{ startIndex + 1 }}</span> to <span class="text-white fw-bold">{{ endIndex }}</span> of <span class="text-white fw-bold">{{ filteredTenants.length }}</span> tenants
        </div>

        <div class="d-flex align-items-center gap-3">
          <!-- Rows Per Page -->
          <div class="d-flex align-items-center gap-2">
            <span class="text-muted small text-nowrap">Rows per page:</span>
            <select v-model="perPage" class="form-select form-select-sm idp-select" style="width: 75px;">
              <option v-for="opt in perPageOptions" :key="opt" :value="opt">{{ opt }}</option>
            </select>
          </div>

          <!-- Page Navigation -->
          <div class="d-flex align-items-center gap-1">
            <button
              class="btn btn-sm btn-outline-secondary px-2.5"
              :disabled="currentPage === 1"
              @click="currentPage--"
            >
              <i class="bi bi-chevron-left"></i>
            </button>
            <span class="text-light small px-2">
              Page <strong class="text-white">{{ currentPage }}</strong> of <strong>{{ totalPages }}</strong>
            </span>
            <button
              class="btn btn-sm btn-outline-secondary px-2.5"
              :disabled="currentPage >= totalPages"
              @click="currentPage++"
            >
              <i class="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>


    <!-- EXTEND SUBSCRIPTION MODAL -->
    <div
      v-if="showExtendModal && selectedTenant"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.75);"
    >
      <div class="modal-dialog modal-dialog-centered" style="max-width: 460px;">
        <div class="modal-content table-card border-secondary">
          <div class="modal-header border-secondary" style="background: #181b1f;">
            <h5 class="modal-title text-white fw-bold">
              <i class="bi bi-calendar-plus text-primary me-2"></i> Extend Subscription
            </h5>
            <button type="button" class="btn-close btn-close-white" @click="showExtendModal = false"></button>
          </div>
          <div class="modal-body p-4">
            <div class="mb-3">
              <label class="form-label text-muted small">Organization Tenant</label>
              <div class="fw-bold text-white fs-6">{{ selectedTenant.name }}</div>
              <div class="text-muted small">{{ selectedTenant.email }}</div>
            </div>

            <div class="mb-3">
              <label class="form-label text-muted small">Current Expiration Date</label>
              <div class="text-light font-monospace">{{ selectedTenant.expDate ? selectedTenant.expDate.slice(0, 10) : 'Not Set (Default 30d)' }}</div>
            </div>

            <div class="mb-4">
              <label class="form-label text-light">Add Duration (Days)</label>
              <div class="d-flex gap-2 mb-2">
                <button
                  type="button"
                  class="btn btn-sm"
                  :class="extendDaysCount === 30 ? 'btn-primary' : 'btn-outline-secondary'"
                  @click="extendDaysCount = 30"
                >
                  +30 Days (1 Mo)
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  :class="extendDaysCount === 90 ? 'btn-primary' : 'btn-outline-secondary'"
                  @click="extendDaysCount = 90"
                >
                  +90 Days (3 Mo)
                </button>
                <button
                  type="button"
                  class="btn btn-sm"
                  :class="extendDaysCount === 365 ? 'btn-primary' : 'btn-outline-secondary'"
                  @click="extendDaysCount = 365"
                >
                  +365 Days (1 Yr)
                </button>
              </div>
              <input
                v-model.number="extendDaysCount"
                type="number"
                class="form-control idp-search-input font-monospace"
                min="1"
                placeholder="Enter custom days..."
              />
            </div>

            <div class="d-flex gap-2">
              <button
                type="button"
                class="btn btn-secondary flex-grow-1"
                @click="showExtendModal = false"
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn btn-primary flex-grow-1"
                :disabled="isSubmittingAction || extendDaysCount < 1"
                @click="handleConfirmExtend"
              >
                {{ isSubmittingAction ? 'Extending...' : 'Confirm Extension' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tenants-page {
  font-family: 'Inter', sans-serif;
}

.table-card {
  background: #1e2227;
  border: 1px solid #343a40;
  border-radius: 8px;
  overflow: hidden;
}

.table-custom {
  width: 100%;
  border-collapse: collapse;
}

.table-custom thead th {
  background: #181b1f;
  color: #adb5bd;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #343a40;
  white-space: nowrap;
}

.table-custom tbody td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #2a3038;
  vertical-align: middle;
  white-space: nowrap;
}

.tenant-row {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.tenant-row:hover td {
  background-color: #242930;
}

.search-box {
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  pointer-events: none;
  font-size: 0.8rem;
}

.idp-search-input {
  background-color: #181b1f !important;
  border: 1px solid #3b424b !important;
  color: #f8f9fa !important;
  padding-left: 34px !important;
  padding-right: 28px !important;
  border-radius: 6px;
  font-size: 0.85rem;
}

.idp-search-input:focus {
  border-color: #0d6efd !important;
  box-shadow: 0 0 0 0.15rem rgba(13, 110, 253, 0.25) !important;
}

.idp-select {
  background-color: #181b1f !important;
  border: 1px solid #3b424b !important;
  color: #f8f9fa !important;
  border-radius: 6px;
}

.clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 0.85rem;
}

.clear-btn:hover {
  color: #f8f9fa;
}

.uniform-icon-btn {
  height: 32px;
  width: 32px;
  padding: 0;
  border-radius: 6px;
  font-size: 0.9rem;
}

/* Status Switch Toggle */
.status-toggle-wrapper {
  cursor: pointer;
  user-select: none;
  padding: 4px 6px;
  border-radius: 6px;
  transition: all 0.2s ease;
}
.status-toggle-wrapper:hover {
  background-color: rgba(255, 255, 255, 0.06);
}

.custom-switch {
  width: 38px;
  height: 20px;
  border-radius: 10px;
  position: relative;
  transition: background-color 0.25s ease, box-shadow 0.25s ease;
  flex-shrink: 0;
}

.custom-switch.switch-on {
  background-color: #198754;
  box-shadow: 0 0 6px rgba(25, 135, 84, 0.4);
}

.custom-switch.switch-off {
  background-color: #dc3545;
  box-shadow: 0 0 6px rgba(220, 53, 69, 0.4);
}

.switch-handle {
  width: 14px;
  height: 14px;
  background-color: #ffffff;
  border-radius: 50%;
  position: absolute;
  top: 3px;
  left: 3px;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.custom-switch.switch-on .switch-handle {
  transform: translateX(18px);
}

.custom-switch.switch-off .switch-handle {
  transform: translateX(0);
}
</style>
