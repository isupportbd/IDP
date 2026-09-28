<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import MonthNavigator from "@/components/MonthNavigator.vue";
import SearchInput from "@/components/common/SearchInput.vue";
import StatusBadge from "@/components/common/StatusBadge.vue";
import { useBillingApi, type Bill, type Collection } from "@/composables/useBillingApi";
import { useServicesApi } from "@/composables/useServicesApi";
import { useClientsApi } from "@/composables/useClientsApi";
import { useToast } from "@/composables/useToast";

const router = useRouter();
const toast = useToast();

const {
  bills,
  collections,
  missingBills,
  stats,
  totalCollectionsAmount,
  loading,
  fetchBills,
  fetchCollections,
  fetchMissingBills,
  batchGenerateBills,
  deleteBill,
  cancelCollection
} = useBillingApi();

const { customerTypes, references, fetchCustomerTypes, fetchReferences } = useServicesApi();
const { assignableUsers, fetchAssignableUsers } = useClientsApi();

// Active View Tab
const activeTab = ref<"invoices" | "collections" | "billed" | "dues" | "missing">("invoices");

// Period State
const getLastMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};
const selectedMonth = ref(getLastMonth());

// Filters
const searchQuery = ref("");
const selectedCustomerTypeId = ref<number | "all">("all");
const selectedReferenceId = ref<number | "all">("all");
const selectedStatusFilter = ref<string>("all");
const selectedPaymentMethod = ref<string>("all");

// Batch Generating State
const isBatchGenerating = ref(false);

// Load data based on active tab and filters
const loadData = async () => {
  try {
    await Promise.all([
      fetchBills({
        month: selectedMonth.value,
        customerTypeId: selectedCustomerTypeId.value,
        referenceId: selectedReferenceId.value,
        status: selectedStatusFilter.value,
        search: searchQuery.value
      }),
      fetchCollections({
        month: selectedMonth.value,
        paymentMethod: selectedPaymentMethod.value,
        search: searchQuery.value
      }),
      fetchMissingBills(selectedMonth.value),
      fetchCustomerTypes(),
      fetchReferences(),
      fetchAssignableUsers()
    ]);
  } catch (err: any) {
    toast.error("Failed to load billing data");
  }
};

onMounted(() => {
  loadData();
});

watch([selectedMonth, selectedCustomerTypeId, selectedReferenceId, selectedStatusFilter, selectedPaymentMethod, searchQuery], () => {
  loadData();
});

// Filtered Lists for Tabs
const billedClientsList = computed(() => {
  return bills.value;
});

const dueClientsList = computed(() => {
  return bills.value.filter((b) => b.dueAmount > 0);
});

// Pagination State (10 items per page)
const currentPage = ref(1);
const itemsPerPage = 10;

const currentTabList = computed<any[]>(() => {
  if (activeTab.value === 'dues') return dueClientsList.value;
  if (activeTab.value === 'collections') return collections.value;
  if (activeTab.value === 'missing') return missingBills.value;
  return bills.value;
});

const totalPages = computed(() => Math.ceil(currentTabList.value.length / itemsPerPage) || 1);

const paginatedList = computed<any[]>(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return currentTabList.value.slice(start, start + itemsPerPage);
});

watch([activeTab, selectedMonth, selectedCustomerTypeId, selectedReferenceId, selectedStatusFilter, selectedPaymentMethod, searchQuery], () => {
  currentPage.value = 1;
});

// Navigate to Create Invoice (Full Page)
const goToCreateBill = (clientId?: number, month?: string) => {
  const query: any = {};
  if (clientId) query.clientId = clientId;
  if (month) query.month = month;
  else query.month = selectedMonth.value;
  router.push({ path: "/admin/billing/create", query });
};

// Navigate to Receive Payment (Full Page)
const goToCreateCollection = (clientId?: number, billId?: number) => {
  const query: any = {};
  if (clientId) query.clientId = clientId;
  if (billId) query.billId = billId;
  router.push({ path: "/admin/billing/collections/create", query });
};

