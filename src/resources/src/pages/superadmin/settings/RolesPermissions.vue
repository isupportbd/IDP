<script setup lang="ts">
import { ref, computed } from "vue";
import { useAuthStore } from "@/stores/auth";

const authStore = useAuthStore();
const activeRoleTab = ref<"superadmin" | "admin" | "user">("superadmin");

interface RoleDefinition {
  id: "superadmin" | "admin" | "user";
  name: string;
  subtitle: string;
  badgeClass: string;
  icon: string;
  description: string;
  targetUser: string;
  userCount: number;
}

const roles: RoleDefinition[] = [
  {
    id: "superadmin",
    name: "Super Admin",
    subtitle: "Global System Authority",
    badgeClass: "bg-danger text-white border-danger",
    icon: "bi-shield-shaded",
    description: "Full, unrestricted master authority over the entire IDP platform, all tenant organizations, global configurations, storage limits, and system subscription plans.",
    targetUser: "System Owner & Platform Engineers",
    userCount: 1
  },
  {
    id: "admin",
    name: "Admin (Tenant Owner)",
    subtitle: "Organization Manager",
    badgeClass: "bg-primary text-white border-primary",
    icon: "bi-building-gear",
    description: "Organization lead with complete control over tenant clients, team sub-users, custom client types & areas, purchases, sales rates, and report downloads.",
    targetUser: "Firm Proprietor, Lead Tax Consultant, Company Manager",
    userCount: 3
  },
  {
    id: "user",
    name: "User (Staff Operator)",
    subtitle: "Operational Team Member",
    badgeClass: "bg-secondary text-light border-secondary",
    icon: "bi-person-badge",
    description: "Operational team member with access to client data entry, file upload & purchase parsing, BIN formatting, and daily invoice submissions.",
    targetUser: "Data Entry Operator, Junior Tax Accountant",
    userCount: 8
  }
];

interface ModulePermission {
  module: string;
  feature: string;
  description: string;
  superadmin: boolean;
  admin: boolean;
  user: boolean;
}

const permissions = ref<ModulePermission[]>([
  // Clients & CRM
  { module: "Clients Management", feature: "View Client List", description: "Browse client directory & basic dossiers", superadmin: true, admin: true, user: true },
  { module: "Clients Management", feature: "Add / Register New Client", description: "Register new client with 7-part registration form", superadmin: true, admin: true, user: true },
  { module: "Clients Management", feature: "Edit Client & Credentials", description: "Modify client details, VAT portal credentials & notes", superadmin: true, admin: true, user: false },
  { module: "Clients Management", feature: "Delete Client Record", description: "Permanent deletion of client and associated purchases", superadmin: true, admin: true, user: false },

  // Activity & Tracking
  { module: "Activity Tracking", feature: "View Activity Filter", description: "Real-time log of team logins, heartbeats, and page actions", superadmin: true, admin: true, user: true },
  { module: "Activity Tracking", feature: "Live Online & Active Status", description: "30-minute online status & 5-minute interaction indicator", superadmin: true, admin: true, user: true },
  { module: "Activity Tracking", feature: "Tenant Team Oversight", description: "Inspect active users, IP addresses, and user-agent devices", superadmin: true, admin: true, user: false },

  // Purchases & Data Processing
  { module: "Data Processing", feature: "Upload Excel / CSV Purchases", description: "Upload client purchase invoices for automatic parsing", superadmin: true, admin: true, user: true },
  { module: "Data Processing", feature: "BIN Auto-Formatter", description: "Format raw 9/13 digit BIN numbers with dashes", superadmin: true, admin: true, user: true },
  { module: "Data Processing", feature: "Manage Sales Rates", description: "Set item-specific sales & output VAT calculation rates", superadmin: true, admin: true, user: false },
  { module: "Data Processing", feature: "Generate VAT Submissions", description: "Export formatted Mushak return schedules & summaries", superadmin: true, admin: true, user: true },
  { module: "Data Processing", feature: "Tenant Purchase Reports", description: "View monthly summary & aggregated purchase registers", superadmin: true, admin: true, user: true },

  // Master Settings
  { module: "Master Settings", feature: "Client Types Configuration", description: "Manage categories (Trader, Manufacturer, Service, etc.)", superadmin: true, admin: true, user: false },
  { module: "Master Settings", feature: "Locations & Cascading Areas", description: "Manage districts, thanas, and custom client clusters", superadmin: true, admin: true, user: false },
  { module: "Master Settings", feature: "References & Partners", description: "Manage referral agents and commission tracking", superadmin: true, admin: true, user: false },
  { module: "Master Settings", feature: "Column Mapping Aliases", description: "Configure system-wide spreadsheet column auto-mapping", superadmin: true, admin: false, user: false },
  { module: "Master Settings", feature: "Global Items & HS Codes", description: "Manage master commodity catalog and default VAT rates", superadmin: true, admin: false, user: false },
  { module: "Master Settings", feature: "Unit Conversions & VAT Notes", description: "Manage standard measurement units and return notes", superadmin: true, admin: false, user: false },

  // Organization & System
  { module: "Administration", feature: "Manage Sub-Users & Team", description: "Invite, create, and remove organization team accounts", superadmin: true, admin: true, user: false },
  { module: "Administration", feature: "Tenant Organizations & Plans", description: "Create tenant accounts, assign storage & subscription tiers", superadmin: true, admin: false, user: false },
  { module: "Administration", feature: "Global System Storage & Logs", description: "Inspect platform disk usage, backups, and audit logs", superadmin: true, admin: false, user: false }
]);

