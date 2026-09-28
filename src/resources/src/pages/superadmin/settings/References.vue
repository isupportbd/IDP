<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import axios from "axios";
import { pulse } from "@/plugins/pulse";
import { useToast } from "@/composables/useToast";
import SearchInput from "@/components/common/SearchInput.vue";

const toast = useToast();

interface ReferenceItem {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  isActive: boolean;
  referredClientsCount?: number;
}

const references = ref<ReferenceItem[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const searchQuery = ref("");
const showModal = ref(false);
const isEditing = ref(false);
const form = ref({ id: 0, name: "", phone: "", email: "", notes: "", isActive: true });
const modalError = ref("");

onBeforeRouteLeave(() => {
  if (showModal.value) {
    toast.error("Please close or save the modal before leaving this page.");
    return false;
  }
});

const fetchReferences = async () => {
  isLoading.value = true;
  try {
    const res = await axios.get("/api/superadmin/references");
    if (res.data?.success && Array.isArray(res.data.data)) {
      references.value = res.data.data.map((r: any) => ({
        id: r.id,
        name: r.name,
        phone: r.phone || "",
        email: r.email || "",
        notes: r.notes || "",
        isActive: r.isActive !== false && r.is_active !== false,
        referredClientsCount: r.referredClientsCount || 0
      }));
    }
  } catch (err: any) {
    console.error("Error loading references:", err);
  } finally {
    isLoading.value = false;
  }
};

const handleRealtimeUpdate = (p: any) => {
  if (!p?.type || p.type === "references") fetchReferences();
};

onMounted(() => {
  fetchReferences();
  pulse.channel("auth").listen("global:settings-updated", handleRealtimeUpdate);
});

onUnmounted(() => {
  pulse.channel("auth").stopListening("global:settings-updated", handleRealtimeUpdate);
});

const filteredReferences = computed(() => {
  if (!searchQuery.value.trim()) return references.value;
  const q = searchQuery.value.toLowerCase().trim();
  return references.value.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      (r.phone && r.phone.includes(q)) ||
      (r.email?.toLowerCase().includes(q)) ||
      (r.notes?.toLowerCase().includes(q))
  );
});

const openAddModal = () => {
  isEditing.value = false;
  form.value = { id: 0, name: "", phone: "", email: "", notes: "", isActive: true };
  modalError.value = "";
  showModal.value = true;
};

const openEditModal = (r: ReferenceItem) => {
  isEditing.value = true;
  form.value = { id: r.id, name: r.name, phone: r.phone || "", email: r.email || "", notes: r.notes || "", isActive: r.isActive };
  modalError.value = "";
  showModal.value = true;
};

const handleSave = async () => {
  if (!form.value.name.trim()) {
    modalError.value = "Reference name is required.";
    return;
  }
  isSaving.value = true;
  modalError.value = "";
  try {
    if (isEditing.value) {
      const res = await axios.put(`/api/superadmin/references/${form.value.id}`, {
        name: form.value.name.trim(),
        phone: form.value.phone.trim(),
        email: form.value.email.trim(),
        notes: form.value.notes.trim(),
        isActive: form.value.isActive
      });
      if (res.data?.success) {
        showModal.value = false;
        toast.success("Reference updated successfully");
        await fetchReferences();
      } else {
        modalError.value = res.data?.error || "Failed to update reference";
        toast.error(modalError.value);
      }
    } else {
      const res = await axios.post("/api/superadmin/references", {
        name: form.value.name.trim(),
        phone: form.value.phone.trim(),
        email: form.value.email.trim(),
        notes: form.value.notes.trim(),
        isActive: form.value.isActive
      });
      if (res.data?.success) {
        showModal.value = false;
        toast.success("Reference saved to database successfully");
        await fetchReferences();
      } else {
        modalError.value = res.data?.error || "Failed to create reference";
        toast.error(modalError.value);
      }
    }
  } catch (err: any) {
    modalError.value = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Server error";
    toast.error(modalError.value);
  } finally {
    isSaving.value = false;
  }
};

const toggleStatus = async (r: ReferenceItem) => {
  const prev = r.isActive;
  r.isActive = !r.isActive;
  try {
    const res = await axios.patch(`/api/superadmin/references/${r.id}/toggle`);
    if (!res.data?.success) {
      r.isActive = prev;
      toast.error("Failed to update status");
    } else {
      toast.success(`Reference "${r.name}" status updated`);
    }
  } catch (err: any) {
    r.isActive = prev;
    toast.error(err?.response?.data?.error || "Error toggling status");
  }
};

const deleteRef = async (r: ReferenceItem) => {
  if (confirm(`Are you sure you want to permanently delete reference "${r.name}" from database?`)) {
    const backup = [...references.value];
    references.value = references.value.filter((item) => item.id !== r.id);
    try {
      const res = await axios.delete(`/api/superadmin/references/${r.id}`);
      if (!res.data?.success) {
        references.value = backup;
        toast.error(res.data?.error || "Failed to delete reference");
      } else {
        toast.success(`Reference "${r.name}" deleted from database`);
        await fetchReferences();
      }
    } catch (err: any) {
      references.value = backup;
      toast.error(err?.response?.data?.error || "Failed to delete reference");
    }
  }
};
</script>

