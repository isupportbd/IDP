<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { onBeforeRouteLeave } from "vue-router";
import axios from "axios";
import { pulse } from "@/plugins/pulse";
import { useToast } from "@/composables/useToast";
import SearchInput from "@/components/common/SearchInput.vue";

const toast = useToast();

interface LocationItem {
  id: number;
  name: string;
  code?: string;
  isActive: boolean;
  areasCount?: number;
}

interface AreaItem {
  id: number;
  locationId: number;
  locationName: string;
  name: string;
  postalCode?: string;
  isActive: boolean;
}

const activeTab = ref<"locations" | "areas">("locations");
const searchQuery = ref("");
const selectedLocationFilter = ref<number | "all">("all");
const isLoading = ref(false);
const isSavingLocation = ref(false);
const isSavingArea = ref(false);

const locations = ref<LocationItem[]>([]);
const areas = ref<AreaItem[]>([]);

onBeforeRouteLeave(() => {
  if (showLocationModal.value || showAreaModal.value) {
    toast.error("Please close or save the modal before leaving this page.");
    return false;
  }
});

const fetchLocations = async () => {
  try {
    const res = await axios.get("/api/superadmin/locations");
    if (res.data?.success && Array.isArray(res.data.data)) {
      locations.value = res.data.data.map((l: any) => ({
        id: l.id,
        name: l.name,
        code: l.code || "",
        isActive: l.isActive !== false && l.is_active !== false,
        areasCount: l.areasCount || 0
      }));
    }
  } catch (err: any) {
    console.error("Error loading locations:", err);
  }
};

const fetchAreas = async () => {
  try {
    const res = await axios.get("/api/superadmin/commercial-areas");
    if (res.data?.success && Array.isArray(res.data.data)) {
      areas.value = res.data.data.map((a: any) => ({
        id: a.id,
        locationId: a.locationId || a.location_id,
        locationName: a.locationName || a.location_name || "—",
        name: a.name,
        postalCode: a.postalCode || a.postal_code || "",
        isActive: a.isActive !== false && a.is_active !== false
      }));
    }
  } catch (err: any) {
    console.error("Error loading areas:", err);
  }
};

const loadAllData = async () => {
  isLoading.value = true;
  await Promise.all([fetchLocations(), fetchAreas()]);
  isLoading.value = false;
};

const handleRealtimeUpdate = (p: any) => {
  if (!p?.type || p.type === "locations" || p.type === "commercial-areas") {
    loadAllData();
  }
};

onMounted(() => {
  loadAllData();
  pulse.channel("auth").listen("global:settings-updated", handleRealtimeUpdate);
});

onUnmounted(() => {
  pulse.channel("auth").stopListening("global:settings-updated", handleRealtimeUpdate);
});

// Modals
const showLocationModal = ref(false);
const isEditingLocation = ref(false);
const locationForm = ref({ id: 0, name: "", code: "", isActive: true });

const showAreaModal = ref(false);
const isEditingArea = ref(false);
const areaForm = ref({ id: 0, locationId: 0, name: "", postalCode: "", isActive: true });
const modalError = ref("");

// Computed Filters
const filteredLocations = computed(() => {
  if (!searchQuery.value.trim()) return locations.value;
  const q = searchQuery.value.toLowerCase().trim();
  return locations.value.filter(
    (l) => l.name.toLowerCase().includes(q) || (l.code && l.code.toLowerCase().includes(q))
  );
});

const filteredAreas = computed(() => {
  let list = areas.value;
  if (selectedLocationFilter.value !== "all") {
    list = list.filter((a) => a.locationId === selectedLocationFilter.value);
  }
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.locationName.toLowerCase().includes(q) ||
        (a.postalCode && a.postalCode.includes(q))
    );
  }
  return list;
});

// Location Actions
const openAddLocation = () => {
  isEditingLocation.value = false;
  locationForm.value = { id: 0, name: "", code: "", isActive: true };
  modalError.value = "";
  showLocationModal.value = true;
};

const openEditLocation = (l: LocationItem) => {
  isEditingLocation.value = true;
  locationForm.value = { id: l.id, name: l.name, code: l.code || "", isActive: l.isActive };
  modalError.value = "";
  showLocationModal.value = true;
};

