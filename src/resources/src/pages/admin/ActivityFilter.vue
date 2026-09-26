<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import * as XLSX from "xlsx";
import MonthNavigator from "@/components/MonthNavigator.vue";
import { useActivityFilterApi, type ActivityClient } from "@/composables/useActivityFilterApi";

const router = useRouter();
const { loading, matrixData, stats, clientTypes, references, loadActivityMatrix } = useActivityFilterApi();

// Previous Month setup (Default to previous month, e.g. "2026-08" for September 2026)
const getPreviousMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const selectedMonth = ref(getPreviousMonth());
const searchQuery = ref("");
const statusFilter = ref<
  | "all"
  | "active"
  | "inactive"
  | "active_filed"
  | "active_unfiled"
  | "inactive_filed"
  | "inactive_unfiled"
  | "total_filed"
  | "total_unfiled"
>("all");
const selectedClientType = ref<string>("all");
const selectedReference = ref<string>("all");
const currentPage = ref(1);
const itemsPerPage = 10;

// Password visibility & clipboard copy state
const visiblePasswords = ref<Record<number, boolean>>({});
const copiedField = ref<string | null>(null);

const togglePasswordVisibility = (id: number) => {
  visiblePasswords.value[id] = !visiblePasswords.value[id];
};

const copyToClipboard = async (text?: string, key?: string) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    if (key) {
      copiedField.value = key;
      setTimeout(() => {
        if (copiedField.value === key) copiedField.value = null;
      }, 1500);
    }
  } catch (err) {
    console.error("Failed to copy:", err);
  }
};

// Format BIN (e.g. 001234567-0101)
const formatBin = (rawBin?: string) => {
  if (!rawBin) return "—";
  const digits = rawBin.replace(/\D/g, "");
  if (digits.length === 13) {
    return `${digits.slice(0, 9)}-${digits.slice(9)}`;
  }
  return rawBin;
};

// Format Currency Amount
const formatCurrency = (amount: number) => {
  if (!amount || amount === 0) return "0.00";
  return amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Summary metrics computed dynamically from matrixData matching dropdown filters
const clientsMatchingDropdowns = computed(() => {
  let list = matrixData.value;
  if (selectedClientType.value !== "all") {
    list = list.filter((c) => c.clientType === selectedClientType.value);
  }
  if (selectedReference.value !== "all") {
    list = list.filter((c) => c.reference === selectedReference.value);
  }
  return list;
});

const totalClientsCount = computed(() => clientsMatchingDropdowns.value.length);

const activeClientsCount = computed(() => {
  return clientsMatchingDropdowns.value.filter((c) => (c.purchaseAmount || 0) > 0).length;
});

const activeFiledClientsCount = computed(() => {
  return clientsMatchingDropdowns.value.filter(
    (c) => (c.purchaseAmount || 0) > 0 && c.isSubmitted
  ).length;
});

const activeUnfiledClientsCount = computed(() => {
  return clientsMatchingDropdowns.value.filter(
    (c) => (c.purchaseAmount || 0) > 0 && !c.isSubmitted
  ).length;
});

const inactiveClientsCount = computed(() => {
  return clientsMatchingDropdowns.value.filter((c) => (c.purchaseAmount || 0) === 0).length;
});

const inactiveFiledClientsCount = computed(() => {
  return clientsMatchingDropdowns.value.filter(
    (c) => (c.purchaseAmount || 0) === 0 && c.isSubmitted
  ).length;
});

const inactiveUnfiledClientsCount = computed(() => {
  return clientsMatchingDropdowns.value.filter(
    (c) => (c.purchaseAmount || 0) === 0 && !c.isSubmitted
  ).length;
});

const totalFiledClientsCount = computed(() => {
  return clientsMatchingDropdowns.value.filter((c) => c.isSubmitted).length;
});

const totalUnfiledClientsCount = computed(() => {
  return clientsMatchingDropdowns.value.filter((c) => !c.isSubmitted).length;
});

const totalMonthPurchaseSum = computed(() => {
  return clientsMatchingDropdowns.value.reduce((acc, c) => acc + (c.purchaseAmount || 0), 0);
});

// Filter by search, status tab, client type, and reference
const filteredClients = computed(() => {
  let list = clientsMatchingDropdowns.value;

  // 1. Status Filter
  if (statusFilter.value === "active") {
    list = list.filter((c) => (c.purchaseAmount || 0) > 0);
  } else if (statusFilter.value === "active_filed") {
    list = list.filter((c) => (c.purchaseAmount || 0) > 0 && c.isSubmitted);
  } else if (statusFilter.value === "active_unfiled") {
    list = list.filter((c) => (c.purchaseAmount || 0) > 0 && !c.isSubmitted);
  } else if (statusFilter.value === "inactive") {
    list = list.filter((c) => (c.purchaseAmount || 0) === 0);
  } else if (statusFilter.value === "inactive_filed") {
    list = list.filter((c) => (c.purchaseAmount || 0) === 0 && c.isSubmitted);
  } else if (statusFilter.value === "inactive_unfiled") {
    list = list.filter((c) => (c.purchaseAmount || 0) === 0 && !c.isSubmitted);
  } else if (statusFilter.value === "total_filed") {
    list = list.filter((c) => c.isSubmitted);
  } else if (statusFilter.value === "total_unfiled") {
    list = list.filter((c) => !c.isSubmitted);
  }

  // 2. Search Filter
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.bin && c.bin.includes(q)) ||
        (c.username && c.username.toLowerCase().includes(q)) ||
        (c.password && c.password.toLowerCase().includes(q)) ||
        (c.clientType && c.clientType.toLowerCase().includes(q)) ||
        (c.reference && c.reference.toLowerCase().includes(q)) ||
        (c.submission?.submissionId && c.submission.submissionId.toLowerCase().includes(q)) ||
        (c.submission?.submittedBy && c.submission.submittedBy.toLowerCase().includes(q))
    );
  }

  return list;
});

