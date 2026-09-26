<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import axios from "axios";
import { pulse } from "@/plugins/pulse";
import { useToast } from "@/composables/useToast";

const toast = useToast();

interface ServiceUnitItem {
  id: number;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

const units = ref<ServiceUnitItem[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const searchQuery = ref("");
const showModal = ref(false);
const isEditing = ref(false);

const form = ref({
  id: 0,
  code: "",
  name: "",
  description: "",
  isActive: true
});
const formError = ref("");

// Prevent navigation while modal is open
onBeforeRouteLeave(() => {
  if (showModal.value) {
    toast.error("Please close or save the modal before leaving this page.");
    return false;
  }
});

const fetchUnits = async () => {
  isLoading.value = true;
  try {
    const res = await axios.get("/api/superadmin/service-units");
    if (res.data?.success && Array.isArray(res.data.data)) {
      units.value = res.data.data.map((u: any) => ({
        id: u.id,
        code: u.code || "",
        name: u.name || "",
        description: u.description || "",
        isActive: u.isActive !== false && u.is_active !== false
      }));
    }
  } catch (err: any) {
    console.error("Error loading service units:", err);
  } finally {
    isLoading.value = false;
  }
};

const handleRealtimeUpdate = (p: any) => {
  if (!p?.type || p.type === "service-units") fetchUnits();
};

onMounted(() => {
  fetchUnits();
  pulse.channel("auth").listen("global:settings-updated", handleRealtimeUpdate);
});

onUnmounted(() => {
  pulse.channel("auth").stopListening("global:settings-updated", handleRealtimeUpdate);
});

const filteredUnits = computed(() => {
  if (!searchQuery.value.trim()) return units.value;
  const q = searchQuery.value.toLowerCase().trim();
  return units.value.filter(
    (u) =>
      u.code.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      (u.description && u.description.toLowerCase().includes(q))
  );
});

const openAddModal = () => {
  isEditing.value = false;
  form.value = {
    id: 0,
    code: "",
    name: "",
    description: "",
    isActive: true
  };
  formError.value = "";
  showModal.value = true;
};

const openEditModal = (u: ServiceUnitItem) => {
  isEditing.value = true;
  form.value = {
    id: u.id,
    code: u.code,
    name: u.name,
    description: u.description || "",
    isActive: u.isActive
  };
  formError.value = "";
  showModal.value = true;
};

const handleSave = async () => {
  if (!form.value.code.trim()) {
    formError.value = "Unit Code is required (e.g. MT, Month, Entry, Job).";
    return;
  }
  if (!form.value.name.trim()) {
    formError.value = "Unit Name is required (e.g. Per MT (Metric Ton)).";
    return;
  }

  const enteredCode = form.value.code.trim().toLowerCase();
  const duplicate = units.value.find(
    (u) => u.code.trim().toLowerCase() === enteredCode && (!isEditing.value || u.id !== form.value.id)
  );
  if (duplicate) {
    formError.value = `Unit Code "${form.value.code.trim()}" already exists in the catalog!`;
    toast.error(formError.value);
    return;
  }

  isSaving.value = true;
  formError.value = "";

  const payload = {
    code: form.value.code.trim(),
    name: form.value.name.trim(),
    description: form.value.description.trim(),
    isActive: form.value.isActive
  };

  try {
    if (isEditing.value) {
      await axios.put(`/api/superadmin/service-units/${form.value.id}`, payload);
      toast.success("Service unit updated successfully");
    } else {
      await axios.post("/api/superadmin/service-units", payload);
      toast.success("Service unit added successfully");
    }
    showModal.value = false;
    await fetchUnits();
  } catch (err: any) {
    formError.value = err.response?.data?.error || err.response?.data?.message || "Failed to save service unit";
    toast.error(formError.value);
  } finally {
    isSaving.value = false;
  }
};

const handleToggleStatus = async (u: ServiceUnitItem) => {
  try {
    await axios.patch(`/api/superadmin/service-units/${u.id}/toggle`);
    u.isActive = !u.isActive;
    toast.success(`Unit ${u.code} marked as ${u.isActive ? "Active" : "Inactive"}`);
  } catch (err: any) {
    toast.error("Failed to toggle unit status");
    await fetchUnits();
  }
};

const handleDelete = async (u: ServiceUnitItem) => {
  if (confirm(`Are you sure you want to delete service unit "${u.code}"?`)) {
    try {
      await axios.delete(`/api/superadmin/service-units/${u.id}`);
      toast.success("Service unit deleted");
      await fetchUnits();
    } catch (err: any) {
      toast.error("Failed to delete service unit");
    }
  }
};
</script>

<template>
  <div class="service-units-page">
    <!-- Header Controls -->
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
      <div>
        <h5 class="text-white fw-bold mb-1 d-flex align-items-center gap-2">
          <i class="bi bi-tag-fill text-warning"></i> Global Service Units & Billing Basis
        </h5>
        <span class="text-muted small">
          Manage system-wide service rate measurement units (e.g. Per MT, Per Month, Per Entry, Per Job, Flat Fee).
        </span>
      </div>
      <div class="d-flex align-items-center gap-2">
        <div class="position-relative" style="width: 260px;">
          <i class="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted small"></i>
          <input
            v-model="searchQuery"
            type="text"
            class="form-control form-control-sm ps-5 bg-dark text-white border-secondary"
            placeholder="Search service units..."
          />
        </div>
        <button type="button" class="btn btn-warning btn-sm px-3 fw-semibold text-dark d-flex align-items-center gap-1" @click="openAddModal">
          <i class="bi bi-plus-lg"></i> <span>Add Service Unit</span>
        </button>
      </div>
    </div>

    <!-- Units Table -->
    <div class="table-card">
      <div class="table-responsive">
        <table class="table-custom">
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th style="width: 140px;">Unit Code</th>
              <th>Unit Name & Display Label</th>
              <th>Description / Calculation Basis</th>
              <th style="width: 120px; text-align: center;">Status</th>
              <th style="width: 100px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(u, idx) in filteredUnits" :key="u.id">
              <td class="text-muted">{{ idx + 1 }}</td>
              <td>
                <span class="badge bg-dark border border-secondary text-info fw-bold font-monospace px-2 py-1">
                  {{ u.code }}
                </span>
              </td>
              <td>
                <span class="fw-semibold text-white">{{ u.name }}</span>
              </td>
              <td>
                <span class="text-muted small">{{ u.description || '—' }}</span>
              </td>
              <td style="text-align: center;">
                <button
                  type="button"
                  class="badge-btn"
                  :class="u.isActive ? 'badge-active' : 'badge-inactive'"
                  @click="handleToggleStatus(u)"
                  :title="u.isActive ? 'Click to Deactivate' : 'Click to Activate'"
                >
                  <span class="dot"></span>
                  <span>{{ u.isActive ? 'Active' : 'Inactive' }}</span>
                </button>
              </td>
              <td style="text-align: right;">
                <div class="d-flex gap-1 justify-content-end">
                  <button class="action-btn btn-edit" title="Edit Unit" @click="openEditModal(u)">
                    <i class="bi bi-pencil-fill"></i>
                  </button>
                  <button class="action-btn btn-del" title="Delete Unit" @click="handleDelete(u)">
                    <i class="bi bi-trash3-fill"></i>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="filteredUnits.length === 0 && !isLoading">
              <td colspan="6" class="text-center py-5 text-muted">
                <div class="d-flex flex-column align-items-center gap-2">
                  <i class="bi bi-tag fs-2 text-secondary"></i>
                  <span>No service units found. Click "Add Service Unit" to create one.</span>
                </div>
              </td>
            </tr>
            <tr v-if="isLoading">
              <td colspan="6" class="text-center py-5 text-muted">
                <div class="spinner-border spinner-border-sm text-primary me-2"></div>
                <span>Loading global service units...</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add / Edit Modal -->
    <div
      v-if="showModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.75);"
    >
      <div class="modal-dialog modal-dialog-centered" style="max-width: 480px;">
        <div class="modal-content idp-card shadow-lg border border-secondary border-opacity-25" style="border-radius: 12px;">
          <div class="modal-header border-0 pb-0 pt-4 px-4 d-flex justify-content-between align-items-start">
            <div>
              <h5 class="modal-title text-white fw-bold mb-1">
                <i class="bi bi-tag-fill text-warning me-2"></i>
                {{ isEditing ? 'Edit Service Unit' : 'Add Service Unit' }}
              </h5>
              <p class="text-muted small mb-0">
                {{ isEditing ? 'Update service unit code and calculation details' : 'Register a global service measurement unit for firm billing rates' }}
              </p>
            </div>
            <button type="button" class="btn-close btn-close-white" @click="showModal = false"></button>
          </div>
          <div class="modal-body px-4 py-3">
            <div v-if="formError" class="alert alert-danger py-2 small mb-3">
              {{ formError }}
            </div>

            <div class="row g-3 mb-3">
              <div class="col-5">
                <label class="form-label text-light small fw-medium mb-1">Unit Code <span class="text-danger">*</span></label>
                <input
                  v-model="form.code"
                  type="text"
                  class="form-control idp-input font-monospace"
                  placeholder="e.g. MT, Month, Entry"
                  required
                />
              </div>
              <div class="col-7">
                <label class="form-label text-light small fw-medium mb-1">Display Name <span class="text-danger">*</span></label>
                <input
                  v-model="form.name"
                  type="text"
                  class="form-control idp-input"
                  placeholder="e.g. Per MT (Metric Ton)"
                  required
                />
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label text-light small fw-medium mb-1">Description / Billing Context</label>
              <textarea
                v-model="form.description"
                rows="2"
                class="form-control idp-input small"
                placeholder="Explain how this unit is calculated during invoicing..."
              ></textarea>
            </div>

            <div class="form-check form-switch pt-1">
              <input v-model="form.isActive" class="form-check-input" type="checkbox" id="unitActiveCheck" />
              <label class="form-check-label text-light small" for="unitActiveCheck">Active in Firm Rate Dropdowns</label>
            </div>
          </div>
          <div class="modal-footer border-0 pt-0 pb-4 px-4 d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-secondary btn-sm px-3 text-light" style="background-color: #1e293b; border: 1px solid #334155;" @click="showModal = false">Cancel</button>
            <button type="button" class="btn btn-warning btn-sm px-4 fw-semibold text-dark" :disabled="isSaving" @click="handleSave">
              <span v-if="isSaving" class="spinner-border spinner-border-sm me-1"></span>
              {{ isEditing ? 'Update Unit' : 'Save Unit' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.service-units-page {
  width: 100%;
}

.idp-card {
  background: #1e2227;
  border: 1px solid #343a40;
  border-radius: 8px;
}

.idp-input {
  background-color: #15181c !important;
  border: 1px solid #3a4149 !important;
  color: #f8f9fa !important;
  border-radius: 6px;
}

.idp-input:focus {
  border-color: #0d6efd !important;
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25) !important;
}

/* ── Modern Dark Table & Card Styles ─────────────────── */
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
  padding: 12px 16px;
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #adb5bd;
  text-align: left;
  border-bottom: 1px solid #343a40;
}

.table-custom td {
  padding: 13px 16px;
  font-size: 0.85rem;
  border-bottom: 1px solid #282d34;
  vertical-align: middle;
  color: #e2e8f0;
}

.table-custom tbody tr:hover td {
  background: #252a30;
}

.table-custom tbody tr:last-child td {
  border-bottom: none;
}

/* ── Status Badges ───────────────────────────────────── */
.badge-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.73rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.badge-active {
  background: rgba(25, 135, 84, 0.15);
  color: #20c997;
  border: 1px solid rgba(25, 135, 84, 0.35);
}

.badge-active:hover {
  background: rgba(25, 135, 84, 0.25);
}

.badge-inactive {
  background: rgba(108, 117, 125, 0.15);
  color: #adb5bd;
  border: 1px solid rgba(108, 117, 125, 0.35);
}

.badge-inactive:hover {
  background: rgba(108, 117, 125, 0.25);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

/* ── Action Buttons ──────────────────────────────────── */
.action-btn {
  width: 30px;
  height: 30px;
  border-radius: 5px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-edit {
  background: rgba(59, 142, 237, 0.12);
  color: #3b8eed;
  border: 1px solid rgba(59, 142, 237, 0.3);
}

.btn-edit:hover {
  background: rgba(59, 142, 237, 0.25);
  color: #60a5fa;
}

.btn-del {
  background: rgba(220, 53, 69, 0.12);
  color: #ea868f;
  border: 1px solid rgba(220, 53, 69, 0.28);
}

.btn-del:hover {
  background: rgba(220, 53, 69, 0.25);
  color: #f87171;
}
</style>