// Batch Generate Missing Bills
const handleBatchGenerate = async () => {
  const eligibleCount = missingBills.value.filter((m) => m.isSubmitted).length;
  if (eligibleCount === 0) {
    toast.error("No eligible clients with finalized submissions found for this month");
    return;
  }

  if (
    !confirm(
      `Generate monthly bills for ${eligibleCount} eligible clients for ${selectedMonth.value}?`
    )
  ) {
    return;
  }

  isBatchGenerating.value = true;
  try {
    const res = await batchGenerateBills({
      taxPeriod: selectedMonth.value
    });
    await loadData();
    activeTab.value = "invoices";
  } catch (err: any) {
    // Toast handled in composable
  } finally {
    isBatchGenerating.value = false;
  }
};

// Delete / Cancel Actions
const handleDeleteBill = async (bill: Bill) => {
  if (!confirm(`Are you sure you want to delete invoice ${bill.billNo} for ${bill.clientName}?`)) {
    return;
  }
  try {
    await deleteBill(bill.id);
    await loadData();
  } catch (err: any) {
    // Handled
  }
};

const handleCancelReceipt = async (col: Collection) => {
  if (!confirm(`Are you sure you want to cancel payment receipt ${col.receiptNo}?`)) {
    return;
  }
  try {
    await cancelCollection(col.id);
    await loadData();
  } catch (err: any) {
    // Handled
  }
};

