import { createRouter, createWebHistory, type RouteLocationNormalized } from "vue-router";
import { useAuthStore } from "@/stores/auth";
import { hasRole, isTenantAdmin, canAccessModule } from "@/composables/useAuth";

export const routes = [
  {
    path: "/landing",
    name: "landing",
    component: () => import("@/pages/auth/Landing.vue"),
    meta: { guestOnly: true, title: "Welcome" }
  },
  {
    path: "/login",
    name: "login",
    component: () => import("@/pages/auth/login.vue"),
    meta: { guestOnly: true, title: "Sign In" }
  },
  {
    path: "/",
    component: () => import("@/layouts/Layout/index.vue"),
    meta: { requiresAuth: true },
    children: [
      {
        path: "",
        name: "dashboard",
        component: () => import("@/pages/dashboard/index.vue"),
        meta: { title: "Dashboard" }
      },
      // Admin / User features
      {
        path: "admin/clients",
        name: "clients",
        component: () => import("@/pages/admin/Clients.vue"),
        meta: { title: "Clients" }
      },
      {
        path: "admin/clients/create",
        name: "clients-create",
        component: () => import("@/pages/admin/ClientForm.vue"),
        meta: { title: "Add Client Organization" }
      },
      {
        path: "admin/clients/upload",
        name: "clients-upload",
        component: () => import("@/pages/admin/UploadClients.vue"),
        meta: { title: "Bulk Upload Clients" }
      },
      {
        path: "admin/clients/:id",
        name: "clients-view",
        component: () => import("@/pages/admin/ClientDetails.vue"),
        meta: { title: "Client Details" }
      },
      {
        path: "admin/clients/:id/edit",
        name: "clients-edit",
        component: () => import("@/pages/admin/ClientForm.vue"),
        meta: { title: "Edit Client Organization" }
      },
      {
        path: "admin/assignments",
        name: "assignments",
        component: () => import("@/pages/admin/Assignments.vue"),
        meta: { title: "Client Assignments" }
      },
      {
        path: "admin/activity-filter",
        name: "activity-filter",
        component: () => import("@/pages/admin/ActivityFilter.vue"),
        meta: { title: "Activity Filter" }
      },
      {
        path: "admin/bin-formatter",
        name: "bin-formatter",
        component: () => import("@/pages/admin/BinFormatter.vue"),
        meta: { title: "BIN Formatter" }
      },
      {
        path: "admin/submissions",
        name: "submissions",
        component: () => import("@/pages/admin/Submissions.vue"),
        meta: { title: "Submissions" }
      },
      {
        path: "admin/sales-rates",
        name: "sales-rates",
        component: () => import("@/pages/admin/SalesRates.vue"),
        meta: { title: "Sales Rates" }
      },
      {
        path: "admin/upload",
        name: "upload-purchases",
        component: () => import("@/pages/admin/UploadPurchases.vue"),
        meta: { title: "Upload Purchases" }
      },
      {
        path: "admin/purchases",
        name: "purchases",
        component: () => import("@/pages/admin/TenantPurchases.vue"),
        meta: { title: "Purchases" }
      },
      {
        path: "admin/reports",
        name: "reports",
        component: () => import("@/pages/admin/TenantReports.vue"),
        meta: { title: "Reports" }
      },
      {
        path: "admin/billing",
        name: "billing",
        component: () => import("@/pages/admin/Billing.vue"),
        meta: { title: "Billing & Invoices" }
      },
      {
        path: "admin/billing/create",
        name: "billing-create",
        component: () => import("@/pages/admin/BillCreate.vue"),
        meta: { title: "Create Invoice" }
      },
      {
        path: "admin/billing/collections/create",
        name: "collection-create",
        component: () => import("@/pages/admin/CollectionCreate.vue"),
        meta: { title: "Record Payment" }
      },
      {
        path: "admin/settings",
        name: "admin-settings",
        component: () => import("@/pages/admin/AdminSettings.vue"),
        meta: { title: "Firm Settings" }
      },
      {
        path: "admin/users",
        name: "users",
        component: () => import("@/pages/admin/Users.vue"),
        meta: { title: "Team Users" }
      },
      {
        path: "admin/users/create",
        name: "users-create",
        component: () => import("@/pages/admin/UserForm.vue"),
        meta: { title: "Add Sub-User" }
      },
      {
        path: "admin/users/:id/edit",
        name: "users-edit",
        component: () => import("@/pages/admin/UserForm.vue"),
        meta: { title: "Edit Sub-User" }
      },

      // SuperAdmin features
      {
        path: "superadmin/tenants",
        name: "superadmin-tenants",
        component: () => import("@/pages/superadmin/Tenants.vue"),
        meta: { title: "Tenants" }
      },
      {
        path: "superadmin/tenants/:id/ledger",
        name: "superadmin-tenant-ledger",
        component: () => import("@/pages/superadmin/TenantLedger.vue"),
        meta: { title: "Tenant Ledger & Payment History" }
      },
      {
        path: "superadmin/plans",
        name: "superadmin-plans",
        component: () => import("@/pages/superadmin/Plans.vue"),
        meta: { title: "Plans & Payments" }
      },
      {
        path: "superadmin/reports",
        name: "superadmin-reports",
        component: () => import("@/pages/superadmin/GlobalReports.vue"),
        meta: { title: "Global Reports" }
      },
      {
        path: "superadmin/storage",
        name: "superadmin-storage",
        component: () => import("@/pages/superadmin/Storage.vue"),
        meta: { title: "Storage Stats" }
      },
      {
        path: "superadmin/settings",
        component: () => import("@/pages/superadmin/settings/SettingsLayout.vue"),
        children: [
          {
            path: "",
            redirect: "/superadmin/settings/client-types"
          },
          {
            path: "mappings",
            name: "settings-mappings",
            component: () => import("@/pages/superadmin/settings/ColumnMappings.vue"),
            meta: { title: "Column Mappings" }
          },
          {
            path: "items",
            name: "settings-items",
            component: () => import("@/pages/superadmin/settings/GlobalItems.vue"),
            meta: { title: "Global Items" }
          },
          {
            path: "units",
            name: "settings-units",
            component: () => import("@/pages/superadmin/settings/GlobalUnits.vue"),
            meta: { title: "Global Units" }
          },
          {
            path: "service-units",
            name: "settings-service-units",
            component: () => import("@/pages/superadmin/settings/GlobalServiceUnits.vue"),
            meta: { title: "Global Service Units" }
          },
          {
            path: "vat-notes",
            name: "settings-vat-notes",
            component: () => import("@/pages/superadmin/settings/VatNotes.vue"),
            meta: { title: "VAT Notes" }
          },
          {
            path: "unit-conversions",
            name: "settings-unit-conversions",
            component: () => import("@/pages/superadmin/settings/UnitConversions.vue"),
            meta: { title: "Unit Conversions" }
          },
          {
            path: "client-types",
            name: "settings-client-types",
            component: () => import("@/pages/superadmin/settings/ClientTypes.vue"),
            meta: { title: "Client Types" }
          },
          {
            path: "locations",
            name: "settings-locations",
            component: () => import("@/pages/superadmin/settings/Locations.vue"),
            meta: { title: "Locations & Areas" }
          },
          {
            path: "references",
            name: "settings-references",
            component: () => import("@/pages/superadmin/settings/References.vue"),
            meta: { title: "References" }
          }
        ]
      },

      // Shared
      {
        path: "profile",
        name: "profile",
        component: () => import("@/pages/shared/Profile.vue"),
        meta: { title: "Profile Settings" }
      }
    ]
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/"
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (_to, _from, savedPosition) => {
    if (savedPosition) return savedPosition;
    return { top: 0 };
  }
});

