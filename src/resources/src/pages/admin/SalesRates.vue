<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import axios from "axios";
import SearchInput from "@/components/common/SearchInput.vue";

interface SalesRate {
  id: number;
  clientId: number;
  clientName: string;
  clientBin: string;
  itemId: number;
  itemName: string;
  itemHsCode: string;
  unitId: number;
  unitName: string;
  salesRate: number;
  vatRate: number;
  additionPercent: number;
  vatableValue: number;
  activationDate: string;
  status: "Active" | "Frozen";
}

interface ClientOption {
  id: number;
  name: string;
  bin: string;
}

interface ItemOption {
  id: number;
  name: string;
  hsCode: string;
}

interface UnitOption {
  id: number;
  purchaseUnit: string;
  salesUnit: string;
  factor: number;
}

// Master Clients
const clientsList = ref<ClientOption[]>([]);

// Master Items for table filtering
const itemsList = ref<ItemOption[]>([]);

// Selected Client's Purchased Items ONLY (Dynamically fetched per client)
const clientPurchasedItems = ref<ItemOption[]>([]);
const isFetchingClientItems = ref(false);

// Units
const unitsList = ref<UnitOption[]>([]);

// Master Sales Rates Database
const salesRates = ref<SalesRate[]>([]);

// Filters State
const searchQuery = ref("");
const selectedClient = ref("");
const selectedItem = ref("");
const selectedStatus = ref("");
const currentPage = ref(1);
const itemsPerPage = ref(10);
const isLoading = ref(false);

// Modal State
const showModal = ref(false);
const isEditing = ref(false);
const formError = ref("");
const isSubmitting = ref(false);

// Autocomplete State inside Modal
const clientSearchText = ref("");
const showClientDropdown = ref(false);

const itemSearchText = ref("");
const showItemDropdown = ref(false);

// Rate History Modal
const showHistoryModal = ref(false);
const historyClientItem = ref<{ clientName: string; itemName: string; records: SalesRate[] }>({
  clientName: "",
  itemName: "",
  records: []
});

const todayDate = new Date().toISOString().slice(0, 10);

const form = ref({
  id: 0,
  clientId: "" as string | number,
  itemId: "" as string | number,
  unitId: 1 as number,
  salesRate: "" as string | number,
  vatRate: 15.00 as number,
  additionPercent: 36.00 as number,
  activationDate: todayDate,
  status: "Active" as "Active" | "Frozen"
});

// Autocomplete Filtered Clients for Modal (Only shows when user types text)
const modalFilteredClients = computed(() => {
  if (!clientSearchText.value.trim()) return [];
  const q = clientSearchText.value.toLowerCase().trim();
  return clientsList.value.filter(
    (c) => (c.name || "").toLowerCase().includes(q) || (c.bin || "").toLowerCase().includes(q)
  );
});

// Modal Items: ONLY client's purchased items, filtered strictly on typing (typing-only autocomplete)
const modalFilteredItems = computed(() => {
  if (!form.value.clientId) return [];
  if (!itemSearchText.value.trim() || form.value.itemId) {
    return [];
  }
  const q = itemSearchText.value.toLowerCase().trim();
  return clientPurchasedItems.value.filter(
    (i) => i.name.toLowerCase().includes(q) || (i.hsCode && i.hsCode.toLowerCase().includes(q))
  ).slice(0, 50);
});

// Computed Vatable Value for Modal (Realtime Auto Calculation)
const modalComputedVatableValue = computed(() => {
  const sr = Number(form.value.salesRate);
  const vr = Number(form.value.vatRate);
  if (!sr || isNaN(sr) || isNaN(vr) || vr < 0) return "0.00";
  const vatable = sr / (1 + vr / 100);
  return vatable.toFixed(2);
});

// Number formatter strictly without commas
const formatNumber = (val?: number | string) => {
  if (val === undefined || val === null || val === "" || isNaN(Number(val))) return "0.00";
  return Number(val).toFixed(2);
};

// Filtered Rates for Table
const filteredRates = computed(() => {
  let list = salesRates.value;

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(
      (r) =>
        r.clientName.toLowerCase().includes(q) ||
        r.clientBin.toLowerCase().includes(q) ||
        r.itemName.toLowerCase().includes(q) ||
        r.itemHsCode.toLowerCase().includes(q) ||
        r.unitName.toLowerCase().includes(q)
    );
  }

  if (selectedClient.value) {
    const cId = Number(selectedClient.value);
    list = list.filter((r) => r.clientId === cId);
  }

  if (selectedItem.value) {
    const iId = Number(selectedItem.value);
    list = list.filter((r) => r.itemId === iId);
  }

  if (selectedStatus.value) {
    list = list.filter((r) => r.status === selectedStatus.value);
  }

  return list;
});

