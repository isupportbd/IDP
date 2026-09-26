<script setup lang="ts">
import { ref, onMounted } from "vue";
import axios from "axios";

const summary = ref({
  totalTenants: 0,
  totalClients: 0,
  totalPurchases: 0,
  totalTaxVolume: 0,
  totalVatVolume: 0
});
const isLoading = ref(false);

const fetchGlobalMetrics = async () => {
  isLoading.value = true;
  try {
    const res = await axios.get("/api/superadmin/metrics");
    if (res.data?.summary) {
      summary.value = res.data.summary;
    }
  } catch (e) {
    // fallback
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchGlobalMetrics);
</script>

<template>
  <div class="py-2">
    <!-- Breadcrumbs -->
    <div class="d-flex align-items-center gap-2 mb-1">
      <router-link to="/" class="text-muted text-decoration-none small">
        <i class="bi bi-arrow-left me-1"></i> Dashboard
      </router-link>
      <span class="text-muted small">/</span>
      <span class="text-primary small fw-semibold">Global Reports</span>
    </div>
    <h4 class="text-white fw-bold mb-4">System-Wide Analytics & Metrics</h4>

    <div class="row g-4">
      <div class="col-md-4">
        <div class="idp-card p-4">
          <div class="text-muted small mb-1">Active Organization Tenants</div>
          <h3 class="text-white fw-bold mb-0">{{ summary.totalTenants ?? 0 }}</h3>
        </div>
      </div>
      <div class="col-md-4">
        <div class="idp-card p-4">
          <div class="text-muted small mb-1">Total Registered Business Clients</div>
          <h3 class="text-white fw-bold mb-0">{{ summary.totalClients ?? 0 }}</h3>
        </div>
      </div>
      <div class="col-md-4">
        <div class="idp-card p-4">
          <div class="text-muted small mb-1">Total Purchases Tracked</div>
          <h3 class="text-white fw-bold mb-0">{{ summary.totalPurchases ?? 0 }}</h3>
        </div>
      </div>
    </div>
  </div>
</template>
