<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import axios from "axios";

const purchases = ref<any[]>([]);
const totalCount = ref(0);
const isLoading = ref(false);
const searchQuery = ref("");
const currentPage = ref(1);
const itemsPerPage = 15;

const fetchGlobalPurchases = async () => {
  isLoading.value = true;
  try {
    const res = await axios.get("/api/superadmin/purchases", {
      params: {
        page: currentPage.value,
        limit: itemsPerPage,
        search: searchQuery.value
      }
    });
    if (res.data) {
      purchases.value = res.data.data || [];
      totalCount.value = res.data.total || 0;
    }
  } catch (e) {
    console.error(e);
  } finally {
    isLoading.value = false;
  }
};

watch([searchQuery], () => {
  currentPage.value = 1;
  fetchGlobalPurchases();
});

watch(currentPage, fetchGlobalPurchases);

onMounted(fetchGlobalPurchases);
</script>

<template>
  <div class="py-2">
    <!-- Breadcrumbs -->
    <div class="d-flex align-items-center gap-2 mb-1">
      <router-link to="/" class="text-muted text-decoration-none small">
        <i class="bi bi-arrow-left me-1"></i> Dashboard
      </router-link>
      <span class="text-muted small">/</span>
      <span class="text-primary small fw-semibold">Global Purchases</span>
    </div>
    <h4 class="text-white fw-bold mb-4">System-Wide Purchases Audit</h4>

    <!-- Search Bar -->
    <div class="idp-card p-3 mb-4">
      <div class="input-group">
        <span class="input-group-text bg-dark border-secondary text-muted">
          <i class="bi bi-search"></i>
        </span>
        <input
          v-model="searchQuery"
          type="text"
          class="form-control idp-input"
          placeholder="Search by tenant, client, challan, seller..."
        />
      </div>
    </div>

    <!-- Table -->
    <div class="idp-table-wrapper">
      <div class="table-responsive">
        <table class="table idp-table table-sm">
          <thead>
            <tr>
              <th>#</th>
              <th>Tenant Org</th>
              <th>Client Name</th>
              <th>Challan / Date</th>
              <th>Seller Name</th>
              <th>Item</th>
              <th class="text-end">Amount</th>
              <th class="text-end">VAT</th>
              <th class="text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="9" class="text-center py-5 text-muted">Loading global purchases...</td>
            </tr>
            <tr v-else-if="purchases.length === 0">
              <td colspan="9" class="text-center py-5 text-muted">No records found.</td>
            </tr>
            <tr v-for="(p, idx) in purchases" :key="p.id">
              <td class="text-muted small">{{ (currentPage - 1) * itemsPerPage + idx + 1 }}</td>
              <td><span class="badge bg-secondary">{{ p.tenantName || 'Tenant #' + (p.tenantId || p.adminId) }}</span></td>
              <td class="fw-bold text-white">{{ p.clientName || '—' }}</td>
              <td>{{ p.challanNo || '—' }}</td>
              <td>{{ p.sellerName || '—' }}</td>
              <td>{{ p.itemName || '—' }}</td>
              <td class="text-end">{{ p.amount?.toLocaleString() || 0 }}</td>
              <td class="text-end text-warning">{{ p.vatAmount?.toLocaleString() || 0 }}</td>
              <td class="text-end text-success fw-bold">{{ p.totalAmount?.toLocaleString() || 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
