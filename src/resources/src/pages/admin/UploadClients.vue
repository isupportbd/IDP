<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import axios from "axios";
import { useToast } from "@/composables/useToast";
import SearchInput from "@/components/common/SearchInput.vue";

const router = useRouter();
const toast = useToast();

// ── File Selection & Parsing State ───────────────────────────
const selectedFile = ref<File | null>(null);
const fileName = ref("");
const fileSize = ref("");
const fileInputRef = ref<HTMLInputElement | null>(null);

const parsedClients = ref<any[]>([]);
const isProcessing = ref(false);
const isUploading = ref(false);
const searchQuery = ref("");

const currentPage = ref(1);
const pageSize = ref(15);

// ── Sample Template Download ─────────────────────────────────
const downloadSampleTemplate = async () => {
  const sampleData = [
    {
      "Company Name": "ABC Traders Ltd.",
      "Proprietor Name": "Md. Rafiqul Islam",
      "BIN Number": "001234567-0101",
      "TIN Number": "782910384721",
      "Trade License No": "TRAD/DSCC/019283",
      "Full Office Address": "House #12, Road #4, Motijheel C/A, Dhaka-1000",
      "Mobile": "01711234567",
      "Alternative Mobile": "01819234567",
      "Email": "info@abctraders.com",
      "Customer Type": "Commercial Importer",
      "Reference": "Direct Client",
      "VAT Portal User ID": "abc_vat2026",
      "VAT Portal Password": "User@1234",
      "VAT Service Type": "FULL",
      "Opening Balance (- for Due, + for Advance)": -5000,
      "Status": "Active",
      "Notes": "Imports wholesale goods via Chittagong Port"
    },
    {
      "Company Name": "XYZ Enterprise",
      "Proprietor Name": "Kamal Hossain",
      "BIN Number": "009876543-0202",
      "TIN Number": "981273645123",
      "Trade License No": "TRAD/DNCC/082736",
      "Full Office Address": "Plot #5, Kawran Bazar, Dhaka-1215",
      "Mobile": "01912345678",
      "Alternative Mobile": "",
      "Email": "contact@xyz-bd.com",
      "Customer Type": "Trader",
      "Reference": "Advocate Md. Ruhul Amin",
      "VAT Portal User ID": "xyz_tax",
      "VAT Portal Password": "Vat#5678",
      "VAT Service Type": "ONLY_RETURN",
      "Opening Balance (- for Due, + for Advance)": 2000,
      "Status": "Active",
      "Notes": "Monthly 9.1 submission client"
    }
  ];

  const XLSX = await import("xlsx");
  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws["!cols"] = [
    { wch: 26 }, // Company Name
    { wch: 22 }, // Proprietor Name
    { wch: 18 }, // BIN Number
    { wch: 16 }, // TIN Number
    { wch: 20 }, // Trade License No
    { wch: 38 }, // Full Office Address
    { wch: 16 }, // Mobile
    { wch: 18 }, // Alternative Mobile
    { wch: 24 }, // Email
    { wch: 22 }, // Customer Type
    { wch: 24 }, // Reference
    { wch: 20 }, // VAT Portal User ID
    { wch: 20 }, // VAT Portal Password
    { wch: 18 }, // VAT Service Type
    { wch: 26 }, // Opening Balance
    { wch: 12 }, // Status
    { wch: 32 }  // Notes
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clients_Template");
  XLSX.writeFile(wb, "client_bulk_import_template.xlsx");
};

// ── File Selection & Parsing ─────────────────────────────────
const triggerFileInput = () => {
  fileInputRef.value?.click();
};

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    parseFile(target.files[0]);
  }
};

const handleDropFile = (e: DragEvent) => {
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    parseFile(e.dataTransfer.files[0]);
  }
};

const clearFile = () => {
  selectedFile.value = null;
  fileName.value = "";
  fileSize.value = "";
  parsedClients.value = [];
  currentPage.value = 1;
  searchQuery.value = "";
  if (fileInputRef.value) fileInputRef.value.value = "";
};