// Pagination
const totalPages = computed(() => Math.max(1, Math.ceil(filteredRates.value.length / itemsPerPage.value)));
const paginatedRates = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value;
  return filteredRates.value.slice(start, start + itemsPerPage.value);
});

watch([searchQuery, selectedClient, selectedItem, selectedStatus, itemsPerPage], () => {
  currentPage.value = 1;
});

const fetchMasterData = async () => {
  try {
    const [cRes, iRes, uRes] = await Promise.allSettled([
      axios.get("/api/clients", { params: { limit: 1000, isActive: "all" } }),
      axios.get("/api/items", { params: { limit: 1000 } }),
      axios.get("/api/superadmin/unit-conversions", { params: { all: "true" } })
    ]);
    if (cRes.status === "fulfilled" && cRes.value.data?.data) {
      clientsList.value = cRes.value.data.data.map((c: any) => ({
        id: c.id,
        name: c.companyName || c.name,
        bin: c.binNumber || c.bin || ""
      }));
    }
    if (iRes.status === "fulfilled" && iRes.value.data?.data) {
      itemsList.value = iRes.value.data.data.map((i: any) => ({
        id: i.id,
        name: i.itemName || i.name,
        hsCode: i.hsCode || ""
      }));
    }
    if (uRes.status === "fulfilled" && uRes.value.data?.data) {
      unitsList.value = uRes.value.data.data.map((u: any) => ({
        id: u.id,
        purchaseUnit: u.purchaseUnit,
        salesUnit: u.salesUnit,
        factor: Number(u.factor || 1)
      }));
    }
  } catch (err) {
    console.error("Failed to load master data:", err);
  }
};

const fetchRates = async () => {
  isLoading.value = true;
  try {
    const res = await axios.get("/api/sales-rates", { params: { limit: 1000 } });
    if (res.data?.success && Array.isArray(res.data?.data)) {
      salesRates.value = res.data.data;
    } else if (Array.isArray(res.data)) {
      salesRates.value = res.data;
    } else {
      salesRates.value = [];
    }
  } catch (e) {
    salesRates.value = [];
  } finally {
    isLoading.value = false;
  }
};

const fetchClientPurchasedItems = async (clientId: number | string) => {
  const cId = Number(clientId);
  if (!cId || isNaN(cId)) {
    clientPurchasedItems.value = [];
    return;
  }
  isFetchingClientItems.value = true;
  try {
    const res = await axios.get(`/api/clients/${cId}/items`);
    if (res.data?.data && Array.isArray(res.data.data)) {
      clientPurchasedItems.value = res.data.data.map((i: any) => ({
        id: i.id,
        name: i.name || i.itemName,
        hsCode: i.hsCode || ""
      }));
    } else {
      clientPurchasedItems.value = [];
    }
  } catch (err) {
    console.error("Failed to fetch client items:", err);
    clientPurchasedItems.value = [];
  } finally {
    isFetchingClientItems.value = false;
  }
};

const selectModalClient = async (client: ClientOption) => {
  form.value.clientId = client.id;
  clientSearchText.value = client.name;
  showClientDropdown.value = false;

  // Clear previous item selection
  form.value.itemId = "";
  itemSearchText.value = "";

  // Dynamically fetch ONLY purchased items for this client
  await fetchClientPurchasedItems(client.id);

  // If there's exactly 1 item purchased by this client, auto-select it
  if (clientPurchasedItems.value.length === 1) {
    const firstItem = clientPurchasedItems.value[0];
    form.value.itemId = firstItem.id;
    itemSearchText.value = firstItem.name;
  }
};

const selectModalItem = (item: ItemOption) => {
  form.value.itemId = item.id;
  itemSearchText.value = item.name;
  showItemDropdown.value = false;
};

const handleClientInput = () => {
  form.value.clientId = "";
  clientPurchasedItems.value = [];
  form.value.itemId = "";
  itemSearchText.value = "";
  showClientDropdown.value = clientSearchText.value.trim().length > 0;
};