// Pagination computed
const totalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredClients.value.length / itemsPerPage));
});

const paginatedClients = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredClients.value.slice(start, start + itemsPerPage);
});

// Card click filter function
const selectCardFilter = (filter: typeof statusFilter.value) => {
  statusFilter.value = filter;
  currentPage.value = 1;
};

// Quick filter by clicking a Reference badge
const filterBySpecificReference = (refName: string) => {
  selectedReference.value = refName;
  currentPage.value = 1;
};

// Export to Excel
const exportToExcel = () => {
  const exportRows = filteredClients.value.map((c, idx) => ({
    "Sl No": idx + 1,
    "Company Name": c.name,
    "BIN": c.bin || "N/A",
    "VAT Username": c.username || "—",
    "Customer Type": c.clientType,
    "Reference": c.reference,
    "Tax Period": selectedMonth.value,
    "Purchase Amount (Tk)": c.purchaseAmount || 0,
    "Submission Status": c.isSubmitted ? "Submitted" : "Not-Filed",
    "Submission ID": c.submission?.submissionId || "Pending",
    "Submitted By": c.submission?.submittedBy || "—"
  }));

  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Activity Filter");
  XLSX.writeFile(wb, `IDP_Activity_Filter_${selectedMonth.value}.xlsx`);
};

// Print
const printReport = () => {
  window.print();
};

// Watchers
watch(selectedMonth, (newMonth) => {
  currentPage.value = 1;
  loadActivityMatrix(newMonth);
});

watch([searchQuery, statusFilter, selectedClientType, selectedReference], () => {
  currentPage.value = 1;
});

onMounted(() => {
  loadActivityMatrix(selectedMonth.value);
});
</script>

