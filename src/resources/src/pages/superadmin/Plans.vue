<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useSuperAdminApi, type Plan } from "@/composables/useSuperAdminApi";
import { useToast } from "@/composables/useToast";

const toast = useToast();

const {
  plans,
  paymentSettings,
  isLoadingPlans,
  isSaving,
  fetchPlans,
  createPlan,
  updatePlan,
  deletePlan,
  fetchPaymentSettings,
  savePaymentSettings
} = useSuperAdminApi();

const showPlanModal = ref(false);
const editingPlanId = ref<number | null>(null);
const isSubmittingPlan = ref(false);

const planForm = ref<{
  name: string;
  rateMonthly: number | null;
  rateYearly: number | null;
  maxUsers: number | null;
  maxClients: number | null;
  maxStorageMB: number | null;
  hasAccounts: boolean;
  yearlyDiscountPercent: number;
  featuresText: string;
  status: string;
}>({
  name: "",
  rateMonthly: null,
  rateYearly: null,
  maxUsers: null,
  maxClients: 50,
  maxStorageMB: 1024,
  hasAccounts: false,
  yearlyDiscountPercent: 0,
  featuresText: "",
  status: "active"
});

const calculateDiscount = () => {
  const m = Number(planForm.value.rateMonthly) || 0;
  const y = Number(planForm.value.rateYearly) || 0;
  if (m > 0 && y > 0) {
    const disc = Math.round(((m * 12 - y) / (m * 12)) * 100);
    planForm.value.yearlyDiscountPercent = Math.max(0, disc);
  } else {
    planForm.value.yearlyDiscountPercent = 0;
  }
};

const openCreatePlanModal = () => {
  editingPlanId.value = null;
  planForm.value = {
    name: "",
    rateMonthly: null,
    rateYearly: null,
    maxUsers: null,
    maxClients: 50,
    maxStorageMB: 1024,
    hasAccounts: false,
    yearlyDiscountPercent: 0,
    featuresText: "",
    status: "active"
  };
  showPlanModal.value = true;
};

const openEditPlanModal = (plan: Plan) => {
  editingPlanId.value = plan.id;
  planForm.value = {
    name: plan.name,
    rateMonthly: plan.rateMonthly,
    rateYearly: plan.rateYearly,
    maxUsers: plan.maxUsers,
    maxClients: plan.maxClients ?? 50,
    maxStorageMB: plan.maxStorageMB ?? 1024,
    hasAccounts: !!plan.hasAccounts,
    yearlyDiscountPercent: plan.yearlyDiscountPercent,
    featuresText: (plan.features || []).join("\n"),
    status: plan.status || "active"
  };
  showPlanModal.value = true;
};

const handleSavePlan = async () => {
  if (!planForm.value.name.trim()) {
    toast.warning("Plan name is required");
    return;
  }
  isSubmittingPlan.value = true;
  try {
    const features = planForm.value.featuresText
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);

    const payload = {
      name: planForm.value.name,
      rateMonthly: Number(planForm.value.rateMonthly),
      rateYearly: Number(planForm.value.rateYearly),
      maxUsers: Number(planForm.value.maxUsers),
      maxClients: Number(planForm.value.maxClients) || 50,
      maxStorageMB: Number(planForm.value.maxStorageMB) || 1024,
      hasAccounts: Boolean(planForm.value.hasAccounts),
      yearlyDiscountPercent: Number(planForm.value.yearlyDiscountPercent),
      features,
      status: planForm.value.status
    };

    if (editingPlanId.value) {
      await updatePlan(editingPlanId.value, payload);
      toast.success("Subscription plan updated successfully!");
    } else {
      await createPlan(payload);
      toast.success("Subscription plan created successfully!");
    }
    showPlanModal.value = false;
  } catch (e: any) {
    toast.error(e?.response?.data?.error || "Failed to save plan");
  } finally {
    isSubmittingPlan.value = false;
  }
};

const handleDeletePlan = async (plan: Plan) => {
  if (!confirm(`Are you sure you want to delete subscription plan "${plan.name}"?`)) return;
  try {
    await deletePlan(plan.id);
    toast.success("Subscription plan deleted successfully!");
  } catch (e: any) {
    toast.error(e?.response?.data?.error || "Failed to delete plan");
  }
};

const handleSavePaymentConfig = async () => {
  try {
    await savePaymentSettings(paymentSettings.value);
    toast.success("Payment settings saved to database!");
  } catch (e: any) {
    toast.error(e?.response?.data?.error || "Failed to save payment settings");
  }
};

