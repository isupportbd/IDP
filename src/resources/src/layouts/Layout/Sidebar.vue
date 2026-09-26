<template>
  <!-- sidebar start -->
  <div class="sidebar">
    <a
      href="#"
      role="button"
      class="sidebar-toggle card card-body rounded-circle position-absolute top-0 end-0 d-xl-none"
      title="sidebar-toggle"
      @click.prevent="props.onToggleSidebar">
      <i class="bi bi-chevron-left fw-bold"></i>
    </a>

    <div class="app-brand">
      <router-link to="/" aria-label="logo" class="d-flex align-items-center gap-2 text-decoration-none">
        <img src="@/assets/images/logo.png" alt="IDP" style="max-height: 32px;" />
        <span class="fw-bold text-white fs-5">IDP ERP</span>
      </router-link>
    </div>

    <div id="accordion-sidebar" class="accordion accordion-flush">
      <ul class="list-group px-3">
        <!-- Dashboard -->
        <li class="list-group-item" :class="{ active: isActive('/') }">
          <router-link to="/">
            <div class="menu-icon">
              <i class="bi bi-house"></i>
            </div>
            <span>Dashboard</span>
          </router-link>
        </li>

        <!-- TENANT ADMIN & USER MODULES (Hidden from SuperAdmin) -->
        <template v-if="!isSuperAdmin">
          <!-- MODULES SECTION -->
          <li class="split-label">
            <span class="text-uppercase">Modules</span>
          </li>

          <!-- 1. Clients -->
          <li v-if="canAccessModule('clients')" class="list-group-item" :class="{ active: isActive('/admin/clients') }">
            <router-link to="/admin/clients">
              <div class="menu-icon">
                <i class="bi bi-briefcase"></i>
              </div>
              <span>Clients</span>
            </router-link>
          </li>

          <!-- 2. Activity Filter -->
          <li v-if="canAccessModule('activity_filter')" class="list-group-item" :class="{ active: isActive('/admin/activity-filter') }">
            <router-link to="/admin/activity-filter">
              <div class="menu-icon">
                <i class="bi bi-funnel"></i>
              </div>
              <span>Activity Filter</span>
            </router-link>
          </li>

          <!-- 3. Submissions -->
          <li v-if="canAccessModule('submissions')" class="list-group-item" :class="{ active: isActive('/admin/submissions') }">
            <router-link to="/admin/submissions">
              <div class="menu-icon">
                <i class="bi bi-journal-text"></i>
              </div>
              <span>Submissions</span>
            </router-link>
          </li>

          <!-- 4. BIN Formatter -->
          <li v-if="canAccessModule('bin_formatter')" class="list-group-item" :class="{ active: isActive('/admin/bin-formatter') }">
            <router-link to="/admin/bin-formatter">
              <div class="menu-icon">
                <i class="bi bi-card-checklist"></i>
              </div>
              <span>BIN Formatter</span>
            </router-link>
          </li>

          <!-- 5, 6, 7. Purchases & Sales Dropdown -->
          <li v-if="canAccessModule('purchases') || canAccessModule('sales_rates')" class="list-group-item accordion-item">
            <a
              href="#"
              class="accordion-button collapsed"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#collapsePurchases"
              aria-expanded="false"
              aria-controls="collapsePurchases">
              <div class="menu-icon">
                <i class="bi bi-cart3"></i>
              </div>
              <span>Purchases & Sales</span>
            </a>
            <ul id="collapsePurchases" class="list-group accordion-collapse collapse" data-bs-parent="#accordion-sidebar">
              <li v-if="canAccessModule('purchases')" class="list-group-item" :class="{ active: isActive('/admin/upload') }">
                <router-link to="/admin/upload">Upload Purchase</router-link>
              </li>
              <li v-if="canAccessModule('purchases')" class="list-group-item" :class="{ active: isActive('/admin/purchases') }">
                <router-link to="/admin/purchases">Purchase List</router-link>
              </li>
              <li v-if="canAccessModule('sales_rates')" class="list-group-item" :class="{ active: isActive('/admin/sales-rates') }">
                <router-link to="/admin/sales-rates">Sales Rate</router-link>
              </li>
            </ul>
          </li>

          <!-- 8. Reports -->
          <li v-if="canAccessModule('reports')" class="list-group-item" :class="{ active: isActive('/admin/reports') }">
            <router-link to="/admin/reports">
              <div class="menu-icon">
                <i class="bi bi-file-earmark-bar-graph"></i>
              </div>
              <span>Reports</span>
            </router-link>
          </li>

          <!-- ADMIN PLATFORM SECTION -->
          <template v-if="hasAnyAdminPlatformItem">
            <li class="split-label">
              <span class="text-uppercase">Admin Platform</span>
            </li>

            <!-- 1. User & Staff (Tenant Admin only) -->
            <li v-if="isTenantAdmin()" class="list-group-item" :class="{ active: isActive('/admin/users') }">
              <router-link to="/admin/users" target="_blank">
                <div class="menu-icon">
                  <i class="bi bi-people"></i>
                </div>
                <span>User & Staff</span>
              </router-link>
            </li>

            <!-- 2. Assignments (Tenant Admin only) -->
            <li v-if="isTenantAdmin()" class="list-group-item" :class="{ active: isActive('/admin/assignments') }">
              <router-link to="/admin/assignments">
                <div class="menu-icon">
                  <i class="bi bi-person-check"></i>
                </div>
                <span>Assignments</span>
              </router-link>
            </li>

            <!-- 3. Billing & Invoice -->
            <li v-if="hasAccountsAccess && canAccessModule('billing')" class="list-group-item" :class="{ active: isActive('/admin/billing') }">
              <router-link to="/admin/billing">
                <div class="menu-icon">
                  <i class="bi bi-receipt-cutoff"></i>
                </div>
                <span>Billing & Invoice</span>
              </router-link>
            </li>

            <!-- 4. Firm Settings -->
            <li v-if="canAccessModule('settings')" class="list-group-item" :class="{ active: isActive('/admin/settings') }">
              <router-link to="/admin/settings">
                <div class="menu-icon">
                  <i class="bi bi-sliders"></i>
                </div>
                <span>Firm Settings</span>
              </router-link>
            </li>
          </template>
        </template>

        <!-- SUPER ADMIN SECTION -->
        <template v-if="isSuperAdmin">
          <li class="split-label">
            <span class="text-uppercase">Super Admin</span>
          </li>

          <!-- Tenants -->
          <li class="list-group-item" :class="{ active: isActive('/superadmin/tenants') }">
            <router-link to="/superadmin/tenants">
              <div class="menu-icon">
                <i class="bi bi-buildings"></i>
              </div>
              <span>Tenants & Approvals</span>
            </router-link>
          </li>

          <!-- Plans & Pricing -->
          <li class="list-group-item" :class="{ active: isActive('/superadmin/plans') }">
            <router-link to="/superadmin/plans">
              <div class="menu-icon">
                <i class="bi bi-credit-card-2-front"></i>
              </div>
              <span>Plans & Pricing</span>
            </router-link>
          </li>

          <!-- Global Reports -->
          <li class="list-group-item" :class="{ active: isActive('/superadmin/reports') }">
            <router-link to="/superadmin/reports">
              <div class="menu-icon">
                <i class="bi bi-bar-chart-line"></i>
              </div>
              <span>Global Reports</span>
            </router-link>
          </li>

          <!-- Master Settings Dropdown -->
          <li class="list-group-item accordion-item">
            <a
              href="#"
              class="accordion-button collapsed"
              type="button"
              data-bs-toggle="collapse"
              data-bs-target="#collapseMasterSettings"
              aria-expanded="false"
              aria-controls="collapseMasterSettings">
              <div class="menu-icon">
                <i class="bi bi-sliders"></i>
              </div>
              <span>Master Settings</span>
            </a>
            <ul id="collapseMasterSettings" class="list-group accordion-collapse collapse" data-bs-parent="#accordion-sidebar">
              <li class="list-group-item">
                <router-link to="/superadmin/settings/client-types">Client Types</router-link>
              </li>
              <li class="list-group-item">
                <router-link to="/superadmin/settings/locations">Locations & Areas</router-link>
              </li>
              <li class="list-group-item">
                <router-link to="/superadmin/settings/references">References</router-link>
              </li>
              <li class="list-group-item">
                <router-link to="/superadmin/settings/mappings">Column Mappings</router-link>
              </li>
              <li class="list-group-item">
                <router-link to="/superadmin/settings/vat-notes">VAT Notes</router-link>
              </li>
              <li class="list-group-item">
                <router-link to="/superadmin/settings/unit-conversions">Unit Conversions</router-link>
              </li>
            </ul>
          </li>

          <!-- Storage Stats -->
          <li class="list-group-item" :class="{ active: isActive('/superadmin/storage') }">
            <router-link to="/superadmin/storage">
              <div class="menu-icon">
                <i class="bi bi-database-check"></i>
              </div>
              <span>Storage Stats</span>
            </router-link>
          </li>
        </template>
      </ul>
    </div>
  </div>
  <!-- sidebar end -->
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useAdminUiStore } from "@/stores/admin-ui";
import { useAuthStore } from "@/stores/auth";
import { hasRole, isTenantAdmin, canAccessModule } from "@/composables/useAuth";

const props = defineProps<{ onToggleSidebar: () => void; }>();

const ui = useAdminUiStore();
const authStore = useAuthStore();
const route = useRoute();

const isSuperAdmin = computed(() => hasRole("superadmin"));

const hasAccountsAccess = computed(() => {
  if (isSuperAdmin.value) return true;
  const user = authStore.user as any;
  if (!user) return true;
  if (user.plan) {
    return user.plan.hasAccounts !== false;
  }
  return true;
});

const hasAnyAdminPlatformItem = computed(() => {
  return isTenantAdmin() || (hasAccountsAccess.value && canAccessModule('billing')) || canAccessModule('settings');
});

function isActive(path: string) {
  return route.path === path;
}

onMounted(() => ui.initSidebarCollapsePersistence());
onBeforeUnmount(() => ui.cleanupSidebarCollapsePersistence());
</script>

<style lang="scss" scoped></style>