const handleClientFocus = () => {
  if (clientSearchText.value.trim().length > 0 && !isEditing.value) {
    showClientDropdown.value = true;
  }
};

const handleClientBlur = () => {
  setTimeout(() => {
    showClientDropdown.value = false;
  }, 200);
};

const handleItemInput = () => {
  form.value.itemId = "";
  if (form.value.clientId && itemSearchText.value.trim().length > 0) {
    showItemDropdown.value = true;
  } else {
    showItemDropdown.value = false;
  }
};

const handleItemFocus = () => {
  if (!isEditing.value && form.value.clientId && itemSearchText.value.trim().length > 0 && !form.value.itemId) {
    showItemDropdown.value = true;
  }
};

const handleItemBlur = () => {
  setTimeout(() => {
    showItemDropdown.value = false;
  }, 200);
};

const openAddModal = () => {
  isEditing.value = false;
  formError.value = "";
  clientPurchasedItems.value = [];

  form.value = {
    id: 0,
    clientId: "",
    itemId: "",
    unitId: unitsList.value[0]?.id || 1,
    salesRate: "",
    vatRate: 15.00,
    additionPercent: 36.00,
    activationDate: todayDate,
    status: "Active"
  };

  clientSearchText.value = "";
  itemSearchText.value = "";
  showClientDropdown.value = false;
  showItemDropdown.value = false;

  showModal.value = true;
};

const openEditModal = async (r: SalesRate) => {
  isEditing.value = true;
  formError.value = "";
  form.value = {
    id: r.id,
    clientId: r.clientId,
    itemId: r.itemId,
    unitId: r.unitId,
    salesRate: r.salesRate,
    vatRate: r.vatRate,
    additionPercent: r.additionPercent,
    activationDate: r.activationDate,
    status: r.status
  };

  clientSearchText.value = r.clientName;
  itemSearchText.value = r.itemName;
  showClientDropdown.value = false;
  showItemDropdown.value = false;

  showModal.value = true;
  await fetchClientPurchasedItems(r.clientId);
};

const handleSaveRate = async () => {
  if (!form.value.clientId || !form.value.itemId) {
    formError.value = "Please select both Client and Commodity Item.";
    return;
  }

  const numRate = Number(form.value.salesRate);
  if (isNaN(numRate) || numRate <= 0) {
    formError.value = "Please enter a valid positive Sales Rate.";
    return;
  }

  const numVat = Number(form.value.vatRate);
  if (isNaN(numVat) || numVat < 0) {
    formError.value = "VAT Rate must be zero or a positive percentage.";
    return;
  }

  const selectedDate = new Date(form.value.activationDate);
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  if (selectedDate > now) {
    formError.value = "Activation date cannot be in the future.";
    return;
  }

  isSubmitting.value = true;
  formError.value = "";

  try {
    const payload = {
      clientId: Number(form.value.clientId),
      itemId: Number(form.value.itemId),
      unitId: form.value.unitId ? Number(form.value.unitId) : null,
      salesRate: numRate,
      vatRate: numVat,
      additionPercent: Number(form.value.additionPercent) || 0,
      activationDate: form.value.activationDate,
      status: form.value.status
    };

    if (isEditing.value && form.value.id) {
      await axios.put(`/api/sales-rates/${form.value.id}`, payload);
    } else {
      await axios.post("/api/sales-rates", payload);
    }

    await fetchRates();
    showModal.value = false;
  } catch (err: any) {
    console.error("Failed to save sales rate:", err);
    formError.value = err.response?.data?.message || err.message || "Failed to save sales rate.";
  } finally {
    isSubmitting.value = false;
  }
};

const handleDeleteRate = async (r: SalesRate) => {
  if (r.status === "Frozen") {
    alert("Frozen historical rates cannot be deleted directly.");
    return;
  }

  if (!confirm(`Are you sure you want to delete the sales rate for "${r.clientName}" - "${r.itemName}"?`)) {
    return;
  }

  try {
    await axios.delete(`/api/sales-rates/${r.id}`);
    await fetchRates();
  } catch (err: any) {
    console.error("Failed to delete sales rate:", err);
    alert(err.response?.data?.message || "Failed to delete sales rate.");
  }
};

