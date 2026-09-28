<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import axios from "axios";
import { pulse } from "@/plugins/pulse";
import { useToast } from "@/composables/useToast";
import SearchInput from "@/components/common/SearchInput.vue";

const toast = useToast();

interface VatNote {
  id: number;
  vatRate: number;
  noteName: string;
}

const notes = ref<VatNote[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const searchQuery = ref("");
const showModal = ref(false);
const isEditing = ref(false);

const form = ref<{
  id: number;
  vatRate: number | string;
  noteName: string;
}>({
  id: 0,
  vatRate: "",
  noteName: ""
});
const formError = ref("");

// Prevent accidental route changes when modal is open
onBeforeRouteLeave(() => {
  if (showModal.value) {
    toast.error("Please close or save the modal before leaving this page.");
    return false;
  }
});

const fetchNotes = async () => {
  isLoading.value = true;
  try {
    const res = await axios.get("/api/superadmin/vat-notes");
    if (res.data?.success && Array.isArray(res.data.data)) {
      notes.value = res.data.data.map((n: any) => ({
        id: n.id,
        vatRate: Number(n.vatRate !== undefined ? n.vatRate : n.vat_rate),
        noteName: n.noteName || n.note_name || ""
      }));
    }
  } catch (err: any) {
    console.error("Error loading VAT notes:", err);
  } finally {
    isLoading.value = false;
  }
};

const handleRealtimeUpdate = (p: any) => {
  if (!p?.type || p.type === "vat-notes") fetchNotes();
};

onMounted(() => {
  fetchNotes();
  pulse.channel("auth").listen("global:settings-updated", handleRealtimeUpdate);
});

onUnmounted(() => {
  pulse.channel("auth").stopListening("global:settings-updated", handleRealtimeUpdate);
});

const filteredNotes = computed(() => {
  if (!searchQuery.value.trim()) return notes.value;
  const q = searchQuery.value.toLowerCase().trim();
  return notes.value.filter(
    (n) =>
      n.noteName.toLowerCase().includes(q) ||
      n.vatRate.toString().includes(q)
  );
});

const openAddModal = () => {
  isEditing.value = false;
  form.value = {
    id: 0,
    vatRate: "",
    noteName: ""
  };
  formError.value = "";
  showModal.value = true;
};

const openEditModal = (n: VatNote) => {
  isEditing.value = true;
  form.value = {
    id: n.id,
    vatRate: n.vatRate,
    noteName: n.noteName
  };
  formError.value = "";
  showModal.value = true;
};

const handleSave = async () => {
  if (form.value.vatRate === "" || form.value.vatRate === null || form.value.vatRate === undefined) {
    formError.value = "VAT Rate (%) is required (e.g. 15, 7.5, 5, 0).";
    return;
  }
  if (!form.value.noteName.trim()) {
    formError.value = "Note Name is required (e.g. Note 1, Note 2, Note 3, Note 8).";
    return;
  }

  const numericRate = parseFloat(form.value.vatRate.toString());
  if (Number.isNaN(numericRate) || numericRate < 0) {
    formError.value = "Please enter a valid non-negative VAT rate percentage.";
    return;
  }

  const duplicate = notes.value.find(
    (n) => n.vatRate === numericRate && (!isEditing.value || n.id !== form.value.id)
  );
  if (duplicate) {
    formError.value = `A mapping for VAT Rate "${numericRate}%" already exists (${duplicate.noteName})! Duplicate VAT rates are not allowed.`;
    toast.error(formError.value);
    return;
  }

  isSaving.value = true;
  formError.value = "";

  const payload = {
    vatRate: numericRate,
    noteName: form.value.noteName.trim()
  };

  try {
    if (isEditing.value) {
      const targetId = form.value.id;
      const res = await axios.put(`/api/superadmin/vat-notes/${targetId}`, payload);
      if (res.data?.success) {
        const idx = notes.value.findIndex((n) => n.id === targetId);
        if (idx !== -1) {
          notes.value[idx] = { ...notes.value[idx], ...payload, id: targetId };
        }
        showModal.value = false;
        toast.success("VAT Note updated successfully");
        await fetchNotes();
      } else {
        formError.value = res.data?.error || "Failed to update VAT note";
        toast.error(formError.value);
      }
    } else {
      const res = await axios.post("/api/superadmin/vat-notes", payload);
      if (res.data?.success) {
        const created = res.data.data;
        notes.value.push({
          id: created?.id || Date.now(),
          ...payload
        });
        showModal.value = false;
        toast.success("VAT Note saved to database successfully");
        await fetchNotes();
      } else {
        formError.value = res.data?.error || "Failed to create VAT note";
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

const handleDelete = async (n: VatNote) => {
  if (confirm(`Are you sure you want to permanently delete VAT note mapping for "${n.vatRate}% ➔ ${n.noteName}"?`)) {
    const backup = [...notes.value];
    notes.value = notes.value.filter((item) => item.id !== n.id);
    try {
      const res = await axios.delete(`/api/superadmin/vat-notes/${n.id}`);
      if (!res.data?.success) {
        notes.value = backup;
        toast.error(res.data?.error || "Failed to delete VAT note");
      } else {
        toast.success(`VAT Note mapping for "${n.vatRate}%" deleted`);
      }
    } catch (err: any) {
      notes.value = backup;
      toast.error(err?.response?.data?.error || "Failed to delete VAT note");
    }
  }
};
</script>

<template>
  <div class="settings-page">
    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <div>
        <h5 class="text-white fw-bold mb-1">NBR Return VAT Note Mappings (Sales)</h5>
        <p class="text-muted small mb-0">Map each specific VAT rate percentage (%) to its legal NBR Return 9.1 Note.</p>
      </div>
      <button class="btn btn-primary btn-sm d-flex align-items-center gap-1" @click="openAddModal">
        <i class="bi bi-plus-lg"></i> Add VAT Note
      </button>
    </div>

    <!-- Search Toolbar -->
    <div v-if="notes.length > 0 || searchQuery" class="d-flex gap-2 mb-3">
      <SearchInput v-model="searchQuery" placeholder="Search rate %, note name..." max-width="320px" />
    </div>

    <!-- Table Card (Consistent design tokens) -->
    <div class="table-card position-relative">
      <div v-if="isLoading" class="p-5 text-center text-muted">
        <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
        <span>Loading VAT notes from database...</span>
      </div>
      <table v-else class="table-custom">
        <thead>
          <tr>
            <th style="width: 50px;">#</th>
            <th style="width: 240px;">VAT Rate (%)</th>
            <th>Note Name</th>
            <th style="width: 100px; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(n, idx) in filteredNotes" :key="n.id">
            <td class="text-muted">{{ idx + 1 }}</td>
            <td>
              <span class="text-white fw-bold font-monospace fs-6">{{ n.vatRate }}%</span>
            </td>
            <td>
              <span class="text-white fw-semibold">{{ n.noteName }}</span>
            </td>
            <td style="text-align: right;">
              <div class="d-flex gap-1 justify-content-end">
                <button
                  type="button"
                  class="action-btn btn-edit"
                  title="Edit VAT Note"
                  @click="openEditModal(n)"
                >
                  <i class="bi bi-pencil-fill"></i>
                </button>
                <button
                  type="button"
                  class="action-btn btn-del"
                  title="Delete VAT Note"
                  @click="handleDelete(n)"
                >
                  <i class="bi bi-trash3-fill"></i>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredNotes.length === 0">
            <td colspan="4" class="text-center py-5 text-muted">
              <div class="d-flex flex-column align-items-center justify-content-center gap-2">
                <i class="bi bi-card-text fs-2 text-secondary"></i>
                <span v-if="searchQuery">No VAT note mappings found matching "{{ searchQuery }}"</span>
                <span v-else>No VAT note mappings defined yet. Click "+ Add VAT Note" to create one.</span>
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
            {{ isEditing ? 'Edit VAT Note' : 'Add VAT Note' }}
          </h6>
          <button type="button" class="btn-close btn-close-white" @click="showModal = false"></button>
        </div>
        <div class="modal-bdy">
          <div v-if="formError" class="alert alert-danger py-2 small mb-3">
            {{ formError }}
          </div>

          <div class="mb-3">
            <label class="form-label text-muted small fw-semibold">VAT Rate (%) <span class="text-danger">*</span></label>
            <input
              v-model="form.vatRate"
              type="number"
              step="0.01"
              min="0"
              class="form-control form-control-sm idp-input"
              placeholder="e.g. 15, 10, 7.5, 5, 0"
            />
            <span class="text-muted fs-8">Exact individual numeric VAT percentage (e.g. 5, 7.5, 10, 15)</span>
          </div>

          <div class="mb-3">
            <label class="form-label text-muted small fw-semibold">Note Name <span class="text-danger">*</span></label>
            <input
              v-model="form.noteName"
              type="text"
              class="form-control form-control-sm idp-input"
              placeholder="e.g. Note 1, Note 2, Note 3, Note 8"
            />
            <span class="text-muted fs-8">Target sub-form note label on NBR Return 9.1</span>
          </div>
        </div>
        <div class="modal-ftr">
          <button type="button" class="btn btn-secondary btn-sm" @click="showModal = false">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm d-flex align-items-center gap-1"
            :disabled="isSaving"
            @click="handleSave"
          >
            <span v-if="isSaving" class="spinner-border spinner-border-sm" role="status"></span>
            <span>{{ isEditing ? 'Update Note' : 'Save Note' }}</span>
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
  max-width: 480px;
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
</style>


