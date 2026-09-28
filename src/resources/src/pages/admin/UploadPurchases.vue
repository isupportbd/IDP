<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import axios from "axios";
import MonthNavigator from "@/components/MonthNavigator.vue";
import { useToast } from "@/composables/useToast";

const router = useRouter();
const toast = useToast();

// Global Measurement Units
const globalUnits = ref<Array<{ id?: number; code: string; name: string }>>([
  { code: "U", name: "Unit" },
  { code: "KG", name: "Kilogram" },
  { code: "MT", name: "Metric Ton" },
  { code: "PCS", name: "Pieces" },
  { code: "LTR", name: "Liter" }
]);

const loadGlobalUnits = async () => {
  try {
    const res = await axios.get("/api/superadmin/measurement-units");
    if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
      globalUnits.value = res.data.data
        .filter((u: any) => u.isActive !== false && u.is_active !== false)
        .map((u: any) => ({
          id: u.id,
          code: u.code || "",
          name: u.name || ""
        }));
    }
  } catch (err) {
    console.error("Error loading global measurement units:", err);
  }
};

onMounted(() => {
  loadGlobalUnits();
});

// Top Upload Bar State
const selectedFile = ref<File | null>(null);
const fileName = ref("");
const fileSize = ref("");
const fileInputRef = ref<HTMLInputElement | null>(null);

const getLastMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};
const selectedMonth = ref(getLastMonth());
const isRebate = ref(false);
const isFfs = ref(false);

const isProcessing = ref(false);
const isSaving = ref(false);

// Temp Data Table State
const tempData = ref<any[]>([]);
const currentPage = ref(1);
const pageSize = ref(10);

// Modal States
const showMissingItemsModal = ref(false);
const missingItems = ref<Array<{ hsCode: string; name: string; awHsCode: string; unit?: string }>>([]);

const showMissingClientsModal = ref(false);
const missingClients = ref<Array<{ bin: string; name: string; clientTypeId?: number }>>([]);

const showCompareModal = ref(false);
const duplicateList = ref<any[]>([]);

const showFfsModal = ref(false);
const ffsPendingList = ref<any[]>([]);

// Dropdown Master Options
const clientTypeOptions = [
  { id: 1, name: "Importer" },
  { id: 2, name: "Commercial Importer" },
  { id: 3, name: "Manufacturer" },
  { id: 4, name: "Trader / Wholesaler" },
  { id: 5, name: "Exporter" },
  { id: 6, name: "Service Provider" }
];

// Helper Formatters
const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const formatNumber = (val: any) => {
  if (val === undefined || val === null || val === "") return "";
  const num = parseFloat(String(val).replace(/,/g, ""));
  if (isNaN(num)) return val;
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatMonthStr = (monthStr: string) => {
  if (!monthStr) return "";
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }).replace(" ", "-");
};

// Pagination Computations
const totalPages = computed(() => Math.max(1, Math.ceil(tempData.value.length / pageSize.value)));

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return tempData.value.slice(start, start + pageSize.value);
});

// File Selection Handlers
const setFile = (f: File) => {
  selectedFile.value = f;
  fileName.value = f.name;
  fileSize.value = (f.size / 1024).toFixed(1) + " KB";
};

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    setFile(target.files[0]);
  }
};

const triggerFileInput = () => {
  fileInputRef.value?.click();
};

const clearSelectedFile = (e?: Event) => {
  if (e) e.stopPropagation();
  selectedFile.value = null;
  fileName.value = "";
  fileSize.value = "";
  if (fileInputRef.value) fileInputRef.value.value = "";
};

const handleRebateChange = () => {
  if (isRebate.value) {
    isFfs.value = false;
  }
};

const handleFfsChange = () => {
  if (isFfs.value) {
    isRebate.value = false;
  }
};

