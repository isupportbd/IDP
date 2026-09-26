<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import axios from "axios";

interface ClientRecord {
  id: number;
  name: string;
  bin: string;
  clientType: string;
  isActive: boolean;
}

const mode = ref<"db" | "manual">("db");
const manualInput = ref("");
const statusFilter = ref<"all" | "active" | "inactive">("active");
const selectedClientType = ref<string>("all");
const startIndex = ref<number>(1);
const batchSize = ref<number>(10);
const copied = ref(false);
const isLoading = ref(false);

// Clean raw BIN into numeric string
const cleanBin = (raw: string): string => {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
};

// Client Master Dataset from Database
const clients = ref<ClientRecord[]>([]);

// Dynamic Client Types
const clientTypesList = computed(() => {
  const set = new Set<string>();
  clients.value.forEach((c) => {
    if (c.clientType) set.add(c.clientType);
  });
  return Array.from(set);
});

// Fetch Clients from API
const fetchDbClients = async () => {
  isLoading.value = true;
  try {
    const res = await axios.get("/api/clients?limit=5000");
    if (res.data?.data && Array.isArray(res.data.data)) {
      clients.value = res.data.data.map((c: any) => ({
        id: c.id,
        name: c.companyName || c.name || "Unnamed Client",
        bin: c.binNumber || c.bin || "",
        clientType: c.customerTypeName || c.clientTypeName || c.clientType || "Standard",
        isActive: c.isActive !== false
      }));
    }
  } catch (err) {
    console.error("Failed to load clients for BIN formatter:", err);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchDbClients();
});

// Filtered DB Clients
const filteredDbClients = computed(() => {
  let list = clients.value;
  if (statusFilter.value === "active") {
    list = list.filter((c) => c.isActive === true);
  } else if (statusFilter.value === "inactive") {
    list = list.filter((c) => c.isActive === false);
  }
  if (selectedClientType.value !== "all") {
    list = list.filter((c) => c.clientType === selectedClientType.value);
  }
  return list;
});

// Available BINs list
const allAvailableBins = computed<string[]>(() => {
  if (mode.value === "db") {
    return filteredDbClients.value
      .filter((c) => c.bin && cleanBin(c.bin).length >= 9)
      .map((c) => cleanBin(c.bin));
  } else {
    return manualInput.value
      .split(/[\r\n,;]+/)
      .map((t) => cleanBin(t.trim()))
      .filter((t) => t.length >= 9);
  }
});

const totalBinsCount = computed(() => allAvailableBins.value.length);

// Sliced Batch based on Range
const selectedBatchBins = computed(() => {
  const total = allAvailableBins.value.length;
  if (total === 0) return [];
  const start = Math.max(0, (startIndex.value || 1) - 1);
  const size = Math.max(1, batchSize.value || 10);
  return allAvailableBins.value.slice(start, start + size);
});

// Semicolon Formatted Output String
const formattedOutput = computed(() => {
  if (selectedBatchBins.value.length === 0) return "";
  return selectedBatchBins.value.join(";");
});

// Range bounds
const rangeEnd = computed(() => {
  const total = allAvailableBins.value.length;
  if (total === 0) return 0;
  const start = Math.max(1, startIndex.value || 1);
  const size = Math.max(1, batchSize.value || 10);
  return Math.min(start + size - 1, total);
});

// Batch Navigation
const prevBatch = () => {
  const size = Math.max(1, batchSize.value || 10);
  const currentStart = Math.max(1, startIndex.value || 1);
  startIndex.value = Math.max(1, currentStart - size);
};

const nextBatch = () => {
  const size = Math.max(1, batchSize.value || 10);
  const currentStart = Math.max(1, startIndex.value || 1);
  const total = allAvailableBins.value.length;
  if (currentStart + size <= total) {
    startIndex.value = currentStart + size;
  }
};

const setQuickPreset = (start: number, size: number) => {
  startIndex.value = start;
  batchSize.value = size;
};

// Reset on mode/filter changes
watch([mode, statusFilter, selectedClientType], () => {
  startIndex.value = 1;
});

