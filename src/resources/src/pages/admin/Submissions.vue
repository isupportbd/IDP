<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import MonthNavigator from "@/components/MonthNavigator.vue";
import StatusBadge from "@/components/common/StatusBadge.vue";
import { useSubmissionsApi, type SubmissionItem } from "@/composables/useSubmissionsApi";
import { useServicesApi } from "@/composables/useServicesApi";
import { useClientsApi } from "@/composables/useClientsApi";
import { useToast } from "@/composables/useToast";
import SearchInput from "@/components/common/SearchInput.vue";

const toast = useToast();

const {
  submissions,
  stats,
  loading,
  fetchSubmissions,
  recordSubmission,
  deleteSubmission,
  batchDeleteSubmissions
} = useSubmissionsApi();

const {
  customerTypes,
  references,
  fetchCustomerTypes,
  fetchReferences
} = useServicesApi();

const {
  assignableUsers,
  fetchAssignableUsers
} = useClientsApi();

// Tax Period Month (e.g. "2026-08")
const getLastMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const selectedMonth = ref(getLastMonth());
const searchQuery = ref("");
const selectedCustomerTypeId = ref<number | "all">("all");
const selectedReferenceId = ref<number | "all">("all");
const selectedManagerId = ref<number | "all">("all");
const statusFilter = ref<"all" | "submitted" | "pending" | "late_submitted">("all");

// Multi-Selection State
const selectedIds = ref<number[]>([]);

// Modal State
const showModal = ref(false);
const isSaving = ref(false);

const form = ref({
  clientId: null as number | null,
  taxPeriod: selectedMonth.value,
  submissionId: "",
  remarks: ""
});

const selectedClientItem = computed(() => {
  return submissions.value.find((s) => s.id === form.value.clientId) || null;
});

let searchTimeout: any = null;

const loadSubmissionsList = async () => {
  try {
    await fetchSubmissions({
      month: selectedMonth.value,
      customerTypeId: selectedCustomerTypeId.value,
      referenceId: selectedReferenceId.value,
      managerId: selectedManagerId.value,
      status: statusFilter.value,
      search: searchQuery.value.trim()
    });
  } catch (err: any) {
    toast.error("Failed to load submissions");
  }
};

const loadData = async () => {
  try {
    await Promise.all([
      loadSubmissionsList(),
      fetchCustomerTypes(),
      fetchReferences(),
      fetchAssignableUsers()
    ]);
  } catch (err: any) {
    toast.error("Failed to load initial submissions data");
  }
};

onMounted(() => {
  loadData();
});

// Pagination State (10 items per page)
const currentPage = ref(1);
const itemsPerPage = 10;

const totalPages = computed(() => Math.ceil(submissions.value.length / itemsPerPage) || 1);

const paginatedSubmissions = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return submissions.value.slice(start, start + itemsPerPage);
});

watch([selectedMonth, selectedCustomerTypeId, selectedReferenceId, selectedManagerId, statusFilter], () => {
  selectedIds.value = [];
  currentPage.value = 1;
  loadSubmissionsList();
});

// Selection Handlers
const isAllSelected = computed(() => {
  if (submissions.value.length === 0) return false;
  return submissions.value.every((s) => selectedIds.value.includes(s.id));
});

const toggleSelectAll = () => {
  if (isAllSelected.value) {
    selectedIds.value = [];
  } else {
    selectedIds.value = submissions.value.map((s) => s.id);
  }
};

const toggleSelectRow = (id: number) => {
  const idx = selectedIds.value.indexOf(id);
  if (idx >= 0) {
    selectedIds.value.splice(idx, 1);
  } else {
    selectedIds.value.push(id);
  }
};

// Modal Actions
const openRecordModal = (item?: SubmissionItem) => {
  if (item) {
    form.value = {
      clientId: item.id,
      taxPeriod: selectedMonth.value,
      submissionId: item.submissionId || "",
      remarks: item.remarks || ""
    };
  } else {
    form.value = {
      clientId: null,
      taxPeriod: selectedMonth.value,
      submissionId: "",
      remarks: ""
    };
  }
  showModal.value = true;
};

