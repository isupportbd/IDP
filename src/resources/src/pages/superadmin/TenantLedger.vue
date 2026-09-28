<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import { type Tenant, type SubscriptionTransaction } from "@/composables/useSuperAdminApi";
import SearchInput from "@/components/common/SearchInput.vue";

const route = useRoute();
const router = useRouter();

const tenantId = computed(() => Number(route.params.id));
const tenant = ref<Tenant | null>(null);
const transactions = ref<SubscriptionTransaction[]>([]);
const isLoading = ref(true);
const searchTerm = ref("");
const error = ref<string | null>(null);

// Extend Subscription state
const showExtendModal = ref(false);
const extendDaysCount = ref(30);
const isSubmittingExtend = ref(false);

const fetchLedgerData = async () => {
  if (!tenantId.value) return;
  isLoading.value = true;
  error.value = null;
  try {
    const res = await axios.get(`/api/superadmin/tenants/${tenantId.value}/transactions`);
    if (res.data?.success && res.data.data) {
      tenant.value = res.data.data.tenant;
      transactions.value = res.data.data.transactions || [];
    } else {
      error.value = "Failed to load tenant ledger details";
    }
  } catch (e: any) {
    error.value = e?.response?.data?.error || e?.message || "Failed to load tenant ledger";
  } finally {
    isLoading.value = false;
  }
};

const filteredTransactions = computed(() => {
  if (!searchTerm.value.trim()) return transactions.value;
  const q = searchTerm.value.toLowerCase();
  return transactions.value.filter(
    tx =>
      (tx.trxId && tx.trxId.toLowerCase().includes(q)) ||
      (tx.planName && tx.planName.toLowerCase().includes(q)) ||
      (tx.billingCycle && tx.billingCycle.toLowerCase().includes(q)) ||
      (tx.note && tx.note.toLowerCase().includes(q)) ||
      (tx.paymentMethod && tx.paymentMethod.toLowerCase().includes(q))
  );
});

const isProcessingTx = ref<{ [key: number]: boolean }>({});

const totalPaidAmount = computed(() => {
  return transactions.value
    .filter(tx => (tx.status === "completed" || tx.status === "approved") && tx.type !== "plan_fee")
    .reduce((sum, tx) => sum + (Number(tx.paidAmount) || 0), 0);
});

const totalExcessCreditAdded = computed(() => {
  return transactions.value
    .filter(tx => (tx.status === "completed" || tx.status === "approved") && tx.type !== "plan_fee")
    .reduce((sum, tx) => sum + (Number(tx.excessCredit) || 0), 0);
});

const handleApproveTx = async (tx: SubscriptionTransaction) => {
  isProcessingTx.value[tx.id] = true;
  try {
    const res = await axios.post("/api/superadmin/approve-recharge", { transactionId: tx.id });
    if (res.data?.success) {
      await fetchLedgerData();
    } else {
      alert(res.data?.message || "Failed to approve transaction");
    }
  } catch (e: any) {
    alert(e?.response?.data?.message || "Failed to approve transaction");
  } finally {
    isProcessingTx.value[tx.id] = false;
  }
};

