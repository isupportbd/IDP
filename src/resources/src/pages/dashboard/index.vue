<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import { hasRole, isTenantAdmin, canAccessModule } from "@/composables/useAuth";

const authStore = useAuthStore();

const isSuperAdmin = computed(() => {
  const r = (authStore.user as any)?.role;
  return r === "superadmin" || (typeof r === "object" && (r?.name === "superadmin" || r?.slug === "superadmin"));
});

const hasAccountsAccess = computed(() => {
  if (isSuperAdmin.value) return true;
  const user = authStore.user as any;
  if (!user) return false;
  if (user.plan) {
    return user.plan.hasAccounts === true;
  }
  return false;
});

const hasAnyAdminTools = computed(() => {
  return isTenantAdmin() || canAccessModule('settings') || canAccessModule('billing');
});
</script>

<template>
  <div class="dashboard-container">
    <!-- SUPER ADMIN DASHBOARD VIEW -->
    <template v-if="isSuperAdmin">
      <!-- Welcome Header -->
      <div class="dashboard-header mb-4">
        <h3 class="dashboard-title">
          IDP Super Admin Management Center
        </h3>
        <p class="dashboard-subtitle">
          Welcome back, <span class="user-highlight">Super Admin</span>. Manage all SaaS tenant firms, subscription plans, platform storage, and master settings.
        </p>
      </div>

      <!-- Super Admin Features -->
      <div>
        <div class="d-flex align-items-center gap-2 mb-3">
          <i class="bi bi-shield-lock-fill text-warning"></i>
          <h5 class="text-white fw-bold mb-0">Super Admin Platform</h5>
        </div>

        <div class="dashboard-cards-grid">
          <!-- Tenants -->
          <router-link to="/superadmin/tenants" class="dash-card">
            <div class="dash-card-icon text-primary">
              <i class="bi bi-buildings"></i>
            </div>
            <h5 class="dash-card-title">Tenants & Approvals</h5>
            <p class="dash-card-desc">Manage firm organizations, pending registrations, and access.</p>
          </router-link>

          <!-- Plans & Pricing -->
          <router-link to="/superadmin/plans" class="dash-card">
            <div class="dash-card-icon text-success">
              <i class="bi bi-credit-card-2-front"></i>
            </div>
            <h5 class="dash-card-title">Plans & Pricing</h5>
            <p class="dash-card-desc">Configure subscription plans, discounts, and bKash gateway.</p>
          </router-link>

          <!-- Global Reports -->
          <router-link to="/superadmin/reports" class="dash-card">
            <div class="dash-card-icon text-info">
              <i class="bi bi-bar-chart-line"></i>
            </div>
            <h5 class="dash-card-title">Global Reports</h5>
            <p class="dash-card-desc">Consolidated financial, return summary, and tax metrics.</p>
          </router-link>

          <!-- Master Settings -->
          <router-link to="/superadmin/settings/client-types" class="dash-card">
            <div class="dash-card-icon text-secondary">
              <i class="bi bi-sliders"></i>
            </div>
            <h5 class="dash-card-title">Master Settings</h5>
            <p class="dash-card-desc">Client Types, Locations, Areas, and Partner References.</p>
          </router-link>

          <!-- Storage Stats -->
          <router-link to="/superadmin/storage" class="dash-card">
            <div class="dash-card-icon text-danger">
              <i class="bi bi-database-check"></i>
            </div>
            <h5 class="dash-card-title">Storage Stats</h5>
            <p class="dash-card-desc">Database record volume, disk size, and system health.</p>
          </router-link>
        </div>
      </div>
    </template>

    <!-- TENANT ADMIN & STAFF DASHBOARD VIEW -->
    <template v-else>
      <!-- Welcome Header -->
      <div class="dashboard-header mb-4">
        <h3 class="dashboard-title">
          IDP Platform Operations & Management
        </h3>
        <p class="dashboard-subtitle">
          Welcome back, <span class="user-highlight">{{ (authStore.user as any)?.name || 'Administrator' }}</span>. Select any module or firm management tool below to get started.
        </p>
      </div>

      <!-- 1. MODULES SECTION -->
      <div class="mb-4">
        <div class="d-flex align-items-center gap-2 mb-3">
          <i class="bi bi-grid-fill text-primary"></i>
          <h5 class="text-white fw-bold mb-0">Modules</h5>
        </div>

        <div class="dashboard-cards-grid">
          <!-- 1. Clients -->
          <router-link v-if="canAccessModule('clients')" to="/admin/clients" class="dash-card">
            <div class="dash-card-icon text-primary">
              <i class="bi bi-briefcase"></i>
            </div>
            <h5 class="dash-card-title">Clients</h5>
            <p class="dash-card-desc">Manage client profiles, BIN numbers, and VAT credentials.</p>
          </router-link>

          <!-- 2. Activity Filter -->
          <router-link v-if="canAccessModule('activity_filter')" to="/admin/activity-filter" class="dash-card">
            <div class="dash-card-icon text-info">
              <i class="bi bi-funnel"></i>
            </div>
            <h5 class="dash-card-title">Activity Filter</h5>
            <p class="dash-card-desc">Active vs Nil return client matrix with month filtering.</p>
          </router-link>

          <!-- 3. Submissions -->
          <router-link v-if="canAccessModule('submissions')" to="/admin/submissions" class="dash-card">
            <div class="dash-card-icon text-success">
              <i class="bi bi-journal-text"></i>
            </div>
            <h5 class="dash-card-title">Submissions</h5>
            <p class="dash-card-desc">Record and track monthly return submission IDs for clients.</p>
          </router-link>

          <!-- 4. BIN Formatter -->
          <router-link v-if="canAccessModule('bin_formatter')" to="/admin/bin-formatter" class="dash-card">
            <div class="dash-card-icon text-info">
              <i class="bi bi-card-checklist"></i>
            </div>
            <h5 class="dash-card-title">BIN Formatter</h5>
            <p class="dash-card-desc">Batch extract and format BINs separated by semicolons.</p>
          </router-link>

          <!-- 5. Upload Purchase -->
          <router-link v-if="canAccessModule('purchases')" to="/admin/upload" class="dash-card">
            <div class="dash-card-icon text-warning">
              <i class="bi bi-cloud-arrow-up"></i>
            </div>
            <h5 class="dash-card-title">Upload Purchase</h5>
            <p class="dash-card-desc">Excel / CSV import with column validation and live preview.</p>
          </router-link>

          <!-- 6. Purchase List -->
          <router-link v-if="canAccessModule('purchases')" to="/admin/purchases" class="dash-card">
            <div class="dash-card-icon text-secondary">
              <i class="bi bi-receipt"></i>
            </div>
            <h5 class="dash-card-title">Purchase List</h5>
            <p class="dash-card-desc">Browse, search, and audit item purchases and tax values.</p>
          </router-link>

          <!-- 7. Sales Rate -->
          <router-link v-if="canAccessModule('sales_rates')" to="/admin/sales-rates" class="dash-card">
            <div class="dash-card-icon text-warning">
              <i class="bi bi-currency-dollar"></i>
            </div>
            <h5 class="dash-card-title">Sales Rate</h5>
            <p class="dash-card-desc">Configure client and item-wise sales and tax percentages.</p>
          </router-link>

          <!-- 8. Reports -->
          <router-link v-if="canAccessModule('reports')" to="/admin/reports" class="dash-card">
            <div class="dash-card-icon text-success">
              <i class="bi bi-file-earmark-bar-graph"></i>
            </div>
            <h5 class="dash-card-title">Reports</h5>
            <p class="dash-card-desc">Client breakdown, monthly VAT totals, and Excel export.</p>
          </router-link>
        </div>
      </div>

      <!-- 2. ADMIN PLATFORM SECTION -->
      <div v-if="hasAnyAdminTools" class="mb-4 pt-2">
        <div class="d-flex align-items-center gap-2 mb-3">
          <i class="bi bi-building-gear text-primary"></i>
          <h5 class="text-white fw-bold mb-0">Admin Platform</h5>
        </div>

        <div class="dashboard-cards-grid">
          <!-- 1. User & Staff (Tenant Admin only) -->
          <router-link v-if="isTenantAdmin()" to="/admin/users" class="dash-card">
            <div class="dash-card-icon text-primary">
              <i class="bi bi-people"></i>
            </div>
            <h5 class="dash-card-title">User & Staff</h5>
            <p class="dash-card-desc">Manage sub-users, executives, and staff accounts.</p>
          </router-link>

          <!-- 2. Assignments (Tenant Admin only) -->
          <router-link v-if="isTenantAdmin()" to="/admin/assignments" class="dash-card">
            <div class="dash-card-icon text-success">
              <i class="bi bi-person-check"></i>
            </div>
            <h5 class="dash-card-title">Assignments</h5>
            <p class="dash-card-desc">Assign team members and operators to client organizations.</p>
          </router-link>

          <!-- 3. Billing & Invoice -->
          <router-link v-if="hasAccountsAccess && canAccessModule('billing')" to="/admin/billing" class="dash-card">
            <div class="dash-card-icon text-warning">
              <i class="bi bi-receipt-cutoff"></i>
            </div>
            <h5 class="dash-card-title">Billing & Invoice</h5>
            <p class="dash-card-desc">Client invoices, payments, collections, and dues tracking.</p>
          </router-link>
          <div v-else class="dash-card opacity-75 position-relative" style="cursor: not-allowed;" title="Upgrade plan to access Billing & Accounts">
            <!-- Top-right corner lock badge -->
            <span class="position-absolute top-0 end-0 m-3 badge bg-secondary text-white border border-secondary shadow-sm d-inline-flex align-items-center gap-1" style="font-size: 0.72rem;">
              <i class="bi bi-lock-fill text-warning"></i>
              <span>Locked</span>
            </span>
            <div class="dash-card-icon text-warning opacity-75">
              <i class="bi bi-receipt-cutoff"></i>
            </div>
            <h5 class="dash-card-title text-light">Billing & Invoice</h5>
            <p class="dash-card-desc text-muted">Client invoices, payments, collections, and dues tracking.</p>
          </div>

          <!-- 4. Firm Settings -->
          <router-link v-if="canAccessModule('settings')" to="/admin/settings" class="dash-card">
            <div class="dash-card-icon text-info">
              <i class="bi bi-sliders"></i>
            </div>
            <h5 class="dash-card-title">Firm Settings</h5>
            <p class="dash-card-desc">Company profile, bank accounts, expenses, and service rates.</p>
          </router-link>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dashboard-container {
  width: 100%;
  padding: 0.25rem 0 1.5rem;
}