<template>
  <div class="settings-page">
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <div>
        <h5 class="text-white fw-bold mb-1">Client References & Acquisition Sources</h5>
        <p class="text-muted small mb-0">Track referral partners, C&F agents, tax consultants, and acquisition channels.</p>
      </div>
      <button class="btn btn-primary btn-sm d-flex align-items-center gap-1" @click="openAddModal">
        <i class="bi bi-plus-lg"></i> Add Reference
      </button>
    </div>

    <!-- Search Toolbar -->
    <div v-if="references.length > 0 || searchQuery" class="d-flex gap-2 mb-3">
      <SearchInput v-model="searchQuery" placeholder="Search references by name, phone..." max-width="320px" />
    </div>

    <!-- Table Card -->
    <div class="table-card position-relative">
      <div v-if="isLoading" class="p-5 text-center text-muted">
        <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
        <span>Loading references from database...</span>
      </div>
      <table v-else class="table-custom">
        <thead>
          <tr>
            <th style="width: 50px;">#</th>
            <th>Reference Name</th>
            <th>Contact Phone</th>
            <th>Email</th>
            <th>Referred Clients</th>
            <th style="width: 120px;">Status</th>
            <th style="width: 100px; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, idx) in filteredReferences" :key="r.id">
            <td class="text-muted">{{ idx + 1 }}</td>
            <td>
              <div>
                <span class="fw-semibold text-white d-block">{{ r.name }}</span>
                <span v-if="r.notes" class="text-muted small">{{ r.notes }}</span>
              </div>
            </td>
            <td>
              <span v-if="r.phone" class="text-info font-monospace small">
                <i class="bi bi-telephone-fill me-1"></i>{{ r.phone }}
              </span>
              <span v-else class="text-muted small">—</span>
            </td>
            <td>
              <span v-if="r.email" class="text-light small">{{ r.email }}</span>
              <span v-else class="text-muted small">—</span>
            </td>
            <td>
              <span class="badge bg-dark border border-secondary text-primary font-monospace">
                {{ r.referredClientsCount || 0 }} clients
              </span>
            </td>
            <td>
              <button
                type="button"
                class="badge-btn"
                :class="r.isActive ? 'badge-active' : 'badge-inactive'"
                @click="toggleStatus(r)"
              >
                <span class="dot"></span> {{ r.isActive ? 'Active' : 'Inactive' }}
              </button>
            </td>
            <td style="text-align: right;">
              <div class="d-flex gap-1 justify-content-end">
                <button class="action-btn btn-edit" title="Edit" @click="openEditModal(r)">
                  <i class="bi bi-pencil-fill"></i>
                </button>
                <button class="action-btn btn-del" title="Delete" @click="deleteRef(r)">
                  <i class="bi bi-trash3-fill"></i>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredReferences.length === 0">
            <td colspan="7" class="text-center py-5 text-muted">
              <div class="d-flex flex-column align-items-center justify-content-center gap-2">
                <i class="bi bi-person-lines-fill fs-2 text-secondary"></i>
                <span v-if="searchQuery">No reference contacts found matching "{{ searchQuery }}"</span>
                <span v-else>No client references defined yet. Click "+ Add Reference" to create one in the database.</span>
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
            {{ isEditing ? 'Edit Reference' : 'Add New Reference' }}
          </h6>
          <button class="btn-close btn-close-white" @click="showModal = false"></button>
        </div>
        <div class="modal-bdy">
          <div v-if="modalError" class="alert alert-danger py-2 small mb-3">{{ modalError }}</div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Reference Name / Channel <span class="text-danger">*</span></label>
            <input v-model="form.name" type="text" class="form-control form-control-sm idp-input" placeholder="e.g. Md. Aminul Islam" />
          </div>
          <div class="row g-2 mb-3">
            <div class="col-6">
              <label class="form-label small fw-semibold">Contact Phone</label>
              <input v-model="form.phone" type="text" class="form-control form-control-sm idp-input" placeholder="01XXXXXXXXX" />
            </div>
            <div class="col-6">
              <label class="form-label small fw-semibold">Email</label>
              <input v-model="form.email" type="email" class="form-control form-control-sm idp-input" placeholder="email@domain.com" />
            </div>
          </div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Notes</label>
            <textarea v-model="form.notes" rows="2" class="form-control form-control-sm idp-input" placeholder="Consultant, agency, or commission details..."></textarea>
          </div>
          <div class="form-check form-switch">
            <input id="refActive" v-model="form.isActive" class="form-check-input" type="checkbox" />
            <label class="form-check-label small text-muted" for="refActive">Active</label>
          </div>
        </div>
        <div class="modal-ftr">
          <button class="btn btn-dark border-secondary btn-sm" :disabled="isSaving" @click="showModal = false">Cancel</button>
          <button class="btn btn-primary btn-sm d-flex align-items-center gap-1" :disabled="isSaving" @click="handleSave">
            <span v-if="isSaving" class="spinner-border spinner-border-sm me-1" role="status"></span>
            {{ isSaving ? 'Saving...' : 'Save Reference' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-page { font-family: 'Inter', sans-serif; }
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
.table-custom tbody tr:hover td { background: #2c3238; }

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
.badge-active { background: rgba(25, 135, 84, 0.15); color: #20c997; border: 1px solid rgba(25, 135, 84, 0.3); }
.badge-inactive { background: rgba(108, 117, 125, 0.15); color: #adb5bd; border: 1px solid rgba(108, 117, 125, 0.3); }
.dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

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
