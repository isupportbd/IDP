<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import axios from "axios";
import MonthNavigator from "@/components/MonthNavigator.vue";
import { useToast } from "@/composables/useToast";

const toast = useToast();

interface Purchase {
  id: number;
  clientId: number;
  clientName?: string;
  clientBin?: string;
  office?: string;
  beNo?: string;
  beDate?: string;
  month?: string;
  lcNumber?: string;
  netWt?: number;
  totalQty?: number;
  assValue?: number;
  baseValueOfVat?: number;
  unitValue?: number;
  cd?: number;
  rd?: number;
  sd?: number;
  vat?: number;
  at?: number;
  isRebate?: boolean;
  isFfs?: boolean;
  itemId?: number;
  itemName?: string;
  hsCode?: string;
}

const purchases = ref<Purchase[]>([]);
const clients = ref<any[]>([]);
const references = ref<any[]>([]);
const totalCount = ref(0);
const isLoading = ref(false);

const searchQuery = ref("");
const selectedClient = ref("");
const selectedReference = ref("");

const getLastMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 7);
};
const selectedMonth = ref(getLastMonth());

const currentPage = ref(1);
const itemsPerPage = ref(15);
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / itemsPerPage.value)));

// Deletion Modal State
const showDeleteModal = ref(false);
const deleteTargetType = ref<"single" | "filtered">("single");
const singleDeleteId = ref<number | null>(null);
const isDeleting = ref(false);

// Formatters
const formatDate = (dateStr?: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const dd = String(date.getDate()).padStart(2, "0");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mmm = monthNames[date.getMonth()];
  const yyyy = date.getFullYear();
  return `${dd} ${mmm} ${yyyy}`;
};

const formatBeDate = (dateStr?: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  }
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const formatNumber = (val: any) => {
  if (val === undefined || val === null || val === "") return "";
  const num = parseFloat(String(val).replace(/,/g, ""));
  if (isNaN(num)) return val;
  return num.toFixed(2);
};

const formatMonthStr = (monthStr?: string) => {
  if (!monthStr) return "";
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }).replace(" ", "-");
};

// Filtered Clients based on Reference selection
const availableClients = computed(() => {
  if (!selectedReference.value) return clients.value;
  return clients.value.filter((c) => String(c.referenceId) === String(selectedReference.value));
});










// Fetch Purchases
const fetchPurchases = async () => {
  isLoading.value = true;
  try {
    const res = await axios.get("/api/purchases", {
      params: {
        month: selectedMonth.value || undefined,
        clientId: selectedClient.value || undefined,
        referenceId: selectedReference.value || undefined,
        search: searchQuery.value || undefined,
        page: currentPage.value,
        limit: itemsPerPage.value
      }
    });

    if (res.data?.success || res.status === 200) {
      purchases.value = res.data.data || [];
      totalCount.value = res.data.pagination?.totalCount ?? res.data.pagination?.totalRows ?? (res.data.data?.length || 0);
    } else {
      purchases.value = [];
      totalCount.value = 0;
    }
  } catch (e: any) {
    console.error("Failed to load purchases from API", e);
    purchases.value = [];
    totalCount.value = 0;
  } finally {
    isLoading.value = false;
  }
};

// Fetch Clients & Master Data
const fetchMasterData = async () => {
  try {
    const [clientsRes, refRes] = await Promise.allSettled([
      axios.get("/api/clients", { params: { limit: 1000 } }),
      axios.get("/api/services/references")
    ]);

    if (clientsRes.status === "fulfilled" && clientsRes.value.data?.data) {
      clients.value = clientsRes.value.data.data;
    } else {
      clients.value = [];
    }

    if (refRes.status === "fulfilled" && refRes.value.data?.data) {
      references.value = refRes.value.data.data;
    } else {
      references.value = [];
    }
  } catch (e) {
    clients.value = [];
    references.value = [];
  }
};

// Open Single Delete Modal
const confirmSingleDelete = (id: number) => {
  deleteTargetType.value = "single";
  singleDeleteId.value = id;
  showDeleteModal.value = true;
};

// Open Bulk/Filtered Delete Modal
const confirmFilteredDelete = () => {
  deleteTargetType.value = "filtered";
  singleDeleteId.value = null;
  showDeleteModal.value = true;
};

