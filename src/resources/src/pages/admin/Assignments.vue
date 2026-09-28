<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useClientsApi, type ClientManagerAssignment, type AssignableUser } from "@/composables/useClientsApi";
import { useServicesApi, type CustomerType, type ClientReference } from "@/composables/useServicesApi";
import { useToast } from "@/composables/useToast";
import ManagersMultiSelect from "@/components/common/ManagersMultiSelect.vue";
import SearchInput from "@/components/common/SearchInput.vue";

const toast = useToast();
const {
  assignments,
  assignableUsers,
  loading,
  fetchAssignments,
  saveAssignments,
  fetchAssignableUsers
} = useClientsApi();

const {
  customerTypes,
  references,
  fetchCustomerTypes,
  fetchReferences
} = useServicesApi();

const mainTab = ref<"customers" | "shared">("customers");
const searchQuery = ref("");
const selectedTypeFilter = ref<number | "all">("all");
const selectedReferenceFilter = ref<number | "all">("all");
const activeFilter = ref<"all" | "assigned" | "shared" | "unassigned">("all");
const pendingAssignments = ref<Record<number, number[]>>({});
const savingIds = ref<Record<number, boolean>>({});

const loadData = async () => {
  try {
    await Promise.all([
      fetchAssignments({ search: searchQuery.value, filter: activeFilter.value }),
      fetchAssignableUsers(),
      fetchCustomerTypes(),
      fetchReferences()
    ]);
  } catch (err: any) {
    toast.error("Failed to load assignments");
  }
};

onMounted(() => {
  loadData();
});

watch([activeFilter, searchQuery], () => {
  loadData();
});

const getClientManagerIds = (client: ClientManagerAssignment): number[] => {
  if (pendingAssignments.value[client.id] !== undefined) {
    return pendingAssignments.value[client.id];
  }
  return client.managerIds || [];
};

const updatePending = (clientId: number, nextIds: number[]) => {
  pendingAssignments.value[clientId] = nextIds;
};

const hasPendingChanges = (client: ClientManagerAssignment): boolean => {
  if (pendingAssignments.value[client.id] === undefined) return false;
  const pending = pendingAssignments.value[client.id].slice().sort();
  const current = (client.managerIds || []).slice().sort();
  return JSON.stringify(pending) !== JSON.stringify(current);
};

const handleSaveSingle = async (client: ClientManagerAssignment) => {
  const nextIds = pendingAssignments.value[client.id] ?? client.managerIds;
  savingIds.value[client.id] = true;
  try {
    await saveAssignments(client.id, nextIds);
    toast.success("Manager assignments updated");
    delete pendingAssignments.value[client.id];
    await fetchAssignments({ search: searchQuery.value, filter: activeFilter.value });
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to save assignment");
  } finally {
    savingIds.value[client.id] = false;
  }
};

const filteredAssignments = computed(() => {
  let list = assignments.value;
  if (selectedTypeFilter.value !== "all") {
    const typeObj = customerTypes.value.find((t) => t.id === selectedTypeFilter.value);
    if (typeObj) {
      list = list.filter((a) => a.customerTypeId === selectedTypeFilter.value || a.customerTypeName === typeObj.typeName);
    }
  }
  if (selectedReferenceFilter.value !== "all") {
    const refObj = references.value.find((r) => r.id === selectedReferenceFilter.value);
    if (refObj) {
      list = list.filter((a) => a.referenceId === selectedReferenceFilter.value || a.referenceName === refObj.name);
    }
  }
  return list;
});

const sharedClientsList = computed(() => {
  let list = assignments.value.filter((c) => (c.managerIds || []).length > 1);
  if (selectedTypeFilter.value !== "all") {
    const typeObj = customerTypes.value.find((t) => t.id === selectedTypeFilter.value);
    if (typeObj) {
      list = list.filter((a) => a.customerTypeId === selectedTypeFilter.value || a.customerTypeName === typeObj.typeName);
    }
  }
  if (selectedReferenceFilter.value !== "all") {
    const refObj = references.value.find((r) => r.id === selectedReferenceFilter.value);
    if (refObj) {
      list = list.filter((a) => a.referenceId === selectedReferenceFilter.value || a.referenceName === refObj.name);
    }
  }
  return list;
});

