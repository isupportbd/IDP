<script setup lang="ts">
import { useRoute } from "vue-router";
const route = useRoute();
</script>

<template>
  <div class="py-2">
    <!-- Breadcrumbs -->
    <div class="d-flex align-items-center gap-2 mb-1">
      <router-link to="/" class="text-muted text-decoration-none small">
        <i class="bi bi-arrow-left me-1"></i> Dashboard
      </router-link>
      <span class="text-muted small">/</span>
      <span class="text-primary small fw-semibold">Settings</span>
    </div>
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-4">
      <div>
        <h4 class="text-white fw-bold mb-0">Global System Settings & Master Data</h4>
        <span class="text-muted small">Manage master database catalogs, role permissions, and import mappings</span>
      </div>
    </div>

    <!-- Settings Tabs Bar -->
    <div class="d-flex flex-wrap gap-2 mb-4 border-bottom border-secondary pb-3">
      <router-link
        to="/superadmin/settings/client-types"
        class="btn btn-sm"
        :class="route.path.includes('/client-types') ? 'btn-primary' : 'btn-dark border-secondary text-muted'"
      >
        <i class="bi bi-tags me-1"></i> Client Types
      </router-link>
      <router-link
        to="/superadmin/settings/locations"
        class="btn btn-sm"
        :class="route.path.includes('/locations') ? 'btn-primary' : 'btn-dark border-secondary text-muted'"
      >
        <i class="bi bi-geo-alt me-1"></i> Locations & Areas
      </router-link>
      <router-link
        to="/superadmin/settings/references"
        class="btn btn-sm"
        :class="route.path.includes('/references') ? 'btn-primary' : 'btn-dark border-secondary text-muted'"
      >
        <i class="bi bi-person-lines-fill me-1"></i> References
      </router-link>
      <router-link
        to="/superadmin/settings/mappings"
        class="btn btn-sm"
        :class="route.path.includes('/mappings') ? 'btn-primary' : 'btn-dark border-secondary text-muted'"
      >
        <i class="bi bi-columns-gap me-1"></i> Column Mappings
      </router-link>
      <router-link
        to="/superadmin/settings/items"
        class="btn btn-sm"
        :class="route.path.includes('/items') ? 'btn-primary' : 'btn-dark border-secondary text-muted'"
      >
        <i class="bi bi-box-seam me-1"></i> Global Items
      </router-link>
      <router-link
        to="/superadmin/settings/units"
        class="btn btn-sm"
        :class="route.path === '/superadmin/settings/units' ? 'btn-primary' : 'btn-dark border-secondary text-muted'"
      >
        <i class="bi bi-rulers me-1"></i> Global Units
      </router-link>
      <router-link
        to="/superadmin/settings/service-units"
        class="btn btn-sm"
        :class="route.path.includes('/service-units') ? 'btn-primary' : 'btn-dark border-secondary text-muted'"
      >
        <i class="bi bi-tag-fill me-1"></i> Global Service Units
      </router-link>
      <router-link
        to="/superadmin/settings/vat-notes"
        class="btn btn-sm"
        :class="route.path.includes('/vat-notes') ? 'btn-primary' : 'btn-dark border-secondary text-muted'"
      >
        <i class="bi bi-card-text me-1"></i> VAT Notes
      </router-link>
      <router-link
        to="/superadmin/settings/unit-conversions"
        class="btn btn-sm"
        :class="route.path.includes('/unit-conversions') ? 'btn-primary' : 'btn-dark border-secondary text-muted'"
      >
        <i class="bi bi-arrow-left-right me-1"></i> Unit Conversions
      </router-link>
    </div>

    <!-- Sub Route View -->
    <router-view />
  </div>
</template>