const handleSaveSubmission = async () => {
  if (!form.value.clientId) {
    toast.error("Please select an active client");
    return;
  }
  if (!form.value.submissionId.trim()) {
    toast.error("Submission ID is required");
    return;
  }

  isSaving.value = true;
  try {
    await recordSubmission({
      clientId: form.value.clientId,
      taxPeriod: form.value.taxPeriod || selectedMonth.value,
      submissionId: form.value.submissionId.trim(),
      remarks: form.value.remarks?.trim() || undefined
    });
    toast.success("Submission ID recorded successfully");
    showModal.value = false;
    await loadData();
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to record submission");
  } finally {
    isSaving.value = false;
  }
};

const handleClearSingle = async (item: SubmissionItem) => {
  if (!item.submissionRecordId) return;
  if (!confirm(`Are you sure you want to clear the submission record for ${item.companyName}?`)) {
    return;
  }
  try {
    await deleteSubmission(item.submissionRecordId);
    toast.success("Submission cleared");
    await loadData();
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to clear submission");
  }
};

const handleBatchClear = async () => {
  // Find submissionRecordIds for selected clients
  const targetRecordIds = submissions.value
    .filter((s) => selectedIds.value.includes(s.id) && s.submissionRecordId !== null)
    .map((s) => s.submissionRecordId as number);

  if (targetRecordIds.length === 0) {
    toast.info("None of the selected clients have recorded submissions to clear");
    return;
  }

  if (!confirm(`Clear recorded submissions for ${targetRecordIds.length} selected client(s)?`)) {
    return;
  }

  try {
    await batchDeleteSubmissions(targetRecordIds);
    toast.success(`${targetRecordIds.length} submission(s) cleared`);
    selectedIds.value = [];
    await loadData();
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to clear submissions");
  }
};

// 1. Export to Excel
const exportToExcel = async () => {
  const exportData = submissions.value.map((s, idx) => ({
    "Sl No.": idx + 1,
    "Client / Company Name": s.companyName,
    "BIN Number": s.binNumber || "—",
    "Customer Type": s.customerTypeName || "Standard",
    "Reference": s.referenceName || "Direct",
    "Tax Period": s.taxPeriod,
    "Submission ID": s.submissionId || "Pending",
    "Status": s.status === "submitted" ? "Submitted" : s.status === "late_submitted" ? "Late Submitted" : "Pending",
    "Submission Date": s.submittedAt ? new Date(s.submittedAt).toLocaleDateString() : "—",
    "Remarks": s.remarks || ""
  }));

  const XLSX = await import("xlsx");
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Submissions");
  XLSX.writeFile(workbook, `Submissions_${selectedMonth.value || "All"}.xlsx`);
};

// 2. Standard A4 Print Action
const printReport = () => {
  window.print();
};
</script>