const selectedRole = computed(() => {
  return roles.find(r => r.id === activeRoleTab.value) || roles[0];
});

const groupedPermissions = computed(() => {
  const groups: Record<string, ModulePermission[]> = {};
  permissions.value.forEach(p => {
    if (!groups[p.module]) groups[p.module] = [];
    groups[p.module].push(p);
  });
  return groups;
});

const searchQuery = ref("");
const filteredGroupedPermissions = computed(() => {
  const q = searchQuery.value.toLowerCase().trim();
  if (!q) return groupedPermissions.value;
  
  const filtered: Record<string, ModulePermission[]> = {};
  for (const [module, items] of Object.entries(groupedPermissions.value)) {
    const matched = items.filter(i => 
      i.feature.toLowerCase().includes(q) || 
      i.description.toLowerCase().includes(q) ||
      module.toLowerCase().includes(q)
    );
    if (matched.length > 0) {
      filtered[module] = matched;
    }
  }
  return filtered;
});

const saveSuccess = ref(false);
const handleSaveMatrix = () => {
  saveSuccess.value = true;
  setTimeout(() => {
    saveSuccess.value = false;
  }, 3000);
};
</script>

<template>
  <div class="roles-permissions-page">
    <!-- Header Summary Card -->
    <div class="idp-card p-4 mb-4">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div>
          <div class="d-flex align-items-center gap-2 mb-1">
            <span class="badge bg-primary px-2 py-1 small">3 Roles Architecture</span>
            <span class="text-muted small">Role-Based Access Control (RBAC)</span>
          </div>
          <h5 class="text-white fw-bold mb-1">System Roles & Permission Matrix</h5>
          <p class="text-muted small mb-0">
            IDP operates with exactly 3 predefined roles: 
            <strong class="text-danger">Superadmin</strong>, 
            <strong class="text-primary">Admin</strong>, and 
            <strong class="text-light">User</strong>.
            Review and calibrate functional access across all platform modules.
          </p>
        </div>
        <div class="d-flex align-items-center gap-2">
          <button 
            type="button" 
            class="btn btn-idp-primary btn-sm d-flex align-items-center gap-2"
            @click="handleSaveMatrix"
          >
            <i class="bi bi-shield-check"></i> Save Permissions Matrix
          </button>
        </div>
      </div>

      <div v-if="saveSuccess" class="alert alert-success mt-3 py-2 small d-flex align-items-center gap-2 mb-0">
        <i class="bi bi-check-circle-fill fs-5"></i>
        <span>Role permissions configuration saved successfully for all 3 roles.</span>
      </div>
    </div>

    <!-- 3 Roles Overview Cards -->
    <div class="row g-3 mb-4">
      <div 
        v-for="r in roles" 
        :key="r.id" 
        class="col-md-4"
      >
        <div 
          class="idp-card p-3 h-100 cursor-pointer transition-all border"
          :class="activeRoleTab === r.id ? 'border-primary bg-dark' : 'border-secondary'"
          @click="activeRoleTab = r.id"
          style="cursor: pointer; border-radius: 8px;"
        >
          <div class="d-flex justify-content-between align-items-center mb-2">
            <div class="d-flex align-items-center gap-2">
              <i class="bi fs-4" :class="[r.icon, r.id === 'superadmin' ? 'text-danger' : r.id === 'admin' ? 'text-primary' : 'text-info']"></i>
              <div>
                <div class="text-white fw-bold">{{ r.name }}</div>
                <div class="text-muted small" style="font-size: 0.78rem;">{{ r.subtitle }}</div>
              </div>
            </div>
            <span class="badge border" :class="r.badgeClass" style="font-size: 0.7rem;">
              {{ r.id.toUpperCase() }}
            </span>
          </div>
          <p class="text-light small mb-2" style="font-size: 0.8rem; min-height: 48px;">
            {{ r.description }}
          </p>
          <div class="d-flex justify-content-between align-items-center pt-2 border-top border-secondary text-muted" style="font-size: 0.75rem;">
            <span><i class="bi bi-people me-1"></i> {{ r.targetUser }}</span>
            <span class="fw-semibold text-white">{{ r.userCount }} {{ r.userCount === 1 ? 'User' : 'Users' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Permissions Matrix Section -->
    <div class="idp-card p-4">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <div>
          <h6 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
            <i class="bi bi-grid-3x3-gap text-primary"></i> Module Access & Capabilities Matrix
          </h6>
          <span class="text-muted small">Toggle or inspect functional capabilities for each role</span>
        </div>

        <div class="d-flex align-items-center gap-2" style="max-width: 320px; width: 100%;">
          <div class="position-relative w-100">
            <i class="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
            <input 
              v-model="searchQuery" 
              type="text" 
              class="form-control form-control-sm idp-input" 
              style="padding-left: 36px !important;" 
              placeholder="Search module or feature..." 
            />
          </div>
        </div>
      </div>

      <!-- Matrix Table -->
      <div class="idp-table-wrapper">
        <table class="table idp-table align-middle">
          <thead>
            <tr>
              <th style="width: 35%;">Module & Feature</th>
              <th style="width: 35%;">Description & Scope</th>
              <th class="text-center" style="width: 10%;">
                <span class="badge bg-danger text-white border border-danger">SUPERADMIN</span>
              </th>
              <th class="text-center" style="width: 10%;">
                <span class="badge bg-primary text-white border border-primary">ADMIN</span>
              </th>
              <th class="text-center" style="width: 10%;">
                <span class="badge bg-secondary text-light border border-secondary">USER</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(items, moduleName) in filteredGroupedPermissions" :key="moduleName">
              <!-- Module Category Header -->
              <tr class="table-active" style="background-color: #212529 !important;">
                <td colspan="5" class="py-2 text-primary fw-bold small text-uppercase letter-spacing-1">
                  <i class="bi bi-folder2-open me-1"></i> {{ moduleName }} ({{ items.length }} Features)
                </td>
              </tr>

              <!-- Feature Rows -->
              <tr v-for="item in items" :key="item.feature">
                <td class="ps-4">
                  <div class="text-white fw-semibold small">{{ item.feature }}</div>
                </td>
                <td>
                  <span class="text-muted small">{{ item.description }}</span>
                </td>
                <td class="text-center">
                  <div class="form-check form-switch d-inline-block">
                    <input 
                      class="form-check-input" 
                      type="checkbox" 
                      v-model="item.superadmin"
                      :disabled="item.module === 'Administration' && item.feature.includes('Tenant')"
                    />
                  </div>
                </td>
                <td class="text-center">
                  <div class="form-check form-switch d-inline-block">
                    <input 
                      class="form-check-input" 
                      type="checkbox" 
                      v-model="item.admin"
                    />
                  </div>
                </td>
                <td class="text-center">
                  <div class="form-check form-switch d-inline-block">
                    <input 
                      class="form-check-input" 
                      type="checkbox" 
                      v-model="item.user"
                    />
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Footer Info Note -->
      <div class="d-flex align-items-center justify-content-between pt-3 border-top border-secondary text-muted small">
        <span>
          <i class="bi bi-info-circle me-1 text-primary"></i> 
          Role modifications take effect immediately upon next user login session.
        </span>
        <button class="btn btn-idp-primary btn-sm" @click="handleSaveMatrix">
          <i class="bi bi-check2-all me-1"></i> Save Changes
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.letter-spacing-1 {
  letter-spacing: 0.05em;
}
.cursor-pointer {
  cursor: pointer;
}
.transition-all {
  transition: all 0.2s ease;
}
.idp-table tbody tr:hover {
  background-color: rgba(255, 255, 255, 0.02);
}
</style>