onMounted(async () => {
  await Promise.all([fetchPlans(), fetchPaymentSettings()]);
});
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
          <span class="text-primary small fw-semibold">Plans & Payments</span>
        </div>
        <h4 class="text-white fw-bold mb-0">Subscription Plans & bKash Gateway</h4>
      </div>
      <button class="btn btn-idp-primary btn-sm px-3 py-1.5 fw-semibold d-flex align-items-center gap-2" @click="openCreatePlanModal">
        <i class="bi bi-plus-lg"></i> Add New Plan
      </button>
    </div>

    <div class="row g-4 mb-4">
      <!-- 1. bKash Gateway Configuration -->
      <div class="col-lg-4">
        <div class="idp-card p-4 h-100">
          <h5 class="text-white fw-bold mb-3 d-flex align-items-center gap-2">
            <i class="bi bi-wallet2 text-danger"></i> bKash Payment Gateway
          </h5>
          <p class="text-muted small mb-4">
            Live configuration for direct SaaS tenant signups with manual bKash Transaction ID (TrxID) verification.
          </p>

          <div class="mb-3">
            <label class="form-label text-light">bKash Merchant / Agent / Personal No</label>
            <input
              v-model="paymentSettings.bkashNumber"
              type="text"
              class="form-control idp-input font-monospace"
              placeholder="01XXXXXXXXX"
            />
          </div>

          <div class="mb-3">
            <label class="form-label text-light">bKash Send Money / Fee (%)</label>
            <input
              v-model.number="paymentSettings.bkashCharge"
              type="number"
              step="0.1"
              class="form-control idp-input font-monospace"
            />
            <div class="text-muted small mt-1">Default 1.8% added automatically at registration checkout.</div>
          </div>

          <div class="mb-4">
            <label class="form-label text-light">Nagad Number (Optional)</label>
            <input
              v-model="paymentSettings.nagadNumber"
              type="text"
              class="form-control idp-input font-monospace"
              placeholder="01XXXXXXXXX"
            />
          </div>

          <button
            class="btn btn-idp-primary w-100 py-2.5 fw-bold"
            :disabled="isSaving"
            @click="handleSavePaymentConfig"
          >
            {{ isSaving ? 'Saving to Database...' : 'Save Payment Config' }}
          </button>
        </div>
      </div>

      <!-- 2. Real Subscription Plans Grid -->
      <div class="col-lg-8">
        <div class="idp-card p-4 h-100">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="text-white fw-bold mb-0">Active Packages in PostgreSQL</h5>
            <span class="badge bg-primary">{{ plans.length }} Packages</span>
          </div>

          <div v-if="isLoadingPlans" class="py-5 text-center text-muted">
            <span class="spinner-border spinner-border-sm text-primary me-2"></span>
            Loading subscription packages...
          </div>

          <div v-else class="row g-3">
            <div v-for="plan in plans" :key="plan.id" class="col-md-6">
              <div class="p-3 bg-dark border border-secondary rounded h-100 d-flex flex-column">
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <div>
                    <h6 class="text-white fw-bold mb-1">{{ plan.name }}</h6>
                    <div class="d-flex flex-wrap gap-1 mt-1">
                      <span class="badge bg-info bg-opacity-25 text-info border border-info small">
                        Max {{ plan.maxUsers }} Users
                      </span>
                      <span class="badge bg-primary bg-opacity-25 text-primary border border-primary small">
                        Max {{ plan.maxClients || 50 }} Clients
                      </span>
                      <span class="badge bg-secondary bg-opacity-25 text-light border border-secondary small">
                        <i class="bi bi-hdd me-1"></i>{{ (plan.maxStorageMB || 1024) >= 1024 ? ((plan.maxStorageMB || 1024) / 1024).toFixed((plan.maxStorageMB || 1024) % 1024 === 0 ? 0 : 1) + ' GB' : (plan.maxStorageMB || 1024) + ' MB' }}
                      </span>
                      <span v-if="plan.hasAccounts" class="badge bg-success bg-opacity-25 text-success border border-success small">
                        <i class="bi bi-shield-check me-1"></i>Accounts
                      </span>
                      <span v-else class="badge bg-warning bg-opacity-25 text-warning border border-warning small">
                        <i class="bi bi-lock me-1"></i>No Accounts
                      </span>
                    </div>
                  </div>
                  <div class="text-end">
                    <div class="text-success fw-bold font-monospace fs-5">৳ {{ plan.rateMonthly }}<span class="text-muted fs-6">/mo</span></div>
                  </div>
                </div>

                <div class="text-muted small mb-3 pb-2 border-bottom border-secondary border-opacity-50">
                  Yearly: <strong class="text-light">৳ {{ plan.rateYearly }}</strong>
                  <span class="badge bg-success bg-opacity-25 text-success ms-1">Save {{ plan.yearlyDiscountPercent }}%</span>
                </div>

                <ul class="list-unstyled mb-4 small flex-grow-1">
                  <li v-for="(f, i) in (plan.features || [])" :key="i" class="text-light mb-1.5 d-flex align-items-center gap-2">
                    <i class="bi bi-check2-circle text-primary"></i> {{ f }}
                  </li>
                </ul>

                <div class="d-flex gap-2 pt-2 border-top border-secondary border-opacity-50">
                  <button class="btn btn-sm btn-outline-primary flex-grow-1" @click="openEditPlanModal(plan)">
                    <i class="bi bi-pencil me-1"></i> Edit Plan
                  </button>
                  <button class="btn btn-sm btn-outline-danger" @click="handleDeletePlan(plan)">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ADD / EDIT PLAN MODAL -->
    <div
      v-if="showPlanModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.75);"
    >
      <div class="modal-dialog modal-dialog-centered" style="max-width: 520px;">
        <div class="modal-content idp-card">
          <div class="modal-header border-secondary">
            <h5 class="modal-title text-white fw-bold">
              {{ editingPlanId ? 'Edit Subscription Plan' : 'Create Subscription Plan' }}
            </h5>
            <button type="button" class="btn-close btn-close-white" @click="showPlanModal = false"></button>
          </div>
          <div class="modal-body p-4">
            <form @submit.prevent="handleSavePlan">
              <div class="mb-3">
                <label class="form-label text-light">Plan Name *</label>
                <input
                  v-model="planForm.name"
                  type="text"
                  class="form-control idp-input"
                  required
                  placeholder="e.g. Professional VAT Consultant"
                />
              </div>

              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <label class="form-label text-light">Monthly Rate (Tk) *</label>
                  <input
                    v-model.number="planForm.rateMonthly"
                    type="number"
                    class="form-control idp-input font-monospace"
                    required
                    min="0"
                    placeholder="e.g. 1500"
                    @input="calculateDiscount"
                  />
                </div>
                <div class="col-md-6">
                  <label class="form-label text-light">Yearly Rate (Tk) *</label>
                  <input
                    v-model.number="planForm.rateYearly"
                    type="number"
                    class="form-control idp-input font-monospace"
                    required
                    min="0"
                    placeholder="e.g. 15000"
                    @input="calculateDiscount"
                  />
                </div>
              </div>

              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <label class="form-label text-light">Max Allowed Sub-users *</label>
                  <input
                    v-model.number="planForm.maxUsers"
                    type="number"
                    class="form-control idp-input font-monospace"
                    required
                    min="1"
                    placeholder="e.g. 5"
                  />
                </div>
                <div class="col-md-6">
                  <label class="form-label text-light">Max Allowed Clients *</label>
                  <input
                    v-model.number="planForm.maxClients"
                    type="number"
                    class="form-control idp-input font-monospace"
                    required
                    min="1"
                    placeholder="e.g. 50"
                  />
                </div>
              </div>

              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <label class="form-label text-light">Database Storage (MB) *</label>
                  <input
                    v-model.number="planForm.maxStorageMB"
                    type="number"
                    class="form-control idp-input font-monospace"
                    required
                    min="100"
                    placeholder="e.g. 1024"
                  />
                  <div class="text-muted small mt-1">1024 MB = 1 GB, 2048 MB = 2 GB</div>
                </div>
                <div class="col-md-6">
                  <label class="form-label text-light">Yearly Discount (%)</label>
                  <input
                    v-model.number="planForm.yearlyDiscountPercent"
                    type="number"
                    class="form-control idp-input font-monospace bg-dark text-muted"
                    readonly
                    placeholder="0"
                  />
                </div>
              </div>

              <div class="p-3 mb-3 rounded bg-dark border border-secondary border-opacity-50">
                <div class="form-check form-switch mb-0">
                  <input
                    id="hasAccountsSwitch"
                    v-model="planForm.hasAccounts"
                    class="form-check-input"
                    type="checkbox"
                  />
                  <label class="form-check-label text-light fw-semibold" for="hasAccountsSwitch">
                    Enable Accounts & Billing Module Access
                  </label>
                </div>
                <div class="text-muted small mt-1 ms-4">
                  When enabled, tenants on this plan can access Invoicing, Billing, and Collections.
                </div>
              </div>

              <div class="mb-4">
                <label class="form-label text-light">Features List (One feature per line)</label>
                <textarea
                  v-model="planForm.featuresText"
                  rows="4"
                  class="form-control idp-input"
                  placeholder="Enter features (one per line)&#10;e.g. Full Client Profile Management&#10;Unlimited Purchases & Sales Rates&#10;Submissions Tracker"
                ></textarea>
              </div>

              <div class="d-flex gap-2">
                <button type="button" class="btn btn-secondary flex-grow-1" @click="showPlanModal = false">
                  Cancel
                </button>
                <button
                  type="submit"
                  class="btn btn-idp-primary flex-grow-1"
                  :disabled="isSubmittingPlan"
                >
                  {{ isSubmittingPlan ? 'Saving Plan...' : (editingPlanId ? 'Update Plan' : 'Create Plan') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