const parseFile = (file: File) => {
  selectedFile.value = file;
  fileName.value = file.name;
  fileSize.value = (file.size / 1024).toFixed(1) + " KB";
  isProcessing.value = true;
  currentPage.value = 1;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const XLSX = await import("xlsx");
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rawRows.length === 0) {
        toast.error("The selected file contains no data rows.");
        isProcessing.value = false;
        return;
      }

      const normalizedList = rawRows.map((row) => {
        const rowKeys = Object.keys(row);
        const getVal = (...matchKeys: string[]) => {
          for (const mk of matchKeys) {
            const found = rowKeys.find((k) =>
              k.toLowerCase().replace(/[^a-z0-9]/g, "").includes(mk.toLowerCase().replace(/[^a-z0-9]/g, ""))
            );
            if (found && row[found] !== undefined && String(row[found]).trim() !== "") {
              return String(row[found]).trim();
            }
          }
          return "";
        };

        const rawDue = getVal(
          "openingbalance",
          "openingbal",
          "previousdue",
          "balance",
          "due",
          "advance",
          "opening"
        );
        let openingBal = 0;
        if (rawDue !== "") {
          const str = String(rawDue).trim().toLowerCase();
          const cleanNum = parseFloat(str.replace(/[^0-9.-]/g, ""));
          if (!isNaN(cleanNum) && cleanNum !== 0) {
            // If user supplied minus sign (e.g. -5000) or words 'due'/'বকেয়া' -> Due (client owes)
            if (str.includes("-") || str.includes("due") || str.includes("বকেয়া") || str.includes("বকেয়া") || str.includes("payable")) {
              openingBal = Math.abs(cleanNum); // Positive in ledger = Due
            } else {
              // Positive number or 'advance'/'অগ্রিম' -> Advance (credit)
              openingBal = -Math.abs(cleanNum); // Negative in ledger = Advance
            }
          }
        }

        return {
          companyName: getVal("company", "organization", "clientname", "name"),
          proprietorName: getVal("proprietor", "owner", "director", "contactperson"),
          binNumber: getVal("binnumber", "bin", "vatreg"),
          tinNumber: getVal("tinnumber", "tin"),
          tradeLicenseNo: getVal("tradelicense", "trade", "licenseno", "license"),
          address: getVal("fullofficeaddress", "officeaddress", "address", "location"),
          mobile: getVal("officialmobile", "mobile", "phone", "cell", "contact"),
          alternativeMobile: getVal("alternativemobile", "altmobile", "alt", "secondary", "otherphone"),
          email: getVal("officialemail", "email", "mail"),
          customerType: getVal("customertype", "businesstype", "type", "clienttype"),
          reference: getVal("reference", "introducer", "ref"),
          vatUserId: getVal(
            "vatportaluserid",
            "vatuserid",
            "portaluserid",
            "portaluser",
            "nbruser",
            "nbruserid",
            "vatuser",
            "userid",
            "username",
            "user",
            "portalid",
            "loginid",
            "loginuser"
          ),
          vatPassword: getVal(
            "vatportalpassword",
            "vatpassword",
            "portalpassword",
            "nbrpassword",
            "userpassword",
            "loginpassword",
            "password",
            "portalpass",
            "vatpass",
            "secret",
            "pass"
          ),
          vatServiceType: getVal("vatservicetype", "vatservice", "service", "scope") || "FULL",
          openingBalance: openingBal,
          isActive: getVal("status", "isactive", "active") || "Active",
          notes: getVal("specialnotes", "notes", "remark", "remarks")
        };
      }).filter(c => c.companyName || c.binNumber || c.mobile);

      if (normalizedList.length === 0) {
        toast.error("No valid client rows detected. Ensure at least Company Name, BIN, or Mobile column is present.");
        isProcessing.value = false;
        return;
      }

      normalizedList.forEach((c, idx) => {
        if (!c.companyName) {
          c.companyName = `Client ${c.binNumber || c.mobile || idx + 1}`;
        }
      });

      parsedClients.value = normalizedList;
      toast.success(`Successfully parsed ${normalizedList.length} client record(s).`);
    } catch (err: any) {
      console.error("Parse error:", err);
      toast.error("Failed to parse spreadsheet file.");
    } finally {
      isProcessing.value = false;
    }
  };
  reader.readAsArrayBuffer(file);
};

// ── Search & Pagination Computations ─────────────────────────
const filteredClients = computed(() => {
  if (!searchQuery.value) return parsedClients.value;
  const q = searchQuery.value.toLowerCase().trim();
  return parsedClients.value.filter((c) =>
    (c.companyName && c.companyName.toLowerCase().includes(q)) ||
    (c.binNumber && c.binNumber.toLowerCase().includes(q)) ||
    (c.mobile && c.mobile.toLowerCase().includes(q)) ||
    (c.proprietorName && c.proprietorName.toLowerCase().includes(q)) ||
    (c.vatUserId && c.vatUserId.toLowerCase().includes(q)) ||
    (c.vatPassword && c.vatPassword.toLowerCase().includes(q)) ||
    (c.customerType && c.customerType.toLowerCase().includes(q)) ||
    (c.reference && c.reference.toLowerCase().includes(q)) ||
    (c.email && c.email.toLowerCase().includes(q)) ||
    (c.tinNumber && c.tinNumber.toLowerCase().includes(q))
  );
});