<template>
  <div class="activity-filter-page py-2">
    <!-- Header with Action Buttons -->
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Dashboard
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">Activity Filter</span>
        </div>
        <h4 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
          <i class="bi bi-funnel-fill text-primary"></i>
          <span>Client Purchase Activity Filter</span>
        </h4>
        <span class="text-muted small">
          Monitor monthly purchase transactions & submission statuses across all client organizations
        </span>
      </div>

      <!-- Action Buttons -->
      <div class="d-flex align-items-center gap-2 d-print-none flex-wrap">
        <!-- Export Excel -->
        <button
          type="button"
          class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 px-3"
          @click="exportToExcel"
        >
          <i class="bi bi-file-earmark-excel text-success"></i>
          <span>Export Excel</span>
        </button>

        <!-- Print -->
        <button
          type="button"
          class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 px-3"
          @click="printReport"
        >
          <i class="bi bi-printer text-light"></i>
          <span>Print</span>
        </button>
      </div>
    </div>

    <!-- 3 Compact Space-Saving Summary Cards -->
    <div class="row g-3 mb-4">
      <!-- 1. Total Clients Card -->
      <div class="col-md-4">
        <div
          class="summary-card"
          :class="{ active: statusFilter === 'all' || statusFilter === 'total_filed' || statusFilter === 'total_unfiled' }"
          @click="selectCardFilter('all')"
        >
          <div class="d-flex justify-content-between align-items-center mb-1">
            <div class="d-flex align-items-baseline gap-2">
              <span class="card-label text-muted mb-0">Total Clients:</span>
              <span class="card-value text-white">{{ totalClientsCount }}</span>
            </div>
            <div class="card-icon-wrap icon-blue">
              <i class="bi bi-building"></i>
            </div>
          </div>
          <div class="card-sub text-muted mb-2">
            <i class="bi bi-funnel me-1"></i> Click to filter all clients
          </div>

          <!-- Sub-Status Badges -->
          <div class="d-flex align-items-center gap-2 pt-2 border-top border-secondary border-opacity-25" @click.stop>
            <span
              class="sub-stat-chip cursor-pointer"
              :class="{ 'chip-active-green': statusFilter === 'total_filed' }"
              title="Click to view total filed clients"
              @click="selectCardFilter('total_filed')"
            >
              <i class="bi bi-check2"></i> Filed: {{ totalFiledClientsCount }}
            </span>
            <span
              class="sub-stat-chip cursor-pointer"
              :class="{ 'chip-active-red': statusFilter === 'total_unfiled' }"
              title="Click to view total clients missing submission ID"
              @click="selectCardFilter('total_unfiled')"
            >
              <i class="bi bi-exclamation-circle"></i> Missing ID: {{ totalUnfiledClientsCount }}
            </span>
          </div>
        </div>
      </div>

      <!-- 2. Active Purchases Card -->
      <div class="col-md-4">
        <div
          class="summary-card"
          :class="{ active: statusFilter === 'active' || statusFilter === 'active_filed' || statusFilter === 'active_unfiled' }"
          @click="selectCardFilter('active')"
        >
          <div class="d-flex justify-content-between align-items-center mb-1">
            <div class="d-flex align-items-baseline gap-2">
              <span class="card-label text-muted mb-0">Active Purchases:</span>
              <span class="card-value text-success">{{ activeClientsCount }}</span>
            </div>
            <div class="card-icon-wrap icon-green">
              <i class="bi bi-cart-check"></i>
            </div>
          </div>
          <div class="card-sub text-success mb-2">
            <i class="bi bi-check-circle me-1"></i> Total Volume: {{ formatCurrency(totalMonthPurchaseSum) }} Tk
          </div>

          <!-- Sub-Status Badges -->
          <div class="d-flex align-items-center gap-2 pt-2 border-top border-secondary border-opacity-25" @click.stop>
            <span
              class="sub-stat-chip cursor-pointer"
              :class="{ 'chip-active-green': statusFilter === 'active_filed' }"
              title="Click to view active clients with submission ID"
              @click="selectCardFilter('active_filed')"
            >
              <i class="bi bi-check2"></i> Filed: {{ activeFiledClientsCount }}
            </span>
            <span
              class="sub-stat-chip cursor-pointer"
              :class="{ 'chip-active-red': statusFilter === 'active_unfiled' }"
              title="Click to view active clients MISSING submission ID"
              @click="selectCardFilter('active_unfiled')"
            >
              <i class="bi bi-exclamation-triangle-fill text-danger"></i> Missing ID: {{ activeUnfiledClientsCount }}
            </span>
          </div>
        </div>
      </div>

      <!-- 3. No Activity This Month Card (Nil Returns) -->
      <div class="col-md-4">
        <div
          class="summary-card"
          :class="{ active: statusFilter === 'inactive' || statusFilter === 'inactive_filed' || statusFilter === 'inactive_unfiled' }"
          @click="selectCardFilter('inactive')"
        >
          <div class="d-flex justify-content-between align-items-center mb-1">
            <div class="d-flex align-items-baseline gap-2">
              <span class="card-label text-muted mb-0">No Purchases:</span>
              <span class="card-value text-secondary">{{ inactiveClientsCount }}</span>
            </div>
            <div class="card-icon-wrap icon-gray">
              <i class="bi bi-cart-x"></i>
            </div>
          </div>
          <div class="card-sub text-muted mb-2">
            <i class="bi bi-dash-circle me-1"></i> No purchases recorded this month
          </div>

          <!-- Sub-Status Badges -->
          <div class="d-flex align-items-center gap-2 pt-2 border-top border-secondary border-opacity-25" @click.stop>
            <span
              class="sub-stat-chip cursor-pointer"
              :class="{ 'chip-active-green': statusFilter === 'inactive_filed' }"
              title="Click to view nil clients with submission ID"
              @click="selectCardFilter('inactive_filed')"
            >
              <i class="bi bi-check2"></i> Filed: {{ inactiveFiledClientsCount }}
            </span>
            <span
              class="sub-stat-chip cursor-pointer"
              :class="{ 'chip-active-red': statusFilter === 'inactive_unfiled' }"
              title="Click to view nil clients MISSING submission ID"
              @click="selectCardFilter('inactive_unfiled')"
            >
              <i class="bi bi-exclamation-circle text-danger"></i> Missing ID: {{ inactiveUnfiledClientsCount }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <!-- Left: Search Input, Client Type Dropdown, Reference Dropdown -->
      <div class="d-flex flex-wrap align-items-center gap-2 flex-grow-1" style="max-width: 800px;">
        <!-- Search Input -->
        <div class="position-relative flex-grow-1" style="min-width: 220px;">
          <i class="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
          <input
            v-model="searchQuery"
            type="text"
            class="form-control form-control-sm idp-input"
            style="padding: 0 14px 0 40px !important; height: 38px;"
            placeholder="Search company, BIN, username, ref..."
          />
        </div>

        <!-- 1. Client Type Dropdown Filter -->
        <div style="min-width: 170px;">
          <select
            v-model="selectedClientType"
            class="form-select form-select-sm idp-input"
            style="height: 38px;"
          >
            <option value="all">All Types ({{ clientTypes.length }})</option>
            <option v-for="typeObj in clientTypes" :key="typeObj.id" :value="typeObj.name">
              {{ typeObj.name }}
            </option>
          </select>
        </div>

        <!-- 2. Reference Dropdown Filter -->
        <div style="min-width: 180px;">
          <select
            v-model="selectedReference"
            class="form-select form-select-sm idp-input"
            style="height: 38px;"
          >
            <option value="all">All References ({{ references.length }})</option>
            <option v-for="refObj in references" :key="refObj.id" :value="refObj.name">
              {{ refObj.name }}
            </option>
          </select>
        </div>
      </div>

      <!-- Right: Month Navigator (Equal 38px Height) -->
      <div class="d-flex align-items-center gap-2 ms-auto flex-shrink-0" style="width: 200px;">
        <MonthNavigator v-model="selectedMonth" />
      </div>
    </div>

    <!-- Active Filter Chips Bar -->
    <div v-if="selectedClientType !== 'all' || selectedReference !== 'all'" class="d-flex flex-wrap align-items-center gap-2 mb-3">
      <span class="text-muted small">Active Filters:</span>
      
      <!-- Client Type Chip -->
      <span v-if="selectedClientType !== 'all'" class="badge bg-info text-dark d-inline-flex align-items-center gap-1">
        <i class="bi bi-tag-fill"></i> Type: {{ selectedClientType }}
        <i class="bi bi-x cursor-pointer ms-1" @click="selectedClientType = 'all'"></i>
      </span>

      <!-- Reference Chip -->
      <span v-if="selectedReference !== 'all'" class="badge bg-primary d-inline-flex align-items-center gap-1">
        <i class="bi bi-person-lines-fill"></i> Ref: {{ selectedReference }}
        <i class="bi bi-x cursor-pointer ms-1" @click="selectedReference = 'all'"></i>
      </span>

      <button
        class="btn btn-link btn-sm text-muted text-decoration-none p-0 small ms-1"
        @click="selectedClientType = 'all'; selectedReference = 'all';"
      >
        Clear All
      </button>
    </div>

    <!-- Activity Clients Table Card -->
    <div class="table-card shadow-sm">
      <table class="table-custom">
        <thead>
          <tr>
            <th style="width: 50px;">#</th>
            <th>Company & BIN</th>
            <th style="width: 150px;">Username</th>
            <th style="width: 165px;">Password</th>
            <th style="width: 185px;">Reference</th>
            <th style="width: 160px;">Submission ID</th>
            <th style="width: 160px;">Submitted By</th>
          </tr>
        </thead>
        <tbody>
          <!-- Loading State -->
          <tr v-if="loading && matrixData.length === 0">
            <td colspan="7" class="text-center py-5 text-muted">
              <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
              Loading client activity matrix from database...
            </td>
          </tr>

          <!-- Client Rows -->
          <tr v-else-if="paginatedClients.length > 0" v-for="(client, index) in paginatedClients" :key="client.id">
            <!-- 1. Serial # -->
            <td class="text-muted font-monospace">
              {{ (currentPage - 1) * itemsPerPage + index + 1 }}
            </td>

            <!-- 2. Company Name & BIN Combined -->
            <td>
              <div>
                <div class="d-flex align-items-center gap-2">
                  <span
                    class="status-indicator-dot"
                    :class="(client.purchaseAmount || 0) > 0 ? 'dot-active' : 'dot-inactive'"
                  ></span>
                  <span class="text-white fw-semibold">{{ client.name }}</span>
                </div>
                <div class="text-info font-monospace" style="margin-left: 16px; font-size: 0.77rem; letter-spacing: 0.3px;">
                  BIN: {{ formatBin(client.bin) }}
                </div>
              </div>
            </td>

            <!-- 3. Username -->
            <td>
              <div v-if="client.username" class="d-flex align-items-center gap-1">
                <span class="text-light font-monospace small user-select-all cred-text">{{ client.username }}</span>
                <button
                  type="button"
                  class="btn btn-link btn-sm p-0 text-muted copy-icon-btn"
                  title="Copy Username"
                  @click="copyToClipboard(client.username, 'user-' + client.id)"
                >
                  <i class="bi" :class="copiedField === 'user-' + client.id ? 'bi-check2 text-success' : 'bi-copy'"></i>
                </button>
              </div>
              <span v-else class="text-muted small">—</span>
            </td>

            <!-- 4. Password -->
            <td>
              <div v-if="client.password" class="d-flex align-items-center gap-1">
                <span class="text-light font-monospace small cred-text">
                  {{ visiblePasswords[client.id] ? client.password : '••••••••' }}
                </span>
                <button
                  type="button"
                  class="btn btn-link btn-sm p-0 text-muted copy-icon-btn ms-1"
                  :title="visiblePasswords[client.id] ? 'Hide Password' : 'Show Password'"
                  @click="togglePasswordVisibility(client.id)"
                >
                  <i class="bi" :class="visiblePasswords[client.id] ? 'bi-eye-slash text-info' : 'bi-eye'"></i>
                </button>
                <button
                  type="button"
                  class="btn btn-link btn-sm p-0 text-muted copy-icon-btn ms-1"
                  title="Copy Password"
                  @click="copyToClipboard(client.password, 'pass-' + client.id)"
                >
                  <i class="bi" :class="copiedField === 'pass-' + client.id ? 'bi-check2 text-success' : 'bi-copy'"></i>
                </button>
              </div>
              <span v-else class="text-muted small">—</span>
            </td>

            <!-- 5. Reference -->
            <td>
              <div
                v-if="client.reference"
                class="d-inline-flex align-items-center gap-1 text-light cursor-pointer ref-link"
                title="Click to filter by this reference"
                @click="filterBySpecificReference(client.reference)"
              >
                <i class="bi bi-person text-primary small"></i>
                <span>{{ client.reference }}</span>
              </div>
              <span v-else class="text-muted small">—</span>
            </td>

            <!-- 6. Submission ID -->
            <td>
              <span
                v-if="client.isSubmitted && client.submission?.submissionId"
                class="text-info font-monospace fw-semibold"
              >
                {{ client.submission.submissionId }}
              </span>
              <span
                v-else
                class="badge badge-not-filed font-monospace"
              >
                Not-Filed
              </span>
            </td>

            <!-- 7. Submitted By -->
            <td>
              <div v-if="client.submission?.submittedBy" class="d-flex align-items-center gap-1">
                <i class="bi bi-person text-secondary small"></i>
                <span class="text-light small fw-medium">{{ client.submission.submittedBy }}</span>
              </div>
              <span v-else class="text-muted small">—</span>
            </td>
          </tr>

          <!-- Empty State -->
          <tr v-else>
            <td colspan="7" class="text-center py-5 text-muted">
              <i class="bi bi-inbox fs-3 d-block mb-2 text-secondary"></i>
              No client records found matching the current filters.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="filteredClients.length > 0" class="d-flex flex-wrap justify-content-between align-items-center mt-3 pt-2">
      <span class="text-muted small">
        Showing <strong>{{ (currentPage - 1) * itemsPerPage + 1 }}</strong> to
        <strong>{{ Math.min(currentPage * itemsPerPage, filteredClients.length) }}</strong> of
        <strong>{{ filteredClients.length }}</strong> clients ({{ itemsPerPage }} per page)
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
  </div>
</template>

<style scoped>
.activity-filter-page {
  font-family: 'Inter', sans-serif;
  color: #f8f9fa;
}

/* 3 Clickable Compact Summary Cards */
.summary-card {
  background: #1e2227;
  border: 1px solid #343a40;
  border-radius: 8px;
  padding: 0.95rem 1.15rem;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
}
.summary-card:hover {
  background: #282d33;
  border-color: #49515a;
  transform: translateY(-2px);
}
.summary-card.active {
  border-color: #3b8eed !important;
  background: #222933 !important;
  box-shadow: 0 4px 12px rgba(59, 142, 237, 0.15);
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

/* Sub-Stat Badges */
.sub-stat-chip {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #adb5bd;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.sub-stat-chip:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.25);
}
.sub-stat-chip.chip-active-green {
  background: rgba(32, 201, 151, 0.2) !important;
  border-color: #20c997 !important;
  color: #20c997 !important;
}
.sub-stat-chip.chip-active-red {
  background: rgba(220, 53, 69, 0.2) !important;
  border-color: #dc3545 !important;
  color: #ff6b6b !important;
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
  background: #dc3545;
  box-shadow: 0 0 6px rgba(220, 53, 69, 0.6);
}

/* Table Card & Styles */
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
  font-size: 0.8rem;
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
}
.table-custom tbody tr:hover {
  background-color: #242930;
}
.ref-link {
  font-size: 0.84rem;
  transition: color 0.15s ease;
}
.ref-link:hover {
  color: #3b8eed !important;
  text-decoration: underline;
}
.cred-text {
  font-size: 0.82rem;
  letter-spacing: 0.3px;
}
.copy-icon-btn {
  font-size: 0.8rem;
  line-height: 1;
  opacity: 0.65;
  transition: opacity 0.15s, color 0.15s;
}
.copy-icon-btn:hover {
  opacity: 1;
  color: #0dcaf0 !important;
}
.badge-not-filed {
  background-color: #ffffff !important;
  color: #dc2626 !important;
  border: 1px solid #dc2626 !important;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 3px 8px;
  letter-spacing: 0.3px;
  border-radius: 4px;
}
.cursor-pointer {
  cursor: pointer;
}
.idp-input {
  background-color: #181b1f !important;
  border: 1px solid #3b424b !important;
  color: #f8f9fa !important;
  border-radius: 6px;
  font-size: 0.86rem;
}
.idp-input:focus {
  border-color: #3b8eed !important;
  box-shadow: 0 0 0 0.15rem rgba(59, 142, 237, 0.25) !important;
}
</style>