const saveLocation = async () => {
  if (!locationForm.value.name.trim()) {
    modalError.value = "Location / District name is required.";
    return;
  }
  isSavingLocation.value = true;
  modalError.value = "";
  try {
    if (isEditingLocation.value) {
      const res = await axios.put(`/api/superadmin/locations/${locationForm.value.id}`, {
        name: locationForm.value.name.trim(),
        code: locationForm.value.code.trim().toUpperCase(),
        isActive: locationForm.value.isActive
      });
      if (res.data?.success) {
        showLocationModal.value = false;
        toast.success("Location updated successfully");
        await loadAllData();
      } else {
        modalError.value = res.data?.error || "Failed to update location";
        toast.error(modalError.value);
      }
    } else {
      const res = await axios.post("/api/superadmin/locations", {
        name: locationForm.value.name.trim(),
        code: locationForm.value.code.trim().toUpperCase(),
        isActive: locationForm.value.isActive
      });
      if (res.data?.success) {
        showLocationModal.value = false;
        toast.success("Location saved to database successfully");
        await loadAllData();
      } else {
        modalError.value = res.data?.error || "Failed to create location";
        toast.error(modalError.value);
      }
    }
  } catch (err: any) {
    modalError.value = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Server error";
    toast.error(modalError.value);
  } finally {
    isSavingLocation.value = false;
  }
};

const toggleLocationStatus = async (l: LocationItem) => {
  const prev = l.isActive;
  l.isActive = !l.isActive;
  try {
    const res = await axios.patch(`/api/superadmin/locations/${l.id}/toggle`);
    if (!res.data?.success) {
      l.isActive = prev;
      toast.error("Failed to update location status");
    } else {
      toast.success(`Location "${l.name}" status updated`);
    }
  } catch (err: any) {
    l.isActive = prev;
    toast.error(err?.response?.data?.error || "Error toggling status");
  }
};

const deleteLocation = async (l: LocationItem) => {
  if (confirm(`Are you sure you want to permanently delete location "${l.name}" and all its linked areas?`)) {
    const backup = [...locations.value];
    locations.value = locations.value.filter((item) => item.id !== l.id);
    try {
      const res = await axios.delete(`/api/superadmin/locations/${l.id}`);
      if (!res.data?.success) {
        locations.value = backup;
        toast.error(res.data?.error || "Failed to delete location");
      } else {
        toast.success(`Location "${l.name}" deleted from database`);
        await loadAllData();
      }
    } catch (err: any) {
      locations.value = backup;
      toast.error(err?.response?.data?.error || "Failed to delete location");
    }
  }
};

// Area Actions
const openAddArea = () => {
  if (locations.value.length === 0) {
    alert("Please add at least one Location / District first.");
    return;
  }
  isEditingArea.value = false;
  const defaultLocId = selectedLocationFilter.value !== "all" ? Number(selectedLocationFilter.value) : (locations.value[0]?.id || 0);
  areaForm.value = { id: 0, locationId: defaultLocId, name: "", postalCode: "", isActive: true };
  modalError.value = "";
  showAreaModal.value = true;
};

const openEditArea = (a: AreaItem) => {
  isEditingArea.value = true;
  areaForm.value = { id: a.id, locationId: a.locationId, name: a.name, postalCode: a.postalCode || "", isActive: a.isActive };
  modalError.value = "";
  showAreaModal.value = true;
};