// Execute Delete Action
const executeDelete = async () => {
  isDeleting.value = true;
  try {
    if (deleteTargetType.value === "single" && singleDeleteId.value) {
      await axios.delete(`/api/purchases/${singleDeleteId.value}`);
      toast.success("Purchase entry deleted successfully.");
    } else {
      // Bulk delete for current month / filter
      if (selectedMonth.value) {
        await axios.delete(`/api/purchases/month/${selectedMonth.value}`);
        toast.success(`All purchases for ${formatMonthStr(selectedMonth.value)} deleted successfully.`);
      }
    }
    showDeleteModal.value = false;
    await fetchPurchases();
  } catch (e: any) {
    toast.error(e?.response?.data?.message || "Failed to delete purchase record(s).");
  } finally {
    isDeleting.value = false;
  }
};

// Watchers for filtering
let filterTimer: any = null;
watch([selectedMonth, selectedClient, selectedReference, searchQuery], () => {
  currentPage.value = 1;
  clearTimeout(filterTimer);
  filterTimer = setTimeout(fetchPurchases, 300);
});

watch(selectedReference, () => {
  if (selectedClient.value) {
    const valid = availableClients.value.some((c) => String(c.id) === String(selectedClient.value));
    if (!valid) selectedClient.value = "";
  }
});

watch(currentPage, fetchPurchases);

onMounted(async () => {
  await fetchMasterData();
  await fetchPurchases();
});
</script>

