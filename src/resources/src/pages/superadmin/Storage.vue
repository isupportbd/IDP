<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import axios from "axios";
import SearchInput from "@/components/common/SearchInput.vue";

interface TenantStorageItem {
  id: number;
  name: string;
  email: string;
  mobile?: string;
  status: string;
  rank: number;
  planName?: string;
  maxStorageMB?: number;
  usagePercent?: number;
  clientsCount: number;
  submissionsCount: number;
  billsCount: number;
  totalRecords: number;
  estimatedKB: number;
  estimatedMB: number;
  createdAt?: string;
}

const stats = ref<{
  dbSizeMB: number;
  tablesCount: number;
  totalRows: number;
  totalClients: number;
  totalUsers: number;
  totalSubmissions: number;
  totalBills: number;
  tenantsCount: number;
  rankingResetTime: string;
  lastCalculated: string;
  tenantBreakdown: TenantStorageItem[];
}>({
  dbSizeMB: 18.5,
  tablesCount: 18,
  totalRows: 0,
  totalClients: 0,
  totalUsers: 0,
  totalSubmissions: 0,
  totalBills: 0,
  tenantsCount: 0,
  rankingResetTime: "12:00 AM Daily",
  lastCalculated: new Date().toISOString(),
  tenantBreakdown: []
});

const isLoading = ref(false);
const searchTerm = ref("");

const fetchStorageStats = async () => {
  isLoading.value = true;
  try {
    const res = await axios.get("/api/superadmin/storage-stats");
    if (res.data?.success && res.data?.data) {
      stats.value = res.data.data;
    }
  } catch (e) {
    console.error("Failed to fetch storage stats:", e);
  } finally {
    isLoading.value = false;
  }
};

const filteredBreakdown = computed(() => {
  const list = stats.value.tenantBreakdown || [];
  if (!searchTerm.value.trim()) return list;
  const q = searchTerm.value.toLowerCase();
  return list.filter(
    (t) =>
      t.name.toLowerCase().includes(q) ||
      t.email.toLowerCase().includes(q) ||
      (t.mobile && t.mobile.includes(q))
  );
});

const getRankBadge = (rank: number) => {
  if (rank === 1) return { text: "Rank #1", class: "bg-warning text-dark border-warning" };
  if (rank === 2) return { text: "Rank #2", class: "bg-light text-dark border-light" };
  if (rank === 3) return { text: "Rank #3", class: "bg-danger bg-opacity-75 text-white border-danger" };
  return { text: `Rank #${rank}`, class: "bg-secondary bg-opacity-50 text-light border-secondary" };
};

onMounted(fetchStorageStats);
</script>

