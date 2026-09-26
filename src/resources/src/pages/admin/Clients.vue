<script setup lang="ts">
import { ref, onMounted, computed, watch } from "vue";
import { useRouter } from "vue-router";
import axios from "axios";
import * as XLSX from "xlsx";
import { useClientsApi, type ClientItem, type AssignableUser } from "@/composables/useClientsApi";
import { useServicesApi, type CustomerType, type ClientReference } from "@/composables/useServicesApi";
import { useToast } from "@/composables/useToast";
import { useSubscriptionGuard } from "@/composables/useSubscriptionGuard";

const router = useRouter();
const toast = useToast();
const { isSubscriptionActive, checkOrPromptRecharge } = useSubscriptionGuard();

const navigateWithGuard = (path: string) => {
  if (checkOrPromptRecharge("access client creation or assignment")) {
    router.push(path);
  }
};

const {
  clients,
  assignableUsers,
  totalCount,
  loading: clientsLoading,
  fetchClients,
  createClient,
  updateClient,
  toggleClient,
  deleteClient,
  checkBinUnique,
  checkMobileExists,
  fetchAssignableUsers
} = useClientsApi();

const {
  customerTypes,
  references,
  fetchCustomerTypes,
  fetchReferences
} = useServicesApi();

const searchQuery = ref("");
const selectedTypeFilter = ref<number | "all">("all");
const selectedReferenceFilter = ref<number | "all">("all");
const selectedStatusFilter = ref<"all" | "true" | "false">("all");
const currentPage = ref(1);
const itemsPerPage = 15;

const selectedClientDetails = ref<ClientItem | null>(null);
const deleteTarget = ref<ClientItem | null>(null);
const showDetailsModal = ref(false);
const showDeleteModal = ref(false);
const isSubmitting = ref(false);

const loadData = async () => {
  try {
    await Promise.all([
      fetchClients({
        search: searchQuery.value,
        customerTypeId: selectedTypeFilter.value !== "all" ? selectedTypeFilter.value : undefined,
        referenceId: selectedReferenceFilter.value !== "all" ? selectedReferenceFilter.value : undefined,
        isActive: selectedStatusFilter.value,
        page: currentPage.value,
        limit: itemsPerPage
      }),
      fetchCustomerTypes(),
      fetchReferences(),
      fetchAssignableUsers()
    ]);
  } catch (err: any) {
    toast.error("Failed to load clients");
  }
};

onMounted(() => {
  loadData();
});

watch([searchQuery, selectedTypeFilter, selectedReferenceFilter, selectedStatusFilter, currentPage], () => {
  loadData();
});

const openDetailsModal = (client: ClientItem) => {
  selectedClientDetails.value = client;
  showDetailsModal.value = true;
};

const openDeleteModal = (client: ClientItem) => {
  deleteTarget.value = client;
  showDeleteModal.value = true;
};

const handleToggleActive = async (client: ClientItem) => {
  const nextState = !client.isActive;
  try {
    await toggleClient(client.id, nextState);
    toast.success(`Client ${nextState ? "activated" : "deactivated"}`);
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to update status");
  }
};