// Excel Export
const exportToExcel = async () => {
  let exportRows: any[] = [];
  if (activeTab.value === "invoices" || activeTab.value === "billed" || activeTab.value === "dues") {
    const source = activeTab.value === "dues" ? dueClientsList.value : bills.value;
    exportRows = source.map((b) => ({
      "Invoice No": b.billNo,
      "Client Organization": b.clientName,
      "BIN Number": b.clientBin || "N/A",
      "Customer Type": b.customerTypeName || "Standard",
      "Reference": b.referenceName || "N/A",
      "Tax Period": b.taxPeriod,
      "Bill Date": new Date(b.billDate).toLocaleDateString(),
      "Subtotal (Tk)": b.subtotal,
      "Discount (Tk)": b.discountAmount,
      "Previous Due (Tk)": b.previousDue,
      "Grand Total (Tk)": b.grandTotal,
      "Paid Amount (Tk)": b.paidAmount,
      "Due Amount (Tk)": b.dueAmount,
      "Status": b.status.toUpperCase()
    }));
  } else if (activeTab.value === "collections") {
    exportRows = collections.value.map((c) => ({
      "Receipt No": c.receiptNo,
      "Client Organization": c.clientName,
      "Collection Date": new Date(c.collectionDate).toLocaleDateString(),
      "Payment Method": c.paymentMethod.toUpperCase(),
      "Collected Amount (Tk)": c.amount,
      "Reference No": c.referenceNo || "N/A",
      "Notes": c.notes || "",
      "Status": c.status.toUpperCase()
    }));
  } else if (activeTab.value === "missing") {
    exportRows = missingBills.value.map((m) => ({
      "Client Organization": m.companyName,
      "BIN Number": m.binNumber || "N/A",
      "Service Scope": m.vatServiceType,
      "Target Month": m.targetMonth,
      "Submission ID": m.submissionId || "Pending",
      "Status": m.isSubmitted ? "Ready to Bill" : "Pending Submission",
      "Previous Due (Tk)": m.previousDue,
      "Service Fee (Tk)": m.monthlyServiceFee
    }));
  }

  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(exportRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Billing Data");
  XLSX.writeFile(wb, `IDP_Billing_${activeTab.value}_${selectedMonth.value}.xlsx`);
  toast.success("Excel report exported successfully");
};

// Print Report
const printReport = () => {
  window.print();
};
</script>

<template>
  <div class="billing-page py-2">
    <!-- Header with Action Buttons -->
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Dashboard
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">Billing & Collections</span>
        </div>
        <h4 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
          <i class="bi bi-cash-stack text-primary"></i>
          <span>Billing, Invoicing & Collections</span>
        </h4>
      </div>

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
          <i class="bi bi-printer text-info"></i>
          <span>Print</span>
        </button>

        <!-- Receive Payment (Full Page) -->
        <button
          type="button"
          class="btn btn-outline-success btn-sm d-flex align-items-center gap-1 px-3 fw-semibold shadow-sm"
          @click="goToCreateCollection()"
        >
          <i class="bi bi-wallet2"></i>
          <span>Receive Payment</span>
        </button>

        <!-- Create Invoice (Full Page) -->
        <button
          type="button"
          class="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 fw-semibold shadow-sm"
          @click="goToCreateBill()"
        >
          <i class="bi bi-plus-lg"></i>
          <span>Create Invoice</span>
        </button>
      </div>
    </div>

    <!-- Quick Stats Cards -->
    <div class="row g-3 mb-3 d-print-none">
      <!-- Total Invoices -->
      <div class="col-6 col-md-3">
        <div
          class="stat-pill cursor-pointer"
          :class="{ 'stat-pill-active': activeTab === 'invoices' }"
          @click="activeTab = 'invoices'"
        >
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="text-muted stat-label">Total Invoiced</span>
            <i class="bi bi-receipt text-primary"></i>
          </div>
          <div class="stat-val text-white">{{ stats.totalBilledAmount.toLocaleString() }} <span class="fs-6 fw-normal text-muted">Tk</span></div>
          <div class="text-secondary small mt-1 font-monospace">{{ stats.totalInvoicesCount }} Invoices</div>
        </div>
      </div>

      <!-- Total Collections -->
      <div class="col-6 col-md-3">
        <div
          class="stat-pill cursor-pointer"
          :class="{ 'stat-pill-active': activeTab === 'collections' }"
          @click="activeTab = 'collections'"
        >
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="text-muted stat-label">Total Collections</span>
            <i class="bi bi-check-circle-fill text-success"></i>
          </div>
          <div class="stat-val text-success">{{ totalCollectionsAmount.toLocaleString() }} <span class="fs-6 fw-normal text-muted">Tk</span></div>
          <div class="text-secondary small mt-1 font-monospace">{{ collections.length }} Receipts</div>
        </div>
      </div>

      <!-- Total Outstanding Dues -->
      <div class="col-6 col-md-3">
        <div
          class="stat-pill cursor-pointer"
          :class="{ 'stat-pill-active': activeTab === 'dues' }"
          @click="activeTab = 'dues'"
        >
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="text-muted stat-label">Total Dues</span>
            <i class="bi bi-exclamation-octagon text-danger"></i>
          </div>
          <div class="stat-val text-danger">{{ stats.totalDueAmount.toLocaleString() }} <span class="fs-6 fw-normal text-muted">Tk</span></div>
          <div class="text-secondary small mt-1 font-monospace">{{ dueClientsList.length }} Due Invoices</div>
        </div>
      </div>

      <!-- Missing Bills -->
      <div class="col-6 col-md-3">
        <div
          class="stat-pill cursor-pointer"
          :class="{ 'stat-pill-active': activeTab === 'missing' }"
          @click="activeTab = 'missing'"
        >
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="text-muted stat-label">Missing Bills</span>
            <i class="bi bi-clock-history text-warning"></i>
          </div>
          <div class="stat-val text-warning">{{ missingBills.length }} <span class="fs-6 fw-normal text-muted">Clients</span></div>
          <div class="text-secondary small mt-1 font-monospace">{{ missingBills.filter(m => m.isSubmitted).length }} Ready to Bill</div>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs & Toolbar -->
    <div class="filter-panel p-2 mb-3 d-print-none d-flex align-items-center justify-content-between gap-3 flex-wrap">
      <!-- Left: Navigation Tabs with matching 38px height -->
      <div class="d-flex align-items-center gap-1 flex-wrap">
        <button
          type="button"
          class="btn tab-btn"
          :class="activeTab === 'invoices' ? 'tab-btn-active' : 'tab-btn-inactive'"
          @click="activeTab = 'invoices'"
        >
          <i class="bi bi-receipt"></i>
          <span>Invoices / Bills ({{ bills.length }})</span>
        </button>

        <button
          type="button"
          class="btn tab-btn"
          :class="activeTab === 'collections' ? 'tab-btn-active' : 'tab-btn-inactive'"
          @click="activeTab = 'collections'"
        >
          <i class="bi bi-wallet2"></i>
          <span>Collections ({{ collections.length }})</span>
        </button>

        <button
          type="button"
          class="btn tab-btn"
          :class="activeTab === 'billed' ? 'tab-btn-active' : 'tab-btn-inactive'"
          @click="activeTab = 'billed'"
        >
          <i class="bi bi-check2-all"></i>
          <span>Billed Clients ({{ billedClientsList.length }})</span>
        </button>

        <button
          type="button"
          class="btn tab-btn"
          :class="activeTab === 'dues' ? 'tab-btn-active' : 'tab-btn-inactive'"
          @click="activeTab = 'dues'"
        >
          <i class="bi bi-exclamation-circle"></i>
          <span>Due Clients ({{ dueClientsList.length }})</span>
        </button>

        <button
          type="button"
          class="btn tab-btn"
          :class="activeTab === 'missing' ? 'tab-btn-warning-active' : 'tab-btn-inactive'"
          @click="activeTab = 'missing'"
        >
          <i class="bi bi-file-earmark-plus"></i>
          <span>Missing Bills ({{ missingBills.length }})</span>
        </button>
      </div>

      <!-- Right: Search & Month Navigator (Equal 38px Heights) -->
      <div class="d-flex align-items-center gap-2 ms-auto flex-wrap">
        <SearchInput
          v-model="searchQuery"
          placeholder="Search invoice, client, receipt..."
          max-width="260px"
          min-width="180px"
        />

        <div class="month-nav-container" style="width: 195px; flex-shrink: 0;">
          <MonthNavigator v-model="selectedMonth" />
        </div>
      </div>
    </div>

    <!-- TAB 1 & 3 & 4: INVOICES TABLE (Active for 'invoices', 'billed', 'dues') -->
    <div v-if="activeTab === 'invoices' || activeTab === 'billed' || activeTab === 'dues'" class="table-card shadow-sm">
      <table class="table-custom">
        <thead>
          <tr>
            <th style="width: 14%;">Invoice No</th>
            <th style="width: 28%;">Client Organization & BIN</th>
            <th style="width: 12%;">Tax Period</th>
            <th style="width: 12%; text-align: right;">Total (Tk)</th>
            <th style="width: 12%; text-align: right;">Paid (Tk)</th>
            <th style="width: 12%; text-align: right;">Due (Tk)</th>
            <th style="width: 10%;">Status</th>
            <th style="width: 10%; text-align: right;" class="d-print-none">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && bills.length === 0">
            <td colspan="8" class="text-center py-4 text-muted">
              <div class="spinner-border spinner-border-sm text-primary me-2"></div>
              Loading invoices...
            </td>
          </tr>

          <tr v-else-if="(activeTab === 'dues' ? dueClientsList : bills).length === 0">
            <td colspan="8" class="text-center py-5 text-muted">
              <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
              No invoices found for {{ selectedMonth }}.
            </td>
          </tr>

          <tr v-for="bill in (paginatedList as Bill[])" :key="bill.id">
            <!-- Invoice No -->
            <td>
              <span class="font-monospace fw-bold text-info" style="font-size: 0.88rem;">{{ bill.billNo }}</span>
              <div class="text-muted small" style="font-size: 0.76rem;">{{ new Date(bill.billDate).toLocaleDateString() }}</div>
            </td>

            <!-- Client Name & BIN -->
            <td>
              <div class="fw-bold text-white text-truncate" style="max-width: 320px; font-size: 0.92rem;">
                {{ bill.clientName }}
              </div>
              <div class="d-flex align-items-center gap-2 mt-1">
                <span v-if="bill.clientBin" class="badge bg-dark border border-secondary text-info font-monospace" style="font-size: 0.78rem;">
                  BIN: {{ bill.clientBin }}
                </span>
                <span v-if="bill.referenceName" class="text-muted small" style="font-size: 0.78rem;">
                  Ref: {{ bill.referenceName }}
                </span>
              </div>
            </td>

            <!-- Tax Period -->
            <td>
              <span class="font-monospace text-light fw-medium">{{ bill.taxPeriod }}</span>
            </td>

            <!-- Grand Total -->
            <td style="text-align: right;">
              <span class="font-monospace fw-bold text-white fs-6">{{ bill.grandTotal.toFixed(2) }}</span>
            </td>

            <!-- Paid Amount -->
            <td style="text-align: right;">
              <span class="font-monospace text-success fw-semibold">{{ bill.paidAmount.toFixed(2) }}</span>
            </td>

            <!-- Due Amount -->
            <td style="text-align: right;">
              <span class="font-monospace fw-bold" :class="bill.dueAmount > 0 ? 'text-danger' : 'text-muted'">
                {{ bill.dueAmount.toFixed(2) }}
              </span>
            </td>

            <!-- Status -->
            <td>
              <StatusBadge :status="bill.status" />
            </td>

            <!-- Actions (Icon Only) -->
            <td style="text-align: right;" class="d-print-none">
              <div class="d-inline-flex align-items-center gap-1">
                <!-- Collect Payment Button (If due exists) -->
                <button
                  v-if="bill.dueAmount > 0"
                  type="button"
                  class="btn btn-sm btn-outline-success p-1"
                  title="Receive Payment"
                  @click="goToCreateCollection(bill.clientId, bill.id)"
                >
                  <i class="bi bi-cash-coin"></i>
                </button>

                <!-- Delete Button -->
                <button
                  type="button"
                  class="btn btn-sm btn-outline-danger p-1"
                  title="Delete Invoice"
                  @click="handleDeleteBill(bill)"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- TAB 2: COLLECTIONS & MONEY RECEIPTS -->
    <div v-else-if="activeTab === 'collections'" class="table-card shadow-sm">
      <table class="table-custom">
        <thead>
          <tr>
            <th style="width: 15%;">Receipt No</th>
            <th style="width: 30%;">Client Organization & BIN</th>
            <th style="width: 15%;">Date</th>
            <th style="width: 15%;">Payment Mode</th>
            <th style="width: 15%; text-align: right;">Amount (Tk)</th>
            <th style="width: 10%; text-align: right;" class="d-print-none">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && collections.length === 0">
            <td colspan="6" class="text-center py-4 text-muted">
              <div class="spinner-border spinner-border-sm text-primary me-2"></div>
              Loading payment receipts...
            </td>
          </tr>

          <tr v-else-if="collections.length === 0">
            <td colspan="6" class="text-center py-5 text-muted">
              <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
              No payment receipts recorded for {{ selectedMonth }}.
            </td>
          </tr>

          <tr v-for="col in (paginatedList as Collection[])" :key="col.id">
            <!-- Receipt No -->
            <td>
              <span class="font-monospace fw-bold text-success" style="font-size: 0.88rem;">{{ col.receiptNo }}</span>
              <div v-if="col.billNo" class="text-muted small" style="font-size: 0.76rem;">Inv: {{ col.billNo }}</div>
            </td>

            <!-- Client Name & BIN -->
            <td>
              <div class="fw-bold text-white text-truncate" style="max-width: 320px; font-size: 0.92rem;">
                {{ col.clientName }}
              </div>
              <div v-if="col.clientBin" class="badge bg-dark border border-secondary text-info font-monospace mt-1" style="font-size: 0.78rem;">
                BIN: {{ col.clientBin }}
              </div>
            </td>

            <!-- Date -->
            <td>
              <span class="text-light font-monospace">{{ new Date(col.collectionDate).toLocaleDateString() }}</span>
            </td>

            <!-- Payment Mode -->
            <td>
              <span class="badge bg-secondary text-uppercase">{{ col.paymentMethod }}</span>
              <div v-if="col.referenceNo" class="text-muted small font-monospace mt-1">{{ col.referenceNo }}</div>
            </td>

            <!-- Amount -->
            <td style="text-align: right;">
              <span class="font-monospace fw-bold text-success fs-6">{{ col.amount.toFixed(2) }}</span>
            </td>

            <!-- Actions -->
            <td style="text-align: right;" class="d-print-none">
              <button
                type="button"
                class="btn btn-sm btn-outline-danger p-1"
                title="Cancel Receipt"
                :disabled="col.status === 'cancelled'"
                @click="handleCancelReceipt(col)"
              >
                <i class="bi bi-x-circle"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- TAB 5: MISSING BILLS WITH BATCH GENERATION -->
    <div v-else-if="activeTab === 'missing'" class="table-card shadow-sm">
      <!-- Missing Bills Action Banner -->
      <div class="px-3 py-2 bg-dark bg-opacity-40 border-bottom border-secondary border-opacity-25 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-warning text-dark px-2 py-1 fw-bold" style="font-size: 0.8rem;">
            {{ missingBills.length }} Missing Clients
          </span>
          <span class="text-secondary small">
            Target Tax Period: <strong class="text-light font-monospace">{{ selectedMonth }}</strong>
          </span>
        </div>

        <button
          type="button"
          class="btn btn-sm btn-warning text-dark fw-bold px-3 shadow-sm d-flex align-items-center gap-1.5"
          style="height: 32px; font-size: 0.82rem;"
          :disabled="isBatchGenerating || missingBills.filter(m => m.isSubmitted).length === 0"
          @click="handleBatchGenerate"
        >
          <span v-if="isBatchGenerating" class="spinner-border spinner-border-sm text-dark"></span>
          <i v-else class="bi bi-lightning-charge-fill"></i>
          <span>Batch Generate Bills ({{ missingBills.filter(m => m.isSubmitted).length }})</span>
        </button>
      </div>

      <table class="table-custom">
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th style="width: 30%;">Client Name & BIN</th>
            <th style="width: 15%;">Reference</th>
            <th style="width: 12%;">Service Scope</th>
            <th style="width: 14%;">Submission ID</th>
            <th style="width: 12%; text-align: right;">Service Fee (Tk)</th>
            <th style="width: 12%; text-align: right;" class="d-print-none">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && missingBills.length === 0">
            <td colspan="7" class="text-center py-4 text-muted">
              <div class="spinner-border spinner-border-sm text-primary me-2"></div>
              Loading missing clients...
            </td>
          </tr>

          <tr v-else-if="missingBills.length === 0">
            <td colspan="7" class="text-center py-5 text-success">
              <i class="bi bi-check-circle-fill fs-2 d-block mb-2"></i>
              All active clients have been billed for {{ selectedMonth }}!
            </td>
          </tr>

          <tr v-for="(item, idx) in (paginatedList as any[])" :key="item.id">
            <!-- Index -->
            <td class="text-muted">{{ (currentPage - 1) * itemsPerPage + idx + 1 }}</td>

            <!-- Client Name & BIN -->
            <td>
              <div class="fw-bold text-white text-truncate" style="max-width: 320px; font-size: 0.92rem;">
                {{ item.companyName }}
              </div>
              <div v-if="item.binNumber" class="badge bg-dark border border-secondary text-info font-monospace mt-1" style="font-size: 0.78rem;">
                BIN: {{ item.binNumber }}
              </div>
            </td>

            <!-- Reference -->
            <td>
              <span class="text-light small">{{ item.referenceName || 'Direct Acquisition' }}</span>
            </td>

            <!-- Scope -->
            <td>
              <span class="badge" :class="item.vatServiceType === 'FULL' ? 'bg-primary' : 'bg-secondary'">
                {{ item.vatServiceType }}
              </span>
            </td>

            <!-- Submission ID -->
            <td>
              <div v-if="item.isSubmitted" class="d-flex align-items-center gap-1">
                <i class="bi bi-check-circle-fill text-success" style="font-size: 0.85rem;"></i>
                <span class="font-monospace fw-bold text-success" style="font-size: 0.88rem;">#{{ item.submissionId }}</span>
              </div>
              <div v-else class="d-flex align-items-center gap-1 text-danger small">
                <i class="bi bi-dash-circle" style="font-size: 0.82rem;"></i>
                <span>Not Submitted</span>
              </div>
            </td>

            <!-- Service Fee -->
            <td style="text-align: right;">
              <span class="font-monospace fw-bold text-white">{{ item.monthlyServiceFee.toFixed(2) }}</span>
            </td>

            <!-- Action -->
            <td style="text-align: right;" class="d-print-none">
              <button
                type="button"
                class="btn btn-sm btn-primary px-3 fw-semibold shadow-sm d-flex align-items-center gap-1 ms-auto"
                :disabled="!item.isSubmitted"
                @click="goToCreateBill(item.id, item.targetMonth)"
              >
                <i class="bi bi-plus-lg"></i>
                <span>Create Bill</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination for Billing -->
    <div v-if="currentTabList.length > 0" class="d-flex flex-wrap justify-content-between align-items-center mt-3 pt-2">
      <span class="text-muted small">
        Showing <strong>{{ (currentPage - 1) * itemsPerPage + 1 }}</strong> to
        <strong>{{ Math.min(currentPage * itemsPerPage, currentTabList.length) }}</strong> of
        <strong>{{ currentTabList.length }}</strong> records
      </span>

      <div v-if="totalPages > 1" class="d-flex align-items-center gap-1">
        <button
          type="button"
          class="btn btn-dark border-secondary btn-sm"
          :disabled="currentPage <= 1"
          @click="currentPage--"
        >
          <i class="bi bi-chevron-left"></i> Prev
        </button>

        <template v-for="p in totalPages" :key="p">
          <button
            v-if="p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2)"
            type="button"
            class="btn btn-sm"
            :class="currentPage === p ? 'btn-primary' : 'btn-dark border-secondary text-muted'"
            style="min-width: 32px;"
            @click="currentPage = p"
          >
            {{ p }}
          </button>
          <span
            v-else-if="p === currentPage - 3 || p === currentPage + 3"
            class="text-muted px-1"
          >
            ...
          </span>
        </template>

        <button
          type="button"
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
.billing-page {
  width: 100%;
}

.stat-pill {
  background: #1e2227;
  border: 1px solid #343a40;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  transition: all 0.2s ease;
}

.stat-pill:hover {
  background: #252b32;
  border-color: #0d6efd;
  transform: translateY(-2px);
}

.stat-pill-active {
  border-color: #0d6efd !important;
  background: #192434 !important;
}

.stat-label {
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.stat-val {
  font-size: 1.65rem;
  font-weight: 800;
  line-height: 1.2;
}

.cursor-pointer {
  cursor: pointer;
}

.filter-panel {
  background: #1e2227;
  border: 1px solid #343a40;
  border-radius: 8px;
}

.tab-btn {
  height: 38px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 12px;
  font-size: 0.84rem;
  font-weight: 600;
  border-radius: 6px;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.tab-btn-active {
  background-color: #0d6efd !important;
  color: #ffffff !important;
  border: 1px solid #0d6efd !important;
  box-shadow: 0 2px 6px rgba(13, 110, 253, 0.35);
}

.tab-btn-inactive {
  background-color: #181b1f !important;
  color: #adb5bd !important;
  border: 1px solid #3b424b !important;
}

.tab-btn-inactive:hover {
  background-color: #242930 !important;
  color: #ffffff !important;
  border-color: #525b67 !important;
}

.tab-btn-warning-active {
  background-color: #ffc107 !important;
  color: #111417 !important;
  font-weight: 700 !important;
  border: 1px solid #ffc107 !important;
  box-shadow: 0 2px 6px rgba(255, 193, 7, 0.35);
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
  padding-left: 36px !important;
  padding-right: 30px !important;
  border-radius: 6px;
  font-size: 0.86rem;
  height: 38px;
}

.idp-search-input:focus {
  border-color: #3b8eed !important;
  box-shadow: 0 0 0 0.15rem rgba(59, 142, 237, 0.25) !important;
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
  white-space: nowrap;
}

.table-custom tbody tr:hover {
  background-color: #242930;
}
</style>