const saveArea = async () => {
  if (!areaForm.value.name.trim()) {
    modalError.value = "Area name is required.";
    return;
  }
  if (!areaForm.value.locationId) {
    modalError.value = "Please select a parent location.";
    return;
  }
  isSavingArea.value = true;
  modalError.value = "";
  try {
    if (isEditingArea.value) {
      const res = await axios.put(`/api/superadmin/commercial-areas/${areaForm.value.id}`, {
        locationId: areaForm.value.locationId,
        name: areaForm.value.name.trim(),
        postalCode: areaForm.value.postalCode.trim(),
        isActive: areaForm.value.isActive
      });
      if (res.data?.success) {
        showAreaModal.value = false;
        toast.success("Commercial area updated successfully");
        await loadAllData();
      } else {
        modalError.value = res.data?.error || "Failed to update area";
        toast.error(modalError.value);
      }
    } else {
      const res = await axios.post("/api/superadmin/commercial-areas", {
        locationId: areaForm.value.locationId,
        name: areaForm.value.name.trim(),
        postalCode: areaForm.value.postalCode.trim(),
        isActive: areaForm.value.isActive
      });
      if (res.data?.success) {
        showAreaModal.value = false;
        toast.success("Commercial area saved to database successfully");
        await loadAllData();
      } else {
        modalError.value = res.data?.error || "Failed to create area";
        toast.error(modalError.value);
      }
    }
  } catch (err: any) {
    modalError.value = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Server error";
    toast.error(modalError.value);
  } finally {
    isSavingArea.value = false;
  }
};

const toggleAreaStatus = async (a: AreaItem) => {
  const prev = a.isActive;
  a.isActive = !a.isActive;
  try {
    const res = await axios.patch(`/api/superadmin/commercial-areas/${a.id}/toggle`);
    if (!res.data?.success) {
      a.isActive = prev;
      toast.error("Failed to update area status");
    } else {
      toast.success(`Area "${a.name}" status updated`);
    }
  } catch (err: any) {
    a.isActive = prev;
    toast.error(err?.response?.data?.error || "Error toggling status");
  }
};

const deleteArea = async (a: AreaItem) => {
  if (confirm(`Are you sure you want to permanently delete area "${a.name}" from database?`)) {
    const backup = [...areas.value];
    areas.value = areas.value.filter((item) => item.id !== a.id);
    try {
      const res = await axios.delete(`/api/superadmin/commercial-areas/${a.id}`);
      if (!res.data?.success) {
        areas.value = backup;
        toast.error(res.data?.error || "Failed to delete area");
      } else {
        toast.success(`Area "${a.name}" deleted from database`);
        await loadAllData();
      }
    } catch (err: any) {
      areas.value = backup;
      toast.error(err?.response?.data?.error || "Failed to delete area");
    }
  }
};
</script>