const handleConfirmDelete = async () => {
  if (!deleteTarget.value) return;
  isSubmitting.value = true;
  try {
    await deleteClient(deleteTarget.value.id);
    toast.success("Client deleted successfully");
    showDeleteModal.value = false;
    deleteTarget.value = null;
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to delete client");
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="clients-page py-2">
    <!-- Header & Breadcrumbs -->
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Dashboard
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">Clients</span>
        </div>
        <h4 class="text-white fw-bold mb-0">Client Organizations</h4>
      </div>

      <div class="d-flex align-items-center gap-2">
        <button
          type="button"
          class="btn btn-outline-success btn-sm px-3 d-flex align-items-center gap-1 shadow-sm"
          @click="navigateWithGuard('/admin/clients/upload')"
        >
          <i class="bi bi-file-earmark-arrow-up"></i>
          <span>Bulk Upload</span>
        </button>
        <button
          type="button"
          class="btn btn-outline-info btn-sm px-3 d-flex align-items-center gap-1"
          @click="navigateWithGuard('/admin/assignments')"
        >
          <i class="bi bi-person-check"></i>
          <span>Assignments</span>
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm px-3 fw-semibold d-flex align-items-center gap-1 shadow-sm"
          @click="navigateWithGuard('/admin/clients/create')"
        >
          <i class="bi bi-plus-lg"></i>
          <span>Add Client</span>
        </button>
      </div>
    </div>

    <!-- Filter & Search Toolbar (Customer Type, Reference & Status Filters) -->
    <div class="filter-panel p-3 mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
      <div class="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
        <!-- Integrated Search Box -->
        <div class="search-box position-relative" style="min-width: 240px; max-width: 320px;">
          <i class="bi bi-search search-icon"></i>
          <input
            v-model="searchQuery"
            type="text"
            class="form-control form-control-sm idp-search-input"
            placeholder="Search by Company, BIN, Mobile..."
          />
          <button v-if="searchQuery" class="clear-btn" @click="searchQuery = ''">
            <i class="bi bi-x"></i>
          </button>
        </div>

        <!-- 1. Customer Type Filter -->
        <select v-model="selectedTypeFilter" class="idp-select" style="width: auto; min-width: 170px;">
          <option value="all">All Customer Types</option>
          <option v-for="t in customerTypes" :key="t.id" :value="t.id">{{ t.typeName }}</option>
        </select>

        <!-- 2. Reference Filter -->
        <select v-model="selectedReferenceFilter" class="idp-select" style="width: auto; min-width: 180px;">
          <option value="all">All References</option>
          <option v-for="r in references" :key="r.id" :value="r.id">{{ r.name }}</option>
        </select>

        <!-- 3. Status Filter -->
        <select v-model="selectedStatusFilter" class="idp-select" style="width: auto; min-width: 130px;">
          <option value="all">All Status</option>
          <option value="true">Active Only</option>
          <option value="false">Inactive Only</option>
        </select>
      </div>

      <!-- Counter -->
      <div class="text-muted small ps-2">
        Total: <strong class="text-white">{{ totalCount }}</strong> Clients
      </div>
    </div>

    <!-- Clients Table Card -->
    <div class="table-card shadow-sm">
      <table class="table-custom">
        <thead>
          <tr>
            <th style="width: 28%;">Company & Proprietor</th>
            <th style="width: 15%;">Identifiers (BIN / TIN)</th>
            <th style="width: 13%;">Customer Type</th>
            <th style="width: 14%;">Reference</th>
            <th style="width: 14%;">Assigned Users</th>
            <th style="width: 6%; text-align: center;">Status</th>
            <th style="width: 10%; text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="clientsLoading && clients.length === 0">
            <td colspan="7" class="text-center py-5 text-muted">
              <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
              Loading client records from database...
            </td>
          </tr>

          <tr v-else-if="clients.length === 0">
            <td colspan="7" class="text-center py-5 text-muted">
              <i class="bi bi-inbox fs-2 d-block mb-2"></i>
              No clients found. Click "Add Client" to register a new organization.
            </td>
          </tr>

          <tr v-for="client in clients" :key="client.id">
            <!-- Company & Proprietor -->
            <td>
              <div class="fw-bold text-white mb-0">{{ client.companyName }}</div>
              <div class="text-muted small">
                <span v-if="client.proprietorName">{{ client.proprietorName }} • </span>
                <span v-if="client.mobile"><i class="bi bi-telephone me-1"></i>{{ client.mobile }}</span>
              </div>
            </td>

            <!-- Identifiers -->
            <td>
              <div v-if="client.binNumber" class="font-monospace text-info small fw-bold">
                BIN: {{ client.binNumber }}
              </div>
              <div v-if="client.tinNumber" class="text-muted small font-monospace">
                TIN: {{ client.tinNumber }}
              </div>
              <div v-if="!client.binNumber && !client.tinNumber" class="text-muted small">
                Not Specified
              </div>
            </td>

            <!-- Customer Type -->
            <td>
              <span class="badge bg-secondary bg-opacity-25 text-light border border-secondary border-opacity-25 small">
                {{ client.customerTypeName || 'Standard' }}
              </span>
            </td>

            <!-- Reference -->
            <td>
              <span v-if="client.referenceName" class="badge bg-dark border border-secondary text-info small">
                {{ client.referenceName }}
              </span>
              <span v-else class="text-muted small">—</span>
            </td>

            <!-- Assigned Managers -->
            <td>
              <div v-if="client.managers && client.managers.length > 0" class="d-flex flex-wrap gap-1 align-items-center">
                <span
                  v-if="client.managers.length === 1"
                  class="badge bg-dark border border-secondary text-light small d-inline-flex align-items-center gap-1 py-1 px-2"
                >
                  <i class="bi bi-person-fill text-primary"></i>
                  {{ client.managers[0].name }}
                </span>
                <template v-else-if="client.managers.length <= 2">
                  <span
                    v-for="mgr in client.managers"
                    :key="mgr.id"
                    class="badge bg-dark border border-secondary text-light small d-inline-flex align-items-center gap-1 py-1 px-2"
                  >
                    <i class="bi bi-person-fill text-primary"></i>
                    {{ mgr.name.split(' ')[0] }}
                  </span>
                </template>
                <template v-else>
                  <span
                    v-for="mgr in client.managers.slice(0, 2)"
                    :key="mgr.id"
                    class="badge bg-dark border border-secondary text-light small d-inline-flex align-items-center gap-1 py-1 px-2"
                  >
                    {{ mgr.name.split(' ')[0] }}
                  </span>
                  <span
                    class="badge bg-info bg-opacity-25 text-info border border-info border-opacity-50 small cursor-pointer"
                    :title="client.managers.map((m: any) => m.name).join(', ')"
                  >
                    +{{ client.managers.length - 2 }}
                  </span>
                </template>
              </div>
              <span v-else class="text-muted small fst-italic">
                Unassigned (Admin)
              </span>
            </td>

            <!-- Status Toggle -->
            <td style="text-align: center;">
              <button
                type="button"
                class="badge-btn"
                :class="client.isActive ? 'badge-active' : 'badge-inactive'"
                title="Click to toggle client status"
                @click="handleToggleActive(client)"
              >
                <span class="dot"></span>
                {{ client.isActive ? 'Active' : 'Inactive' }}
              </button>
            </td>

            <!-- Actions -->
            <td style="text-align: right;">
              <div class="d-inline-flex align-items-center gap-1">
                <router-link
                  :to="`/admin/clients/${client.id}`"
                  target="_blank"
                  class="action-btn btn-view text-decoration-none"
                  title="View Client Details (New Tab)"
                >
                  <i class="bi bi-eye"></i>
                </router-link>
                <router-link
                  :to="`/admin/clients/${client.id}/edit`"
                  class="action-btn btn-edit text-decoration-none"
                  title="Edit Client"
                >
                  <i class="bi bi-pencil"></i>
                </router-link>
                <button
                  type="button"
                  class="action-btn btn-del"
                  title="Delete Client"
                  @click="openDeleteModal(client)"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ── MODAL: CLIENT DETAILS ────────────────────────────────── -->
    <div
      v-if="showDetailsModal && selectedClientDetails"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.75);"
    >
      <div class="modal-dialog modal-dialog-centered modal-lg">
        <div class="modal-content idp-card shadow-lg border border-secondary border-opacity-25">
          <div class="modal-header border-bottom border-secondary border-opacity-25">
            <h5 class="modal-title text-white fw-bold">
              <i class="bi bi-building text-primary me-2"></i> {{ selectedClientDetails.companyName }}
            </h5>
            <button type="button" class="btn-close btn-close-white" @click="showDetailsModal = false"></button>
          </div>
          <div class="modal-body p-4">
            <div class="row g-3">
              <div class="col-md-6">
                <div class="text-muted small">Proprietor / MD</div>
                <div class="text-white fw-semibold">{{ selectedClientDetails.proprietorName || 'N/A' }}</div>
              </div>
              <div class="col-md-6">
                <div class="text-muted small">Customer Type</div>
                <div class="text-white fw-semibold">{{ selectedClientDetails.customerTypeName || 'Standard' }}</div>
              </div>
              <div class="col-md-6">
                <div class="text-muted small">Reference</div>
                <div class="text-info fw-semibold">{{ selectedClientDetails.referenceName || 'N/A' }}</div>
              </div>
              <div class="col-md-6">
                <div class="text-muted small">BIN Number</div>
                <div class="text-info font-monospace fw-bold">{{ selectedClientDetails.binNumber || 'N/A' }}</div>
              </div>
              <div class="col-md-6">
                <div class="text-muted small">TIN Number</div>
                <div class="text-white font-monospace">{{ selectedClientDetails.tinNumber || 'N/A' }}</div>
              </div>
              <div class="col-md-6">
                <div class="text-muted small">Primary Mobile</div>
                <div class="text-white font-monospace">{{ selectedClientDetails.mobile || 'N/A' }}</div>
              </div>
              <div class="col-md-6">
                <div class="text-muted small">Email Address</div>
                <div class="text-white">{{ selectedClientDetails.email || 'N/A' }}</div>
              </div>
              <div class="col-12">
                <div class="text-muted small">Address</div>
                <div class="text-white">{{ selectedClientDetails.address || 'N/A' }}</div>
              </div>
              <div class="col-md-6">
                <div class="text-muted small">VAT Service Scope</div>
                <div class="text-white fw-bold">{{ selectedClientDetails.vatServiceType }}</div>
              </div>
              <div class="col-md-6">
                <div class="text-muted small">VAT User ID</div>
                <div class="text-white font-monospace">{{ selectedClientDetails.vatUserId || 'N/A' }}</div>
              </div>
              <div class="col-12">
                <div class="text-muted small mb-1">Assigned Team Members</div>
                <div v-if="selectedClientDetails.managers && selectedClientDetails.managers.length > 0" class="d-flex flex-wrap gap-1">
                  <span v-for="m in selectedClientDetails.managers" :key="m.id" class="badge bg-dark border border-secondary text-light">
                    {{ m.name }} ({{ m.email }})
                  </span>
                </div>
                <div v-else class="text-muted small">Unassigned (Handled by Admin)</div>
              </div>
            </div>
          </div>
          <div class="modal-footer border-top border-secondary border-opacity-25">
            <button type="button" class="btn btn-idp-secondary btn-sm" @click="showDetailsModal = false">Close</button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── MODAL: CONFIRM DELETE ────────────────────────────────── -->
    <div
      v-if="showDeleteModal && deleteTarget"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.75);"
    >
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content idp-card text-center p-4">
          <i class="bi bi-trash text-danger fs-1 mb-2"></i>
          <h5 class="text-white fw-bold">Delete Client?</h5>
          <p class="text-muted small">
            Are you sure you want to remove <strong>{{ deleteTarget.companyName }}</strong>? This action cannot be undone.
          </p>
          <div class="d-flex justify-content-center gap-2 mt-3">
            <button type="button" class="btn btn-idp-secondary btn-sm px-3" @click="showDeleteModal = false">Cancel</button>
            <button
              type="button"
              class="btn btn-danger btn-sm px-3"
              :disabled="isSubmitting"
              @click="handleConfirmDelete"
            >
              <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-1"></span>
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.clients-page {
  width: 100%;
}