const totalPages = computed(() => Math.max(1, Math.ceil(filteredClients.value.length / pageSize.value)));

const paginatedClients = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  return filteredClients.value.slice(start, start + pageSize.value);
});

// ── Submit Bulk Upload to Backend ────────────────────────────
const handleConfirmUpload = async () => {
  if (parsedClients.value.length === 0) {
    toast.error("No client records to upload.");
    return;
  }

  isUploading.value = true;
  try {
    const res = await axios.post("/api/clients/bulk", {
      clients: parsedClients.value
    });

    toast.success(res.data?.message || `Successfully uploaded ${parsedClients.value.length} client(s).`);
    router.push("/admin/clients");
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to upload clients.");
  } finally {
    isUploading.value = false;
  }
};
</script>

<template>
  <div class="upload-clients-page py-2">
    <!-- Header & Breadcrumbs -->
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Dashboard
          </router-link>
          <span class="text-muted small">/</span>
          <router-link to="/admin/clients" class="text-muted text-decoration-none small">
            Clients
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">Bulk Upload</span>
        </div>
        <h4 class="text-white fw-bold mb-0">Bulk Upload Client Organizations</h4>
      </div>

      <div class="d-flex align-items-center gap-2">
        <router-link to="/admin/clients" class="btn btn-outline-secondary btn-sm px-3 d-flex align-items-center gap-1">
          <i class="bi bi-arrow-left"></i>
          <span>Back to Clients</span>
        </router-link>
      </div>
    </div>

    <!-- ── TOP UPLOAD & CONTROL BAR (MATCHED EXACTLY) ────────── -->
    <div class="top-upload-card p-3 mb-4">
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-3">
        <!-- Left: Instructions -->
        <div>
          <div class="text-white fw-bold fs-6 mb-1 d-flex align-items-center gap-2">
            <i class="bi bi-file-earmark-excel text-success"></i>
            <span>Upload Excel (.xlsx, .xls) or CSV file</span>
          </div>
          <div class="text-muted small">
            Whatever information is found will be imported. Missing fields can be updated later from the client list.
          </div>
        </div>

        <!-- Right / Action Zone: Download + Choose File + Action -->
        <div class="d-flex flex-wrap align-items-center gap-2">
          <!-- Download Template Button -->
          <button
            type="button"
            class="btn btn-info btn-sm px-3 fw-semibold d-flex align-items-center gap-1 shadow-sm text-dark"
            @click="downloadSampleTemplate"
          >
            <i class="bi bi-download"></i>
            <span>Download Sample Template</span>
          </button>

          <!-- Hidden File Input -->
          <input
            ref="fileInputRef"
            type="file"
            class="d-none"
            accept=".xlsx, .xls, .csv"
            @change="handleFileChange"
          />

          <!-- Choose File Button -->
          <button
            type="button"
            class="btn btn-outline-light btn-sm px-3 d-flex align-items-center gap-1 shadow-sm"
            @click="triggerFileInput"
          >
            <i class="bi bi-folder2-open"></i>
            <span>{{ selectedFile ? 'Change File' : 'Choose File' }}</span>
          </button>

          <!-- Selected File Badge -->
          <div
            v-if="selectedFile"
            class="d-inline-flex align-items-center gap-2 bg-dark px-3 py-1 border border-secondary rounded font-monospace small"
          >
            <i class="bi bi-file-earmark-check text-success"></i>
            <span class="text-white text-truncate" style="max-width: 180px;">{{ fileName }}</span>
            <span class="text-muted">({{ fileSize }})</span>
            <button type="button" class="btn-close btn-close-white" style="font-size: 0.65rem;" @click="clearFile" title="Clear file"></button>
          </div>

          <!-- Confirm & Upload Button (Available on Top Bar) -->
          <button
            v-if="parsedClients.length > 0"
            type="button"
            class="btn btn-success btn-sm px-4 fw-semibold d-flex align-items-center gap-1 shadow-sm ms-lg-2"
            :disabled="isUploading"
            @click="handleConfirmUpload"
          >
            <span v-if="isUploading" class="spinner-border spinner-border-sm"></span>
            <i v-else class="bi bi-cloud-arrow-up-fill"></i>
            <span>{{ isUploading ? 'Uploading...' : `Upload & Save (${parsedClients.length} Clients)` }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ── DATA PREVIEW TABLE (ALWAYS VISIBLE) ──────────────── -->
    <div class="preview-section">
      <!-- Toolbar & Statistics -->
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 p-3 bg-dark border border-secondary rounded-top">
        <div class="d-flex align-items-center gap-2">
          <h6 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
            <i class="bi bi-table text-info"></i>
            <span>Parsed Data Preview</span>
          </h6>
          <span class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 font-monospace">
            {{ parsedClients.length }} Total Records
          </span>
          <span v-if="searchQuery" class="badge bg-info bg-opacity-25 text-info border border-info border-opacity-25 font-monospace">
            {{ filteredClients.length }} Filtered
          </span>
        </div>

        <div class="d-flex align-items-center gap-2 flex-grow-1 justify-content-end" style="max-width: 480px;">
          <!-- In-table Search -->
          <SearchInput
            v-model="searchQuery"
            placeholder="Search in preview..."
            max-width="300px"
          />

          <!-- Page size selector -->
          <select
            v-model="pageSize"
            class="idp-select"
            style="min-width: 130px; width: 130px;"
          >
            <option :value="10">10 / page</option>
            <option :value="15">15 / page</option>
            <option :value="25">25 / page</option>
            <option :value="50">50 / page</option>
          </select>
        </div>
      </div>

      <!-- Table Card with Full Columns -->
      <div class="table-card border-top-0 rounded-0 rounded-bottom shadow-sm">
        <div class="table-responsive" style="max-height: 520px;">
          <table class="table-custom">
            <thead class="sticky-top">
              <tr>
                <th style="width: 45px; text-align: center;">#</th>
                <th style="min-width: 220px;">Company Name</th>
                <th style="min-width: 140px;">BIN Number</th>
                <th style="min-width: 130px;">Mobile</th>
                <th style="min-width: 140px;">VAT User ID</th>
                <th style="min-width: 140px;">VAT Password</th>
                <th style="min-width: 150px; text-align: right;">Opening Balance</th>
              </tr>
            </thead>
            <tbody>
              <!-- Empty State: No file uploaded yet -->
              <tr v-if="parsedClients.length === 0">
                <td colspan="7" class="text-center py-5 text-muted">
                  <div class="py-4">
                    <i class="bi bi-file-earmark-excel text-secondary opacity-50" style="font-size: 3rem;"></i>
                    <h6 class="text-white fw-bold mt-2 mb-1">No Client Data Uploaded Yet</h6>
                    <p class="text-muted small mb-0">Click <span class="text-light fw-semibold">"Choose File"</span> from the top bar to load your Excel or CSV spreadsheet.</p>
                  </div>
                </td>
              </tr>

              <!-- Filter State: No search matches -->
              <tr v-else-if="filteredClients.length === 0">
                <td colspan="7" class="text-center py-4 text-muted">
                  <i class="bi bi-search text-secondary me-2"></i>
                  <span>No client records matching "<strong>{{ searchQuery }}</strong>"</span>
                </td>
              </tr>

              <!-- Data Rows -->
              <tr v-else v-for="(client, idx) in paginatedClients" :key="idx">
                <td class="text-muted font-monospace text-center">{{ (currentPage - 1) * pageSize + idx + 1 }}</td>
                <td>
                  <div class="fw-bold text-white">{{ client.companyName }}</div>
                </td>
                <td>
                  <span v-if="client.binNumber" class="font-monospace text-info fw-bold">{{ client.binNumber }}</span>
                  <span v-else class="text-muted small">—</span>
                </td>
                <td>
                  <span v-if="client.mobile" class="font-monospace text-warning">{{ client.mobile }}</span>
                  <span v-else class="text-muted small">—</span>
                </td>
                <td>
                  <span v-if="client.vatUserId" class="font-monospace text-light small">{{ client.vatUserId }}</span>
                  <span v-else class="text-muted small">—</span>
                </td>
                <td>
                  <span v-if="client.vatPassword" class="font-monospace text-warning small">{{ client.vatPassword }}</span>
                  <span v-else class="text-muted small">—</span>
                </td>
                <td style="text-align: right;">
                  <span
                    v-if="client.openingBalance > 0"
                    class="badge bg-danger bg-opacity-25 text-danger border border-danger border-opacity-25 font-monospace"
                  >
                    -{{ client.openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }) }} Tk (Due)
                  </span>
                  <span
                    v-else-if="client.openingBalance < 0"
                    class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 font-monospace"
                  >
                    +{{ Math.abs(client.openingBalance).toLocaleString('en-US', { minimumFractionDigits: 2 }) }} Tk (Adv)
                  </span>
                  <span v-else class="text-muted font-monospace small">
                    0.00 Tk
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Pagination Bar -->
        <div v-if="parsedClients.length > 0" class="d-flex flex-wrap justify-content-between align-items-center p-3 border-top border-secondary border-opacity-50">
          <div class="text-muted small">
            Showing {{ ((currentPage - 1) * pageSize) + 1 }} to {{ Math.min(currentPage * pageSize, filteredClients.length) }} of {{ filteredClients.length }} clients
          </div>

          <div class="d-flex align-items-center gap-1">
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm px-2"
              :disabled="currentPage <= 1"
              @click="currentPage--"
            >
              <i class="bi bi-chevron-left"></i>
            </button>
            <span class="text-muted small px-2 font-monospace">Page {{ currentPage }} / {{ totalPages }}</span>
            <button
              type="button"
              class="btn btn-outline-secondary btn-sm px-2"
              :disabled="currentPage >= totalPages"
              @click="currentPage++"
            >
              <i class="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Bottom Sticky Action Bar -->
      <div v-if="parsedClients.length > 0" class="d-flex justify-content-between align-items-center mt-3 p-3 bg-dark border border-secondary rounded shadow-sm">
        <button type="button" class="btn btn-outline-danger btn-sm px-3" @click="clearFile">
          <i class="bi bi-trash me-1"></i> Clear & Reset
        </button>

        <div class="d-flex align-items-center gap-2">
          <router-link to="/admin/clients" class="btn btn-outline-secondary btn-sm px-3">
            Cancel
          </router-link>
          <button
            type="button"
            class="btn btn-success btn-sm px-4 fw-semibold d-flex align-items-center gap-1 shadow-sm"
            :disabled="isUploading"
            @click="handleConfirmUpload"
          >
            <span v-if="isUploading" class="spinner-border spinner-border-sm"></span>
            <i v-else class="bi bi-cloud-arrow-up-fill"></i>
            <span>{{ isUploading ? 'Uploading Clients...' : `Confirm & Save (${parsedClients.length} Clients)` }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.upload-clients-page {
  width: 100%;
}

.top-upload-card {
  background: #1e2227;
  border: 1px solid #343a40;
  border-radius: 8px;
}

.dropzone-box {
  background: #15181c !important;
  border-width: 2px !important;
  transition: all 0.2s ease;
}

.dropzone-box:hover {
  border-color: #0d6efd !important;
  background-color: rgba(13, 110, 253, 0.04) !important;
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
  padding: 10px 14px;
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #adb5bd;
  text-align: left;
  border-bottom: 1px solid #343a40;
  background: #16191d;
}

.table-custom td {
  padding: 10px 14px;
  font-size: 0.82rem;
  border-bottom: 1px solid #282d34;
  vertical-align: middle;
  color: #e2e8f0;
}

.table-custom tbody tr:hover td {
  background: #252a30;
}

.idp-input {
  background-color: #15181c !important;
  border: 1px solid #343a40 !important;
  color: #f8f9fa !important;
  border-radius: 6px;
}

.search-box {
  position: relative;
}

.idp-search-input {
  background-color: #15181c !important;
  border: 1px solid #343a40 !important;
  color: #f8f9fa !important;
  border-radius: 6px;
  padding-left: 36px !important;
  padding-right: 28px !important;
  height: 36px;
  line-height: 1.5;
  font-size: 0.85rem;
  transition: all 0.15s ease;
}

.idp-search-input:focus {
  border-color: #0d6efd !important;
  box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25) !important;
  background-color: #1a1e24 !important;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  font-size: 0.85rem;
  pointer-events: none;
}

.clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #6c757d;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.clear-btn:hover {
  color: #f8f9fa;
}

.idp-select {
  background-color: #15181c !important;
  border: 1px solid #343a40 !important;
  color: #f8f9fa !important;
  border-radius: 6px;
  height: 36px;
  line-height: 34px;
  font-size: 0.85rem;
  padding: 0 34px 0 12px !important;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3e%3cpath fill='none' stroke='%23adb5bd' stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='m2 5 6 6 6-6'/%3e%3c/svg%3e") !important;
  background-repeat: no-repeat !important;
  background-position: right 12px center !important;
  background-size: 11px 9px !important;
  cursor: pointer;
  outline: none;
}

.idp-select:focus {
  border-color: #0d6efd !important;
  box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25) !important;
}

.cursor-pointer {
  cursor: pointer;
}
</style>
