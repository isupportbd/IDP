<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import axios from "axios";
import { pulse } from "@/plugins/pulse";
import { useToast } from "@/composables/useToast";
import SearchInput from "@/components/common/SearchInput.vue";

const toast = useToast();

interface MeasurementUnit {
  id: number;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

const units = ref<MeasurementUnit[]>([]);
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
    const res = await axios.get("/api/superadmin/measurement-units");
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
    console.error("Error loading units:", err);
  } finally {
    isLoading.value = false;
  }
};

const handleRealtimeUpdate = (p: any) => {
  if (!p?.type || p.type === "measurement-units") fetchUnits();
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

const openEditModal = (u: MeasurementUnit) => {
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
    formError.value = "Unit Code is required (e.g. KGM, U, PCS).";
    return;
  }
  if (!form.value.name.trim()) {
    formError.value = "Unit Name is required (e.g. Kilograms).";
    return;
  }

  const enteredCode = form.value.code.trim().toUpperCase();
  const duplicate = units.value.find(
    (u) => u.code.trim().toUpperCase() === enteredCode && (!isEditing.value || u.id !== form.value.id)
  );
  if (duplicate) {
    formError.value = `Unit Code "${form.value.code.trim()}" already exists in the catalog! Duplicate Unit Codes are not allowed.`;
    toast.error(formError.value);
    return;
  }

  isSaving.value = true;
  formError.value = "";

  const payload = {
    code: form.value.code.trim().toUpperCase(),
    name: form.value.name.trim(),
    description: form.value.description.trim(),
    isActive: form.value.isActive
  };

  try {
    if (isEditing.value) {
      const targetId = form.value.id;
      const res = await axios.put(`/api/superadmin/measurement-units/${targetId}`, payload);
      if (res.data?.success) {
        const idx = units.value.findIndex((u) => u.id === targetId);
        if (idx !== -1) {
          units.value[idx] = { ...units.value[idx], ...payload, id: targetId };
        }
        showModal.value = false;
        toast.success("Measurement unit updated successfully");
        await fetchUnits();
      } else {
        formError.value = res.data?.error || "Failed to update unit";
        toast.error(formError.value);
      }
    } else {
      const res = await axios.post("/api/superadmin/measurement-units", payload);
      if (res.data?.success) {
        const created = res.data.data;
        units.value.push({
          id: created?.id || Date.now(),
          ...payload,
          isActive: created?.isActive ?? payload.isActive
        });
        showModal.value = false;
        toast.success("Measurement unit saved to database successfully");
        await fetchUnits();
      } else {
        formError.value = res.data?.error || "Failed to create unit";
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

const toggleStatus = async (u: MeasurementUnit) => {
  const prev = u.isActive;
  u.isActive = !u.isActive;
  try {
    const res = await axios.patch(`/api/superadmin/measurement-units/${u.id}/toggle`);
    if (!res.data?.success) {
      u.isActive = prev;
      toast.error("Failed to update unit status");
    } else {
      toast.success(`Unit "${u.code}" status updated`);
    }
  } catch (err: any) {
    u.isActive = prev;
    toast.error(err?.response?.data?.error || "Error toggling status");
  }
};

const handleDelete = async (u: MeasurementUnit) => {
  if (confirm(`Are you sure you want to permanently delete unit "${u.code} - ${u.name}" from database?`)) {
    const backup = [...units.value];
    units.value = units.value.filter((item) => item.id !== u.id);
    try {
      const res = await axios.delete(`/api/superadmin/measurement-units/${u.id}`);
      if (!res.data?.success) {
        units.value = backup;
        toast.error(res.data?.error || "Failed to delete unit");
      } else {
        toast.success(`Unit "${u.code}" deleted from database`);
      }
    } catch (err: any) {
      units.value = backup;
      toast.error(err?.response?.data?.error || "Failed to delete unit");
    }
  }
};
</script>

<template>
  <div class="settings-page">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <div>
        <h5 class="text-white fw-bold mb-1">Global Measurement Units</h5>
        <p class="text-muted small mb-0">Master catalog of standardized units of measurement for purchases and item mappings.</p>
      </div>
      <button class="btn btn-primary btn-sm d-flex align-items-center gap-1" @click="openAddModal">
        <i class="bi bi-plus-lg"></i> Add Unit
      </button>
    </div>

    <!-- Search Toolbar -->
    <div v-if="units.length > 0 || searchQuery" class="d-flex gap-2 mb-3">
      <SearchInput v-model="searchQuery" placeholder="Search unit code, title..." max-width="320px" />
    </div>

    <!-- Table Card -->
    <div class="table-card position-relative">
      <div v-if="isLoading" class="p-5 text-center text-muted">
        <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
        <span>Loading measurement units from database...</span>
      </div>
      <table v-else class="table-custom">
        <thead>
          <tr>
            <th style="width: 50px;">#</th>
            <th style="width: 200px;">Unit Code</th>
            <th>Unit Name / Title</th>
            <th>Description / Notes</th>
            <th style="width: 110px;">Status</th>
            <th style="width: 100px; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(u, idx) in filteredUnits" :key="u.id">
            <td class="text-muted">{{ idx + 1 }}</td>
            <td>
              <span class="text-white fw-bold font-monospace fs-6">{{ u.code }}</span>
            </td>
            <td>
              <span class="text-white fw-semibold">{{ u.name }}</span>
            </td>
            <td>
              <span class="text-muted small">{{ u.description || '—' }}</span>
            </td>
            <td>
              <button
                type="button"
                class="badge-btn"
                :class="u.isActive ? 'badge-active' : 'badge-inactive'"
                @click="toggleStatus(u)"
              >
                <span class="dot"></span> {{ u.isActive ? 'Active' : 'Inactive' }}
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
          <tr v-if="filteredUnits.length === 0">
            <td colspan="6" class="text-center py-5 text-muted">
              <div class="d-flex flex-column align-items-center justify-content-center gap-2">
                <i class="bi bi-rulers fs-2 text-secondary"></i>
                <span v-if="searchQuery">No units found matching "{{ searchQuery }}"</span>
                <span v-else>No measurement units defined yet. Click "+ Add Unit" to create one in the database.</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal: Add/Edit Unit (Static Backdrop) -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal-box">
        <div class="modal-hdr">
          <h6 class="text-white fw-bold mb-0">
            {{ isEditing ? 'Edit Measurement Unit' : 'Add Measurement Unit' }}
          </h6>
          <button class="btn-close btn-close-white" @click="showModal = false"></button>
        </div>
        <div class="modal-bdy">
          <div v-if="formError" class="alert alert-danger py-2 small mb-3">
            {{ formError }}
          </div>

          <div class="row g-3 mb-3">
            <div class="col-6">
              <label class="form-label small fw-semibold">Unit Code <span class="text-danger">*</span></label>
              <input
                v-model="form.code"
                type="text"
                class="form-control form-control-sm idp-input font-monospace text-uppercase"
                placeholder="e.g. KGM, U, PCS"
              />
            </div>
            <div class="col-6">
              <label class="form-label small fw-semibold">Unit Title / Name <span class="text-danger">*</span></label>
              <input
                v-model="form.name"
                type="text"
                class="form-control form-control-sm idp-input"
                placeholder="e.g. Kilograms"
              />
            </div>
          </div>

          <div class="mb-3">
            <label class="form-label small fw-semibold">Description / Notes</label>
            <textarea
              v-model="form.description"
              rows="2"
              class="form-control form-control-sm idp-input"
              placeholder="e.g. Standard metric mass measurement unit..."
            ></textarea>
          </div>

          <div class="form-check form-switch mt-2">
            <input id="unitActiveSwitch" v-model="form.isActive" class="form-check-input" type="checkbox" />
            <label class="form-check-label small text-muted" for="unitActiveSwitch">Active Status</label>
          </div>
        </div>
        <div class="modal-ftr">
          <button class="btn btn-dark border-secondary btn-sm" :disabled="isSaving" @click="showModal = false">Cancel</button>
          <button class="btn btn-primary btn-sm d-flex align-items-center gap-1" :disabled="isSaving" @click="handleSave">
            <span v-if="isSaving" class="spinner-border spinner-border-sm me-1" role="status"></span>
            {{ isSaving ? 'Saving...' : 'Save Unit' }}
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