<template>
  <div class="settings-page">
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <div>
        <h5 class="text-white fw-bold mb-1">Locations & Commercial Areas</h5>
        <p class="text-muted small mb-0">Master geo-directory for client business addresses, VAT circles, and zones.</p>
      </div>
      <div class="d-flex gap-2">
        <button
          v-if="activeTab === 'locations'"
          class="btn btn-primary btn-sm d-flex align-items-center gap-1"
          @click="openAddLocation"
        >
          <i class="bi bi-plus-lg"></i> Add Location
        </button>
        <button
          v-else
          class="btn btn-primary btn-sm d-flex align-items-center gap-1"
          @click="openAddArea"
        >
          <i class="bi bi-plus-lg"></i> Add Area
        </button>
      </div>
    </div>

    <!-- Toggle Sub-Tabs & Filter Bar -->
    <div class="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
      <div class="btn-group btn-group-sm" role="group">
        <button
          type="button"
          class="btn"
          :class="activeTab === 'locations' ? 'btn-primary' : 'btn-dark border-secondary text-muted'"
          @click="activeTab = 'locations'; searchQuery = ''"
        >
          <i class="bi bi-buildings me-1"></i> Locations / Districts ({{ locations.length }})
        </button>
        <button
          type="button"
          class="btn"
          :class="activeTab === 'areas' ? 'btn-primary' : 'btn-dark border-secondary text-muted'"
          @click="activeTab = 'areas'; searchQuery = ''"
        >
          <i class="bi bi-geo-alt me-1"></i> Sub-Areas / Thanas ({{ areas.length }})
        </button>
      </div>

      <div class="d-flex gap-2 align-items-center flex-grow-1 justify-content-end" style="max-width: 520px;">
        <!-- Location filter if in Areas tab -->
        <select
          v-if="activeTab === 'areas'"
          v-model="selectedLocationFilter"
          class="form-select form-select-sm idp-input"
          style="width: 170px;"
        >
          <option value="all">All Locations</option>
          <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }}</option>
        </select>

        <SearchInput
          v-model="searchQuery"
          :placeholder="activeTab === 'locations' ? 'Search locations...' : 'Search areas...'"
          max-width="280px"
          min-width="220px"
        />
      </div>
    </div>

    <!-- LOCATIONS TABLE -->
    <div v-if="activeTab === 'locations'" class="table-card position-relative">
      <div v-if="isLoading" class="p-5 text-center text-muted">
        <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
        <span>Loading locations from database...</span>
      </div>
      <table v-else class="table-custom">
        <thead>
          <tr>
            <th style="width: 50px;">#</th>
            <th>Location / District</th>
            <th>Code</th>
            <th>Linked Areas</th>
            <th style="width: 120px;">Status</th>
            <th style="width: 100px; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(l, idx) in filteredLocations" :key="l.id">
            <td class="text-muted">{{ idx + 1 }}</td>
            <td>
              <div class="d-flex align-items-center gap-2">
                <i class="bi bi-geo-alt-fill text-primary"></i>
                <span class="fw-semibold text-white">{{ l.name }}</span>
              </div>
            </td>
            <td>
              <span class="badge bg-dark border border-secondary text-info font-monospace">{{ l.code || '—' }}</span>
            </td>
            <td>
              <span class="text-muted small">
                {{ areas.filter(a => a.locationId === l.id).length }} areas
              </span>
            </td>
            <td>
              <button
                type="button"
                class="badge-btn"
                :class="l.isActive ? 'badge-active' : 'badge-inactive'"
                @click="toggleLocationStatus(l)"
              >
                <span class="dot"></span> {{ l.isActive ? 'Active' : 'Inactive' }}
              </button>
            </td>
            <td style="text-align: right;">
              <div class="d-flex gap-1 justify-content-end">
                <button class="action-btn btn-edit" title="Edit" @click="openEditLocation(l)">
                  <i class="bi bi-pencil-fill"></i>
                </button>
                <button class="action-btn btn-del" title="Delete" @click="deleteLocation(l)">
                  <i class="bi bi-trash3-fill"></i>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredLocations.length === 0">
            <td colspan="6" class="text-center py-5 text-muted">
              <div class="d-flex flex-column align-items-center justify-content-center gap-2">
                <i class="bi bi-geo-alt fs-2 text-secondary"></i>
                <span v-if="searchQuery">No locations found matching "{{ searchQuery }}"</span>
                <span v-else>No locations defined yet. Click "+ Add Location" to create one in the database.</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- AREAS TABLE -->
    <div v-else class="table-card position-relative">
      <div v-if="isLoading" class="p-5 text-center text-muted">
        <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
        <span>Loading commercial areas from database...</span>
      </div>
      <table v-else class="table-custom">
        <thead>
          <tr>
            <th style="width: 50px;">#</th>
            <th>Area / Zone Name</th>
            <th>Parent Location</th>
            <th>Postal Code</th>
            <th style="width: 120px;">Status</th>
            <th style="width: 100px; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(a, idx) in filteredAreas" :key="a.id">
            <td class="text-muted">{{ idx + 1 }}</td>
            <td>
              <span class="fw-semibold text-white">{{ a.name }}</span>
            </td>
            <td>
              <span class="badge bg-dark border border-secondary text-light">
                <i class="bi bi-pin-map me-1 text-primary"></i>{{ a.locationName }}
              </span>
            </td>
            <td>
              <span class="text-muted small font-monospace">{{ a.postalCode || '—' }}</span>
            </td>
            <td>
              <button
                type="button"
                class="badge-btn"
                :class="a.isActive ? 'badge-active' : 'badge-inactive'"
                @click="toggleAreaStatus(a)"
              >
                <span class="dot"></span> {{ a.isActive ? 'Active' : 'Inactive' }}
              </button>
            </td>
            <td style="text-align: right;">
              <div class="d-flex gap-1 justify-content-end">
                <button class="action-btn btn-edit" title="Edit" @click="openEditArea(a)">
                  <i class="bi bi-pencil-fill"></i>
                </button>
                <button class="action-btn btn-del" title="Delete" @click="deleteArea(a)">
                  <i class="bi bi-trash3-fill"></i>
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredAreas.length === 0">
            <td colspan="6" class="text-center py-5 text-muted">
              <div class="d-flex flex-column align-items-center justify-content-center gap-2">
                <i class="bi bi-buildings fs-2 text-secondary"></i>
                <span v-if="searchQuery">No commercial areas found matching "{{ searchQuery }}"</span>
                <span v-else>No commercial areas defined yet. Click "+ Add Area" to create one in the database.</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Location Modal (Static backdrop) -->
    <div v-if="showLocationModal" class="modal-overlay">
      <div class="modal-box">
        <div class="modal-hdr">
          <h6 class="text-white fw-bold mb-0">
            {{ isEditingLocation ? 'Edit Location' : 'Add New Location / District' }}
          </h6>
          <button class="btn-close btn-close-white" @click="showLocationModal = false"></button>
        </div>
        <div class="modal-bdy">
          <div v-if="modalError" class="alert alert-danger py-2 small mb-3">{{ modalError }}</div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Location / District Name <span class="text-danger">*</span></label>
            <input v-model="locationForm.name" type="text" class="form-control form-control-sm idp-input" placeholder="e.g. Dhaka" />
          </div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Short Code</label>
            <input v-model="locationForm.code" type="text" class="form-control form-control-sm idp-input" placeholder="e.g. DHK" />
          </div>
          <div class="form-check form-switch">
            <input id="locActive" v-model="locationForm.isActive" class="form-check-input" type="checkbox" />
            <label class="form-check-label small text-muted" for="locActive">Active</label>
          </div>
        </div>
        <div class="modal-ftr">
          <button class="btn btn-dark border-secondary btn-sm" :disabled="isSavingLocation" @click="showLocationModal = false">Cancel</button>
          <button class="btn btn-primary btn-sm d-flex align-items-center gap-1" :disabled="isSavingLocation" @click="saveLocation">
            <span v-if="isSavingLocation" class="spinner-border spinner-border-sm me-1" role="status"></span>
            {{ isSavingLocation ? 'Saving...' : 'Save Location' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Area Modal (Static backdrop) -->
    <div v-if="showAreaModal" class="modal-overlay">
      <div class="modal-box">
        <div class="modal-hdr">
          <h6 class="text-white fw-bold mb-0">
            {{ isEditingArea ? 'Edit Commercial Area' : 'Add New Commercial Area' }}
          </h6>
          <button class="btn-close btn-close-white" @click="showAreaModal = false"></button>
        </div>
        <div class="modal-bdy">
          <div v-if="modalError" class="alert alert-danger py-2 small mb-3">{{ modalError }}</div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Parent Location / District <span class="text-danger">*</span></label>
            <select v-model="areaForm.locationId" class="form-select form-select-sm idp-input">
              <option :value="0" disabled>Select Location...</option>
              <option v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }}</option>
            </select>
          </div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Area / Zone Name <span class="text-danger">*</span></label>
            <input v-model="areaForm.name" type="text" class="form-control form-control-sm idp-input" placeholder="e.g. Motijheel" />
          </div>
          <div class="mb-3">
            <label class="form-label small fw-semibold">Postal Code</label>
            <input v-model="areaForm.postalCode" type="text" class="form-control form-control-sm idp-input" placeholder="e.g. 1000" />
          </div>
          <div class="form-check form-switch">
            <input id="areaActive" v-model="areaForm.isActive" class="form-check-input" type="checkbox" />
            <label class="form-check-label small text-muted" for="areaActive">Active</label>
          </div>
        </div>
        <div class="modal-ftr">
          <button class="btn btn-dark border-secondary btn-sm" :disabled="isSavingArea" @click="showAreaModal = false">Cancel</button>
          <button class="btn btn-primary btn-sm d-flex align-items-center gap-1" :disabled="isSavingArea" @click="saveArea">
            <span v-if="isSavingArea" class="spinner-border spinner-border-sm me-1" role="status"></span>
            {{ isSavingArea ? 'Saving...' : 'Save Area' }}
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
