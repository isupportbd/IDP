import { ref, onMounted, onUnmounted } from "vue";
import axios from "axios";
import { pulse } from "@/plugins/pulse";

export interface Plan {
  id: number;
  name: string;
  rateMonthly: number;
  rateYearly: number;
  maxUsers: number;
  maxClients: number;
  maxStorageMB: number;
  hasAccounts: boolean;
  yearlyDiscountPercent: number;
  features: string[];
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Tenant {
  id: number;
  name: string;
  email: string;
  mobile: string;
  status: string;
  planId?: number;
  planName?: string;
  planMaxUsers?: number;
  planMaxClients?: number;
  planMaxStorageMB?: number;
  planHasAccounts?: boolean;
  trxId?: string;
  billingCycle?: string;
  paidAmount?: number;
  advanceBalance?: number;
  expDate?: string;
  createdAt?: string;
  clientsCount?: number;
  roleName?: string;
}

export interface PendingSignup {
  id: number;
  name: string;
  email: string;
  mobile: string;
  status: string;
  planId?: number;
  planName?: string;
  planMaxUsers?: number;
  planMaxClients?: number;
  planMaxStorageMB?: number;
  rateMonthly?: number;
  rateYearly?: number;
  planPrice?: number;
  grossAmount?: number;
  gatewayCharge?: number;
  netAmount?: number;
  willActivate?: boolean;
  shortage?: number;
  excessCredit?: number;
  trxId?: string;
  billingCycle?: string;
  paidAmount?: number;
  advanceBalance?: number;
  baseFee?: number;
  chargePercent?: number;
  chargeAmount?: number;
  requiredFee?: number;
  excessAmount?: number;
  createdAt?: string;
}

export interface SubscriptionTransaction {
  id: number;
  userId: number;
  planId?: number;
  planName?: string;
  type?: string;
  billingCycle: string;
  grossAmount?: number;
  gatewayCharge?: number;
  netAmount?: number;
  planRate: number;
  paidAmount: number;
  excessCredit: number;
  trxId?: string;
  paymentMethod: string;
  daysAdded?: number;
  status: string;
  note?: string;
  createdAt: string;
}

export interface PaymentSettings {
  id?: number;
  bkashNumber: string;
  bkashCharge: number;
  nagadNumber?: string;
  rocketNumber?: string;
}

export function useSuperAdminApi() {
  const tenants = ref<Tenant[]>([]);
  const pendingSignups = ref<PendingSignup[]>([]);
  const plans = ref<Plan[]>([]);
  const paymentSettings = ref<PaymentSettings>({
    bkashNumber: "01719950891",
    bkashCharge: 1.8
  });
  const storageStats = ref<{ dbSizeMB: number; totalClients: number; totalUsers: number; totalSubmissions: number } | null>(null);

  const isLoadingTenants = ref(false);
  const isLoadingPending = ref(false);
  const isLoadingPlans = ref(false);
  const isSaving = ref(false);
  const error = ref<string | null>(null);

  const onSettingsUpdated = (payload: any) => {
    const type = payload?.type;
    if (!type || type === "plans") {
      if (plans.value.length > 0) fetchPlans();
    }
    if (!type || type === "payment-settings") {
      fetchPaymentSettings();
    }
  };

  try {
    onMounted(() => {
      pulse.channel("auth").listen("global:settings-updated", onSettingsUpdated);
    });
    onUnmounted(() => {
      pulse.channel("auth").stopListening("global:settings-updated", onSettingsUpdated);
    });
  } catch {}

  // Fetch Tenants
  async function fetchTenants() {
    isLoadingTenants.value = true;
    error.value = null;
    try {
      const res = await axios.get("/api/superadmin/tenants");
      if (res.data?.success) {
        tenants.value = res.data.data || [];
      }
    } catch (e: any) {
      error.value = e?.response?.data?.error || "Failed to fetch tenants";
    } finally {
      isLoadingTenants.value = false;
    }
  }

  // Fetch Pending Signups
  async function fetchPendingSignups() {
    isLoadingPending.value = true;
    try {
      const res = await axios.get("/api/superadmin/pending-signups");
      if (res.data?.success) {
        pendingSignups.value = res.data.data || [];
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      isLoadingPending.value = false;
    }
  }

  // Fetch Pending Recharges
  const pendingRecharges = ref<any[]>([]);
  const isLoadingPendingRecharges = ref(false);

  async function fetchPendingRecharges() {
    isLoadingPendingRecharges.value = true;
    try {
      const res = await axios.get("/api/superadmin/pending-recharges");
      if (res.data?.success) {
        pendingRecharges.value = res.data.data || [];
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      isLoadingPendingRecharges.value = false;
    }
  }

  // Approve Signup
  async function approveSignup(userId: number, days?: number) {
    const res = await axios.post("/api/superadmin/approve-signup", { userId, days });
    await fetchPendingSignups();
    await fetchTenants();
    return res.data;
  }

  // Reject Signup
  async function rejectSignup(userId: number) {
    const res = await axios.post("/api/superadmin/reject-signup", { userId });
    await fetchPendingSignups();
    return res.data;
  }

  // Approve Recharge
  async function approveRecharge(transactionId: number) {
    const res = await axios.post("/api/superadmin/approve-recharge", { transactionId });
    await fetchPendingRecharges();
    await fetchTenants();
    return res.data;
  }

  // Reject Recharge
  async function rejectRecharge(transactionId: number, reason?: string) {
    const res = await axios.post("/api/superadmin/reject-recharge", { transactionId, reason });
    await fetchPendingRecharges();
    return res.data;
  }

  // Extend Tenant Subscription
  async function extendTenant(id: number, days: number) {
    const res = await axios.post(`/api/superadmin/tenants/${id}/extend`, { days });
    await fetchTenants();
    return res.data;
  }

  // Toggle Tenant Status
  async function toggleTenantStatus(id: number) {
    const res = await axios.post(`/api/superadmin/tenants/${id}/toggle-status`);
    await fetchTenants();
    return res.data;
  }

  // Delete Tenant Permanently
  async function deleteTenant(id: number) {
    const res = await axios.delete(`/api/superadmin/tenants/${id}`);
    await fetchTenants();
    return res.data;
  }

  // Fetch Plans
  async function fetchPlans() {
    isLoadingPlans.value = true;
    try {
      const res = await axios.get("/api/superadmin/plans");
      if (res.data?.success) {
        plans.value = res.data.data || [];
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      isLoadingPlans.value = false;
    }
  }

  // Create Plan
  async function createPlan(planData: Omit<Plan, "id">) {
    const res = await axios.post("/api/superadmin/plans", planData);
    await fetchPlans();
    return res.data;
  }

  // Update Plan
  async function updatePlan(id: number, planData: Partial<Plan>) {
    const res = await axios.put(`/api/superadmin/plans/${id}`, planData);
    await fetchPlans();
    return res.data;
  }

  // Delete Plan
  async function deletePlan(id: number) {
    const res = await axios.delete(`/api/superadmin/plans/${id}`);
    await fetchPlans();
    return res.data;
  }

  // Fetch Payment Settings
  async function fetchPaymentSettings() {
    try {
      const res = await axios.get("/api/superadmin/payment-settings");
      if (res.data?.success && res.data.data) {
        paymentSettings.value = res.data.data;
      }
    } catch (e: any) {
      console.error(e);
    }
  }

  // Save Payment Settings
  async function savePaymentSettings(data: PaymentSettings) {
    isSaving.value = true;
    try {
      const res = await axios.post("/api/superadmin/payment-settings", data);
      if (res.data?.success) {
        paymentSettings.value = res.data.data;
      }
      return res.data;
    } finally {
      isSaving.value = false;
    }
  }

  // Fetch Storage Stats
  async function fetchStorageStats() {
    try {
      const res = await axios.get("/api/superadmin/storage-stats");
      if (res.data?.success) {
        storageStats.value = res.data.data;
      }
    } catch (e: any) {
      console.error(e);
    }
  }

  // Fetch Tenant Transaction History
  async function fetchTenantTransactions(tenantId: number): Promise<SubscriptionTransaction[]> {
    try {
      const res = await axios.get(`/api/superadmin/tenants/${tenantId}/transactions`);
      if (res.data?.success) {
        return res.data.data || [];
      }
      return [];
    } catch (e: any) {
      console.error("Failed to fetch tenant transactions:", e);
      return [];
    }
  }

  return {
    tenants,
    pendingSignups,
    pendingRecharges,
    plans,
    paymentSettings,
    storageStats,
    isLoadingTenants,
    isLoadingPending,
    isLoadingPendingRecharges,
    isLoadingPlans,
    isSaving,
    error,
    fetchTenants,
    fetchPendingSignups,
    fetchPendingRecharges,
    approveSignup,
    rejectSignup,
    approveRecharge,
    rejectRecharge,
    extendTenant,
    fetchTenantTransactions,
    toggleTenantStatus,
    deleteTenant,
    fetchPlans,
    createPlan,
    updatePlan,
    deletePlan,
    fetchPaymentSettings,
    savePaymentSettings,
    fetchStorageStats
  };
}