// Copy Handler
const copyToClipboard = async () => {
  if (!formattedOutput.value) return;
  try {
    await navigator.clipboard.writeText(formattedOutput.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.error("Failed to copy", err);
  }
};

const clearManualInput = () => {
  manualInput.value = "";
  startIndex.value = 1;
};
</script>

<template>
  <div class="bin-formatter-page">
    <!-- Header with Stats -->
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-4">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Dashboard
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">BIN Formatter</span>
        </div>
        <h4 class="text-white fw-bold mb-0">BIN Batch Extractor & Formatter</h4>
        <span class="text-muted small">
          Extract, filter, and batch client BIN numbers separated by semicolons for NBR VAT portal lookups
        </span>
      </div>

      <!-- Quick KPI Chips -->
      <div class="d-flex align-items-center gap-2 mt-3 mt-md-0">
        <div class="kpi-chip">
          <span class="kpi-label">Available BINs</span>
          <span class="kpi-val text-info">{{ totalBinsCount }}</span>
        </div>
        <div class="kpi-chip">
          <span class="kpi-label">Batch Size</span>
          <span class="kpi-val text-success">{{ selectedBatchBins.length }}</span>
        </div>
        <div class="kpi-chip d-none d-sm-flex">
          <span class="kpi-label">Delimiter</span>
          <span class="kpi-val text-warning">Semicolon (;)</span>
        </div>
      </div>
    </div>

    <!-- Main Two-Column Layout -->
    <div class="row g-4">
      <!-- LEFT COLUMN: Mode Switcher, Database Filters, and Range Controls -->
      <div class="col-lg-6">
        <div class="card-panel h-100 d-flex flex-column">
          <!-- 1. Source Mode Switcher -->
          <div class="mode-switcher-wrap mb-3">
            <button
              type="button"
              class="mode-switch-btn"
              :class="{ active: mode === 'db' }"
              @click="mode = 'db'"
            >
              <i class="bi bi-database-fill me-2"></i> Database Mode
            </button>
            <button
              type="button"
              class="mode-switch-btn"
              :class="{ active: mode === 'manual' }"
              @click="mode = 'manual'"
            >
              <i class="bi bi-clipboard-data me-2"></i> Manual Paste Mode
            </button>
          </div>

          <!-- 2A. DATABASE EXTRACTION FILTERS -->
          <div v-if="mode === 'db'" class="db-filter-panel mb-3 p-3 rounded-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="text-white fw-semibold small d-flex align-items-center gap-2">
                <i class="bi bi-funnel-fill text-primary"></i> Database Filters
              </span>
              <span v-if="isLoading" class="spinner-border spinner-border-sm text-primary"></span>
              <span v-else class="badge bg-dark border border-secondary text-info font-monospace" style="font-size: 0.75rem;">
                {{ totalBinsCount }} / {{ clients.length }} Clients
              </span>
            </div>

            <div class="row g-2">
              <!-- Filter 1: Status Filter -->
              <div class="col-sm-6">
                <label class="form-label text-muted small mb-1">1. Business Status</label>
                <select v-model="statusFilter" class="form-select form-select-sm idp-input">
                  <option value="all">All Statuses</option>
                  <option value="active">Active Clients Only</option>
                  <option value="inactive">Inactive Clients Only</option>
                </select>
              </div>

              <!-- Filter 2: Customer Type Filter -->
              <div class="col-sm-6">
                <label class="form-label text-muted small mb-1">2. Customer Type</label>
                <select v-model="selectedClientType" class="form-select form-select-sm idp-input">
                  <option value="all">All Types ({{ clientTypesList.length }})</option>
                  <option v-for="t in clientTypesList" :key="t" :value="t">
                    {{ t }}
                  </option>
                </select>
              </div>
            </div>
          </div>

          <!-- 2B. MANUAL PASTE AREA -->
          <div v-else class="manual-paste-panel mb-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <label class="form-label text-white small fw-medium mb-0">
                Paste BINs (Newline, comma, or semicolon separated)
              </label>
              <button
                type="button"
                class="btn btn-link btn-sm p-0 text-muted small text-decoration-none"
                @click="clearManualInput"
              >
                <i class="bi bi-trash me-1"></i> Clear
              </button>
            </div>
            <textarea
              v-model="manualInput"
              class="form-control idp-input font-monospace"
              rows="4"
              placeholder="e.g.&#10;0012345670101&#10;002345678-0202, 0034567890303&#10;0045678900404; 0056789010505"
            ></textarea>
            <div class="d-flex justify-content-between align-items-center text-muted small mt-1">
              <span>Detected valid BINs: <strong class="text-info">{{ totalBinsCount }}</strong></span>
            </div>
          </div>

          <!-- 3. RANGE & BATCH ENGINE -->
          <div class="range-panel p-3 rounded-3 flex-grow-1 d-flex flex-column justify-content-between">
            <div>
              <div class="d-flex justify-content-between align-items-center mb-3">
                <span class="text-white fw-semibold small d-flex align-items-center gap-2">
                  <i class="bi bi-sliders text-info"></i> Range & Batch Selection
                </span>
                <span class="text-muted small">1-Indexed Position</span>
              </div>

              <div class="row g-3 mb-3">
                <!-- Start Index -->
                <div class="col-6">
                  <label class="form-label text-muted small mb-1">Start No. (Item #)</label>
                  <div class="input-group input-group-sm">
                    <button
                      class="btn btn-dark border-secondary"
                      type="button"
                      :disabled="startIndex <= 1"
                      @click="startIndex = Math.max(1, startIndex - 1)"
                    >
                      <i class="bi bi-dash"></i>
                    </button>
                    <input
                      v-model.number="startIndex"
                      type="number"
                      min="1"
                      :max="totalBinsCount || 1"
                      class="form-control idp-input text-center fw-bold font-monospace"
                    />
                    <button
                      class="btn btn-dark border-secondary"
                      type="button"
                      :disabled="startIndex >= totalBinsCount"
                      @click="startIndex = Math.min(totalBinsCount, startIndex + 1)"
                    >
                      <i class="bi bi-plus"></i>
                    </button>
                  </div>
                </div>

                <!-- Batch Size -->
                <div class="col-6">
                  <label class="form-label text-muted small mb-1">Batch Size (Count)</label>
                  <div class="input-group input-group-sm">
                    <button
                      class="btn btn-dark border-secondary"
                      type="button"
                      :disabled="batchSize <= 1"
                      @click="batchSize = Math.max(1, batchSize - 1)"
                    >
                      <i class="bi bi-dash"></i>
                    </button>
                    <input
                      v-model.number="batchSize"
                      type="number"
                      min="1"
                      max="100"
                      class="form-control idp-input text-center fw-bold font-monospace"
                    />
                    <button
                      class="btn btn-dark border-secondary"
                      type="button"
                      @click="batchSize = batchSize + 1"
                    >
                      <i class="bi bi-plus"></i>
                    </button>
                  </div>
                </div>
              </div>

              <!-- Fast Navigation & Quick Presets -->
              <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
                <div class="btn-group" role="group">
                  <button
                    type="button"
                    class="btn btn-dark border-secondary btn-sm"
                    :disabled="startIndex <= 1"
                    @click="prevBatch"
                  >
                    <i class="bi bi-chevron-left me-1"></i> Prev Batch
                  </button>
                  <button
                    type="button"
                    class="btn btn-dark border-secondary btn-sm"
                    :disabled="startIndex + batchSize > totalBinsCount"
                    @click="nextBatch"
                  >
                    Next Batch <i class="bi bi-chevron-right ms-1"></i>
                  </button>
                </div>

                <div class="d-flex align-items-center gap-1">
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm py-1 px-2"
                    style="font-size: 0.74rem;"
                    @click="setQuickPreset(1, 10)"
                  >
                    1-10
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm py-1 px-2"
                    style="font-size: 0.74rem;"
                    @click="setQuickPreset(11, 10)"
                  >
                    11-20
                  </button>
                  <button
                    type="button"
                    class="btn btn-outline-secondary btn-sm py-1 px-2"
                    style="font-size: 0.74rem;"
                    @click="setQuickPreset(1, totalBinsCount || 50)"
                  >
                    All ({{ totalBinsCount }})
                  </button>
                </div>
              </div>
            </div>

            <!-- Dynamic Range Live Banner -->
            <div class="range-info-banner">
              <i class="bi bi-info-circle-fill text-info me-2"></i>
              <span v-if="totalBinsCount > 0">
                Extracting BINs from <strong class="text-white">#{{ startIndex }}</strong> to
                <strong class="text-white">#{{ rangeEnd }}</strong> of
                <strong class="text-info">{{ totalBinsCount }}</strong> available records.
              </span>
              <span v-else class="text-muted">
                No matching BIN records found with the selected filter criteria.
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: Semicolon Formatted Output & Copy Panel -->
      <div class="col-lg-6">
        <div class="card-panel h-100 d-flex flex-column">
          <!-- Output Header -->
          <div class="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h6 class="text-white fw-bold mb-0">Formatted Semicolon Output</h6>
              <span class="text-muted small">Ready for pasting into NBR VAT Portal search box</span>
            </div>
          </div>

          <!-- Full Output Textarea -->
          <div class="flex-grow-1 position-relative mb-3 output-area-container">
            <textarea
              :value="formattedOutput"
              readonly
              class="form-control idp-input h-100 font-monospace output-textarea"
              placeholder="Semicolon formatted BINs will appear here automatically..."
            ></textarea>
          </div>

          <!-- Copy Button & Stats Bar -->
          <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 pt-2 border-top border-secondary">
            <div class="text-muted small font-monospace">
              <span>Length: <strong>{{ formattedOutput.length }}</strong> chars</span>
              <span class="mx-2">•</span>
              <span>Items: <strong>{{ selectedBatchBins.length }}</strong></span>
            </div>

            <button
              type="button"
              class="btn btn-sm px-3 py-1 fw-medium d-inline-flex align-items-center gap-1"
              :class="copied ? 'btn-success' : 'btn-primary'"
              :disabled="!formattedOutput"
              @click="copyToClipboard"
            >
              <i class="bi" :class="copied ? 'bi-check2' : 'bi-clipboard'"></i>
              <span>{{ copied ? 'Copied!' : 'Copy' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bin-formatter-page {
  font-family: 'Inter', sans-serif;
  color: #f8f9fa;
}

.card-panel {
  background: #212529;
  border: 1px solid #3b424b;
  border-radius: 10px;
  padding: 1.35rem 1.45rem;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
}

/* KPI Chips */
.kpi-chip {
  background: #1a1d21;
  border: 1px solid #323842;
  border-radius: 8px;
  padding: 6px 14px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}
.kpi-label {
  font-size: 0.7rem;
  color: #adb5bd;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.kpi-val {
  font-size: 1.05rem;
  font-weight: 700;
  font-family: monospace;
  line-height: 1.1;
}

/* Mode Switcher */
.mode-switcher-wrap {
  display: flex;
  background: #181b1f;
  border: 1px solid #323842;
  border-radius: 8px;
  padding: 4px;
  gap: 4px;
}
.mode-switch-btn {
  flex: 1;
  background: transparent;
  border: none;
  color: #adb5bd;
  font-size: 0.88rem;
  font-weight: 600;
  padding: 9px 16px;
  border-radius: 6px;
  transition: all 0.2s ease;
  cursor: pointer;
}
.mode-switch-btn:hover {
  color: #ffffff;
}
.mode-switch-btn.active {
  background: #3b8eed;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(59, 142, 237, 0.3);
}

/* Database Filter Panel */
.db-filter-panel {
  background: rgba(59, 142, 237, 0.05);
  border: 1px solid rgba(59, 142, 237, 0.2);
}

/* Range Panel */
.range-panel {
  background: #181b1f;
  border: 1px solid #323842;
}
.range-info-banner {
  background: rgba(13, 202, 240, 0.08);
  border: 1px solid rgba(13, 202, 240, 0.2);
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 0.82rem;
  color: #adb5bd;
}

/* Inputs */
.idp-input {
  background: #181b1f !important;
  border-color: #3b424b !important;
  color: #f8f9fa !important;
}
.idp-input:focus {
  border-color: #3b8eed !important;
  box-shadow: 0 0 0 0.2rem rgba(59, 142, 237, 0.2) !important;
}

/* Output Area */
.output-area-container {
  min-height: 280px;
}
.output-textarea {
  font-size: 0.92rem;
  line-height: 1.8;
  resize: none;
  background: #16181b !important;
  color: #0dcaf0 !important;
  padding: 18px;
  border-color: #3b424b !important;
  border-radius: 8px;
}
</style>