const handleRejectTx = async (tx: SubscriptionTransaction) => {
  if (!confirm("Are you sure you want to reject this recharge transaction?")) return;
  isProcessingTx.value[tx.id] = true;
  try {
    const res = await axios.post("/api/superadmin/reject-recharge", { transactionId: tx.id });
    if (res.data?.success) {
      await fetchLedgerData();
    } else {
      alert(res.data?.message || "Failed to reject transaction");
    }
  } catch (e: any) {
    alert(e?.response?.data?.message || "Failed to reject transaction");
  } finally {
    isProcessingTx.value[tx.id] = false;
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

const handleConfirmExtend = async () => {
  if (!tenant.value || extendDaysCount.value < 1) return;
  isSubmittingExtend.value = true;
  try {
    const res = await axios.post(`/api/superadmin/tenants/${tenant.value.id}/extend`, {
      days: extendDaysCount.value
    });
    if (res.data?.success) {
      showExtendModal.value = false;
      await fetchLedgerData();
    }
  } catch (e: any) {
    alert(e?.response?.data?.error || "Failed to extend subscription");
  } finally {
    isSubmittingExtend.value = false;
  }
};

const extractRawTrxId = (trx?: string, method?: string) => {
  if (method === "wallet_balance" || method === "wallet_deduction") return "Wallet Balance";
  if (!trx || trx === "null" || trx === "NULL") return "Internal Balance";
  return trx.replace(/\s*\((monthly|yearly|m|y)\)/gi, "").trim();
};

const handlePrint = () => {
  window.print();
};

onMounted(fetchLedgerData);
</script>

<template>
  <div class="tenant-ledger-page p-3 p-md-4">
    <!-- Top Header & Breadcrumb -->
    <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4 pb-2 border-bottom border-secondary no-print">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/superadmin/tenants" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Tenants
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">Subscription & Payment Ledger</span>
        </div>
        <h4 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
          <i class="bi bi-receipt text-primary"></i> Tenant Payment Ledger & Statement
        </h4>
      </div>

      <div class="d-flex flex-wrap align-items-center gap-2">
        <button class="btn btn-outline-light btn-sm d-inline-flex align-items-center gap-2" @click="handlePrint">
          <i class="bi bi-printer"></i>
          <span>Print Statement</span>
        </button>
        <button
          v-if="tenant"
          class="btn btn-primary btn-sm d-inline-flex align-items-center gap-2"
          @click="showExtendModal = true"
        >
          <i class="bi bi-calendar-plus"></i>
          <span>Extend Subscription</span>
        </button>
        <button class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2" @click="fetchLedgerData">
          <i class="bi bi-arrow-clockwise"></i>
          <span>Refresh</span>
        </button>
        <router-link to="/superadmin/tenants" class="btn btn-outline-secondary btn-sm d-inline-flex align-items-center">
          Back to Tenants
        </router-link>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-5 text-muted">
      <div class="spinner-border text-primary mb-3"></div>
      <div class="fs-6">Loading tenant subscription ledger...</div>
    </div>

    <!-- Error State -->
    <div v-else-if="error || !tenant" class="alert alert-danger p-4 text-center my-4">
      <i class="bi bi-exclamation-triangle fs-3 d-block mb-2"></i>
      <div class="fw-bold fs-6">{{ error || 'Tenant not found' }}</div>
      <router-link to="/superadmin/tenants" class="btn btn-secondary btn-sm mt-3">
        Return to Tenants Directory
      </router-link>
    </div>

    <!-- Ledger Content -->
    <div v-else class="ledger-content">
      <!-- Printable Statement Header (Visible only on print) -->
      <div class="d-none d-print-block mb-4 text-center border-bottom pb-3">
        <h2 class="fw-bold">IDP - Importer Data Processor</h2>
        <h4 class="text-secondary">Official Tenant Subscription & Payment Statement</h4>
        <div class="small text-muted">Generated on: {{ new Date().toLocaleString() }}</div>
      </div>

      <!-- Top Tenant Profile & Financial Cards -->
      <div class="row g-3 mb-4">
        <!-- 1. Tenant Profile Card -->
        <div class="col-12 col-lg-4">
          <div class="table-card p-4 h-100">
            <div class="d-flex justify-content-between align-items-start mb-3">
              <div>
                <span class="badge bg-secondary bg-opacity-25 text-light border border-secondary mb-2">
                  Tenant ID: #{{ tenant.id }}
                </span>
                <h5 class="fw-bold text-white mb-1">{{ tenant.name }}</h5>
                <div class="text-muted small">{{ tenant.email }}</div>
                <div class="text-muted small font-monospace">{{ tenant.mobile || 'No mobile' }}</div>
              </div>
              <span
                class="badge"
                :class="tenant.status === 'active' ? 'bg-success' : 'bg-danger'"
              >
                {{ tenant.status === 'active' ? 'Active' : 'Suspended' }}
              </span>
            </div>
            <div class="border-top border-secondary pt-2 mt-auto d-flex justify-content-between text-muted small">
              <span>Registered Since:</span>
              <span class="text-light font-monospace">{{ tenant.createdAt ? tenant.createdAt.slice(0, 10) : '—' }}</span>
            </div>
          </div>
        </div>

        <!-- 2. Subscription Details Card -->
        <div class="col-12 col-md-6 col-lg-4">
          <div class="table-card p-4 h-100">
            <div class="d-flex justify-content-between align-items-center mb-3">
              <span class="text-muted small fw-semibold text-uppercase">Plan & Subscription</span>
              <span class="badge rounded-pill px-2.5 py-1" :class="getDaysRemaining(tenant.expDate).badgeClass">
                {{ getDaysRemaining(tenant.expDate).text }}
              </span>
            </div>
            <div class="fs-5 fw-bold text-white mb-2">{{ tenant.planName || 'Standard Plan' }}</div>
            <div class="d-flex flex-column gap-1 small text-muted mb-3">
              <div class="d-flex justify-content-between">
                <span>Expiration Date:</span>
                <strong class="text-light font-monospace">{{ tenant.expDate ? tenant.expDate.slice(0, 10) : '—' }}</strong>
              </div>
              <div class="d-flex justify-content-between">
                <span>Max Allowed Users:</span>
                <strong class="text-light">{{ tenant.planMaxUsers || 5 }} Sub-users</strong>
              </div>
              <div class="d-flex justify-content-between">
                <span>Storage Limit:</span>
                <strong class="text-light">{{ (tenant.planMaxStorageMB || 1024) >= 1024 ? ((tenant.planMaxStorageMB || 1024) / 1024) + ' GB' : (tenant.planMaxStorageMB || 1024) + ' MB' }}</strong>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Advance Credit Wallet & Financial Summary -->
        <div class="col-12 col-md-6 col-lg-4">
          <div class="table-card p-4 h-100">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="text-muted small fw-bold text-uppercase d-flex align-items-center">
                <i class="bi bi-wallet2 text-success me-2 fs-6"></i>
                <span>Advance Credit Wallet</span>
              </span>
              <span class="badge bg-success text-white px-2.5 py-1 font-monospace shadow-sm">
                Available Credit
              </span>
            </div>
            <div class="fs-4 fw-bold text-success font-monospace mb-2 d-flex align-items-baseline gap-1">
              <span class="fs-6 fw-normal opacity-75">৳</span>
              <span>{{ (tenant.advanceBalance || 0).toLocaleString() }}</span>
            </div>
            <div class="border-top border-secondary pt-2 mt-auto d-flex justify-content-between text-muted small">
              <span>Total Lifetime Paid:</span>
              <span class="text-white fw-bold font-monospace">
                <span class="small opacity-75 fw-normal me-0.5">৳</span>{{ totalPaidAmount }}
              </span>
            </div>
            <div class="d-flex justify-content-between text-muted small mt-1">
              <span>Total Transactions:</span>
              <span class="text-light font-monospace">{{ transactions.length }} entries</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Transaction Ledger Table Card -->
      <div class="table-card p-0 shadow-sm">
        <div class="p-3 border-bottom border-secondary d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3" style="background: #181b1f;">
          <div class="d-flex align-items-center gap-2">
            <h6 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-receipt text-primary"></i> Complete Payment & Subscription Ledger
            </h6>
            <span class="badge bg-primary px-2.5 py-1">{{ filteredTransactions.length }} Entries</span>
          </div>

          <!-- Search Box -->
          <SearchInput
            v-model="searchTerm"
            placeholder="Search TrxID, plan, cycle..."
            max-width="260px"
            min-width="180px"
            class="no-print"
          />
        </div>

        <div class="table-responsive">
          <table class="table-custom mb-0">
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th>Date & Time</th>
                <th>Plan & Cycle</th>
                <th>Required Fee</th>
                <th>Amount Paid</th>
                <th>Advance Credit</th>
                <th>Trx ID & Method</th>
                <th>Days Extended</th>
                <th>Status</th>
                <th>Remarks / Notes</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredTransactions.length === 0">
                <td colspan="10" class="text-center py-5 text-muted">
                  <i class="bi bi-journal-x fs-3 d-block mb-2"></i>
                  No transaction ledger records found for this tenant.
                </td>
              </tr>
              <tr v-for="(tx, idx) in filteredTransactions" :key="tx.id">
                <td class="text-muted small">{{ idx + 1 }}</td>
                <td>
                  <div class="text-light font-monospace fw-semibold">
                    {{ tx.createdAt ? tx.createdAt.slice(0, 10) : '—' }}
                  </div>
                  <div class="text-muted small">
                    {{ tx.createdAt ? tx.createdAt.slice(11, 16) : '' }}
                  </div>
                </td>
                <td>
                  <div class="text-white fw-semibold">{{ tx.planName || 'Custom Extension' }}</div>
                  <span class="badge bg-secondary bg-opacity-50 text-light text-capitalize" style="font-size: 0.72rem;">
                    {{ tx.billingCycle }}
                  </span>
                </td>
                <td>
                  <template v-if="Number(tx.planRate) > 0">
                    <div class="text-white font-monospace fw-bold">
                      ৳ {{ (Number(tx.planRate) + Math.round(Number(tx.planRate) * 0.018)).toLocaleString() }}
                    </div>
                    <div class="text-muted" style="font-size: 0.72rem;">
                      ৳ {{ Number(tx.planRate).toLocaleString() }} + 1.8%
                    </div>
                  </template>
                  <span v-else class="text-muted font-monospace">৳ 0</span>
                </td>
                <td>
                  <template v-if="tx.type === 'plan_fee'">
                    <span class="text-muted font-monospace">৳ 0</span>
                    <span class="badge bg-secondary bg-opacity-75 text-light ms-1" style="font-size: 0.68rem;">Wallet Debit</span>
                  </template>
                  <span v-else class="text-white fw-bold font-monospace fs-6">
                    ৳ {{ tx.paidAmount }}
                  </span>
                </td>
                <td>
                  <span
                    v-if="tx.type === 'plan_fee' && Number(tx.netAmount) < 0"
                    class="badge bg-secondary text-light font-monospace shadow-sm"
                  >
                    -৳ {{ Math.abs(Number(tx.netAmount)) }}
                  </span>
                  <span
                    v-else-if="tx.excessCredit > 0"
                    class="badge bg-success text-white font-monospace shadow-sm"
                  >
                    +৳ {{ tx.excessCredit }}
                  </span>
                  <span v-else class="text-muted small font-monospace">৳ 0</span>
                </td>
                <td>
                  <div class="d-flex flex-column gap-1">
                    <span class="badge bg-dark border border-secondary font-monospace text-light" style="width: fit-content;">
                      {{ extractRawTrxId(tx.trxId, tx.paymentMethod) }}
                    </span>
                    <span class="text-muted" style="font-size: 0.75rem;">
                      Via {{ tx.paymentMethod === 'wallet_balance' || tx.paymentMethod === 'wallet_deduction' ? 'Wallet Balance' : tx.paymentMethod }}
                    </span>
                  </div>
                </td>
                <td>
                  <span class="badge bg-primary bg-opacity-25 text-primary border border-primary border-opacity-50 font-monospace">
                    +{{ tx.daysAdded }} Days
                  </span>
                </td>
                <td>
                  <div class="d-flex flex-column gap-1">
                    <span
                      class="badge text-capitalize"
                      :class="{
                        'bg-success text-white': tx.status === 'completed' || tx.status === 'approved',
                        'bg-warning text-dark fw-bold': tx.status === 'pending',
                        'bg-danger text-white': tx.status === 'rejected'
                      }"
                    >
                      <i v-if="tx.status === 'pending'" class="bi bi-clock-history me-1"></i>
                      {{ tx.status === 'pending' ? 'Pending Approval' : tx.status }}
                    </span>
                    <div v-if="tx.status === 'pending'" class="d-flex gap-1 mt-1 no-print">
                      <button
                        type="button"
                        class="btn btn-sm btn-success py-0.5 px-2 d-inline-flex align-items-center gap-1"
                        style="font-size: 0.72rem;"
                        :disabled="isProcessingTx[tx.id]"
                        @click="handleApproveTx(tx)"
                      >
                        <i class="bi bi-check-lg"></i> Approve
                      </button>
                      <button
                        type="button"
                        class="btn btn-sm btn-outline-danger py-0.5 px-2 d-inline-flex align-items-center gap-1"
                        style="font-size: 0.72rem;"
                        :disabled="isProcessingTx[tx.id]"
                        @click="handleRejectTx(tx)"
                      >
                        <i class="bi bi-x-lg"></i> Reject
                      </button>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="text-light small text-break" style="max-width: 220px;">
                    {{ tx.note || '—' }}
                  </span>
                </td>
              </tr>
            </tbody>
            <tfoot v-if="filteredTransactions.length > 0">
              <tr class="fw-bold text-white bg-dark bg-opacity-50">
                <td colspan="4" class="text-end">Total Summary:</td>
                <td class="text-success font-monospace fs-6">৳ {{ totalPaidAmount }}</td>
                <td class="text-success font-monospace fs-6">+৳ {{ totalExcessCreditAdded }}</td>
                <td colspan="4"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- EXTEND SUBSCRIPTION MODAL -->
    <div
      v-if="showExtendModal && tenant"
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
              <div class="fw-bold text-white fs-6">{{ tenant.name }}</div>
              <div class="text-muted small">{{ tenant.email }}</div>
            </div>

            <div class="mb-3">
              <label class="form-label text-muted small">Current Expiration Date</label>
              <div class="text-light font-monospace">{{ tenant.expDate ? tenant.expDate.slice(0, 10) : 'Not Set' }}</div>
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
                :disabled="isSubmittingExtend || extendDaysCount < 1"
                @click="handleConfirmExtend"
              >
                {{ isSubmittingExtend ? 'Extending...' : 'Confirm Extension' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tenant-ledger-page {
  font-family: 'Inter', sans-serif;
  animation: fadeIn 0.15s ease-in-out;
  min-height: 85vh;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(3px); }
  to { opacity: 1; transform: translateY(0); }
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

.table-custom tbody tr:hover td {
  background-color: #242930;
}

.table-custom tfoot td {
  padding: 0.85rem 1rem;
  border-top: 1px solid #343a40;
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

@media print {
  .no-print {
    display: none !important;
  }
  .table-card {
    border: 1px solid #ccc !important;
    background: #fff !important;
    color: #000 !important;
  }
  .table-custom thead th, .table-custom tbody td {
    color: #000 !important;
    border-color: #ddd !important;
    background: #fff !important;
  }
}
</style>