const viewRateHistory = async (r: SalesRate) => {
  try {
    const res = await axios.get("/api/sales-rates/history", {
      params: { clientId: r.clientId, itemId: r.itemId }
    });
    historyClientItem.value = {
      clientName: r.clientName,
      itemName: r.itemName,
      records: res.data?.data || []
    };
    showHistoryModal.value = true;
  } catch (err: any) {
    console.error("Failed to fetch rate history:", err);
    const records = salesRates.value.filter((x) => x.clientId === r.clientId && x.itemId === r.itemId);
    records.sort((a, b) => new Date(b.activationDate).getTime() - new Date(a.activationDate).getTime());
    historyClientItem.value = {
      clientName: r.clientName,
      itemName: r.itemName,
      records
    };
    showHistoryModal.value = true;
  }
};

onMounted(async () => {
  await fetchMasterData();
  await fetchRates();
});
</script>

<template>
  <div class="py-2">
    <!-- Breadcrumbs & Header -->
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-4">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Dashboard
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">Sales Rates</span>
        </div>
        <h4 class="text-white fw-bold mb-0">Sales & VAT Rates</h4>
      </div>

      <button class="btn btn-idp-primary btn-sm d-flex align-items-center gap-2" @click="openAddModal">
        <i class="bi bi-plus-lg"></i> Add Sales Rate
      </button>
    </div>

    <!-- Filter & Search Toolbar -->
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
      <!-- Left Filters -->
      <div class="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
        <!-- Search Input -->
        <SearchInput
          v-model="searchQuery"
          placeholder="Search client, BIN, item, HS code..."
          max-width="320px"
          min-width="240px"
          size="md"
        />

        <!-- Client Filter -->
        <div style="min-width: 190px;">
          <select v-model="selectedClient" class="form-select form-select-sm idp-input" style="height: 38px;">
            <option value="">All Clients</option>
            <option v-for="c in clientsList" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>

        <!-- Item Filter -->
        <div style="min-width: 200px;">
          <select v-model="selectedItem" class="form-select form-select-sm idp-input" style="height: 38px;">
            <option value="">All Commodity Items</option>
            <option v-for="item in itemsList" :key="item.id" :value="item.id">
              {{ item.name }} ({{ item.hsCode }})
            </option>
          </select>
        </div>

        <!-- Status Filter -->
        <div style="min-width: 140px;">
          <select v-model="selectedStatus" class="form-select form-select-sm idp-input" style="height: 38px;">
            <option value="">All Status</option>
            <option value="Active">Active Only</option>
            <option value="Frozen">Frozen Only</option>
          </select>
        </div>
      </div>

      <!-- Right Rows selector -->
      <div class="d-flex align-items-center gap-2">
        <label class="text-muted small mb-0">Rows:</label>
        <select v-model="itemsPerPage" class="form-select form-select-sm idp-input" style="width: 75px; height: 38px;">
          <option :value="10">10</option>
          <option :value="25">25</option>
          <option :value="50">50</option>
        </select>
      </div>
    </div>

    <!-- Table (Standard IDP-V2 Theme) -->
    <div class="idp-table-wrapper">
      <div class="table-responsive">
        <table class="table idp-table table-sm align-middle text-nowrap">
          <thead>
            <tr>
              <th class="text-center" style="width: 50px;">#</th>
              <th class="text-start">Client</th>
              <th class="text-start">Commodity Item</th>
              <th class="text-center" style="width: 90px;">Unit</th>
              <th class="text-end" style="width: 130px;">Sales Rate</th>
              <th class="text-end" style="width: 100px;">VAT (%)</th>
              <th class="text-end" style="width: 120px;">Addition (%)</th>
              <th class="text-center" style="width: 140px;">Activation Date</th>
              <th class="text-center" style="width: 110px;">Status</th>
              <th class="text-end" style="width: 140px;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="10" class="text-center py-5 text-muted">
                <span class="spinner-border spinner-border-sm text-primary me-2"></span>
                Loading sales rates...
              </td>
            </tr>

            <tr v-else-if="filteredRates.length === 0">
              <td colspan="10" class="text-center py-5 text-muted">
                <i class="bi bi-percent fs-3 d-block mb-2 text-secondary"></i>
                No sales rates found matching your criteria.
              </td>
            </tr>

            <tr v-for="(r, index) in paginatedRates" :key="r.id">
              <!-- 1. Serial # (Center) -->
              <td class="text-center text-muted small">{{ (currentPage - 1) * itemsPerPage + index + 1 }}</td>

              <!-- 2. Client (Left) -->
              <td class="text-start">
                <div class="fw-bold text-white">{{ r.clientName }}</div>
                <div class="text-muted small">BIN: {{ r.clientBin }}</div>
              </td>

              <!-- 3. Commodity Item (Left) -->
              <td class="text-start">
                <div class="text-light">{{ r.itemName }}</div>
                <div class="text-info small font-monospace">[{{ r.itemHsCode }}]</div>
              </td>

              <!-- 4. Unit (Center) -->
              <td class="text-center">
                <span class="badge bg-dark border border-secondary text-light">{{ r.unitName }}</span>
              </td>

              <!-- 5. Sales Rate (Right) -->
              <td class="text-end font-monospace text-white fw-semibold">
                {{ formatNumber(r.salesRate) }}
              </td>

              <!-- 6. VAT Rate (Right) -->
              <td class="text-end font-monospace text-success">
                {{ formatNumber(r.vatRate) }}%
              </td>

              <!-- 7. Addition (Right) -->
              <td class="text-end font-monospace text-warning">
                {{ formatNumber(r.additionPercent) }}%
              </td>

              <!-- 8. Activation Date (Center) -->
              <td class="text-center text-muted small">
                {{ r.activationDate }}
              </td>

              <!-- 9. Status (Center) -->
              <td class="text-center">
                <span
                  class="badge"
                  :class="r.status === 'Active' ? 'bg-success bg-opacity-25 text-success border border-success' : 'bg-secondary bg-opacity-25 text-muted border border-secondary'"
                >
                  {{ r.status }}
                </span>
              </td>

              <!-- 10. Actions (Right) -->
              <td class="text-end">
                <div class="d-inline-flex align-items-center justify-content-end gap-1">
                  <button
                    v-if="r.status === 'Active'"
                    class="btn btn-sm btn-outline-info"
                    title="Edit Rate"
                    @click="openEditModal(r)"
                  >
                    <i class="bi bi-pencil"></i>
                  </button>

                  <button
                    class="btn btn-sm btn-outline-primary"
                    title="Rate History"
                    @click="viewRateHistory(r)"
                  >
                    <i class="bi bi-clock-history"></i>
                  </button>

                  <button
                    v-if="r.status === 'Active'"
                    class="btn btn-sm btn-outline-danger"
                    title="Delete Rate"
                    @click="handleDeleteRate(r)"
                  >
                    <i class="bi bi-trash"></i>
                  </button>
                  <button
                    v-else
                    class="btn btn-sm btn-outline-secondary"
                    disabled
                    title="Frozen Archive"
                  >
                    <i class="bi bi-lock"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="d-flex justify-content-between align-items-center p-3 border-top border-secondary border-opacity-25" v-if="totalPages > 1">
        <div class="text-muted small">
          Page {{ currentPage }} of {{ totalPages }}
        </div>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-outline-secondary" :disabled="currentPage === 1" @click="currentPage--">
            Previous
          </button>
          <button class="btn btn-outline-secondary" :disabled="currentPage === totalPages" @click="currentPage++">
            Next
          </button>
        </div>
      </div>
    </div>

    <!-- Modal: Add / Edit Sales Rate (Standard IDP-V2 Theme with Autocomplete & Dynamic Items) -->
    <div v-if="showModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0, 0, 0, 0.75);">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content idp-card">
          <div class="modal-header border-secondary border-opacity-25">
            <h5 class="modal-title text-white">
              {{ isEditing ? 'Edit Sales Rate' : 'Add Sales Rate' }}
            </h5>
            <button type="button" class="btn-close btn-close-white" @click="showModal = false"></button>
          </div>

          <div class="modal-body p-4">
            <div v-if="formError" class="alert alert-danger py-2 small mb-3">{{ formError }}</div>

            <div class="row g-3">
              <!-- Row 1: Client & Commodity Item -->
              <div class="col-md-6">
                <div class="d-flex justify-content-between align-items-center mb-2" style="height: 20px;">
                  <label class="form-label text-muted small mb-0">Client <span class="text-danger">*</span></label>
                </div>
                <div class="position-relative">
                  <input
                    v-model="clientSearchText"
                    type="text"
                    class="form-control idp-input"
                    :disabled="isEditing"
                    placeholder="Type to search client or BIN..."
                    @focus="handleClientFocus"
                    @input="handleClientInput"
                    @blur="handleClientBlur"
                  />

                  <!-- Client Autocomplete Dropdown -->
                  <div
                    v-if="showClientDropdown && !isEditing && modalFilteredClients.length > 0"
                    class="position-absolute start-0 top-100 w-100 mt-1 bg-dark border border-secondary rounded shadow-lg"
                    style="max-height: 220px; overflow-y: auto; z-index: 1050;"
                  >
                    <div
                      v-for="c in modalFilteredClients"
                      :key="c.id"
                      class="p-2 border-bottom border-secondary border-opacity-25 cursor-pointer hover-bg-secondary text-start"
                      @mousedown.prevent="selectModalClient(c)"
                    >
                      <div class="text-white small fw-semibold">{{ c.name }}</div>
                      <div class="text-muted small font-monospace">BIN: {{ c.bin }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="col-md-6">
                <div class="d-flex justify-content-between align-items-center mb-2" style="height: 20px;">
                  <label class="form-label text-muted small mb-0">Commodity Item <span class="text-danger">*</span></label>
                  <span v-if="form.clientId && clientPurchasedItems.length > 0" class="text-success small" style="font-size: 0.72rem;">
                    <i class="bi bi-bag-check-fill me-1"></i> {{ clientPurchasedItems.length }} Purchased Items
                  </span>
                  <span v-else-if="form.clientId && !isFetchingClientItems && clientPurchasedItems.length === 0" class="text-warning small" style="font-size: 0.72rem;">
                    <i class="bi bi-exclamation-triangle me-1"></i> No Purchases Found
                  </span>
                </div>
                <div class="position-relative">
                  <input
                    v-model="itemSearchText"
                    type="text"
                    class="form-control idp-input"
                    :disabled="isEditing || !form.clientId"
                    :placeholder="!form.clientId ? 'Please select a client first...' : (clientPurchasedItems.length === 0 && !isFetchingClientItems ? 'No purchased items for this client' : 'Type to search purchased item...')"
                    @focus="handleItemFocus"
                    @input="handleItemInput"
                    @blur="handleItemBlur"
                  />

                  <!-- Item Autocomplete Dropdown -->
                  <div
                    v-if="showItemDropdown && !isEditing && form.clientId && itemSearchText.trim().length > 0"
                    class="position-absolute start-0 top-100 w-100 mt-1 bg-dark border border-secondary rounded shadow-lg"
                    style="max-height: 220px; overflow-y: auto; z-index: 1050;"
                  >
                    <div v-if="isFetchingClientItems" class="p-3 text-center text-muted small">
                      <span class="spinner-border spinner-border-sm text-primary me-2"></span>
                      Loading purchased items...
                    </div>
                    <div v-else-if="clientPurchasedItems.length === 0" class="p-3 text-center text-muted small">
                      <i class="bi bi-info-circle me-1"></i> এই ক্লায়েন্টের কোনো ক্রয়কৃত আইটেম নেই
                    </div>
                    <div v-else-if="modalFilteredItems.length === 0" class="p-3 text-center text-muted small">
                      No matching items found
                    </div>
                    <div
                      v-else
                      v-for="item in modalFilteredItems"
                      :key="item.id"
                      class="p-2 border-bottom border-secondary border-opacity-25 cursor-pointer hover-bg-secondary text-start"
                      @mousedown.prevent="selectModalItem(item)"
                    >
                      <div class="text-white small fw-semibold">{{ item.name }}</div>
                      <div class="text-info small font-monospace">[{{ item.hsCode }}]</div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Row 2: Sales Unit & Sales Rate -->
              <div class="col-md-6">
                <div class="d-flex justify-content-between align-items-center mb-2" style="height: 20px;">
                  <label class="form-label text-muted small mb-0">Sales Unit <span class="text-danger">*</span></label>
                </div>
                <select v-model="form.unitId" class="form-select idp-input">
                  <option v-for="u in unitsList" :key="u.id" :value="u.id">
                    {{ u.salesUnit }} (From {{ u.purchaseUnit }} x{{ u.factor }})
                  </option>
                </select>
              </div>

              <div class="col-md-6">
                <div class="d-flex justify-content-between align-items-center mb-2" style="height: 20px;">
                  <label class="form-label text-muted small mb-0">Sales Rate <span class="text-danger">*</span></label>
                </div>
                <input
                  v-model="form.salesRate"
                  type="number"
                  step="0.01"
                  min="0"
                  class="form-control idp-input"
                  placeholder="e.g. 1500.50"
                />
              </div>

              <!-- Row 3: VAT Rate (%) & Addition (%) -->
              <div class="col-md-6">
                <div class="d-flex justify-content-between align-items-center mb-2" style="height: 20px;">
                  <label class="form-label text-muted small mb-0">VAT Rate (%) <span class="text-danger">*</span></label>
                </div>
                <input
                  v-model.number="form.vatRate"
                  type="number"
                  step="0.01"
                  min="0"
                  class="form-control idp-input"
                  placeholder="15.00"
                />
              </div>

              <div class="col-md-6">
                <div class="d-flex justify-content-between align-items-center mb-2" style="height: 20px;">
                  <label class="form-label text-muted small mb-0">Addition (%)</label>
                </div>
                <input
                  v-model.number="form.additionPercent"
                  type="number"
                  step="0.01"
                  min="0"
                  class="form-control idp-input"
                  placeholder="0.00"
                />
              </div>

              <!-- Row 4: Vatable Value (Auto) & Activation Date -->
              <div class="col-md-6">
                <div class="d-flex justify-content-between align-items-center mb-2" style="height: 20px;">
                  <label class="form-label text-muted small mb-0">Vatable Value (Auto)</label>
                </div>
                <input
                  type="text"
                  class="form-control idp-input bg-dark text-info font-monospace"
                  :value="modalComputedVatableValue"
                  readonly
                  disabled
                />
              </div>

              <div class="col-md-6">
                <div class="d-flex justify-content-between align-items-center mb-2" style="height: 20px;">
                  <label class="form-label text-muted small mb-0">Activation Date <span class="text-danger">*</span></label>
                </div>
                <input
                  v-model="form.activationDate"
                  type="date"
                  :max="todayDate"
                  :disabled="isEditing"
                  class="form-control idp-input"
                />
              </div>
            </div>
          </div>

          <div class="modal-footer border-secondary border-opacity-25">
            <button type="button" class="btn btn-dark border-secondary btn-sm" @click="showModal = false">
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-idp-primary btn-sm d-flex align-items-center gap-2"
              :disabled="isSubmitting"
              @click="handleSaveRate"
            >
              <span v-if="isSubmitting" class="spinner-border spinner-border-sm"></span>
              <i v-else class="bi bi-check-lg"></i>
              {{ isEditing ? 'Update Rate' : 'Save Sales Rate' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal: Rate History Timeline (Standard IDP-V2 Theme) -->
    <div v-if="showHistoryModal" class="modal fade show d-block" tabindex="-1" style="background: rgba(0, 0, 0, 0.75);">
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content idp-card">
          <div class="modal-header border-secondary border-opacity-25">
            <div>
              <h5 class="modal-title text-white">
                Rate History & Audit Trail
              </h5>
              <div class="text-muted small">
                {{ historyClientItem.clientName }} • {{ historyClientItem.itemName }}
              </div>
            </div>
            <button type="button" class="btn-close btn-close-white" @click="showHistoryModal = false"></button>
          </div>

          <div class="modal-body p-4">
            <div class="table-responsive">
              <table class="table idp-table table-sm">
                <thead>
                  <tr>
                    <th>Activation Date</th>
                    <th>Unit</th>
                    <th class="text-end">Sales Rate</th>
                    <th class="text-end">VAT (%)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="rec in historyClientItem.records" :key="rec.id">
                    <td class="text-light small">
                      {{ rec.activationDate }}
                    </td>
                    <td>
                      <span class="badge bg-dark border border-secondary text-light">{{ rec.unitName }}</span>
                    </td>
                    <td class="text-end font-monospace text-white fw-bold">
                      {{ formatNumber(rec.salesRate) }}
                    </td>
                    <td class="text-end font-monospace text-success">
                      {{ formatNumber(rec.vatRate) }}%
                    </td>
                    <td>
                      <span
                        class="badge"
                        :class="rec.status === 'Active' ? 'bg-success bg-opacity-25 text-success border border-success' : 'bg-secondary bg-opacity-25 text-muted border border-secondary'"
                      >
                        {{ rec.status }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="modal-footer border-secondary border-opacity-25">
            <button type="button" class="btn btn-dark border-secondary btn-sm" @click="showHistoryModal = false">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hover-bg-secondary:hover {
  background-color: rgba(255, 255, 255, 0.08) !important;
}
.cursor-pointer {
  cursor: pointer;
}
</style>
