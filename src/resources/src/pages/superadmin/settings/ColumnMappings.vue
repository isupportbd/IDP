<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import axios from "axios";
import { pulse } from "@/plugins/pulse";
import { useToast } from "@/composables/useToast";

const toast = useToast();

interface MappingRow {
  dbColumn: string;
  label: string;
  excelHeader: string;
  isCalculated?: boolean;
  isFromDb?: boolean;
  isRegexExtracted?: boolean;
}

const rows = ref<MappingRow[]>([]);
const originalRows = ref<MappingRow[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const isEditMode = ref(false);

// Single Edit Modal State
const showSingleModal = ref(false);
const singleRow = ref<MappingRow | null>(null);
const isSavingSingle = ref(false);

const fetchColumnMappings = async () => {
  isLoading.value = true;
  try {
    const res = await axios.get("/api/superadmin/column-mappings");
    if (res.data?.success && Array.isArray(res.data.data)) {
      const mapped = res.data.data.map((r: any) => ({
        dbColumn: r.dbColumn || r.db_column,
        label: r.label || r.dbColumn || r.db_column,
        excelHeader: r.excelHeader || r.excel_header || "",
        isCalculated: r.isCalculated || r.is_calculated || false,
        isFromDb: r.isFromDb || r.is_from_db || false,
        isRegexExtracted: r.isRegexExtracted || r.is_regex_extracted || false
      }));
      rows.value = mapped;
      originalRows.value = JSON.parse(JSON.stringify(mapped));
    }
  } catch (err: any) {
    console.error("Error loading column mappings:", err);
  } finally {
    isLoading.value = false;
  }
};

const handleRealtimeUpdate = (p: any) => {
  if (!p?.type || p.type === "column-mappings") {
    if (!isEditMode.value) fetchColumnMappings();
  }
};

onMounted(() => {
  fetchColumnMappings();
  pulse.channel("auth").listen("global:settings-updated", handleRealtimeUpdate);
});

onUnmounted(() => {
  pulse.channel("auth").stopListening("global:settings-updated", handleRealtimeUpdate);
});

// Enable Global Edit Mode
const enterEditMode = () => {
  originalRows.value = JSON.parse(JSON.stringify(rows.value));
  isEditMode.value = true;
};

// Cancel Edit Mode
const cancelEditMode = () => {
  rows.value = JSON.parse(JSON.stringify(originalRows.value));
  isEditMode.value = false;
};

// Global Save
const handleSaveAll = async () => {
  isSaving.value = true;
  try {
    const res = await axios.post("/api/superadmin/column-mappings", {
      rows: rows.value
    });
    if (res.data?.success) {
      toast.success("Column mappings saved successfully!");
      if (Array.isArray(res.data.data)) {
        const mapped = res.data.data.map((r: any) => ({
          dbColumn: r.dbColumn || r.db_column,
          label: r.label || r.dbColumn || r.db_column,
          excelHeader: r.excelHeader || r.excel_header || "",
          isCalculated: r.isCalculated || r.is_calculated || false,
          isFromDb: r.isFromDb || r.is_from_db || false,
          isRegexExtracted: r.isRegexExtracted || r.is_regex_extracted || false
        }));
        rows.value = mapped;
        originalRows.value = JSON.parse(JSON.stringify(mapped));
      }
      isEditMode.value = false;
    } else {
      toast.error(res.data?.error || "Failed to save column mappings");
    }
  } catch (err: any) {
    toast.error(err?.response?.data?.error || err?.response?.data?.message || err?.message || "Server error");
  } finally {
    isSaving.value = false;
  }
};

// Open Single Row Edit Modal
const openSingleEdit = (row: MappingRow) => {
  if (row.isCalculated || row.isFromDb) return;
  singleRow.value = { ...row };
  showSingleModal.value = true;
};

// Save Single Row
const saveSingleEdit = async () => {
  if (!singleRow.value) return;
  isSavingSingle.value = true;
  try {
    const target = singleRow.value;
    const updatedRows = rows.value.map((r) =>
      r.dbColumn === target.dbColumn ? { ...r, excelHeader: target.excelHeader } : r
    );

    const res = await axios.post("/api/superadmin/column-mappings", {
      rows: updatedRows
    });

    if (res.data?.success) {
      toast.success(`Mapping for "${target.label}" updated successfully!`);
      showSingleModal.value = false;
      await fetchColumnMappings();
    } else {
      toast.error(res.data?.error || "Failed to update mapping");
    }
  } catch (err: any) {
    toast.error(err?.response?.data?.error || err?.response?.data?.message || err?.message || "Server error");
  } finally {
    isSavingSingle.value = false;
  }
};
</script>

<template>
  <div class="column-mappings-container">
    <!-- Top Bar -->
    <div class="d-flex justify-content-between align-items-center mb-3">
      <div>
        <h5 class="text-white fw-bold mb-1">Column Mappings</h5>
        <p class="text-muted small mb-0">Map database fields to exact Excel/CSV headers for uploads.</p>
      </div>

      <!-- Action Buttons: View Mode vs Edit Mode -->
      <div class="d-flex align-items-center gap-2">
        <template v-if="!isEditMode">
          <button
            class="btn btn-outline-primary btn-sm d-flex align-items-center gap-2"
            :disabled="isLoading"
            @click="enterEditMode"
          >
            <i class="bi bi-pencil-square"></i>
            <span>Edit All Mappings</span>
          </button>
        </template>
        <template v-else>
          <button
            class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-2"
            :disabled="isSaving"
            @click="cancelEditMode"
          >
            <i class="bi bi-x-lg"></i>
            <span>Cancel</span>
          </button>
          <button
            class="btn btn-primary btn-sm d-flex align-items-center gap-2"
            :disabled="isSaving"
            @click="handleSaveAll"
          >
            <span v-if="isSaving" class="spinner-border spinner-border-sm" role="status"></span>
            <i v-else class="bi bi-check-lg"></i>
            <span>{{ isSaving ? 'Saving...' : 'Save Changes' }}</span>
          </button>
        </template>
      </div>
    </div>

    <!-- Mode Alert Badge -->
    <div v-if="isEditMode" class="alert alert-info py-2 px-3 mb-3 d-flex align-items-center justify-content-between">
      <div class="d-flex align-items-center gap-2 small">
        <i class="bi bi-info-circle-fill"></i>
        <span><strong>Edit Mode Active:</strong> You can modify the Excel/CSV Header values below. Click <strong>Save Changes</strong> when done or <strong>Cancel</strong> to discard.</span>
      </div>
    </div>

    <!-- Table Card -->
    <div class="table-card position-relative">
      <div v-if="isLoading" class="p-5 text-center text-muted">
        <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
        <span>Loading column mappings from database...</span>
      </div>
      <table v-else class="table-custom">
        <thead>
          <tr>
            <th style="width: 32%;">Database Field</th>
            <th>Excel/CSV Header</th>
            <th style="width: 15%; text-align: center;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.dbColumn">
            <td>
              <span class="text-light fw-medium font-monospace">{{ row.label }}</span>
              <span v-if="row.isCalculated" class="badge-calculated ms-2">
                Auto-calculated
              </span>
              <span v-if="row.isFromDb" class="badge-db ms-2">
                From DB
              </span>
              <span v-if="row.isRegexExtracted" class="badge-extracted ms-2">
                Smart Extraction
              </span>
            </td>
            <td>
              <!-- Auto-calculated -->
              <span v-if="row.isCalculated" class="text-muted small fst-italic">
                <i class="bi bi-gear me-1"></i> Calculated automatically by system
              </span>

              <!-- From DB -->
              <span v-else-if="row.isFromDb" class="text-muted small fst-italic">
                <i class="bi bi-database me-1"></i> Fetched automatically from Items DB
              </span>

              <!-- Editable: Edit Mode Active -->
              <input
                v-else-if="isEditMode"
                v-model="row.excelHeader"
                type="text"
                class="form-control form-control-sm idp-input font-monospace text-white"
                placeholder="Type exact header (e.g. B/E No.)"
              />

              <!-- Editable: View Mode Active -->
              <div v-else class="d-flex align-items-center gap-2">
                <span v-if="row.excelHeader" class="badge bg-dark border border-secondary text-light font-monospace px-2 py-1">
                  {{ row.excelHeader }}
                </span>
                <span v-else class="text-muted small fst-italic">
                  Not mapped (Default)
                </span>
              </div>
            </td>
            <td style="text-align: center;">
              <template v-if="!row.isCalculated && !row.isFromDb">
                <button
                  v-if="!isEditMode"
                  class="btn btn-sm btn-outline-light py-1 px-2"
                  title="Edit this mapping"
                  @click="openSingleEdit(row)"
                >
                  <i class="bi bi-pencil me-1"></i> Edit
                </button>
                <span v-else class="text-muted small">-</span>
              </template>
              <span v-else class="text-muted small">-</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Single Row Edit Modal -->
    <div
      v-if="showSingleModal && singleRow"
      class="modal-backdrop-custom d-flex align-items-center justify-content-center"
    >
      <div class="modal-card">
        <div class="modal-header d-flex justify-content-between align-items-center p-3 border-bottom border-secondary">
          <h6 class="modal-title text-white fw-bold mb-0">
            <i class="bi bi-pencil-square text-primary me-2"></i>Edit Column Mapping
          </h6>
          <button
            type="button"
            class="btn-close btn-close-white btn-sm"
            @click="showSingleModal = false"
          ></button>
        </div>
        <div class="modal-body p-3">
          <div class="mb-3">
            <label class="form-label text-muted small fw-semibold">Database Field</label>
            <input
              type="text"
              class="form-control form-control-sm idp-input bg-dark text-muted"
              :value="singleRow.label"
              disabled
            />
          </div>
          <div class="mb-3">
            <label class="form-label text-light small fw-semibold">Excel/CSV Header Name</label>
            <input
              v-model="singleRow.excelHeader"
              type="text"
              class="form-control form-control-sm idp-input font-monospace text-white"
              placeholder="e.g. B/E No., Net Wt, Ass. Value"
              autofocus
            />
            <div class="form-text text-muted small">
              Matches the exact column title found in uploaded Excel/CSV files.
            </div>
          </div>
        </div>
        <div class="modal-footer d-flex justify-content-end gap-2 p-3 border-top border-secondary">
          <button
            type="button"
            class="btn btn-outline-secondary btn-sm"
            :disabled="isSavingSingle"
            @click="showSingleModal = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm d-flex align-items-center gap-2"
            :disabled="isSavingSingle"
            @click="saveSingleEdit"
          >
            <span v-if="isSavingSingle" class="spinner-border spinner-border-sm" role="status"></span>
            <i v-else class="bi bi-check-lg"></i>
            <span>{{ isSavingSingle ? 'Saving...' : 'Save Mapping' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.column-mappings-container {
  font-family: 'Inter', sans-serif;
}
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
  padding: 10px 16px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #adb5bd;
  text-align: left;
}
.table-custom td {
  padding: 8px 16px;
  font-size: 0.85rem;
  border-bottom: 1px solid #2e343b;
  vertical-align: middle;
}
.table-custom tbody tr:hover td {
  background: #262b30;
}
.cursor-not-allowed {
  cursor: not-allowed;
}

.badge-calculated {
  display: inline-block;
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
  font-size: 0.72rem;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 4px;
}

.badge-db {
  display: inline-block;
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
  font-size: 0.72rem;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 4px;
}

.badge-extracted {
  display: inline-block;
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.3);
  font-size: 0.72rem;
  font-weight: 500;
  padding: 2px 7px;
  border-radius: 4px;
}

.modal-backdrop-custom {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.7);
  z-index: 1050;
}

.modal-card {
  background: #1e2227;
  border: 1px solid #3b424b;
  border-radius: 8px;
  width: 90%;
  max-width: 460px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
}
</style>
