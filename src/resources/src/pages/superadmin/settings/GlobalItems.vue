<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import axios from "axios";
import { pulse } from "@/plugins/pulse";
import { useToast } from "@/composables/useToast";

const toast = useToast();

interface GlobalItem {
  id: number;
  hsCode: string;
  awHsCode?: string;
  name: string;
  unit: string;
  isActive: boolean;
}

interface MeasurementUnit {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

const items = ref<GlobalItem[]>([]);
const units = ref<MeasurementUnit[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const searchQuery = ref("");
const showModal = ref(false);
const isEditing = ref(false);

const form = ref({
  id: 0,
  hsCode: "",
  awHsCode: "",
  name: "",
  unit: "U",
  isActive: true
});
const formError = ref("");

// Route Guard: Block navigation when modal is open
onBeforeRouteLeave(() => {
  if (showModal.value) {
    toast.error("Please close or save the item modal before leaving this page.");
    return false;
  }
});

const loadData = async () => {
  isLoading.value = true;
  try {
    const [itemsRes, unitsRes] = await Promise.all([
      axios.get("/api/superadmin/global-items"),
      axios.get("/api/superadmin/measurement-units")
    ]);

    if (itemsRes.data?.success && Array.isArray(itemsRes.data.data)) {
      items.value = itemsRes.data.data.map((item: any) => ({
        id: item.id,
        hsCode: item.hsCode || item.hs_code || "",
        awHsCode: item.awHsCode || item.aw_hs_code || "",
        name: item.name || "",
        unit: item.unit || "U",
        isActive: item.isActive !== false && item.is_active !== false
      }));
    }

    if (unitsRes.data?.success && Array.isArray(unitsRes.data.data)) {
      units.value = unitsRes.data.data.map((u: any) => ({
        id: u.id,
        code: u.code || "",
        name: u.name || "",
        isActive: u.isActive !== false && u.is_active !== false
      }));
    }
  } catch (err: any) {
    console.error("Error loading master items:", err);
  } finally {
    isLoading.value = false;
  }
};

const handleRealtimeUpdate = (p: any) => {
  if (!p?.type || p.type === "global-items" || p.type === "measurement-units") {
    loadData();
  }
};

onMounted(() => {
  loadData();
  pulse.channel("auth").listen("global:settings-updated", handleRealtimeUpdate);
});

onUnmounted(() => {
  pulse.channel("auth").stopListening("global:settings-updated", handleRealtimeUpdate);
});

// Active units for select dropdown
const activeUnits = computed(() => {
  return units.value.filter((u) => u.isActive);
});

const filteredItems = computed(() => {
  if (!searchQuery.value.trim()) return items.value;
  const q = searchQuery.value.toLowerCase().trim();
  return items.value.filter(
    (i) =>
      i.name.toLowerCase().includes(q) ||
      i.hsCode.toLowerCase().includes(q) ||
      (i.awHsCode && i.awHsCode.toLowerCase().includes(q)) ||
      (i.unit && i.unit.toLowerCase().includes(q))
  );
});

const onHsCodeInput = () => {
  form.value.awHsCode = form.value.hsCode.replace(/\./g, "").trim();
};

const openAddModal = () => {
  isEditing.value = false;
  const defaultUnit = activeUnits.value[0]?.code || "U";
  form.value = {
    id: 0,
    hsCode: "",
    awHsCode: "",
    name: "",
    unit: defaultUnit,
    isActive: true
  };
  formError.value = "";
  showModal.value = true;
};

const openEditModal = (item: GlobalItem) => {
  isEditing.value = true;
  form.value = {
    id: item.id,
    hsCode: item.hsCode,
    awHsCode: item.awHsCode || item.hsCode.replace(/\./g, "").trim(),
    name: item.name,
    unit: item.unit || "U",
    isActive: item.isActive
  };
  formError.value = "";
  showModal.value = true;
};

const handleSave = async () => {
  if (!form.value.hsCode.trim()) {
    formError.value = "HS Code is required.";
    return;
  }
  if (!form.value.name.trim()) {
    formError.value = "Item / Product name is required.";
    return;
  }

  const enteredHs = form.value.hsCode.trim().toLowerCase();
  const duplicate = items.value.find(
    (item) => item.hsCode.trim().toLowerCase() === enteredHs && (!isEditing.value || item.id !== form.value.id)
  );
  if (duplicate) {
    formError.value = `HS Code "${form.value.hsCode.trim()}" already exists in the catalog! Duplicate HS Codes are not allowed.`;
    toast.error(formError.value);
    return;
  }

  isSaving.value = true;
  formError.value = "";

  const payload = {
    hsCode: form.value.hsCode.trim(),
    awHsCode: form.value.awHsCode.trim() || form.value.hsCode.replace(/\./g, "").trim(),
    name: form.value.name.trim(),
    unit: form.value.unit.trim() || "U",
    isActive: form.value.isActive
  };

  try {
    if (isEditing.value) {
      const targetId = form.value.id;
      const res = await axios.put(`/api/superadmin/global-items/${targetId}`, payload);
      if (res.data?.success) {
        const idx = items.value.findIndex((i) => i.id === targetId);
        if (idx !== -1) {
          items.value[idx] = { ...items.value[idx], ...payload, id: targetId };
        }
        showModal.value = false;
        toast.success("Commodity / HS Code updated successfully");
        await loadData();
      } else {
        formError.value = res.data?.error || "Failed to update item";
        toast.error(formError.value);
      }
    } else {
      const res = await axios.post("/api/superadmin/global-items", payload);
      if (res.data?.success) {
        const created = res.data.data;
        items.value.unshift({
          id: created?.id || Date.now(),
          ...payload,
          isActive: created?.isActive ?? payload.isActive
        });
        showModal.value = false;
        toast.success("Commodity / HS Code saved to database successfully");
        await loadData();
      } else {
        formError.value = res.data?.error || "Failed to create item";
        toast.error(formError.value);
      }
    }
  } catch (err: any) {
    formError.value =
      err?.response?.data?.error || err?.response?.data?.message || err?.message || "Server error";
    toast.error(formError.value);
  } finally {
    isSaving.value = false;
  }
};

const toggleStatus = async (item: GlobalItem) => {
  const prev = item.isActive;
  item.isActive = !item.isActive;
  try {
    const res = await axios.patch(`/api/superadmin/global-items/${item.id}/toggle`);
    if (!res.data?.success) {
      item.isActive = prev;
      toast.error("Failed to update status");
    } else {
      toast.success(`Item "${item.name}" status updated`);
    }
  } catch (err: any) {
    item.isActive = prev;
    toast.error(err?.response?.data?.error || "Error toggling status");
  }
};

const handleDelete = async (item: GlobalItem) => {
  if (confirm(`Are you sure you want to permanently delete HS Code "${item.hsCode} - ${item.name}" from database?`)) {
    const backup = [...items.value];
    items.value = items.value.filter((i) => i.id !== item.id);
    try {
      const res = await axios.delete(`/api/superadmin/global-items/${item.id}`);
      if (!res.data?.success) {
        items.value = backup;
        toast.error(res.data?.error || "Failed to delete item");
      } else {
        toast.success(`HS Code "${item.hsCode}" deleted from database`);
      }
    } catch (err: any) {
      items.value = backup;
      toast.error(err?.response?.data?.error || "Failed to delete item");
    }
  }
};
</script>

<template>
  <div class="settings-page">
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <div>
        <h5 class="text-white fw-bold mb-1">Global Master Commodity & HS Codes</h5>
        <p class="text-muted small mb-0">HS Codes and ASYCUDA AW codes catalog for automated item mapping.</p>
      </div>
      <button class="btn btn-primary btn-sm d-flex align-items-center gap-1" @click="openAddModal">
        <i class="bi bi-plus-lg"></i> Add Item
      </button>
    </div>

    <!-- Search Toolbar -->
    <div v-if="items.length > 0 || searchQuery" class="d-flex gap-2 mb-3">
      <div class="position-relative flex-grow-1" style="max-width: 340px;">
        <i class="bi bi-search position-absolute top-50 translate-middle-y ms-3 text-muted"></i>
        <input
          v-model="searchQuery"
          type="text"
          class="form-control form-control-sm ps-5 idp-input"
          placeholder="Search items, HS Code, AW Code..."
        />
      </div>
    </div>

    <!-- Table Card -->
    <div class="table-card position-relative">
      <div v-if="isLoading" class="p-5 text-center text-muted">
        <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
        <span>Loading HS codes catalog from database...</span>
      </div>
      <table v-else class="table-custom">
        <thead>
          <tr>
            <th style="width: 50px;">#</th>
            <th style="width: 160px;">HS Code</th>
            <th style="width: 140px;">AW HS Code</th>
            <th>Item / Product Name</th>
            <th style="width: 90px;">Unit</th>
            <th style="width: 110px;">Status</th>
            <th style="width: 100px; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, idx) in filteredItems" :key="item.id">
            <td class="text-muted">{{ idx + 1 }}</td>
            <td>
              <span class="hs-badge font-monospace">
                {{ item.hsCode || '—' }}
              </span>
            </td>
            <td>
              <span class="text-muted font-monospace small">
                {{ item.awHsCode || '—' }}
              </span>
            </td>
            <td>
              <span class="text-white fw-semibold">{{ item.name }}</span>
            </td>
            <td>
              <span class="badge-unit font-monospace">{{ item.unit || 'U' }}</span>
            </td>
            <td>
              <button
                type="button"
                class="badge-btn"
                :class="item.isActive ? 'badge-active' : 'badge-inactive'"
                @click="toggleStatus(item)"
              >
                <span class="dot"></span> {{ item.isActive ? 'Active' : 'Inactive' }}
              </button>
            </td>
            <td style="text-align: right;">
              <div class="d-flex gap-1 justify-content-end">
                <button class="action-btn btn-edit" title="Edit Item" @click="openEditModal(item)">
                  <i class="bi bi-pencil-fill"></i>
                </button>
                <button class="action-btn btn-del" title="Delete Item" @click="handleDelete(item)">
                  <i class="bi bi-trash3-fill"></i>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredItems.length === 0">
            <td colspan="7" class="text-center py-5 text-muted">
              <div class="d-flex flex-column align-items-center justify-content-center gap-2">
                <i class="bi bi-box-seam fs-2 text-secondary"></i>
                <span v-if="searchQuery">No commodity items found matching "{{ searchQuery }}"</span>
                <span v-else>No commodity items defined yet. Click "+ Add Item" to create one in the database.</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal (Static backdrop) -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal-box">
        <div class="modal-hdr">
          <h6 class="text-white fw-bold mb-0">
            {{ isEditing ? 'Edit Item / HS Code' : 'Add Item / HS Code' }}
          </h6>
          <button class="btn-close btn-close-white" @click="showModal = false"></button>
        </div>
        <div class="modal-bdy">
          <div v-if="formError" class="alert alert-danger py-2 small mb-3">
            {{ formError }}
          </div>

          <div class="row g-3 mb-3">
            <div class="col-6">
              <label class="form-label small fw-semibold">HS Code (8-digit) <span class="text-danger">*</span></label>
              <input
                v-model="form.hsCode"
                type="text"
                class="form-control form-control-sm idp-input font-monospace"
                placeholder="e.g. 8471.30.00"
                @input="onHsCodeInput"
              />
            </div>
            <div class="col-6">
              <label class="form-label small fw-semibold">AW HS Code (Auto)</label>
              <input
                v-model="form.awHsCode"
                type="text"
                class="form-control form-control-sm idp-input font-monospace text-muted"
                placeholder="Auto-generated"
                readonly
                tabindex="-1"
                style="cursor: not-allowed; background: rgba(0, 0, 0, 0.35); border-color: rgba(255, 255, 255, 0.1);"
              />
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label small fw-semibold">Item / Product Name <span class="text-danger">*</span></label>
            <input
              v-model="form.name"
              type="text"
              class="form-control form-control-sm idp-input"
              placeholder="e.g. Laptop Computers & Data Processors"
            />
          </div>

          <div class="mb-3">
            <label class="form-label small fw-semibold">Unit of Measurement</label>
            <select v-model="form.unit" class="form-select form-select-sm idp-input font-monospace">
              <option v-for="u in activeUnits" :key="u.code" :value="u.code">
                {{ u.code }} — {{ u.name }}
              </option>
            </select>
          </div>

          <div class="form-check form-switch mt-2">
            <input id="itemActiveSwitch" v-model="form.isActive" class="form-check-input" type="checkbox" />
            <label class="form-check-label small text-muted" for="itemActiveSwitch">Active Status</label>
          </div>
        </div>
        <div class="modal-ftr">
          <button class="btn btn-dark border-secondary btn-sm" :disabled="isSaving" @click="showModal = false">Cancel</button>
          <button class="btn btn-primary btn-sm d-flex align-items-center gap-1" :disabled="isSaving" @click="handleSave">
            <span v-if="isSaving" class="spinner-border spinner-border-sm me-1" role="status"></span>
            {{ isSaving ? 'Saving...' : 'Save Item' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
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
  padding: 10px 14px;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #adb5bd;
  text-align: left;
}
.table-custom td {
  padding: 12px 14px;
  font-size: 0.85rem;
  border-bottom: 1px solid #2e343b;
  vertical-align: middle;
}
.table-custom tbody tr:hover td {
  background: #2c3238;
}

.hs-badge {
  display: inline-block;
  padding: 3px 8px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.08);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 6px;
  letter-spacing: 0.5px;
}

.badge-unit {
  display: inline-block;
  padding: 2px 7px;
  font-size: 0.72rem;
  font-weight: 600;
  color: #38bdf8;
  background: rgba(56, 189, 248, 0.1);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 4px;
}

.badge-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
}
.badge-active {
  background: rgba(25, 135, 84, 0.15);
  color: #20c997;
  border: 1px solid rgba(25, 135, 84, 0.3);
}
.badge-inactive {
  background: rgba(108, 117, 125, 0.15);
  color: #adb5bd;
  border: 1px solid rgba(108, 117, 125, 0.3);
}
.dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.action-btn {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-edit { background: rgba(59, 142, 237, 0.15); color: #3b8eed; border: 1px solid rgba(59, 142, 237, 0.3); }
.btn-edit:hover { background: rgba(59, 142, 237, 0.25); }
.btn-del { background: rgba(220, 53, 69, 0.12); color: #ea868f; border: 1px solid rgba(220, 53, 69, 0.25); }
.btn-del:hover { background: rgba(220, 53, 69, 0.25); }

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}
.modal-box {
  background: #212529;
  border: 1px solid #3b424b;
  border-radius: 8px;
  width: 100%;
  max-width: 460px;
  overflow: hidden;
  box-shadow: 0 16px 36px rgba(0,0,0,0.5);
}
.modal-hdr {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  background: #1a1d21;
  border-bottom: 1px solid #3b424b;
}
.modal-bdy { padding: 18px; }
.modal-ftr {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 18px;
  background: #1a1d21;
  border-top: 1px solid #3b424b;
}
</style>