.dashboard-header {
  margin-bottom: 1.5rem;
  width: 100%;
}

.dashboard-title {
  font-size: 1.65rem;
  font-weight: 800;
  color: #f8f9fa;
  margin: 0 0 0.25rem;
  letter-spacing: -0.3px;
}

.dashboard-subtitle {
  font-size: 0.86rem;
  color: #adb5bd;
  margin: 0;
}

.user-highlight {
  color: #f8f9fa;
  font-weight: 600;
}

/* Equal Proportional Grid */
.dashboard-cards-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.25rem;
  width: 100%;
}

@media (max-width: 1199px) {
  .dashboard-cards-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 1.15rem;
  }
}

@media (max-width: 860px) {
  .dashboard-cards-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
  }
}

@media (max-width: 540px) {
  .dashboard-cards-grid {
    grid-template-columns: 1fr;
    gap: 0.85rem;
  }
}

/* Scaled, Balanced Cards */
.dash-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2.25rem 1.5rem;
  min-height: 205px;
  background-color: #212529;
  border: 1px solid #343a40;
  border-radius: 8px;
  color: #f8f9fa;
  text-decoration: none;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  transition: transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
  box-sizing: border-box;
}

.dash-card:hover {
  background-color: #2c3238;
  border-color: #495057;
  transform: translateY(-3px);
  color: #f8f9fa;
}

.dash-card-icon {
  font-size: 2.6rem;
  line-height: 1;
  margin-bottom: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.dash-card-title {
  font-size: 1.18rem;
  font-weight: 700;
  color: #f8f9fa;
  margin: 0 0 0.5rem;
  letter-spacing: -0.2px;
}

.dash-card-desc {
  font-size: 0.83rem;
  color: #adb5bd;
  margin: 0;
  line-height: 1.45;
  max-width: 260px;
}
</style>
