<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import axios from "axios";
import { pulse } from "@/plugins/pulse";
import { useToast } from "@/composables/useToast";

const toast = useToast();

interface UnitConversion {
  id: number;
  purchaseUnit: string;
  salesUnit: string;
  factor: number;
  reverseFactor?: number;
}

interface MeasurementUnit {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
}

const units = ref<UnitConversion[]>([]);
const globalUnits = ref<MeasurementUnit[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const searchQuery = ref("");
const showModal = ref(false);
const isEditing = ref(false);
const formError = ref("");

const form = ref<{
  id: number;
  purchaseUnit: string;
  salesUnit: string;
  factor: number | string;
}>({
  id: 0,
  purchaseUnit: "",
  salesUnit: "",
  factor: ""
});

onBeforeRouteLeave(() => {
  if (showModal.value) {
    toast.error("Please close or save the modal before leaving this page.");
    return false;
  }
});

const loadData = async () => {
  isLoading.value = true;
  try {
    const [convRes, unitsRes] = await Promise.all([
      axios.get("/api/superadmin/unit-conversions"),
      axios.get("/api/superadmin/measurement-units")
    ]);
    if (convRes.data?.success && Array.isArray(convRes.data.data)) {
      units.value = convRes.data.data.map((u: any) => {
        const factorNum = Number(u.factor || 1);
        const revFactor = u.reverseFactor !== undefined
          ? Number(u.reverseFactor)
          : factorNum > 0 ? Math.round((1 / factorNum) * 100000000) / 100000000 : 0;
        return {
          id: u.id,
          purchaseUnit: u.purchaseUnit || u.purchase_unit || "",
          salesUnit: u.salesUnit || u.sales_unit || "",
          factor: factorNum,
          reverseFactor: revFactor
        };
      });
    }
    if (unitsRes.data?.success && Array.isArray(unitsRes.data.data)) {
      globalUnits.value = unitsRes.data.data.map((u: any) => ({
        id: u.id,
        code: u.code || "",
        name: u.name || "",
        isActive: u.isActive !== false && u.is_active !== false
      }));
    }
  } catch (err: any) {
    console.error("Error loading unit conversions & global units:", err);
  } finally {
    isLoading.value = false;
  }
};

const handleRealtimeUpdate = (p: any) => {
  if (!p?.type || p.type === "unit-conversions" || p.type === "measurement-units") {
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

const activeUnits = computed(() => {
  return globalUnits.value.filter((u) => u.isActive);
});

const filteredUnits = computed(() => {
  if (!searchQuery.value.trim()) return units.value;
  const q = searchQuery.value.toLowerCase().trim();
  return units.value.filter(
    (u) =>
      u.purchaseUnit.toLowerCase().includes(q) ||
      u.salesUnit.toLowerCase().includes(q) ||
      u.factor.toString().includes(q)
  );
});

const isSameUnit = computed(() => {
  return (
    Boolean(form.value.purchaseUnit) &&
    Boolean(form.value.salesUnit) &&
    form.value.purchaseUnit.trim().toUpperCase() === form.value.salesUnit.trim().toUpperCase()
  );
});

const computedReverseFactor = computed(() => {
  const f = parseFloat(form.value.factor.toString());
  if (!f || isNaN(f) || f <= 0) return null;
  return Math.round((1 / f) * 100000000) / 100000000;
});

const isPairDuplicate = computed(() => {
  if (!form.value.purchaseUnit || !form.value.salesUnit) return false;
  const p = form.value.purchaseUnit.trim().toUpperCase();
  const s = form.value.salesUnit.trim().toUpperCase();
  if (p === s) return false;
  return units.value.some(
    (u) =>
      ((u.purchaseUnit.toUpperCase() === p && u.salesUnit.toUpperCase() === s) ||
       (u.purchaseUnit.toUpperCase() === s && u.salesUnit.toUpperCase() === p)) &&
      (!isEditing.value || u.id !== form.value.id)
  );
});

const openAddModal = () => {
  isEditing.value = false;
  form.value = {
    id: 0,
    purchaseUnit: "",
    salesUnit: "",
    factor: ""
  };
  formError.value = "";
  showModal.value = true;
};

const openEditModal = (u: UnitConversion) => {
  isEditing.value = true;
  form.value = {
    id: u.id,
    purchaseUnit: u.purchaseUnit,
    salesUnit: u.salesUnit,
    factor: u.factor
  };
  formError.value = "";
  showModal.value = true;
};

const handleSave = async () => {
  if (!form.value.purchaseUnit) {
    formError.value = "Please select a valid Purchase Unit.";
    toast.error(formError.value);
    return;
  }
  if (!form.value.salesUnit) {
    formError.value = "Please select a valid Sales Unit (Base).";
    toast.error(formError.value);
    return;
  }
  if (form.value.purchaseUnit.trim().toUpperCase() === form.value.salesUnit.trim().toUpperCase()) {
    formError.value = `Purchase Unit and Sales Unit cannot be the same (${form.value.purchaseUnit} ➔ ${form.value.salesUnit}). Please select different units.`;
    toast.error(formError.value);
    return;
  }

  const factorNum = parseFloat(form.value.factor.toString());
  if (isNaN(factorNum) || factorNum <= 0) {
    formError.value = "Conversion Factor must be a positive number.";
    toast.error(formError.value);
    return;
  }

  const p = form.value.purchaseUnit.trim().toUpperCase();
  const s = form.value.salesUnit.trim().toUpperCase();
  const duplicate = units.value.find(
    (u) =>
      ((u.purchaseUnit.toUpperCase() === p && u.salesUnit.toUpperCase() === s) ||
       (u.purchaseUnit.toUpperCase() === s && u.salesUnit.toUpperCase() === p)) &&
      (!isEditing.value || u.id !== form.value.id)
  );
  if (duplicate) {
    formError.value = `Conversion between "${p}" and "${s}" already exists in the table! Duplicate unit pairs are not allowed.`;
    toast.error(formError.value);
    return;
  }

  isSaving.value = true;
  formError.value = "";

  const payload = {
    purchaseUnit: p,
    salesUnit: s,
    factor: factorNum
  };

  try {
    if (isEditing.value) {
      const targetId = form.value.id;
      const res = await axios.put(`/api/superadmin/unit-conversions/${targetId}`, payload);
      if (res.data?.success) {
        showModal.value = false;
        toast.success("Unit conversion updated successfully");
        await loadData();
      } else {
        formError.value = res.data?.error || "Failed to update conversion";
        toast.error(formError.value);
      }
    } else {
      const res = await axios.post("/api/superadmin/unit-conversions", payload);
      if (res.data?.success) {
        showModal.value = false;
        toast.success("Unit conversion pair saved to database successfully");
        await loadData();
      } else {
        formError.value = res.data?.error || "Failed to create conversion";
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

const handleDelete = async (u: UnitConversion) => {
  if (confirm(`Are you sure you want to delete conversion pair "${u.purchaseUnit} ⇄ ${u.salesUnit}"?`)) {
    const backup = [...units.value];
    units.value = units.value.filter((item) => item.id !== u.id);
    try {
      const res = await axios.delete(`/api/superadmin/unit-conversions/${u.id}`);
      if (!res.data?.success) {
        units.value = backup;
        toast.error(res.data?.error || "Failed to delete conversion");
      } else {
        toast.success(`Conversion pair "${u.purchaseUnit} ⇄ ${u.salesUnit}" deleted`);
        await loadData();
      }
    } catch (err: any) {
      units.value = backup;
      toast.error(err?.response?.data?.error || "Failed to delete conversion");
    }
  }
};
</script>

<template>
  <div class="settings-page">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <div>
        <h5 class="text-white fw-bold mb-1">Standard Unit Conversions</h5>
        <p class="text-muted small mb-0">Automatic bi-directional conversion rates for purchases, inventory and reports.</p>
      </div>
      <button class="btn btn-primary btn-sm d-flex align-items-center gap-1" @click="openAddModal">
        <i class="bi bi-plus-lg"></i> Add Conversion
      </button>
    </div>

    <!-- Search Toolbar -->
    <div v-if="units.length > 0 || searchQuery" class="d-flex gap-2 mb-3">
      <div class="position-relative flex-grow-1" style="max-width: 320px;">
        <i class="bi bi-search position-absolute top-50 translate-middle-y ms-3 text-muted"></i>
        <input
          v-model="searchQuery"
          type="text"
          class="form-control form-control-sm ps-5 idp-input"
          placeholder="Search unit, multiplier..."
        />
      </div>
    </div>

    <!-- Table Card (Consistent design tokens) -->
    <div class="table-card position-relative">
      <div v-if="isLoading" class="p-5 text-center text-muted">
        <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
        <span>Loading unit conversions from database...</span>
      </div>
      <table v-else class="table-custom">
        <thead>
          <tr>
            <th style="width: 50px;">#</th>
            <th style="width: 170px;">Purchase Unit (From)</th>
            <th style="width: 170px;">Sales Unit (To)</th>
            <th>Direct Conversion Factor</th>
            <th>Reverse Factor (Auto)</th>
            <th style="width: 90px; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(u, idx) in filteredUnits" :key="u.id">
            <td class="text-muted">{{ idx + 1 }}</td>
            <td>
              <span class="text-white fw-bold font-monospace">{{ u.purchaseUnit }}</span>
            </td>
            <td>
              <span class="text-info font-monospace fw-semibold">{{ u.salesUnit }}</span>
            </td>
            <td>
              <span class="formula-badge badge-direct">
                1 {{ u.purchaseUnit }} = {{ u.factor }} {{ u.salesUnit }}
              </span>
            </td>
            <td>
              <span class="formula-badge badge-reverse">
                1 {{ u.salesUnit }} = {{ u.reverseFactor !== undefined ? u.reverseFactor : (Math.round((1 / u.factor) * 100000000) / 100000000) }} {{ u.purchaseUnit }}
              </span>
            </td>
            <td style="text-align: right;">
              <div class="d-flex gap-1 justify-content-end">
                <button
                  type="button"
                  class="action-btn btn-edit"
                  title="Edit Conversion"
                  @click="openEditModal(u)"
                >
                  <i class="bi bi-pencil-fill"></i>
                </button>
                <button
                  type="button"
                  class="action-btn btn-del"
                  title="Delete Conversion"
                  @click="handleDelete(u)"
                >
                  <i class="bi bi-trash3-fill"></i>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredUnits.length === 0">
            <td colspan="6" class="text-center py-5 text-muted">
              <div class="d-flex flex-column align-items-center justify-content-center gap-2">
                <i class="bi bi-calculator fs-2 text-secondary"></i>
                <span v-if="searchQuery">No conversions found matching "{{ searchQuery }}"</span>
                <span v-else>No unit conversions defined yet. Click "+ Add Conversion" to create one in the database.</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Static Backdrop Add/Edit Modal -->
    <div v-if="showModal" class="modal-overlay" @click.self.stop>
      <div class="modal-box" @click.stop>
        <div class="modal-hdr">
          <h6 class="text-white fw-bold mb-0">
            {{ isEditing ? 'Edit Unit Conversion' : 'Add Unit Conversion' }}
          </h6>
          <button type="button" class="btn-close btn-close-white" @click="showModal = false"></button>
        </div>
        <div class="modal-bdy">
          <div v-if="formError" class="alert alert-danger py-2 small mb-3">
            {{ formError }}
          </div>

          <!-- Duplicate Pair Alert -->
          <div v-if="isPairDuplicate" class="alert alert-danger py-2 small mb-3 d-flex align-items-center gap-2">
            <i class="bi bi-exclamation-octagon-fill text-danger flex-shrink-0"></i>
            <span>This unit conversion pair ({{ form.purchaseUnit }} ⇄ {{ form.salesUnit }}) already exists in the table! Duplicate pairs cannot be added.</span>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-6">
              <label class="form-label text-muted small fw-semibold">Purchase Unit (From) <span class="text-danger">*</span></label>
              <select v-model="form.purchaseUnit" class="form-select form-select-sm idp-input font-monospace">
                <option value="" disabled>-- Select Unit --</option>
                <option
                  v-for="u in activeUnits"
                  :key="'p-' + u.id"
                  :value="u.code"
                  :disabled="u.code === form.salesUnit"
                >
                  {{ u.code }} — {{ u.name }} {{ u.code === form.salesUnit ? '(Selected as To Unit)' : '' }}
                </option>
              </select>
            </div>
            <div class="col-6">
              <label class="form-label text-muted small fw-semibold">Sales Unit (To / Base) <span class="text-danger">*</span></label>
              <select v-model="form.salesUnit" class="form-select form-select-sm idp-input font-monospace">
                <option value="" disabled>-- Select Base Unit --</option>
                <option
                  v-for="u in activeUnits"
                  :key="'s-' + u.id"
                  :value="u.code"
                  :disabled="u.code === form.purchaseUnit"
                >
                  {{ u.code }} — {{ u.name }} {{ u.code === form.purchaseUnit ? '(Selected as From Unit)' : '' }}
                </option>
              </select>
            </div>
          </div>

          <!-- Same unit alert -->
          <div v-if="isSameUnit" class="alert alert-warning py-2 small mb-3 d-flex align-items-center gap-2">
            <i class="bi bi-exclamation-triangle-fill text-warning flex-shrink-0"></i>
            <span>From Unit and To Unit cannot be identical (e.g. {{ form.purchaseUnit }} ➔ {{ form.salesUnit }}). Please select different units.</span>
          </div>

          <div class="mb-3">
            <label class="form-label text-muted small fw-semibold">Conversion Factor <span class="text-danger">*</span></label>
            <input
              v-model="form.factor"
              type="number"
              step="0.000001"
              min="0.00000001"
              class="form-control form-control-sm idp-input font-monospace"
              placeholder="e.g. 0.001, 1000, 12"
            />
            <span class="text-muted fs-8">How many sales units are contained in 1 purchase unit</span>
          </div>

          <!-- Real-Time 2-Way Sync Preview Box -->
          <div
            v-if="form.purchaseUnit && form.salesUnit && !isSameUnit && computedReverseFactor"
            class="conversion-preview-card p-3 mb-2 rounded border"
          >
            <div class="d-flex align-items-center justify-content-between mb-2">
              <span class="text-muted fs-8 fw-semibold text-uppercase letter-spacing-1">
                <i class="bi bi-arrow-left-right text-info me-1"></i> Auto Bi-directional Conversion Preview
              </span>
              <span class="badge bg-success-subtle text-success border border-success-subtle px-2 py-0 fs-8">
                2-Way Sync
              </span>
            </div>
            <div class="row g-2">
              <div class="col-6">
                <div class="p-2 rounded formula-preview-box">
                  <div class="text-muted fs-8 mb-1">Direct (From ➔ To)</div>
                  <div class="font-monospace text-warning fw-semibold fs-8 text-truncate">
                    1 {{ form.purchaseUnit }} = {{ form.factor }} {{ form.salesUnit }}
                  </div>
                </div>
              </div>
              <div class="col-6">
                <div class="p-2 rounded formula-preview-box">
                  <div class="text-muted fs-8 mb-1">Reverse (To ➔ From)</div>
                  <div class="font-monospace text-info fw-semibold fs-8 text-truncate">
                    1 {{ form.salesUnit }} = {{ computedReverseFactor }} {{ form.purchaseUnit }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="modal-ftr">
          <button type="button" class="btn btn-secondary btn-sm" @click="showModal = false">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm d-flex align-items-center gap-1"
            :disabled="isSaving || isSameUnit || isPairDuplicate || !form.purchaseUnit || !form.salesUnit"
            @click="handleSave"
          >
            <span v-if="isSaving" class="spinner-border spinner-border-sm" role="status"></span>
            <span>{{ isEditing ? 'Update Conversion' : 'Save Conversion' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page {
  font-family: 'Inter', sans-serif;
  animation: fadeIn 0.15s ease-in-out;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(3px); }
  to { opacity: 1; transform: translateY(0); }
}

.idp-input {
  background: #1e2227 !important;
  border: 1px solid #3b424b !important;
  color: #fff !important;
}
.idp-input:focus {
  border-color: #0d6efd !important;
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25) !important;
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

.formula-badge {
  display: inline-block;
  padding: 3px 10px;
  font-size: 0.8rem;
  font-weight: 600;
  font-family: monospace;
  border-radius: 6px;
}
.badge-direct {
  color: #ffc107;
  background: rgba(255, 193, 7, 0.08);
  border: 1px solid rgba(255, 193, 7, 0.25);
}
.badge-reverse {
  color: #0dcaf0;
  background: rgba(13, 202, 240, 0.08);
  border: 1px solid rgba(13, 202, 240, 0.25);
}

.conversion-preview-card {
  background: #181b1f;
  border-color: #2e343b !important;
}
.formula-preview-box {
  background: #1f2329;
  border: 1px solid #323841;
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
  max-width: 500px;
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
.fs-8 { font-size: 0.75rem; }
.letter-spacing-1 { letter-spacing: 0.5px; }
</style>