router.beforeEach(async (to: RouteLocationNormalized) => {
  const auth = useAuthStore();
  await auth.bootstrap();

  if (to.meta.title) {
    document.title = `${to.meta.title} - IDP`;
  }

  // 1. Unauthenticated users cannot access protected routes
  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }

  // 2. Authenticated users cannot access guest-only routes (e.g. login)
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { path: "/" };
  }

  // 3. SuperAdmin routes protection (block non-superadmin users)
  const isSuperAdminRoute = to.path.startsWith("/superadmin") || to.meta.role === "superadmin";
  if (isSuperAdminRoute) {
    if (!hasRole("superadmin")) {
      return { path: "/" };
    }
  }

  // 4. Block SuperAdmin from accessing any tenant business / admin routes
  if (hasRole("superadmin") && to.path.startsWith("/admin")) {
    return { path: "/" };
  }

  // 5. Tenant Management routes (User & Staff, Assignments) - only accessible to Firm Admin
  if (to.path.startsWith("/admin/users") || to.path.startsWith("/admin/assignments")) {
    if (!isTenantAdmin()) {
      return { path: "/" };
    }
  }

  // 6. Granular module permission checks for sub-users
  const modulePathMap: Record<string, string> = {
    "/admin/clients": "clients",
    "/admin/activity-filter": "activity_filter",
    "/admin/submissions": "submissions",
    "/admin/bin-formatter": "bin_formatter",
    "/admin/upload": "purchases",
    "/admin/purchases": "purchases",
    "/admin/sales-rates": "sales_rates",
    "/admin/reports": "reports",
    "/admin/billing": "billing",
    "/admin/settings": "settings"
  };

  for (const [prefix, moduleId] of Object.entries(modulePathMap)) {
    if (to.path.startsWith(prefix)) {
      if (!canAccessModule(moduleId)) {
        return { path: "/" };
      }
      break;
    }
  }

  return true;
});

export default router;