<template>
  <div class="py-2">
    <!-- Breadcrumbs & Title -->
    <div class="d-flex align-items-center gap-2 mb-1">
      <router-link to="/" class="text-muted text-decoration-none small">
        <i class="bi bi-arrow-left me-1"></i> Dashboard
      </router-link>
      <span class="text-muted small">/</span>
      <span class="text-primary small fw-semibold">Purchases</span>
    </div>
    <h4 class="text-white fw-bold mb-3">Purchases Ledger</h4>

    <!-- Sleek Filter Toolbar Card -->
    <div class="idp-card p-3 mb-4">
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <!-- Left: Search Box -->
        <div class="position-relative flex-grow-1" style="min-width: 200px;">
          <i class="bi bi-search position-absolute top-50 translate-middle-y ms-3 text-muted"></i>
          <input
            v-model="searchQuery"
            type="text"
            class="form-control form-control-sm idp-input ps-5"
            placeholder="Search BE No, Item, HS Code, BIN, LC No..."
          />
        </div>

        <!-- Middle-Left: Reference Filter -->
        <div style="width: 170px;">
          <select v-model="selectedReference" class="form-select form-select-sm idp-input">
            <option value="">All References</option>
            <option v-for="r in references" :key="r.id" :value="r.id">
              {{ r.name }}
            </option>
          </select>
        </div>

        <!-- Middle-Right: Client Filter -->
        <div style="width: 200px;">
          <select v-model="selectedClient" class="form-select form-select-sm idp-input">
            <option value="">All Clients</option>
            <option v-for="c in availableClients" :key="c.id" :value="c.id">
              {{ c.companyName || c.name }}
            </option>
          </select>
        </div>

        <!-- Right: Month Navigator -->
        <div style="width: 210px;">
          <MonthNavigator v-model="selectedMonth" />
        </div>

        <!-- Right Action: Delete Filtered Data Button -->
        <button
          class="btn btn-outline-danger btn-sm px-3 d-flex align-items-center gap-1 flex-shrink-0 fw-semibold"
          style="height: 38px;"
          :disabled="purchases.length === 0 || isLoading"
          title="Delete all purchases matching current month / filter"
          @click="confirmFilteredDelete"
        >
          <i class="bi bi-trash3"></i>
          <span>Delete Filtered</span>
        </button>
      </div>
    </div>

    <!-- Purchases Table Section -->
    <div class="idp-card p-4">
      <!-- Table Header Status Bar -->
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div class="d-flex align-items-center gap-2">
          <span class="text-white fw-bold">Purchase Records</span>
          <span class="badge-count rounded-pill px-3 py-1 font-monospace">
            {{ totalCount }} Total
          </span>
        </div>

        <div class="d-flex align-items-center gap-2">
          <label class="text-muted small mb-0">Rows per page:</label>
          <select
            v-model="itemsPerPage"
            class="form-select form-select-sm idp-input"
            style="width: 80px;"
            @change="currentPage = 1; fetchPurchases()"
          >
            <option :value="10">10</option>
            <option :value="15">15</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </div>
      </div>

      <!-- PURCHASES LEDGER TABLE -->
      <div class="idp-table-wrapper mb-3" style="max-height: 560px; overflow: auto;">
        <table class="table idp-table mb-0 align-middle text-nowrap" style="font-size: 0.85rem;">
          <thead>
            <tr>
              <th class="text-center" style="width: 45px;">#</th>
              <th class="text-center" style="min-width: 90px;">Month</th>
              <th class="text-start" style="min-width: 200px;">Client</th>
              <th class="text-start" style="min-width: 130px;">BE No & Date</th>
              <th class="text-start" style="min-width: 160px;">Item</th>
              <th class="text-start" style="min-width: 130px;">Type</th>
              <th class="text-end" style="min-width: 100px;">Total Qty.</th>
              <th class="text-end" style="min-width: 100px;">Unit Value</th>
              <th class="text-end" style="min-width: 130px;">Base Value Of VAT</th>
              <th class="text-center" style="width: 60px;">Action</th>
            </tr>
          </thead>
          <tbody>
            <!-- Loading State -->
            <tr v-if="isLoading">
              <td colspan="10" class="text-center py-5 text-muted">
                <span class="spinner-border spinner-border-sm text-primary me-2"></span>
                Loading purchases...
              </td>
            </tr>

            <!-- Empty State -->
            <tr v-else-if="purchases.length === 0">
              <td colspan="10" class="text-center py-5 text-muted">
                <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary opacity-50"></i>
                <span>No purchase records found for the selected period / filters.</span>
              </td>
            </tr>

            <!-- Data Rows -->
            <tr v-for="(p, idx) in purchases" :key="p.id">
              <!-- 1. Serial -->
              <td class="text-center text-muted">{{ (currentPage - 1) * itemsPerPage + idx + 1 }}</td>

              <!-- 2. Month -->
              <td class="text-center">
                <span class="badge-month rounded px-2 py-0.5 font-monospace">
                  {{ formatMonthStr(p.month) }}
                </span>
              </td>

              <!-- 3. Client Name & BIN -->
              <td class="text-start">
                <div class="fw-semibold text-white">{{ p.clientName || "Unknown" }}</div>
                <div class="text-muted small font-monospace" style="font-size: 0.75rem;">
                  BIN: {{ p.clientBin || "N/A" }}
                </div>
              </td>

              <!-- 4. BE No & Date -->
              <td class="text-start">
                <div class="font-monospace fw-semibold text-primary">{{ p.beNo || "-" }}</div>
                <div class="text-muted small" style="font-size: 0.75rem;">
                  {{ formatBeDate(p.beDate) }}
                </div>
              </td>

              <!-- 5. Item Name & HS Code -->
              <td class="text-start">
                <div class="fw-medium text-white">{{ p.itemName || "-" }}</div>
                <div class="text-muted font-monospace small" style="font-size: 0.75rem;">
                  [{{ p.hsCode || "-" }}]
                </div>
              </td>

              <!-- 6. Type Badges (Rebate / Non-Rebate & FFS) -->
              <td class="text-start">
                <div class="d-flex flex-wrap gap-1">
                  <span
                    v-if="p.isRebate"
                    class="badge-rebate rounded px-2 py-0.5 fw-medium"
                  >
                    Rebate (15)
                  </span>
                  <span
                    v-else
                    class="badge-nonrebate rounded px-2 py-0.5 fw-medium"
                  >
                    Non-Rebate (22)
                  </span>
                  <span
                    v-if="p.isFfs"
                    class="badge-ffs rounded px-2 py-0.5 fw-medium"
                  >
                    FFS
                  </span>
                </div>
              </td>

              <!-- 7. Total Qty. -->
              <td class="text-end font-monospace fw-semibold text-white">
                {{ formatNumber(p.totalQty) }}
              </td>

              <!-- 8. Unit Value -->
              <td class="text-end font-monospace text-light">
                {{ formatNumber(p.unitValue) }}
              </td>

              <!-- 9. Base Value Of VAT -->
              <td class="text-end font-monospace text-info">
                {{ formatNumber(p.baseValueOfVat) }}
              </td>

              <!-- 10. Action -->
              <td class="text-center">
                <button
                  class="btn btn-sm btn-outline-danger p-1 border-0"
                  title="Delete purchase record"
                  @click="confirmSingleDelete(p.id)"
                >
                  <i class="bi bi-trash fs-6"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination Footer -->
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 pt-3 border-top border-secondary border-opacity-25">
        <div class="text-muted small">
          Showing <strong class="text-white">{{ purchases.length }}</strong> of <strong class="text-white">{{ totalCount }}</strong> purchases
        </div>

        <div class="d-flex align-items-center gap-2">
          <button
            class="btn btn-sm btn-outline-secondary px-3"
            :disabled="currentPage === 1 || isLoading"
            @click="currentPage--"
          >
            Previous
          </button>
          <span class="text-muted small">
            Page <strong class="text-white">{{ currentPage }}</strong> of <strong class="text-white">{{ totalPages }}</strong>
          </span>
          <button
            class="btn btn-sm btn-outline-secondary px-3"
            :disabled="currentPage === totalPages || isLoading"
            @click="currentPage++"
          >
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- CONFIRMATION DELETE MODAL -->
    <div v-if="showDeleteModal" class="modal-backdrop-idp">
      <div class="modal-dialog-idp modal-md">
        <div class="idp-card p-4">
          <div class="d-flex align-items-center gap-2 border-bottom border-secondary border-opacity-25 pb-3 mb-3">
            <i class="bi bi-exclamation-triangle-fill text-danger fs-5"></i>
            <h5 class="text-white fw-bold mb-0">Confirm Delete Action</h5>
          </div>

          <div class="py-2">
            <template v-if="deleteTargetType === 'single'">
              <p class="text-white mb-2">
                Are you sure you want to permanently delete this purchase record?
              </p>
              <p class="text-muted small mb-0">
                This action cannot be undone and will remove the item from this client's purchase ledger.
              </p>
            </template>

            <template v-else>
              <p class="text-white mb-2">
                Are you sure you want to delete all purchases for <strong class="text-danger">{{ formatMonthStr(selectedMonth) }}</strong>?
              </p>
              <p class="text-muted small mb-0">
                This will delete all matching purchase entries for this period. This action is irreversible.
              </p>
            </template>
          </div>

          <div class="d-flex justify-content-end gap-2 pt-3 mt-3 border-top border-secondary border-opacity-25">
            <button
              class="btn btn-outline-secondary px-3"
              :disabled="isDeleting"
              @click="showDeleteModal = false"
            >
              Cancel
            </button>
            <button
              class="btn btn-danger px-4"
              :disabled="isDeleting"
              @click="executeDelete"
            >
              <span v-if="isDeleting" class="spinner-border spinner-border-sm me-1"></span>
              <span>{{ isDeleting ? "Deleting..." : "Delete Permanently" }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Badge Design System */
.badge-count {
  display: inline-flex;
  align-items: center;
  background-color: rgba(59, 130, 246, 0.15) !important;
  color: #60a5fa !important;
  border: 1px solid rgba(59, 130, 246, 0.3) !important;
  font-size: 0.75rem;
  font-weight: 600;
}

.badge-month {
  display: inline-block;
  background-color: rgba(245, 158, 11, 0.15) !important;
  color: #fbbf24 !important;
  border: 1px solid rgba(245, 158, 11, 0.3) !important;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.badge-rebate {
  display: inline-block;
  background-color: rgba(16, 185, 129, 0.15) !important;
  color: #34d399 !important;
  border: 1px solid rgba(16, 185, 129, 0.3) !important;
  font-size: 0.7rem;
  white-space: nowrap;
}

.badge-nonrebate {
  display: inline-block;
  background-color: rgba(148, 163, 184, 0.15) !important;
  color: #94a3b8 !important;
  border: 1px solid rgba(148, 163, 184, 0.3) !important;
  font-size: 0.7rem;
  white-space: nowrap;
}

.badge-ffs {
  display: inline-block;
  background-color: rgba(168, 85, 247, 0.15) !important;
  color: #c084fc !important;
  border: 1px solid rgba(168, 85, 247, 0.3) !important;
  font-size: 0.7rem;
  white-space: nowrap;
}

.modal-backdrop-idp {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-dialog-idp {
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-dialog-idp.modal-md { max-width: 480px; }
</style>