<template>
  <div class="submissions-page py-2">
    <!-- Screen Header (Hidden in Print) -->
    <div class="d-print-none d-flex flex-wrap justify-content-between align-items-center mb-3">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Dashboard
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">Submissions</span>
        </div>
        <h4 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
          <i class="bi bi-file-earmark-check text-primary"></i> Return Submissions Tracker
        </h4>
        <span class="text-muted small">
          Record, track, and verify monthly eVAT submission IDs received from the NBR portal
        </span>
      </div>

      <!-- Action Buttons -->
      <div class="d-flex align-items-center gap-2 mt-3 mt-md-0">
        <!-- Excel Export Button -->
        <button
          type="button"
          class="btn btn-dark border-secondary btn-sm d-flex align-items-center gap-2 text-light px-3"
          title="Download Excel Report"
          @click="exportToExcel"
        >
          <i class="bi bi-download text-success"></i>
          <span>Excel</span>
        </button>

        <!-- Standard A4 Print Button -->
        <button
          type="button"
          class="btn btn-dark border-secondary btn-sm d-flex align-items-center gap-2 text-light px-3"
          title="Print A4 Report"
          @click="printReport"
        >
          <i class="bi bi-printer text-info"></i>
          <span>Print</span>
        </button>

        <!-- Record Submission ID Button -->
        <button
          type="button"
          class="btn btn-primary btn-sm d-flex align-items-center gap-2 px-3 fw-semibold shadow-sm"
          @click="openRecordModal()"
        >
          <i class="bi bi-plus-lg"></i>
          <span>Record Submission ID</span>
        </button>

        <!-- Batch Clear Button -->
        <button
          v-if="selectedIds.length > 0"
          type="button"
          class="btn btn-outline-danger btn-sm d-flex align-items-center gap-1 px-3 fw-semibold"
          @click="handleBatchClear"
        >
          <i class="bi bi-trash"></i>
          <span>Clear Selected ({{ selectedIds.length }})</span>
        </button>
      </div>
    </div>

    <!-- Quick Stats Cards (Clickable to Filter!) -->
    <div class="row g-3 mb-3 d-print-none">
      <div class="col-6 col-md-3">
        <div
          class="stat-pill cursor-pointer"
          :class="{ 'stat-pill-active': statusFilter === 'all' }"
          @click="statusFilter = 'all'"
        >
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="text-muted stat-label">All Active Clients</span>
            <i class="bi bi-building text-primary"></i>
          </div>
          <div class="stat-val text-white">{{ stats.totalActive }}</div>
        </div>
      </div>

      <div class="col-6 col-md-3">
        <div
          class="stat-pill cursor-pointer"
          :class="{ 'stat-pill-active': statusFilter === 'submitted' }"
          @click="statusFilter = 'submitted'"
        >
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="text-muted stat-label">Submitted</span>
            <i class="bi bi-check-circle-fill text-success"></i>
          </div>
          <div class="stat-val text-success">{{ stats.submittedCount }}</div>
        </div>
      </div>

      <div class="col-6 col-md-3">
        <div
          class="stat-pill cursor-pointer"
          :class="{ 'stat-pill-active': statusFilter === 'pending' }"
          @click="statusFilter = 'pending'"
        >
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="text-muted stat-label">Pending</span>
            <i class="bi bi-hourglass-split text-warning"></i>
          </div>
          <div class="stat-val text-warning">{{ stats.pendingCount }}</div>
        </div>
      </div>

      <div class="col-6 col-md-3">
        <div
          class="stat-pill cursor-pointer"
          :class="{ 'stat-pill-active': statusFilter === 'late_submitted' }"
          @click="statusFilter = 'late_submitted'"
        >
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="text-muted stat-label">Late Submitted</span>
            <i class="bi bi-clock-history text-danger"></i>
          </div>
          <div class="stat-val text-danger">{{ stats.lateSubmittedCount }}</div>
        </div>
      </div>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="filter-panel px-3 py-2 mb-3 d-print-none d-flex align-items-center gap-2">
      <!-- 1. Search Box -->
      <SearchInput
        v-model="searchQuery"
        placeholder="Search company, BIN, ID..."
        max-width="320px"
        min-width="200px"
      />

      <!-- 2. Customer Type Filter -->
      <select v-model="selectedCustomerTypeId" class="form-select idp-select" style="width: auto;">
        <option value="all">All Customer Types</option>
        <option v-for="t in customerTypes" :key="t.id" :value="t.id">{{ t.typeName }}</option>
      </select>

      <!-- 3. Reference Filter -->
      <select v-model="selectedReferenceId" class="form-select idp-select" style="width: auto;">
        <option value="all">All References</option>
        <option v-for="r in references" :key="r.id" :value="r.id">{{ r.name }}</option>
      </select>

      <!-- 4. Assigned Manager Filter -->
      <select v-model="selectedManagerId" class="form-select idp-select" style="width: auto;">
        <option value="all">All Managers</option>
        <option v-for="u in assignableUsers" :key="u.id" :value="u.id">{{ u.name }}</option>
      </select>

      <!-- 5. Month Navigator Component -->
      <div class="month-nav-container" style="width: 200px; flex-shrink: 0;">
        <MonthNavigator v-model="selectedMonth" />
      </div>
    </div>

    <!-- A4 Printable Document Header (Visible Only When Printing) -->
    <div class="d-none d-print-block a4-print-header mb-4">
      <div class="d-flex justify-content-between align-items-start border-bottom pb-3">
        <div>
          <h3 class="fw-bold text-dark mb-1">Integrated VAT Data Processing Portal (IDP)</h3>
          <h5 class="text-secondary mb-0">Monthly eVAT Return Submissions Report</h5>
        </div>
        <div class="text-end text-secondary small">
          <div><strong>Tax Period:</strong> {{ selectedMonth }}</div>
          <div><strong>Generated:</strong> {{ new Date().toLocaleString() }}</div>
          <div><strong>Total Active Clients:</strong> {{ submissions.length }}</div>
        </div>
      </div>
    </div>

    <!-- Submissions Table Card -->
    <div class="table-card shadow-sm">
      <table class="table-custom">
        <thead>
          <tr>
            <th style="width: 40px;" class="d-print-none text-center">
              <input
                type="checkbox"
                class="custom-check-box"
                :checked="isAllSelected"
                @change="toggleSelectAll"
              />
            </th>
            <th style="width: 35%;">Client Organization & BIN</th>
            <th style="width: 18%;">Customer Type</th>
            <th style="width: 12%;">Tax Period</th>
            <th style="width: 16%;">Submission ID</th>
            <th style="width: 12%;">Status</th>
            <th style="width: 7%; text-align: right;" class="d-print-none">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading && submissions.length === 0">
            <td colspan="7" class="text-center py-4 text-muted">
              <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
              Loading submissions data...
            </td>
          </tr>

          <tr v-else-if="submissions.length === 0">
            <td colspan="7" class="text-center py-5 text-muted">
              <i class="bi bi-inbox fs-2 d-block mb-2 text-secondary"></i>
              No active clients found matching the selected filters.
            </td>
          </tr>

          <tr v-for="item in paginatedSubmissions" :key="item.id">
            <!-- Checkbox -->
            <td class="d-print-none text-center">
              <input
                type="checkbox"
                class="custom-check-box"
                :checked="selectedIds.includes(item.id)"
                @change="toggleSelectRow(item.id)"
              />
            </td>

            <!-- Client Info -->
            <td>
              <div class="fw-semibold text-white mb-1 text-truncate" style="max-width: 340px; font-size: 0.92rem;">
                {{ item.companyName }}
              </div>
              <div class="d-flex align-items-center gap-2 flex-nowrap" style="font-size: 0.78rem;">
                <span v-if="item.binNumber" class="badge bg-dark border border-secondary text-info font-monospace" style="font-size: 0.78rem;">
                  BIN: {{ item.binNumber }}
                </span>
                <span v-if="item.mobile" class="text-muted" style="font-size: 0.78rem;">
                  <i class="bi bi-telephone me-1"></i>{{ item.mobile }}
                </span>
              </div>
            </td>

            <!-- Customer Type -->
            <td>
              <span class="badge bg-secondary bg-opacity-25 text-light border border-secondary border-opacity-25 px-2 py-1" style="font-size: 0.8rem;">
                {{ item.customerTypeName || 'Standard' }}
              </span>
            </td>

            <!-- Tax Period -->
            <td>
              <span class="font-monospace text-light fw-medium" style="font-size: 0.86rem;">{{ item.taxPeriod }}</span>
            </td>

            <!-- Submission ID -->
            <td>
              <span v-if="item.submissionId" class="badge bg-dark border border-primary border-opacity-50 text-light font-monospace px-2 py-1" style="font-size: 0.84rem;">
                {{ item.submissionId }}
              </span>
              <span v-else class="text-muted fst-italic" style="font-size: 0.82rem;">
                Pending
              </span>
            </td>

            <!-- Status Badge -->
            <td>
              <StatusBadge :status="item.status" />
            </td>

            <!-- Actions (Icon Only) -->
            <td style="text-align: right;" class="d-print-none">
              <div class="d-inline-flex align-items-center gap-1">
                <button
                  type="button"
                  class="btn btn-sm btn-action-icon"
                  :class="item.submissionRecordId ? 'btn-outline-primary' : 'btn-primary shadow-sm'"
                  :title="item.submissionRecordId ? 'Edit Submission ID' : 'Record Submission ID'"
                  @click="openRecordModal(item)"
                >
                  <i class="bi" :class="item.submissionRecordId ? 'bi-pencil-square' : 'bi-plus-lg'"></i>
                </button>

                <button
                  v-if="item.submissionRecordId"
                  type="button"
                  class="btn btn-sm btn-action-icon btn-outline-danger"
                  title="Clear submission"
                  @click="handleClearSingle(item)"
                >
                  <i class="bi bi-x-circle"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination for Submissions -->
    <div v-if="submissions.length > 0" class="d-flex flex-wrap justify-content-between align-items-center mt-3 pt-2">
      <span class="text-muted small">
        Showing <strong>{{ (currentPage - 1) * itemsPerPage + 1 }}</strong> to
        <strong>{{ Math.min(currentPage * itemsPerPage, submissions.length) }}</strong> of
        <strong>{{ submissions.length }}</strong> submissions
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

    <!-- Record Submission ID Modal (Minimal Design) -->
    <div
      v-if="showModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.75); z-index: 1060;"
    >
      <div class="modal-dialog modal-dialog-centered" style="max-width: 440px;">
        <div class="modal-content idp-modal-content text-white border border-secondary shadow-lg rounded-3">
          <div class="modal-header border-bottom border-secondary py-3 px-4">
            <h6 class="modal-title fw-bold d-flex align-items-center gap-2 mb-0">
              <i class="bi bi-file-earmark-check text-primary fs-5"></i>
              <span>Record Return Submission ID</span>
            </h6>
            <button
              type="button"
              class="btn-close btn-close-white"
              @click="showModal = false"
            ></button>
          </div>

          <form @submit.prevent="handleSaveSubmission">
            <div class="modal-body p-4">
              <!-- Client & Period Info Card (When client is selected) -->
              <div v-if="selectedClientItem" class="p-3 mb-3 rounded-2 bg-dark border border-secondary border-opacity-50">
                <div class="d-flex align-items-center justify-content-between mb-1">
                  <span class="text-muted small fw-semibold">Client Organization</span>
                  <button
                    type="button"
                    class="btn btn-link btn-sm text-primary p-0 text-decoration-none small"
                    @click="form.clientId = null"
                  >
                    Change Client
                  </button>
                </div>
                <div class="fw-bold text-white fs-6">
                  {{ selectedClientItem.companyName }}
                </div>
                <div class="d-flex align-items-center gap-3 mt-1 small">
                  <span v-if="selectedClientItem.binNumber" class="text-info font-monospace">
                    BIN: {{ selectedClientItem.binNumber }}
                  </span>
                  <span class="text-muted">
                    Tax Period: <strong class="text-light">{{ form.taxPeriod }}</strong>
                  </span>
                </div>
              </div>

              <!-- Client Selector if not selected -->
              <div v-else class="mb-3">
                <label class="form-label small text-secondary fw-semibold">
                  Select Active Client Organization <span class="text-danger">*</span>
                </label>
                <select
                  v-model="form.clientId"
                  class="form-select idp-modal-input"
                  required
                >
                  <option :value="null" disabled>Choose a client to record submission...</option>
                  <option
                    v-for="c in submissions"
                    :key="c.id"
                    :value="c.id"
                  >
                    {{ c.companyName }} {{ c.binNumber ? `(BIN: ${c.binNumber})` : '' }}
                  </option>
                </select>
              </div>

              <!-- Tax Period Input Field -->
              <div class="mb-3">
                <label class="form-label small text-secondary fw-semibold">
                  Tax Period <span class="text-danger">*</span>
                </label>
                <input
                  v-model="form.taxPeriod"
                  type="month"
                  class="form-control idp-modal-input font-monospace"
                  required
                  style="height: 40px;"
                />
              </div>

              <!-- Submission ID Input -->
              <div class="mb-3">
                <label class="form-label small text-secondary fw-semibold">
                  Submission ID <span class="text-danger">*</span>
                </label>
                <input
                  v-model="form.submissionId"
                  type="text"
                  class="form-control form-control-lg idp-modal-input font-monospace"
                  placeholder="e.g. 202608001"
                  required
                  autofocus
                  style="font-size: 1rem; height: 42px;"
                />
              </div>

              <!-- Remarks (Optional) -->
              <div class="mb-1">
                <label class="form-label small text-secondary fw-semibold">
                  Remarks / Notes <span class="text-muted fw-normal">(Optional)</span>
                </label>
                <input
                  v-model="form.remarks"
                  type="text"
                  class="form-control form-control-sm idp-modal-input"
                  placeholder="Optional submission note..."
                />
              </div>
            </div>

            <div class="modal-footer border-top border-secondary py-2 px-4 d-flex justify-content-between">
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary px-3"
                @click="showModal = false"
              >
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-sm btn-primary px-4 fw-semibold d-flex align-items-center gap-1 shadow-sm"
                :disabled="isSaving"
              >
                <span v-if="isSaving" class="spinner-border spinner-border-sm me-1"></span>
                <i v-else class="bi bi-check2"></i>
                <span>Save Submission</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.submissions-page {
  width: 100%;
}