<template>
  <div class="py-2">
    <!-- Header -->
    <div class="d-flex align-items-center justify-content-between mb-4">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Dashboard
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">Storage</span>
        </div>
        <h4 class="text-white fw-bold mb-0">Database & Tenant Storage Ranking</h4>
      </div>
      <div class="d-flex align-items-center gap-2">
        <span class="badge bg-dark border border-secondary text-info px-3 py-1.5 font-monospace small">
          <i class="bi bi-clock-history me-1"></i> Ranked Daily (12:00 AM Midnight)
        </span>
        <button class="btn btn-outline-secondary btn-sm" :disabled="isLoading" @click="fetchStorageStats">
          <i class="bi bi-arrow-clockwise me-1" :class="{ 'spin-icon': isLoading }"></i> Refresh
        </button>
      </div>
    </div>

    <!-- 1. SYSTEM STORAGE OVERVIEW CARDS -->
    <div class="row g-3 mb-4">
      <div class="col-md-3">
        <div class="idp-card p-3 d-flex align-items-center gap-3">
          <div class="card-icon bg-primary bg-opacity-10 text-primary rounded p-2.5">
            <i class="bi bi-database fs-3"></i>
          </div>
          <div>
            <div class="text-muted small">PostgreSQL Database</div>
            <h4 class="text-white fw-bold mb-0 font-monospace">{{ stats.dbSizeMB }} MB</h4>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="idp-card p-3 d-flex align-items-center gap-3">
          <div class="card-icon bg-success bg-opacity-10 text-success rounded p-2.5">
            <i class="bi bi-layers fs-3"></i>
          </div>
          <div>
            <div class="text-muted small">Total System Records</div>
            <h4 class="text-white fw-bold mb-0 font-monospace">{{ stats.totalRows?.toLocaleString() }} Rows</h4>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="idp-card p-3 d-flex align-items-center gap-3">
          <div class="card-icon bg-info bg-opacity-10 text-info rounded p-2.5">
            <i class="bi bi-buildings fs-3"></i>
          </div>
          <div>
            <div class="text-muted small">Active Organization Firms</div>
            <h4 class="text-white fw-bold mb-0 font-monospace">{{ stats.tenantsCount }} Tenants</h4>
          </div>
        </div>
      </div>
      <div class="col-md-3">
        <div class="idp-card p-3 d-flex align-items-center gap-3">
          <div class="card-icon bg-warning bg-opacity-10 text-warning rounded p-2.5">
            <i class="bi bi-trophy fs-3"></i>
          </div>
          <div>
            <div class="text-muted small">Storage Ranking Cycle</div>
            <h5 class="text-white fw-bold mb-0">Daily Auto-Sort</h5>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. TENANT STORAGE USAGE BREAKDOWN & RANKING -->
    <div class="idp-table-wrapper">
      <div class="p-3 border-bottom border-secondary d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
        <div>
          <h6 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
            <i class="bi bi-bar-chart-steps text-primary"></i> Tenant Uploads & Storage Usage Breakdown
          </h6>
          <div class="text-muted small">
            Ranked by total database records and storage footprint against plan quota. Auto-sorted daily after 12:00 AM.
          </div>
        </div>

        <!-- Search Box -->
        <SearchInput
          v-model="searchTerm"
          placeholder="Search tenant or email..."
          max-width="260px"
          min-width="180px"
        />
      </div>

      <div class="table-responsive">
        <table class="table idp-table align-middle mb-0">
          <thead>
            <tr>
              <th style="width: 90px;" class="text-center">RANK</th>
              <th>ORGANIZATION TENANT</th>
              <th class="text-center">CLIENTS</th>
              <th class="text-center">SUBMISSIONS</th>
              <th class="text-center">INVOICES</th>
              <th class="text-center">TOTAL RECORDS</th>
              <th style="min-width: 200px;">ESTIMATED USAGE</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="7" class="text-center py-5 text-muted">
                <span class="spinner-border spinner-border-sm text-primary me-2"></span>
                Calculating tenant storage usage and daily ranking...
              </td>
            </tr>
            <tr v-else-if="filteredBreakdown.length === 0">
              <td colspan="7" class="text-center py-5 text-muted">
                No tenant data found matching your query.
              </td>
            </tr>
            <tr v-for="t in filteredBreakdown" :key="t.id">
              <td class="text-center">
                <span class="badge border px-2 py-1 fw-bold rounded-pill" :class="getRankBadge(t.rank).class">
                  {{ getRankBadge(t.rank).text }}
                </span>
              </td>
              <td>
                <div class="d-flex align-items-center gap-2">
                  <div class="fw-bold text-white fs-6">{{ t.name }}</div>
                  <span class="badge bg-dark border border-secondary text-primary font-monospace small px-2">
                    {{ t.planName || 'Plan' }}
                  </span>
                </div>
                <div class="text-muted small font-monospace">{{ t.email }} · Tenant #{{ t.id }}</div>
              </td>
              <td class="text-center">
                <span class="badge bg-secondary bg-opacity-50 text-light px-2.5 py-1 font-monospace">
                  {{ t.clientsCount }} Clients
                </span>
              </td>
              <td class="text-center">
                <span class="text-light font-monospace">{{ t.submissionsCount }}</span>
              </td>
              <td class="text-center">
                <span class="text-light font-monospace">{{ t.billsCount }}</span>
              </td>
              <td class="text-center">
                <span class="text-white fw-bold font-monospace">{{ t.totalRecords?.toLocaleString() }}</span>
              </td>
              <td>
                <div class="d-flex flex-column gap-1">
                  <div class="d-flex justify-content-between align-items-center small">
                    <span class="text-white fw-bold font-monospace">
                      {{ t.estimatedMB > 0 ? t.estimatedMB + ' MB' : t.estimatedKB + ' KB' }}
                      <span class="text-muted fw-normal">/ {{ t.maxStorageMB || 1024 }} MB</span>
                    </span>
                    <span class="text-muted small font-monospace">
                      {{ (t.usagePercent || 0) < 0.01 ? '<0.01%' : t.usagePercent + '%' }}
                    </span>
                  </div>
                  <div class="progress" style="height: 6px; background-color: #2d3748;">
                    <div
                      class="progress-bar"
                      :class="(t.usagePercent || 0) > 90 ? 'bg-danger' : (t.usagePercent || 0) > 75 ? 'bg-warning' : 'bg-primary'"
                      role="progressbar"
                      :style="{ width: `${Math.max(t.usagePercent || 0, 1)}%` }"
                    ></div>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.idp-table th {
  background-color: #1a202c;
  color: #a0aec0;
  font-size: 0.82rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0.75rem 1rem;
}
.idp-table td {
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #2d3748;
}

/* Search Box */
.search-box {
  position: relative;
}
.search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  font-size: 0.85rem;
  pointer-events: none;
}
.idp-search-input {
  padding-left: 32px !important;
  padding-right: 28px !important;
  height: 32px !important;
  background-color: #1a202c !important;
  border: 1px solid #2d3748 !important;
  color: #e2e8f0 !important;
  border-radius: 6px !important;
  font-size: 0.82rem !important;
}
.idp-search-input:focus {
  border-color: #3182ce !important;
  box-shadow: 0 0 0 1px #3182ce !important;
}
.clear-btn {
  position: absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: #a0aec0;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
}
.clear-btn:hover {
  color: #fff;
  background-color: #2d3748;
}

.spin-icon {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}
</style>
