<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import axios from "axios";
import { pulse } from "@/plugins/pulse";
import { useToast } from "@/composables/useToast";
import SearchInput from "@/components/common/SearchInput.vue";

const toast = useToast();

interface ClientType {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  count?: number;
}

const clientTypes = ref<ClientType[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const searchQuery = ref("");
const showModal = ref(false);
const isEditing = ref(false);
const form = ref({ id: 0, name: "", description: "", isActive: true });
const formError = ref("");

onBeforeRouteLeave(() => {
  if (showModal.value) {
    toast.error("Please close or save the modal before leaving this page.");
    return false;
  }
});

const fetchClientTypes = async () => {
  isLoading.value = true;
  try {
    const res = await axios.get("/api/superadmin/client-types");
    if (res.data?.success && Array.isArray(res.data.data)) {
      clientTypes.value = res.data.data.map((item: any) => ({
        id: item.id,
        name: item.typeName || item.name,
        description: item.description,
        isActive: item.isActive !== false && item.is_active !== false,
        count: item.count || 0
      }));
    }
  } catch (err: any) {
    console.error("Error loading client types:", err);
  } finally {
    isLoading.value = false;
  }
};

const handleRealtimeUpdate = (p: any) => {
  if (!p?.type || p.type === "client-types") fetchClientTypes();
};

onMounted(() => {
  fetchClientTypes();
  pulse.channel("auth").listen("global:settings-updated", handleRealtimeUpdate);
});

onUnmounted(() => {
  pulse.channel("auth").stopListening("global:settings-updated", handleRealtimeUpdate);
});

const filteredTypes = computed(() => {
  if (!searchQuery.value.trim()) return clientTypes.value;
  const q = searchQuery.value.toLowerCase().trim();
  return clientTypes.value.filter(
    (t) => t.name.toLowerCase().includes(q) || (t.description && t.description.toLowerCase().includes(q))
  );
});

const openAddModal = () => {
  isEditing.value = false;
  form.value = { id: 0, name: "", description: "", isActive: true };
  formError.value = "";
  showModal.value = true;
};

const openEditModal = (t: ClientType) => {
  isEditing.value = true;
  form.value = { id: t.id, name: t.name, description: t.description || "", isActive: t.isActive };
  formError.value = "";
  showModal.value = true;
};

const handleSave = async () => {
  if (!form.value.name.trim()) {
    formError.value = "Type name is required.";
    return;
  }
  isSaving.value = true;
  formError.value = "";
  try {
    if (isEditing.value) {
      const targetId = form.value.id;
      const res = await axios.put(`/api/superadmin/client-types/${targetId}`, {
        name: form.value.name.trim(),
        description: form.value.description.trim(),
        isActive: form.value.isActive
      });
      if (res.data?.success) {
        const idx = clientTypes.value.findIndex((item) => item.id === targetId);
        if (idx !== -1) {
          clientTypes.value[idx] = {
            ...clientTypes.value[idx],
            name: form.value.name.trim(),
            description: form.value.description.trim(),
            isActive: form.value.isActive
          };
        }
        showModal.value = false;
        toast.success("Client type updated successfully");
        await fetchClientTypes();
      } else {
        formError.value = res.data?.error || "Failed to update client type";
        toast.error(formError.value);
      }
    } else {
      const res = await axios.post("/api/superadmin/client-types", {
        name: form.value.name.trim(),
        description: form.value.description.trim(),
        isActive: form.value.isActive
      });
      if (res.data?.success) {
        const created = res.data.data;
        clientTypes.value.unshift({
          id: created?.id || Date.now(),
          name: created?.typeName || created?.name || form.value.name.trim(),
          description: created?.description || form.value.description.trim(),
          isActive: created?.isActive ?? form.value.isActive,
          count: 0
        });
        showModal.value = false;
        toast.success("Client type saved to database successfully");
        await fetchClientTypes();
      } else {
        formError.value = res.data?.error || "Failed to create client type";
        toast.error(formError.value);
      }
    }
  } catch (err: any) {
    formError.value = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Server error";
    toast.error(formError.value);
  } finally {
    isSaving.value = false;
  }
};

const toggleStatus = async (t: ClientType) => {
  const prev = t.isActive;
  t.isActive = !t.isActive; // Instant reactive UI toggle
  try {
    const res = await axios.patch(`/api/superadmin/client-types/${t.id}/toggle`);
    if (!res.data?.success) {
      t.isActive = prev; // Revert on failure
      toast.error("Failed to update status");
    } else {
      toast.success(`Client type "${t.name}" status updated`);
    }
  } catch (err: any) {
    t.isActive = prev; // Revert on error
    toast.error(err?.response?.data?.error || "Error toggling status");
  }
};

const deleteType = async (t: ClientType) => {
  if (confirm(`Are you sure you want to permanently delete client type "${t.name}" from the database?`)) {
    const backup = [...clientTypes.value];
    clientTypes.value = clientTypes.value.filter((item) => item.id !== t.id); // Instant reactive removal
    try {
      const res = await axios.delete(`/api/superadmin/client-types/${t.id}`);
      if (!res.data?.success) {
        clientTypes.value = backup; // Revert on failure
        toast.error(res.data?.error || "Failed to delete client type");
      } else {
        toast.success(`Client type "${t.name}" deleted from database`);
      }
    } catch (err: any) {
      clientTypes.value = backup;
      toast.error(err?.response?.data?.error || "Failed to delete client type");
    }
  }
};
</script>

<template>
  <div class="settings-page">
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <div>
        <h5 class="text-white fw-bold mb-1">Customer / Client Types</h5>
        <p class="text-muted small mb-0">Define business categories for clients and tax profile classification.</p>
      </div>
      <button class="btn btn-primary btn-sm d-flex align-items-center gap-1" @click="openAddModal">
        <i class="bi bi-plus-lg"></i> Add Client Type
      </button>
    </div>

    <!-- Search Toolbar -->
    <div v-if="clientTypes.length > 0 || searchQuery" class="d-flex gap-2 mb-3">
      <SearchInput v-model="searchQuery" placeholder="Search client types..." max-width="320px" />
    </div>

    <!-- Table Card -->
    <div class="table-card position-relative">
      <div v-if="isLoading" class="p-5 text-center text-muted">
        <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
        <span>Loading client types from database...</span>
      </div>
      <table v-else class="table-custom">
        <thead>
          <tr>
            <th style="width: 50px;">#</th>
            <th>Type Name</th>
            <th>Description</th>
            <th style="width: 120px;">Status</th>
            <th style="width: 100px; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(t, idx) in filteredTypes" :key="t.id">
            <td class="text-muted">{{ idx + 1 }}</td>
            <td>
              <span class="fw-semibold text-white">{{ t.name }}</span>
            </td>
            <td class="text-muted small">{{ t.description || '—' }}</td>
            <td>
              <button
                type="button"
                class="badge-btn"
                :class="t.isActive ? 'badge-active' : 'badge-inactive'"
                @click="toggleStatus(t)"
              >
                <span class="dot"></span> {{ t.isActive ? 'Active' : 'Inactive' }}
              </button>
            </td>
            <td style="text-align: right;">
              <div class="d-flex gap-1 justify-content-end">
                <button class="action-btn btn-edit" title="Edit" @click="openEditModal(t)">
                  <i class="bi bi-pencil-fill"></i>
                </button>
                <button class="action-btn btn-del" title="Delete" @click="deleteType(t)">
                  <i class="bi bi-trash3-fill"></i>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredTypes.length === 0">
            <td colspan="5" class="text-center py-5 text-muted">
              <div class="d-flex flex-column align-items-center justify-content-center gap-2">
                <i class="bi bi-inbox fs-2 text-secondary"></i>
                <span v-if="searchQuery">No client types found matching "{{ searchQuery }}"</span>
                <span v-else>No client types defined yet. Click "+ Add Client Type" to create one in the database.</span>
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
            {{ isEditing ? 'Edit Client Type' : 'Add New Client Type' }}
          </h6>
          <button class="btn-close btn-close-white" @click="showModal = false"></button>
        </div>
        <div class="modal-bdy">
          <div v-if="formError" class="alert alert-danger py-2 small mb-3">
            {{ formError }}
          </div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Type Name <span class="text-danger">*</span></label>
            <input v-model="form.name" type="text" class="form-control form-control-sm idp-input" placeholder="e.g. Importer" />
          </div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Description</label>
            <textarea v-model="form.description" rows="2" class="form-control form-control-sm idp-input" placeholder="Brief description..."></textarea>
          </div>
          <div class="form-check form-switch">
            <input id="activeSwitch" v-model="form.isActive" class="form-check-input" type="checkbox" />
            <label class="form-check-label small text-muted" for="activeSwitch">Active Status</label>
          </div>
        </div>
        <div class="modal-ftr">
          <button class="btn btn-dark border-secondary btn-sm" :disabled="isSaving" @click="showModal = false">Cancel</button>
          <button class="btn btn-primary btn-sm d-flex align-items-center gap-1" :disabled="isSaving" @click="handleSave">
            <span v-if="isSaving" class="spinner-border spinner-border-sm me-1" role="status"></span>
            {{ isSaving ? 'Saving...' : 'Save Type' }}
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
  max-width: 440px;
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