.filter-panel {
  background: #1e2227;
  border: 1px solid #343a40;
  border-radius: 8px;
}

.idp-search-input {
  background-color: #15181c !important;
  border: 1px solid #343a40 !important;
  color: #f8f9fa !important;
  border-radius: 6px;
  padding-left: 36px !important;
  padding-right: 28px !important;
  height: 38px;
  line-height: 36px;
  font-size: 0.85rem;
}

.idp-search-input:focus {
  border-color: #0d6efd !important;
  box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25) !important;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  font-size: 0.82rem;
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
  height: 38px;
  line-height: 36px;
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
  vertical-align: middle;
}

.idp-select:focus {
  border-color: #0d6efd !important;
  box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25) !important;
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
  padding: 12px 16px;
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #adb5bd;
  text-align: left;
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

.idp-card {
  background: #1e2227;
  border: 1px solid #343a40;
  border-radius: 8px;
}

.idp-input {
  background-color: #15181c !important;
  border: 1px solid #343a40 !important;
  color: #f8f9fa !important;
  border-radius: 6px;
}

.idp-input:focus {
  border-color: #0d6efd !important;
  box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25) !important;
}

.btn-idp-secondary {
  background-color: #343a40;
  color: #f8f9fa;
  border: 1px solid #495057;
}

.btn-idp-secondary:hover {
  background-color: #495057;
  color: #fff;
}

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

.btn-view {
  background: rgba(13, 202, 240, 0.12);
  color: #0dcaf0;
  border: 1px solid rgba(13, 202, 240, 0.3);
}

.btn-view:hover {
  background: rgba(13, 202, 240, 0.25);
  color: #38d9f5;
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

.cursor-pointer {
  cursor: pointer;
}

.upload-dropzone {
  transition: all 0.2s ease;
  border-width: 2px !important;
}

.upload-dropzone:hover {
  border-color: #0d6efd !important;
  background-color: rgba(13, 110, 253, 0.05) !important;
}
</style>