.stat-pill {
  background: #1e2227;
  border: 1px solid #343a40;
  border-radius: 8px;
  padding: 0.9rem 1.15rem;
  transition: all 0.15s ease;
}

.stat-pill:hover {
  background: #252a30;
  border-color: #495057;
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

.custom-check-box {
  width: 16px !important;
  height: 16px !important;
  min-width: 16px !important;
  max-width: 16px !important;
  appearance: auto !important;
  -webkit-appearance: auto !important;
  cursor: pointer;
  margin: 0 auto !important;
  display: block !important;
  accent-color: #0d6efd !important;
}

.cursor-pointer {
  cursor: pointer;
}

.filter-panel {
  background: #1e2227;
  border: 1px solid #343a40;
  border-radius: 8px;
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

.idp-select {
  background-color: #181b1f !important;
  border: 1px solid #3b424b !important;
  color: #f8f9fa !important;
  border-radius: 6px;
  font-size: 0.86rem;
  height: 38px;
  padding-left: 12px;
  padding-right: 32px;
}

.idp-select:focus {
  border-color: #3b8eed !important;
  box-shadow: 0 0 0 0.15rem rgba(59, 142, 237, 0.25) !important;
}

.month-nav-container {
  display: flex;
  align-items: center;
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

.table-custom thead tr {
  background: #16191d;
  border-bottom: 1px solid #343a40;
}

.table-custom th {
  padding: 12px 14px;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #adb5bd;
  text-align: left;
  white-space: nowrap;
}

.table-custom td {
  padding: 13px 14px;
  font-size: 0.88rem;
  border-bottom: 1px solid #282d34;
  vertical-align: middle;
  color: #e2e8f0;
  white-space: nowrap;
}

.table-custom tbody tr:hover td {
  background: #252a30;
}

.btn-action-icon {
  width: 32px;
  height: 32px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 0.9rem;
}

/* Status Badges */
.badge-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
}

.badge-status-submitted {
  background: rgba(25, 135, 84, 0.15);
  color: #20c997;
  border: 1px solid rgba(25, 135, 84, 0.35);
}

.badge-status-pending {
  background: rgba(255, 193, 7, 0.15);
  color: #ffc107;
  border: 1px solid rgba(255, 193, 7, 0.35);
}

.badge-status-late {
  background: rgba(253, 126, 20, 0.15);
  color: #fd7e14;
  border: 1px solid rgba(253, 126, 20, 0.35);
}

.status-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

/* Modal Styling */
.idp-modal-content {
  background-color: #1e2227;
  border-radius: 8px;
}

.idp-modal-input {
  background-color: #15181c !important;
  border: 1px solid #3a4149 !important;
  color: #f8f9fa !important;
  font-size: 0.85rem;
}

.idp-modal-input:focus {
  border-color: #0d6efd !important;
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25) !important;
}
</style>