// Process File (Add to Temp)
const processFile = async (silent: boolean | Event = false) => {
  if (!selectedFile.value) return;

  const isSilent = typeof silent === "boolean" ? silent : false;
  isProcessing.value = true;

  try {
    const formData = new FormData();
    formData.append("file", selectedFile.value);
    formData.append("month", selectedMonth.value);
    formData.append("isRebate", String(isRebate.value));
    formData.append("isFfs", String(isFfs.value));

    const response = await axios.post("/api/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });

    const data = response.data;
    if (data.success) {
      tempData.value = data.data || [];
      currentPage.value = 1;
      if (!isSilent) {
        toast.success(`File processed successfully. ${tempData.value.length} records ready for preview.`);
      }
    } else if (data.requiresItemMapping) {
      missingItems.value = (data.missingItems || []).map((item: any) => ({
        ...item,
        unit: item.unit || globalUnits.value[0]?.code || "U"
      }));
      showMissingItemsModal.value = true;
    } else if (data.requiresClientMapping) {
      missingClients.value = data.missingClients || [];
      showMissingClientsModal.value = true;
    } else {
      toast.error(data.message || "Failed to process file.");
    }
  } catch (error: any) {
    const data = error.response?.data;
    if (data?.requiresItemMapping) {
      missingItems.value = (data.missingItems || []).map((item: any) => ({
        ...item,
        unit: item.unit || globalUnits.value[0]?.code || "U"
      }));
      showMissingItemsModal.value = true;
    } else if (data?.requiresClientMapping) {
      missingClients.value = data.missingClients || [];
      showMissingClientsModal.value = true;
    } else {
      toast.error(data?.message || error.message || "An error occurred during file processing.");
    }
  } finally {
    isProcessing.value = false;
  }
};

// Missing Items Handlers
const cancelMissingItems = () => {
  showMissingItemsModal.value = false;
  missingItems.value = [];
  toast.error("Upload cancelled due to missing item mappings.");
};

const skipMissingItems = () => {
  const missingHsSet = new Set(
    missingItems.value.map((i) => (i.awHsCode || i.hsCode || "").replace(/[.\s]/g, ""))
  );
  const beforeCount = tempData.value.length;
  tempData.value = tempData.value.filter((row) => {
    const rawAw = (row.awHsCode || row.hsCode || "").replace(/[.\s]/g, "");
    return !missingHsSet.has(rawAw);
  });
  const skippedCount = beforeCount - tempData.value.length;
  showMissingItemsModal.value = false;
  missingItems.value = [];
  currentPage.value = 1;
  toast.warning(`Skipped ${skippedCount} row(s) with unmapped items. ${tempData.value.length} row(s) ready in preview.`);
};

const formatHsCodeInput = (item: any) => {
  if (!item.hsCode) return;
  const digits = item.hsCode.replace(/[^0-9a-zA-Z]/g, "");
  if (!item.hsCode.includes(".")) {
    if (digits.length === 8) {
      item.hsCode = `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}`;
    } else if (digits.length === 10) {
      item.hsCode = `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6, 8)}.${digits.slice(8, 10)}`;
    }
  }
};

const saveMissingItems = async () => {
  for (const item of missingItems.value) {
    if (!item.name || !item.name.trim()) {
      toast.error(`Please provide an Item Name for HS Code: ${item.hsCode || item.awHsCode}`);
      return;
    }
    if (!item.hsCode || !item.hsCode.trim()) {
      toast.error(`Please provide a standard HS Code for: ${item.name}`);
      return;
    }
  }

  isSaving.value = true;
  try {
    const res = await axios.post("/api/items/bulk", { items: missingItems.value });
    if (res.data?.success || res.status === 200) {
      toast.success(res.data?.message || "Item mappings saved to global catalog successfully!");
      showMissingItemsModal.value = false;
      missingItems.value = [];
      await processFile(true);
    } else {
      toast.error(res.data?.message || "Failed to save item mappings.");
    }
  } catch (err: any) {
    console.error("Error saving items:", err);
    toast.error(err.response?.data?.message || "Failed to save item mappings.");
  } finally {
    isSaving.value = false;
  }
};

// Missing Clients Handlers
const cancelMissingClients = () => {
  showMissingClientsModal.value = false;
  missingClients.value = [];
  toast.error("Upload cancelled due to unverified clients.");
};

const skipMissingClients = () => {
  const missingBinSet = new Set(missingClients.value.map((c) => String(c.bin).trim()));
  const beforeCount = tempData.value.length;
  tempData.value = tempData.value.filter((row) => !missingBinSet.has(String(row.bin).trim()));
  const skippedCount = beforeCount - tempData.value.length;
  showMissingClientsModal.value = false;
  missingClients.value = [];
  currentPage.value = 1;
  toast.warning(`Skipped ${skippedCount} row(s) for unregistered clients. ${tempData.value.length} row(s) ready in preview.`);
};

const saveMissingClients = async () => {
  for (const client of missingClients.value) {
    if (!client.name || !client.name.trim()) {
      toast.error(`Please provide a name for BIN: ${client.bin}`);
      return;
    }
  }

  isSaving.value = true;
  try {
    const res = await axios.post("/api/clients/bulk", { clients: missingClients.value });
    if (res.data?.success || res.status === 200) {
      toast.success(res.data?.message || "Missing clients registered successfully!");
      showMissingClientsModal.value = false;
      missingClients.value = [];
      await processFile(true);
    } else {
      toast.error(res.data?.message || "Failed to register missing clients.");
    }
  } catch (err: any) {
    showMissingClientsModal.value = false;
    missingClients.value = [];
    await processFile();
  } finally {
    isSaving.value = false;
  }
};

// Save Temp Data to Database
const saveToDatabase = async () => {
  if (!tempData.value || tempData.value.length === 0) return;

  isSaving.value = true;

  try {
    const response = await axios.post("/api/upload/save", {
      data: tempData.value,
      month: selectedMonth.value,
      isRebate: isRebate.value,
      isFfs: isFfs.value
    });

    const data = response.data;
    if (data.success) {
      if (data.duplicatesList && data.duplicatesList.length > 0) {
        duplicateList.value = data.duplicatesList;
        showCompareModal.value = true;
      }
      if (data.ffsPendingList && data.ffsPendingList.length > 0) {
        ffsPendingList.value = data.ffsPendingList;
        showFfsModal.value = true;
      }

      if (
        (!data.duplicatesList || data.duplicatesList.length === 0) &&
        (!data.ffsPendingList || data.ffsPendingList.length === 0)
      ) {
        toast.success(`${data.totalRowsProcessed || tempData.value.length} records saved to database successfully!`);
        resetUpload();
        setTimeout(() => {
          router.push("/admin/purchases");
        }, 1500);
      }
    } else {
      toast.error(data.message || "Failed to save data.");
    }
  } catch (error: any) {
    toast.error(error.response?.data?.message || "An error occurred during save.");
  } finally {
    isSaving.value = false;
  }
};

// Duplicate Compare Modal Handlers
const handleIgnoreDuplicate = (index: number) => {
  duplicateList.value.splice(index, 1);
  toast.info("Duplicate record skipped.");
  if (duplicateList.value.length === 0) {
    showCompareModal.value = false;
    resetUpload();
    setTimeout(() => {
      router.push("/admin/purchases");
    }, 800);
  }
};

const handleReplaceDuplicate = async (item: any, index: number) => {
  try {
    isSaving.value = true;
    await axios.post("/api/upload/replace", { itemsToReplace: [item] });
    toast.success("Duplicate record updated successfully.");
    duplicateList.value.splice(index, 1);
    if (duplicateList.value.length === 0) {
      showCompareModal.value = false;
      resetUpload();
      setTimeout(() => {
        router.push("/admin/purchases");
      }, 800);
    }
  } catch (err: any) {
    toast.error(err?.response?.data?.message || "Failed to replace duplicate record.");
    duplicateList.value.splice(index, 1);
    if (duplicateList.value.length === 0) {
      showCompareModal.value = false;
      resetUpload();
    }
  } finally {
    isSaving.value = false;
  }
};

const handleReplaceAll = async () => {
  if (duplicateList.value.length === 0) return;
  try {
    isSaving.value = true;
    await axios.post("/api/upload/replace", { itemsToReplace: duplicateList.value });
    toast.success(`All ${duplicateList.value.length} duplicate records updated successfully.`);
    duplicateList.value = [];
    showCompareModal.value = false;
    resetUpload();
    setTimeout(() => {
      router.push("/admin/purchases");
    }, 800);
  } catch (err: any) {
    toast.error(err?.response?.data?.message || "Failed to replace all duplicate records.");
  } finally {
    isSaving.value = false;
  }
};

const handleIgnoreAll = () => {
  const count = duplicateList.value.length;
  duplicateList.value = [];
  showCompareModal.value = false;
  resetUpload();
  toast.info(`Skipped ${count} duplicate record(s).`);
  setTimeout(() => {
    router.push("/admin/purchases");
  }, 800);
};

// FFS Resolution Modal Handlers
const handleSavePendingFfs = async (takeRebate: boolean) => {
  isSaving.value = true;
  try {
    const res = await axios.post("/api/upload/save-pending-ffs", {
      itemsToSave: ffsPendingList.value,
      takeRebate
    });
    toast.success(res.data.message || "FFS records saved successfully!");
    showFfsModal.value = false;
    ffsPendingList.value = [];
    resetUpload();
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to save FFS items");
    showFfsModal.value = false;
    ffsPendingList.value = [];
    resetUpload();
  } finally {
    isSaving.value = false;
  }
};

const cancelFfsModal = () => {
  showFfsModal.value = false;
  ffsPendingList.value = [];
  resetUpload();
  toast.info("Pending FFS records discarded.");
};

// Reset State
const resetUpload = () => {
  tempData.value = [];
  selectedFile.value = null;
  fileName.value = "";
  fileSize.value = "";
  if (fileInputRef.value) fileInputRef.value.value = "";
};
</script>

<template>
  <div class="py-2">
    <!-- Breadcrumbs -->
    <div class="d-flex align-items-center gap-2 mb-3">
      <router-link to="/" class="text-muted text-decoration-none small">
        <i class="bi bi-arrow-left me-1"></i> Dashboard
      </router-link>
      <span class="text-muted small">/</span>
      <span class="text-primary small fw-semibold">Upload Purchases</span>
    </div>

    <!-- Alert Banner -->
    <!-- Hidden Native File Input -->
    <input
      ref="fileInputRef"
      type="file"
      class="d-none"
      accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
      @change="handleFileSelect"
    />

    <!-- TOP UPLOAD CARD (Always Visible) -->
    <div class="idp-card p-3 mb-4">
      <div class="d-flex flex-wrap align-items-center gap-3">
        <!-- 1. Month Navigator -->
        <div class="flex-shrink-0" style="width: 210px;">
          <MonthNavigator v-model="selectedMonth" />
        </div>

        <!-- 2. 2-Segment Choose File Box -->
        <div
          class="choose-file-group d-flex align-items-center cursor-pointer flex-grow-1"
          :class="{ 'has-file-active': selectedFile }"
          @click="triggerFileInput"
        >
          <!-- Left Button Part -->
          <div class="choose-file-btn-part d-flex align-items-center gap-2 px-3">
            <i class="bi bi-cloud-arrow-up text-primary fs-5"></i>
            <span class="choose-file-title fw-semibold">Choose File</span>
          </div>

          <!-- Right Display Part -->
          <div class="choose-file-display-part flex-grow-1 px-3 d-flex align-items-center justify-content-between text-truncate">
            <span v-if="fileName" class="text-white small fw-medium text-truncate font-monospace">
              {{ fileName }} <span class="text-muted fw-normal">({{ fileSize }})</span>
            </span>
            <span v-else class="text-muted small">
              No file chosen
            </span>
            <button
              v-if="selectedFile"
              type="button"
              class="btn-close btn-close-white ms-2"
              style="font-size: 0.65rem;"
              title="Remove file"
              @click="clearSelectedFile"
            ></button>
          </div>
        </div>

        <!-- 3. Rebate Checkbox -->
        <div class="d-flex align-items-center gap-2 user-select-none flex-shrink-0">
          <input
            id="rebateCheck"
            v-model="isRebate"
            type="checkbox"
            class="form-check-input mt-0 cursor-pointer"
            @change="handleRebateChange"
          />
          <label for="rebateCheck" class="text-white small fw-semibold mb-0 cursor-pointer">
            Rebate
          </label>
        </div>

        <!-- 4. FFS Checkbox -->
        <div class="d-flex align-items-center gap-2 user-select-none flex-shrink-0">
          <input
            id="ffsCheck"
            v-model="isFfs"
            type="checkbox"
            class="form-check-input mt-0 cursor-pointer"
            @change="handleFfsChange"
          />
          <label for="ffsCheck" class="text-white small fw-semibold mb-0 cursor-pointer">
            FFS
          </label>
        </div>

        <!-- 5. Add to Temp Button -->
        <button
          class="btn btn-idp-primary px-4 fw-semibold d-flex align-items-center gap-2 flex-shrink-0"
          style="height: 38px;"
          :disabled="!selectedFile || isProcessing"
          @click="() => processFile(false)"
        >
          <span v-if="isProcessing" class="spinner-border spinner-border-sm"></span>
          <i v-else class="bi bi-play-fill fs-5"></i>
          <span>{{ isProcessing ? "Processing..." : "Add to Temp" }}</span>
        </button>
      </div>
    </div>

    <!-- PREVIEW PANEL SECTION (Directly below the top card) -->
    <div class="preview-panel-container mb-4">
      <!-- Empty Placeholder State (When no temp data) -->
      <div v-if="tempData.length === 0" class="idp-card p-5 text-center">
        <i class="bi bi-file-earmark-spreadsheet fs-1 text-muted d-block mb-3 opacity-50"></i>
        <h6 class="text-white fw-semibold mb-1">Spreadsheet Preview Panel</h6>
        <p class="text-muted small mb-0">
          Select an Excel or CSV file in the card above and click <strong>"Add to Temp"</strong> to inspect and preview rows here.
        </p>
      </div>

      <!-- Full 16-Column Temp Data Preview Table -->
      <div v-else class="idp-card p-4">
        <!-- Table Header Bar -->
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
          <div class="d-flex align-items-center gap-3">
            <h5 class="text-white fw-bold mb-0">Temp Data Preview</h5>
            <span class="badge-count rounded-pill px-3 py-1 font-monospace">
              {{ tempData.length }} Records Found
            </span>
          </div>

          <div class="d-flex align-items-center gap-2">
            <label class="text-muted small mb-0">Rows per page:</label>
            <select
              v-model="pageSize"
              class="form-select form-select-sm idp-input"
              style="width: 80px;"
              @change="currentPage = 1"
            >
              <option :value="10">10</option>
              <option :value="25">25</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </div>
        </div>

        <!-- 16-Column Paginated Data Table -->
        <div class="idp-table-wrapper mb-3" style="max-height: 520px; overflow: auto;">
          <table class="table idp-table mb-0 align-middle text-nowrap" style="font-size: 0.85rem;">
            <thead>
              <tr>
                <th class="text-center" style="width: 45px;">#</th>
                <th class="text-center">Office</th>
                <th class="text-center">Month</th>
                <th class="text-start">BE No</th>
                <th class="text-center">Date</th>
                <th class="text-center">HS Code</th>
                <th class="text-start">Item Name</th>
                <th class="text-end">Net Wt</th>
                <th class="text-end">Excess Qty</th>
                <th class="text-end">Value</th>
                <th class="text-end">CD</th>
                <th class="text-end">RD</th>
                <th class="text-end">SD</th>
                <th class="text-end">VAT</th>
                <th class="text-end">AT</th>
                <th class="text-start">LC Number</th>
                <th class="text-center">BIN</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in paginatedData" :key="row.tempId || idx">
                <td class="text-center text-muted">{{ (currentPage - 1) * pageSize + idx + 1 }}</td>
                <td class="text-center">{{ row.office }}</td>
                <td class="text-center">{{ formatMonthStr(selectedMonth) }}</td>
                <td class="text-start font-monospace text-white">{{ row.beNo }}</td>
                <td class="text-center">{{ formatDate(row.beDate) }}</td>
                <td class="text-center font-monospace text-primary">{{ row.hsCode }}</td>
                <td class="text-start fw-medium text-white">{{ row.itemName }}</td>
                <td class="text-end font-monospace">{{ formatNumber(row.netWt) }}</td>
                <td class="text-end font-monospace">{{ formatNumber(row.excessQty) }}</td>
                <td class="text-end font-monospace text-info">{{ formatNumber(row.assValue) }}</td>
                <td class="text-end font-monospace">{{ formatNumber(row.cd) }}</td>
                <td class="text-end font-monospace">{{ formatNumber(row.rd) }}</td>
                <td class="text-end font-monospace">{{ formatNumber(row.sd) }}</td>
                <td class="text-end font-monospace text-success">{{ formatNumber(row.vat) }}</td>
                <td class="text-end font-monospace text-warning">{{ formatNumber(row.at) }}</td>
                <td class="text-start font-monospace text-muted">{{ row.lcNumber }}</td>
                <td class="text-center font-monospace text-white">{{ row.bin }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination & Footer Actions -->
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 pt-3 border-top border-secondary border-opacity-25">
          <!-- Pagination -->
          <div class="d-flex align-items-center gap-2">
            <button
              class="btn btn-sm btn-outline-secondary px-3"
              :disabled="currentPage === 1"
              @click="currentPage--"
            >
              Previous
            </button>
            <span class="text-muted small">
              Page <strong class="text-white">{{ currentPage }}</strong> of <strong class="text-white">{{ totalPages }}</strong>
            </span>
            <button
              class="btn btn-sm btn-outline-secondary px-3"
              :disabled="currentPage === totalPages"
              @click="currentPage++"
            >
              Next
            </button>
          </div>

          <!-- Actions -->
          <div class="d-flex align-items-center gap-3">
            <button
              class="btn btn-outline-danger px-4 py-2 fw-semibold"
              :disabled="isSaving"
              @click="resetUpload"
            >
              Cancel
            </button>
            <button
              class="btn btn-idp-primary px-4 py-2 fw-semibold d-flex align-items-center gap-2"
              :disabled="isSaving"
              @click="saveToDatabase"
            >
              <span v-if="isSaving" class="spinner-border spinner-border-sm"></span>
              <i v-else class="bi bi-cloud-arrow-up-fill"></i>
              <span>{{ isSaving ? "Saving to Database..." : "Add to Database" }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL 1: Missing Items Mapping Modal -->
    <div v-if="showMissingItemsModal" class="modal-backdrop-idp">
      <div class="modal-dialog-idp modal-lg">
        <div class="idp-card p-4">
          <div class="d-flex justify-content-between align-items-center border-bottom border-secondary border-opacity-25 pb-3 mb-3">
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-tag-fill text-warning fs-5"></i>
              <h5 class="text-white fw-bold mb-0">Missing Item Mappings</h5>
            </div>
            <button type="button" class="btn-close btn-close-white" @click="cancelMissingItems"></button>
          </div>
          <div>
            <p class="text-muted small mb-3">
              The following items were found in the uploaded file but are not yet registered in the global catalog. The item name has been auto-extracted from the Excel description column. You can edit the standard HS Code or Item Name before saving.
            </p>

            <div class="mb-4" style="max-height: 380px; overflow-y: auto;">
              <div
                v-for="(item, idx) in missingItems"
                :key="idx"
                class="p-3 mb-2 rounded bg-dark border border-secondary border-opacity-30"
              >
                <div class="row g-3 align-items-center">
                  <!-- 1. AW HS Code (From Excel) -->
                  <div class="col-md-3">
                    <label class="form-label small text-muted mb-1">AW HS Code (Raw)</label>
                    <div class="form-control form-control-sm idp-input bg-black bg-opacity-40 font-monospace text-muted text-truncate" title="ASYCUDA World raw HS Code">
                      {{ item.awHsCode || (item.hsCode ? item.hsCode.replace(/[.\s]/g, '') : '—') }}
                    </div>
                  </div>

                  <!-- 2. Standard HS Code (Editable) -->
                  <div class="col-md-3">
                    <label class="form-label small text-muted mb-1">Standard HS Code <span class="text-danger">*</span></label>
                    <input
                      v-model="item.hsCode"
                      type="text"
                      class="form-control form-control-sm idp-input font-monospace text-primary fw-semibold"
                      placeholder="e.g. 2701.19.00"
                      @blur="formatHsCodeInput(item)"
                    />
                  </div>

                  <!-- 3. Item Name (Auto Pre-filled from Excel Description, Editable) -->
                  <div class="col-md-4">
                    <label class="form-label small text-muted mb-1">Item / Commodity Name <span class="text-danger">*</span></label>
                    <input
                      v-model="item.name"
                      type="text"
                      class="form-control form-control-sm idp-input fw-medium text-white"
                      placeholder="Item name from Excel description"
                    />
                  </div>

                  <!-- 4. Unit Dropdown (Global Units) -->
                  <div class="col-md-2">
                    <label class="form-label small text-muted mb-1">Unit</label>
                    <select
                      v-model="item.unit"
                      class="form-select form-select-sm idp-input font-monospace"
                    >
                      <option v-for="u in globalUnits" :key="u.code" :value="u.code">
                        {{ u.code }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div class="d-flex justify-content-between align-items-center pt-3 border-top border-secondary border-opacity-25">
              <button class="btn btn-outline-secondary btn-sm px-3" :disabled="isSaving" @click="cancelMissingItems">
                Cancel Upload
              </button>
              <div class="d-flex gap-2">
                <button
                  type="button"
                  class="btn btn-outline-warning btn-sm px-3"
                  :disabled="isSaving"
                  @click="skipMissingItems"
                >
                  <i class="bi bi-slash-circle me-1"></i> Skip Unmapped Items
                </button>
                <button class="btn btn-idp-primary btn-sm px-4" :disabled="isSaving" @click="saveMissingItems">
                  <span v-if="isSaving" class="spinner-border spinner-border-sm me-1"></span>
                  <span>{{ isSaving ? "Saving..." : "Save Items & Continue" }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL 2: Missing Clients Mapping Modal (Tenant Scoped) -->
    <div v-if="showMissingClientsModal" class="modal-backdrop-idp">
      <div class="modal-dialog-idp modal-lg">
        <div class="idp-card p-4">
          <div class="d-flex justify-content-between align-items-center border-bottom border-secondary border-opacity-25 pb-3 mb-3">
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-building-exclamation text-warning fs-5"></i>
              <h5 class="text-white fw-bold mb-0">Missing Clients Found</h5>
            </div>
            <button type="button" class="btn-close btn-close-white" @click="cancelMissingClients"></button>
          </div>
          <div>
            <p class="text-muted small mb-3">
              The following Business Identification Numbers (BIN) in the uploaded file are not registered under your client list. Please enter the Client Names to add them and proceed, or click <strong>Skip Unregistered</strong> to exclude these rows.
            </p>

            <div class="mb-4" style="max-height: 380px; overflow-y: auto;">
              <div
                v-for="(client, idx) in missingClients"
                :key="idx"
                class="p-3 mb-2 rounded bg-dark border border-secondary border-opacity-30"
              >
                <div class="row g-3 align-items-center">
                  <div class="col-md-4">
                    <label class="form-label small text-muted">BIN</label>
                    <div class="form-control form-control-sm idp-input bg-dark text-white font-monospace">
                      {{ client.bin }}
                    </div>
                  </div>
                  <div class="col-md-5">
                    <label class="form-label small text-muted">Client Name *</label>
                    <input
                      v-model="client.name"
                      type="text"
                      class="form-control form-control-sm idp-input"
                      placeholder="e.g. Acme Corporation Ltd"
                    />
                  </div>
                  <div class="col-md-3">
                    <label class="form-label small text-muted">Client Type</label>
                    <select
                      v-model="client.clientTypeId"
                      class="form-select form-select-sm idp-input"
                    >
                      <option v-for="t in clientTypeOptions" :key="t.id" :value="t.id">
                        {{ t.name }}
                      </option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div class="d-flex justify-content-between align-items-center pt-3 border-top border-secondary border-opacity-25">
              <button class="btn btn-outline-secondary btn-sm px-3" :disabled="isSaving" @click="cancelMissingClients">
                Cancel Upload
              </button>
              <div class="d-flex gap-2">
                <button
                  type="button"
                  class="btn btn-outline-warning btn-sm px-3"
                  :disabled="isSaving"
                  @click="skipMissingClients"
                >
                  <i class="bi bi-slash-circle me-1"></i> Skip Unregistered
                </button>
                <button class="btn btn-idp-primary btn-sm px-4" :disabled="isSaving" @click="saveMissingClients">
                  <span v-if="isSaving" class="spinner-border spinner-border-sm me-1"></span>
                  <span>{{ isSaving ? "Saving..." : "Save Clients & Continue" }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL 3: Duplicate Compare & Replace Modal -->
    <div v-if="showCompareModal" class="modal-backdrop-idp">
      <div class="modal-dialog-idp modal-xl">
        <div class="idp-card p-4">
          <!-- Modal Header -->
          <div class="d-flex flex-wrap justify-content-between align-items-center border-bottom border-secondary border-opacity-25 pb-3 mb-3 gap-2">
            <div class="d-flex align-items-center gap-2">
              <span class="fs-5">📑</span>
              <h5 class="text-white fw-bold mb-0">Duplicate Purchase Records Detected</h5>
              <span class="text-muted fw-bold font-monospace">
                ({{ duplicateList.length }})
              </span>
            </div>

            <!-- Bulk Action Buttons -->
            <div class="d-flex align-items-center gap-2">
              <button
                type="button"
                class="btn btn-idp-secondary btn-sm px-3 fw-medium d-flex align-items-center"
                :disabled="isSaving"
                title="Skip all duplicate records and keep existing database data"
                @click="handleIgnoreAll"
              >
                <i class="bi bi-skip-forward-fill text-muted me-2"></i>
                <span>Skip All</span>
              </button>
              <button
                type="button"
                class="btn btn-idp-primary btn-sm px-3 fw-semibold d-flex align-items-center"
                :disabled="isSaving"
                title="Replace all existing records with the newly uploaded Excel values"
                @click="handleReplaceAll"
              >
                <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
                <i v-else class="bi bi-lightning-charge-fill text-warning me-2"></i>
                <span>Replace All</span>
              </button>
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary ms-1"
                :disabled="isSaving"
                @click="showCompareModal = false"
              >
                <i class="bi bi-x-lg"></i>
              </button>
            </div>
          </div>

          <!-- Info Guide Banner -->
          <div class="dup-info-banner d-flex align-items-center gap-2 py-2 px-3 mb-3">
            <i class="bi bi-info-circle-fill text-warning fs-6 flex-shrink-0 me-1"></i>
            <span class="text-muted small">
              <strong class="text-white">{{ duplicateList.length }} records</strong> already exist. Review changes below. Fields with differences are highlighted.
            </span>
          </div>

          <!-- Scrollable Duplicate Cards List -->
          <div class="mb-2 pe-1" style="max-height: 520px; overflow-y: auto;">
            <div
              v-for="(item, index) in duplicateList"
              :key="index"
              class="dup-record-card mb-3"
            >
              <!-- Card Top Meta Bar -->
              <div class="dup-card-top-bar d-flex flex-wrap justify-content-between align-items-center px-3 py-2.5 gap-2">
                <div class="d-flex flex-wrap align-items-center gap-2">
                  <span class="dup-idx-badge font-monospace">
                    #{{ index + 1 }}
                  </span>
                  <span class="text-white fw-bold small d-flex align-items-center">
                    <i class="bi bi-building text-secondary me-2"></i>
                    {{ item.existing?.clientName || item.newData?.clientName || 'Client ID: ' + (item.existing?.clientId || item.newData?.clientId) }}
                  </span>
                  <span v-if="item.existing?.clientBin || item.newData?.bin" class="text-muted small font-monospace">
                    • BIN: {{ item.existing?.clientBin || item.newData?.bin }}
                  </span>
                  <span class="text-muted small font-monospace">
                    • BE: {{ item.newData?.beNo || item.existing?.beNo }} ({{ formatDate(item.newData?.beDate || item.existing?.beDate) }})
                  </span>
                </div>

                <!-- Individual Card Actions -->
                <div class="d-flex align-items-center gap-2">
                  <button
                    class="btn btn-sm btn-outline-secondary px-3 py-1 fw-medium"
                    :disabled="isSaving"
                    @click="handleIgnoreDuplicate(index)"
                  >
                    Skip
                  </button>
                  <button
                    class="btn btn-sm btn-idp-primary px-3 py-1 fw-semibold"
                    :disabled="isSaving"
                    @click="handleReplaceDuplicate(item, index)"
                  >
                    <span v-if="isSaving" class="spinner-border spinner-border-sm me-1"></span>
                    <span>Replace</span>
                  </button>
                </div>
              </div>

              <!-- Unified 3-Column Comparative Table -->
              <div class="table-responsive">
                <table class="table diff-comp-table mb-0 align-middle">
                  <thead>
                    <tr>
                      <th class="th-attr">ATTRIBUTE</th>
                      <th class="th-col">EXISTING (DATABASE)</th>
                      <th class="th-col">INCOMING (UPLOADED EXCEL)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td class="td-attr">Customs Office</td>
                      <td class="td-existing font-monospace">{{ item.existing?.office || '—' }}</td>
                      <td
                        class="td-incoming font-monospace"
                        :class="{ 'td-diff-highlight': (item.existing?.office || '').trim() !== (item.newData?.office || '').trim() }"
                      >
                        {{ item.newData?.office || '—' }}
                      </td>
                    </tr>
                    <tr>
                      <td class="td-attr">Total Qty</td>
                      <td class="td-existing font-monospace">{{ formatNumber(item.existing?.totalQty) }} MT</td>
                      <td
                        class="td-incoming font-monospace"
                        :class="{ 'td-diff-highlight': formatNumber(item.existing?.totalQty) !== formatNumber(item.newData?.totalQty) }"
                      >
                        {{ formatNumber(item.newData?.totalQty) }} MT
                      </td>
                    </tr>
                    <tr>
                      <td class="td-attr">Base Value</td>
                      <td class="td-existing font-monospace">{{ formatNumber(item.existing?.baseValueOfVat) }} ৳</td>
                      <td
                        class="td-incoming font-monospace"
                        :class="{ 'td-diff-highlight': formatNumber(item.existing?.baseValueOfVat) !== formatNumber(item.newData?.baseValueOfVat) }"
                      >
                        {{ formatNumber(item.newData?.baseValueOfVat) }} ৳
                      </td>
                    </tr>
                    <tr>
                      <td class="td-attr">VAT Amount</td>
                      <td class="td-existing font-monospace">{{ formatNumber(item.existing?.vat) }} ৳</td>
                      <td
                        class="td-incoming font-monospace"
                        :class="{ 'td-diff-highlight': formatNumber(item.existing?.vat) !== formatNumber(item.newData?.vat) }"
                      >
                        {{ formatNumber(item.newData?.vat) }} ৳
                      </td>
                    </tr>
                    <tr>
                      <td class="td-attr">AT Amount</td>
                      <td class="td-existing font-monospace">{{ formatNumber(item.existing?.at) }} ৳</td>
                      <td
                        class="td-incoming font-monospace"
                        :class="{ 'td-diff-highlight': formatNumber(item.existing?.at) !== formatNumber(item.newData?.at) }"
                      >
                        {{ formatNumber(item.newData?.at) }} ৳
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL 4: FFS Resolution Modal -->
    <div v-if="showFfsModal && ffsPendingList.length > 0" class="modal-backdrop-idp">
      <div class="modal-dialog-idp modal-md">
        <div class="idp-card p-4">
          <div class="d-flex justify-content-between align-items-center border-bottom border-secondary border-opacity-25 pb-3 mb-3">
            <div class="d-flex align-items-center gap-2">
              <i class="bi bi-info-circle-fill text-info fs-5"></i>
              <h5 class="text-white fw-bold mb-0">FFS Resolution Required</h5>
            </div>
            <button
              type="button"
              class="btn-close btn-close-white"
              :disabled="isSaving"
              @click="cancelFfsModal"
            ></button>
          </div>
          <div>
            <p class="text-white mb-3" style="line-height: 1.6;">
              The uploaded file contains <span class="badge bg-warning text-dark font-monospace">{{ ffsPendingList.length }}</span> records dated prior to <strong>July 1, 2025</strong>, which fall outside the standard FFS scope.
            </p>
            <p class="text-muted small mb-4">
              Would you like to claim Rebate for these pending records?
            </p>

            <div class="d-flex justify-content-between align-items-center pt-3 border-top border-secondary border-opacity-25">
              <button
                type="button"
                class="btn btn-outline-danger btn-sm px-3"
                :disabled="isSaving"
                @click="cancelFfsModal"
              >
                <i class="bi bi-x-circle me-1"></i> Discard
              </button>
              <div class="d-flex gap-2">
                <button
                  class="btn btn-outline-secondary px-3"
                  :disabled="isSaving"
                  @click="handleSavePendingFfs(false)"
                >
                  No (Non-Rebate)
                </button>
                <button
                  class="btn btn-idp-primary px-4"
                  :disabled="isSaving"
                  @click="handleSavePendingFfs(true)"
                >
                  <span v-if="isSaving" class="spinner-border spinner-border-sm me-1"></span>
                  <span>Yes (Claim Rebate)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.choose-file-group {
  background: #181b1f;
  border: 1px solid #3b424b;
  border-radius: 6px;
  height: 38px;
  overflow: hidden;
  user-select: none;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.choose-file-group:hover,
.choose-file-group.has-file-active {
  border-color: #3b8eed;
}

.choose-file-btn-part {
  background: rgba(255, 255, 255, 0.05);
  border-right: 1px solid #3b424b;
  height: 100%;
  flex-shrink: 0;
  transition: background-color 0.15s ease;
}

.choose-file-group:hover .choose-file-btn-part {
  background: rgba(59, 142, 237, 0.12);
}

.choose-file-title {
  font-size: 0.85rem;
  color: #f8f9fa;
  white-space: nowrap;
}

.choose-file-display-part {
  height: 100%;
  background: transparent;
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

.modal-dialog-idp.modal-md { max-width: 500px; }
.modal-dialog-idp.modal-lg { max-width: 800px; }
.modal-dialog-idp.modal-xl { max-width: 1100px; }

.badge-count {
  background: rgba(59, 142, 237, 0.15);
  color: #3b8eed;
  border: 1px solid rgba(59, 142, 237, 0.3);
  font-size: 0.75rem;
  font-weight: 600;
}

/* Duplicate Comparison Styles - IDP Theme Aligned */
.dup-info-banner {
  background: #1a1d21;
  border: 1px solid #3b424b;
  border-radius: 6px;
}

.dup-record-card {
  background: #212529;
  border: 1px solid #3b424b;
  border-radius: 6px;
  overflow: hidden;
  transition: border-color 0.15s ease;
}

.dup-record-card:hover {
  border-color: #4f5762;
}

.dup-card-top-bar {
  background: #1a1d21;
  border-bottom: 1px solid #3b424b;
}

.dup-idx-badge {
  background: #2c3238;
  color: #adb5bd;
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 600;
  font-size: 0.75rem;
  border: 1px solid #3b424b;
}

.diff-comp-table {
  --bs-table-bg: transparent !important;
  --bs-table-color: #f8f9fa !important;
  color: #f8f9fa !important;
  font-size: 0.84rem;
  border-collapse: collapse;
  width: 100%;
  margin-bottom: 0;
}

.diff-comp-table thead th {
  background: #1a1d21 !important;
  color: #adb5bd !important;
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  border-bottom: 1px solid #3b424b !important;
  border-top: none !important;
  padding: 8px 14px;
}

.diff-comp-table thead th.th-attr {
  width: 26%;
  border-right: 1px solid #3b424b !important;
}

.diff-comp-table thead th.th-col {
  width: 37%;
  border-right: 1px solid #3b424b !important;
}

.diff-comp-table thead th.th-col:last-child {
  border-right: none !important;
}

.diff-comp-table tbody tr {
  border-bottom: 1px solid #2b3035;
}

.diff-comp-table tbody tr:last-child {
  border-bottom: none;
}

.diff-comp-table tbody td {
  padding: 8px 14px;
  vertical-align: middle;
}

.td-attr {
  color: #adb5bd !important;
  font-weight: 500;
  background: #1d2125 !important;
  border-right: 1px solid #3b424b !important;
}

.td-existing {
  color: #f8f9fa !important;
  border-right: 1px solid #3b424b !important;
}

.td-incoming {
  color: #f8f9fa !important;
  border-right: none !important;
}

.td-diff-highlight {
  color: #ffc107 !important;
  font-weight: 700 !important;
  background: rgba(255, 193, 7, 0.12) !important;
}
</style>