const stats = computed(() => {
  const list = assignments.value;
  return {
    total: list.length,
    assigned: list.filter((c) => (c.managerIds || []).length > 0).length,
    shared: list.filter((c) => (c.managerIds || []).length > 1).length,
    unassigned: list.filter((c) => !c.managerIds || c.managerIds.length === 0).length
  };
});

// Pagination State (10 items per page)
const currentPage = ref(1);
const itemsPerPage = 10;

const totalPages = computed(() => Math.ceil(filteredAssignments.value.length / itemsPerPage) || 1);

const paginatedAssignments = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage;
  return filteredAssignments.value.slice(start, start + itemsPerPage);
});

// Shared Tab Pagination State
const sharedCurrentPage = ref(1);
const sharedTotalPages = computed(() => Math.ceil(sharedClientsList.value.length / itemsPerPage) || 1);

const paginatedSharedClients = computed(() => {
  const start = (sharedCurrentPage.value - 1) * itemsPerPage;
  return sharedClientsList.value.slice(start, start + itemsPerPage);
});

// Reset page on filter changes
watch([selectedTypeFilter, selectedReferenceFilter, activeFilter, searchQuery], () => {
  currentPage.value = 1;
  sharedCurrentPage.value = 1;
});
</script>

<template>
  <div class="assignments-container py-2">
    <!-- Header & Breadcrumbs -->
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Dashboard
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">Assignments</span>
        </div>
        <h4 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
          <i class="bi bi-person-check text-primary"></i> Client Manager Assignments
        </h4>
        <p class="text-muted small mb-0 mt-1">
          Manage which team members and staff operators are assigned to manage client accounts and VAT submissions.
        </p>
      </div>

      <div class="d-flex align-items-center gap-2">
        <router-link to="/admin/clients" class="btn btn-outline-secondary btn-sm px-3">
          <i class="bi bi-briefcase me-1"></i> Clients Master
        </router-link>
        <router-link to="/admin/users" class="btn btn-outline-info btn-sm px-3">
          <i class="bi bi-people me-1"></i> Team Users
        </router-link>
      </div>
    </div>

    <!-- Top Two Tabs (Customer Assignment vs Shared Customers) -->
    <div class="settings-tabs-wrapper mb-3">
      <ul class="nav nav-pills gap-2 pb-1">
        <li class="nav-item">
          <button
            type="button"
            class="nav-link py-2 px-3 fw-semibold small d-flex align-items-center gap-2"
            :class="{ active: mainTab === 'customers' }"
            @click="mainTab = 'customers'"
          >
            <i class="bi bi-people"></i>
            <span>Customer Assignment</span>
            <span class="badge bg-dark border border-secondary text-light ms-1">{{ assignments.length }}</span>
          </button>
        </li>
        <li class="nav-item">
          <button
            type="button"
            class="nav-link py-2 px-3 fw-semibold small d-flex align-items-center gap-2"
            :class="{ active: mainTab === 'shared' }"
            @click="mainTab = 'shared'"
          >
            <i class="bi bi-person-lines-fill"></i>
            <span>Shared Customers (2+ Users)</span>
            <span class="badge bg-info text-dark fw-bold ms-1">{{ stats.shared }}</span>
          </button>
        </li>
      </ul>
    </div>

    <!-- ── TAB 1: CUSTOMER ASSIGNMENTS ───────────────────────── -->
    <div v-if="mainTab === 'customers'">
      <!-- Quick Stats Cards -->
      <div class="row g-3 mb-4">
        <div class="col-6 col-md-3">
          <div
            class="stat-pill p-3 cursor-pointer"
            :class="{ 'stat-pill-active': activeFilter === 'all' }"
            @click="activeFilter = 'all'"
          >
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="text-muted small text-uppercase fw-bold">All Clients</span>
              <i class="bi bi-building text-primary"></i>
            </div>
            <div class="fs-4 fw-bold text-white">{{ stats.total }}</div>
          </div>
        </div>

        <div class="col-6 col-md-3">
          <div
            class="stat-pill p-3 cursor-pointer"
            :class="{ 'stat-pill-active': activeFilter === 'assigned' }"
            @click="activeFilter = 'assigned'"
          >
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="text-muted small text-uppercase fw-bold">Assigned</span>
              <i class="bi bi-person-check text-success"></i>
            </div>
            <div class="fs-4 fw-bold text-success">{{ stats.assigned }}</div>
          </div>
        </div>

        <div class="col-6 col-md-3">
          <div
            class="stat-pill p-3 cursor-pointer"
            :class="{ 'stat-pill-active': activeFilter === 'shared' }"
            @click="activeFilter = 'shared'"
          >
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="text-muted small text-uppercase fw-bold">Shared (2+ Users)</span>
              <i class="bi bi-people text-info"></i>
            </div>
            <div class="fs-4 fw-bold text-info">{{ stats.shared }}</div>
          </div>
        </div>

        <div class="col-6 col-md-3">
          <div
            class="stat-pill p-3 cursor-pointer"
            :class="{ 'stat-pill-active': activeFilter === 'unassigned' }"
            @click="activeFilter = 'unassigned'"
          >
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="text-muted small text-uppercase fw-bold">Unassigned</span>
              <i class="bi bi-exclamation-circle text-warning"></i>
            </div>
            <div class="fs-4 fw-bold text-warning">{{ stats.unassigned }}</div>
          </div>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="filter-panel p-3 mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div class="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
          <!-- Integrated Search Box -->
          <SearchInput
            v-model="searchQuery"
            placeholder="Search by client name, BIN, or mobile..."
            max-width="300px"
            min-width="220px"
          />

          <!-- Customer Type Filter -->
          <select v-model="selectedTypeFilter" class="form-select form-select-sm idp-select" style="width: auto; min-width: 160px;">
            <option value="all">All Customer Types</option>
            <option v-for="t in customerTypes" :key="t.id" :value="t.id">{{ t.typeName }}</option>
          </select>

          <!-- Reference Filter -->
          <select v-model="selectedReferenceFilter" class="form-select form-select-sm idp-select" style="width: auto; min-width: 160px;">
            <option value="all">All References</option>
            <option v-for="r in references" :key="r.id" :value="r.id">{{ r.name }}</option>
          </select>
        </div>

        <!-- Filter Buttons -->
        <div class="btn-group btn-group-sm">
          <button
            type="button"
            class="btn"
            :class="activeFilter === 'all' ? 'btn-primary' : 'btn-dark border-secondary text-light'"
            @click="activeFilter = 'all'"
          >
            All
          </button>
          <button
            type="button"
            class="btn"
            :class="activeFilter === 'assigned' ? 'btn-primary' : 'btn-dark border-secondary text-light'"
            @click="activeFilter = 'assigned'"
          >
            Assigned
          </button>
          <button
            type="button"
            class="btn"
            :class="activeFilter === 'shared' ? 'btn-primary' : 'btn-dark border-secondary text-light'"
            @click="activeFilter = 'shared'"
          >
            Shared
          </button>
          <button
            type="button"
            class="btn"
            :class="activeFilter === 'unassigned' ? 'btn-primary' : 'btn-dark border-secondary text-light'"
            @click="activeFilter = 'unassigned'"
          >
            Unassigned
          </button>
        </div>
      </div>

      <!-- Assignments Table with Searchable Multi-Select Dropdown -->
      <div class="table-card shadow-sm">
        <table class="table-custom">
          <thead>
            <tr>
              <th style="width: 28%;">Client Organization</th>
              <th style="width: 13%;">Customer Type</th>
              <th style="width: 13%;">Reference</th>
              <th style="width: 8%;">Status</th>
              <th style="width: 28%;">Assigned Users / Managers</th>
              <th style="width: 10%; text-align: right;">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading && filteredAssignments.length === 0">
              <td colspan="6" class="text-center py-4 text-muted">
                <div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                Loading client assignments...
              </td>
            </tr>

            <tr v-else-if="filteredAssignments.length === 0">
              <td colspan="6" class="text-center py-4 text-muted">
                <i class="bi bi-inbox fs-3 d-block mb-1"></i>
                No clients found matching filter.
              </td>
            </tr>

            <tr v-for="client in paginatedAssignments" :key="client.id">
              <!-- Client Info -->
              <td>
                <div class="fw-semibold text-white mb-1">{{ client.companyName }}</div>
                <div class="d-flex align-items-center gap-2 flex-wrap">
                  <span v-if="client.binNumber" class="badge bg-dark border border-secondary text-info font-monospace small">
                    BIN: {{ client.binNumber }}
                  </span>
                  <span v-if="client.mobile" class="text-muted small">
                    <i class="bi bi-telephone me-1"></i> {{ client.mobile }}
                  </span>
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
                <span class="badge bg-dark border border-secondary text-light small">
                  {{ client.referenceName || 'Direct / None' }}
                </span>
              </td>

              <!-- Active Status -->
              <td>
                <span
                  class="badge-btn"
                  :class="client.isActive ? 'badge-active' : 'badge-inactive'"
                >
                  <span class="dot"></span>
                  {{ client.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>

              <!-- Assigned Managers: Searchable Multi-Select Dropdown Component -->
              <td>
                <ManagersMultiSelect
                  :managers="assignableUsers"
                  :selected="getClientManagerIds(client)"
                  placeholder="Assign managers..."
                  @update:selected="(val) => updatePending(client.id, val)"
                />
              </td>

              <!-- Action Save Button -->
              <td style="text-align: right;">
                <button
                  type="button"
                  class="btn btn-sm px-3 fw-semibold"
                  :class="hasPendingChanges(client) ? 'btn-success shadow-sm' : 'btn-outline-secondary'"
                  :disabled="savingIds[client.id] || !hasPendingChanges(client)"
                  @click="handleSaveSingle(client)"
                >
                  <span v-if="savingIds[client.id]" class="spinner-border spinner-border-sm me-1"></span>
                  <i v-else class="bi bi-check2 me-1"></i>
                  Save
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination for Customer Assignments -->
      <div v-if="filteredAssignments.length > 0" class="d-flex flex-wrap justify-content-between align-items-center mt-3 pt-2">
        <span class="text-muted small">
          Showing <strong>{{ (currentPage - 1) * itemsPerPage + 1 }}</strong> to
          <strong>{{ Math.min(currentPage * itemsPerPage, filteredAssignments.length) }}</strong> of
          <strong>{{ filteredAssignments.length }}</strong> clients
        </span>

        <div v-if="totalPages > 1" class="d-flex align-items-center gap-1">
          <button
            type="button"
            class="btn btn-dark border-secondary btn-sm"
            :disabled="currentPage <= 1"
            @click="currentPage--"
          >
            <i class="bi bi-chevron-left"></i> Prev
          </button>

          <template v-for="p in totalPages" :key="p">
            <button
              v-if="p === 1 || p === totalPages || (p >= currentPage - 2 && p <= currentPage + 2)"
              type="button"
              class="btn btn-sm"
              :class="currentPage === p ? 'btn-primary' : 'btn-dark border-secondary text-muted'"
              style="min-width: 32px;"
              @click="currentPage = p"
            >
              {{ p }}
            </button>
            <span
              v-else-if="p === currentPage - 3 || p === currentPage + 3"
              class="text-muted px-1"
            >
              ...
            </span>
          </template>

          <button
            type="button"
            class="btn btn-dark border-secondary btn-sm"
            :disabled="currentPage >= totalPages"
            @click="currentPage++"
          >
            Next <i class="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- ── TAB 2: SHARED CUSTOMERS (DEDICATED VIEW) ───────────── -->
    <div v-else-if="mainTab === 'shared'">
      <div class="idp-card p-4 shadow-sm mb-3">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <div>
            <h5 class="text-white fw-bold mb-1 d-flex align-items-center gap-2">
              <i class="bi bi-people-fill text-info"></i> Shared Clients Overview
            </h5>
            <p class="text-muted small mb-0">
              List of client accounts co-managed by 2 or more team operators.
            </p>
          </div>
          <div class="stat-pill-sm d-flex align-items-center gap-2 px-3 py-2 rounded-3 border border-secondary border-opacity-50" style="background: #15181c;">
            <i class="bi bi-people-fill text-info"></i>
            <span class="text-secondary small">Total Shared:</span>
            <span class="text-white fw-bold">{{ sharedClientsList.length }} Clients</span>
          </div>
        </div>

        <div class="table-card shadow-sm">
          <table class="table-custom">
            <thead>
              <tr>
                <th style="width: 30%;">Client Organization</th>
                <th style="width: 15%;">Customer Type</th>
                <th style="width: 15%;">Reference</th>
                <th style="width: 25%;">Assigned Team Managers</th>
                <th style="width: 15%; text-align: right;">Managers Count</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="sharedClientsList.length === 0">
                <td colspan="5" class="text-center py-5 text-muted">
                  <i class="bi bi-people fs-2 d-block mb-2 text-secondary"></i>
                  No shared clients found. Assign 2 or more managers to any client to view them here.
                </td>
              </tr>

              <tr v-for="sc in paginatedSharedClients" :key="sc.id">
                <td>
                  <router-link :to="`/admin/clients/${sc.id}/edit`" class="fw-semibold text-white text-decoration-none hover-primary mb-1 d-block">
                    {{ sc.companyName }}
                  </router-link>
                  <div class="text-muted small">
                    <span v-if="sc.binNumber" class="font-monospace text-info me-2">BIN: {{ sc.binNumber }}</span>
                    <span v-if="sc.mobile"><i class="bi bi-telephone me-1"></i>{{ sc.mobile }}</span>
                  </div>
                </td>

                <td>
                  <span class="badge bg-secondary bg-opacity-25 text-light border border-secondary border-opacity-25 small">
                    {{ sc.customerTypeName || 'Standard' }}
                  </span>
                </td>

                <td>
                  <span class="badge bg-dark border border-secondary text-light small">
                    {{ sc.referenceName || 'Direct / None' }}
                  </span>
                </td>

                <td>
                  <div class="d-flex flex-wrap gap-1 align-items-center">
                    <span
                      v-for="mgr in sc.managers"
                      :key="mgr.id"
                      class="badge bg-primary bg-opacity-25 text-light border border-primary border-opacity-50 small d-inline-flex align-items-center gap-1 py-1 px-2"
                    >
                      <i class="bi bi-person-fill text-primary"></i>
                      {{ mgr.name }}
                    </span>
                  </div>
                </td>

                <td style="text-align: right;">
                  <span class="badge bg-dark border border-secondary text-info font-monospace px-2 py-1">
                    {{ sc.managers.length }} Users
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Shared Clients Pagination -->
        <div v-if="sharedClientsList.length > 0" class="d-flex flex-wrap justify-content-between align-items-center mt-3 pt-2">
          <span class="text-muted small">
            Showing <strong>{{ (sharedCurrentPage - 1) * itemsPerPage + 1 }}</strong> to
            <strong>{{ Math.min(sharedCurrentPage * itemsPerPage, sharedClientsList.length) }}</strong> of
            <strong>{{ sharedClientsList.length }}</strong> shared clients
          </span>

          <div v-if="sharedTotalPages > 1" class="d-flex align-items-center gap-1">
            <button
              type="button"
              class="btn btn-dark border-secondary btn-sm"
              :disabled="sharedCurrentPage <= 1"
              @click="sharedCurrentPage--"
            >
              <i class="bi bi-chevron-left"></i> Prev
            </button>

            <template v-for="p in sharedTotalPages" :key="p">
              <button
                v-if="p === 1 || p === sharedTotalPages || (p >= sharedCurrentPage - 2 && p <= sharedCurrentPage + 2)"
                type="button"
                class="btn btn-sm"
                :class="sharedCurrentPage === p ? 'btn-primary' : 'btn-dark border-secondary text-muted'"
                style="min-width: 32px;"
                @click="sharedCurrentPage = p"
              >
                {{ p }}
              </button>
              <span
                v-else-if="p === sharedCurrentPage - 3 || p === sharedCurrentPage + 3"
                class="text-muted px-1"
              >
                ...
              </span>
            </template>

            <button
              type="button"
              class="btn btn-dark border-secondary btn-sm"
              :disabled="sharedCurrentPage >= sharedTotalPages"
              @click="sharedCurrentPage++"
            >
              Next <i class="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.assignments-container {
  width: 100%;
}

.settings-tabs-wrapper {
  border-bottom: 1px solid #343a40;
  padding-bottom: 0.5rem;
}

.settings-tabs-wrapper .nav-link {
  color: #adb5bd;
  background: #212529;
  border: 1px solid #343a40;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.45rem 1rem;
  transition: all 0.15s ease;
}

.settings-tabs-wrapper .nav-link:hover {
  color: #fff;
  background: #2c3238;
}

.settings-tabs-wrapper .nav-link.active {
  color: #fff;
  background: #0d6efd;
  border-color: #0d6efd;
}

.stat-pill {
  background: #1e2227;
  border: 1px solid #343a40;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.stat-pill:hover {
  background: #252a30;
  border-color: #495057;
}

.stat-pill-active {
  border-color: #0d6efd !important;
  background: #192434 !important;
}

.cursor-pointer {
  cursor: pointer;
}

.filter-panel {
  background: #1e2227;
  border: 1px solid #343a40;
  border-radius: 8px;
}

.search-box {
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  pointer-events: none;
  font-size: 0.82rem;
}

.idp-search-input {
  background-color: #15181c !important;
  border: 1px solid #3a4149 !important;
  color: #f8f9fa !important;
  padding-left: 36px !important;
  padding-right: 32px !important;
  border-radius: 6px;
  font-size: 0.85rem;
  height: 36px;
}

.idp-search-input:focus {
  border-color: #0d6efd !important;
  box-shadow: 0 0 0 0.15rem rgba(13, 110, 253, 0.25) !important;
}

.clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 0.95rem;
}

.clear-btn:hover {
  color: #f8f9fa;
}

.idp-select {
  background-color: #15181c !important;
  border: 1px solid #3a4149 !important;
  color: #f8f9fa !important;
  border-radius: 6px;
  font-size: 0.85rem;
  height: 36px;
}

.idp-select:focus {
  border-color: #0d6efd !important;
  box-shadow: 0 0 0 0.15rem rgba(13, 110, 253, 0.25) !important;
}

.idp-card {
  background: #1e2227;
  border: 1px solid #343a40;
  border-radius: 8px;
}

.table-card {
  background: #1e2227;
  border: 1px solid #343a40;
  border-radius: 8px;
  overflow: visible; /* Allows multiselect dropdown popover to float above cleanly */
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

.badge-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.73rem;
  font-weight: 600;
  border: none;
}

.badge-active {
  background: rgba(25, 135, 84, 0.15);
  color: #20c997;
  border: 1px solid rgba(25, 135, 84, 0.35);
}

.badge-inactive {
  background: rgba(108, 117, 125, 0.15);
  color: #adb5bd;
  border: 1px solid rgba(108, 117, 125, 0.35);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.hover-primary:hover {
  color: #3b8eed !important;
}
</style>
