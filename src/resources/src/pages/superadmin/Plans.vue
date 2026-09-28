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

const activeTab = ref<'plans' | 'form' | 'gateway'>('plans');
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

const openCreatePlanTab = () => {
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
  activeTab.value = 'form';
};

const openEditPlanTab = (plan: Plan) => {
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
  activeTab.value = 'form';
};

const cancelForm = () => {
  editingPlanId.value = null;
  activeTab.value = 'plans';
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
    await fetchPlans();
    editingPlanId.value = null;
    activeTab.value = 'plans';
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
    await fetchPlans();
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
    <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Dashboard
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">Plans & Payments</span>
        </div>
        <h4 class="text-white fw-bold mb-0">Subscription Plans & Payment Gateway</h4>
      </div>
      <button 
        v-if="activeTab !== 'form'"
        class="btn btn-idp-primary btn-sm px-3 py-2 fw-semibold d-flex align-items-center gap-2" 
        @click="openCreatePlanTab"
      >
        <i class="bi bi-plus-lg"></i> Add New Plan
      </button>
      <button 
        v-else
        class="btn btn-outline-secondary btn-sm px-3 py-2 fw-semibold d-flex align-items-center gap-2" 
        @click="cancelForm"
      >
        <i class="bi bi-arrow-left"></i> Back to Plans
      </button>
    </div>

    <!-- Navigation Tabs -->
    <div class="d-flex flex-wrap gap-2 mb-4 border-bottom border-secondary border-opacity-50 pb-3">
      <button
        class="btn btn-sm px-3 py-2 fw-semibold rounded-pill d-flex align-items-center gap-2"
        :class="activeTab === 'plans' ? 'btn-primary shadow' : 'btn-dark border-secondary text-muted'"
        @click="activeTab = 'plans'"
      >
        <i class="bi bi-grid-3x3-gap-fill"></i> Subscription Plans ({{ plans.length }})
      </button>
      <button
        class="btn btn-sm px-3 py-2 fw-semibold rounded-pill d-flex align-items-center gap-2"
        :class="activeTab === 'form' ? 'btn-primary shadow' : 'btn-dark border-secondary text-muted'"
        @click="openCreatePlanTab"
      >
        <i class="bi" :class="editingPlanId ? 'bi-pencil-square' : 'bi-plus-circle-fill'"></i>
        {{ editingPlanId ? 'Edit Plan' : 'Create New Plan' }}
      </button>
      <button
        class="btn btn-sm px-3 py-2 fw-semibold rounded-pill d-flex align-items-center gap-2"
        :class="activeTab === 'gateway' ? 'btn-primary shadow' : 'btn-dark border-secondary text-muted'"
        @click="activeTab = 'gateway'"
      >
        <i class="bi bi-wallet2 text-danger"></i> bKash & Gateway Settings
      </button>
    </div>

    <!-- TAB 1: ALL SUBSCRIPTION PLANS -->
    <div v-if="activeTab === 'plans'">
      <div class="idp-card p-4">
        <div class="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h5 class="text-white fw-bold mb-1">Active Subscription Packages</h5>
            <p class="text-muted small mb-0">Configured pricing packages available for tenant registration and subscriptions.</p>
          </div>
          <button class="btn btn-idp-primary btn-sm px-3 py-1.5 fw-semibold" @click="openCreatePlanTab">
            <i class="bi bi-plus-lg me-1"></i> Add New Plan
          </button>
        </div>

        <div v-if="isLoadingPlans" class="py-5 text-center text-muted">
          <span class="spinner-border spinner-border-sm text-primary me-2"></span>
          Loading subscription packages...
        </div>

        <div v-else-if="plans.length === 0" class="py-5 text-center text-muted">
          <i class="bi bi-box-seam fs-1 d-block mb-2 text-secondary"></i>
          <h6>No Subscription Plans Created Yet</h6>
          <p class="small">Click "Add New Plan" to create your first SaaS subscription package.</p>
          <button class="btn btn-idp-primary btn-sm mt-2" @click="openCreatePlanTab">
            <i class="bi bi-plus-lg me-1"></i> Create Plan Now
          </button>
        </div>

        <div v-else class="row g-4">
          <div v-for="plan in plans" :key="plan.id" class="col-lg-4 col-md-6">
            <div class="p-4 bg-dark bg-opacity-75 border border-secondary border-opacity-75 rounded-3 h-100 d-flex flex-column hover-shadow">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <h5 class="text-white fw-bold mb-1">{{ plan.name }}</h5>
                  <div class="d-flex flex-wrap gap-1 mt-2">
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
              </div>

              <div class="d-flex align-items-baseline gap-2 mb-2">
                <div class="text-success fw-bold font-monospace fs-4">৳ {{ plan.rateMonthly }}</div>
                <div class="text-muted small">/ month</div>
              </div>

              <div class="text-muted small mb-3 pb-3 border-bottom border-secondary border-opacity-50">
                Yearly Rate: <strong class="text-light">৳ {{ plan.rateYearly }}</strong>
                <span v-if="plan.yearlyDiscountPercent > 0" class="badge bg-success bg-opacity-25 text-success ms-1">
                  Save {{ plan.yearlyDiscountPercent }}%
                </span>
              </div>

              <div class="mb-4 flex-grow-1">
                <div class="text-muted small fw-semibold mb-2">Features Included:</div>
                <ul class="list-unstyled mb-0 small">
                  <li v-for="(f, i) in (plan.features || [])" :key="i" class="text-light mb-1.5 d-flex align-items-center gap-2">
                    <i class="bi bi-check2-circle text-primary flex-shrink-0"></i> <span>{{ f }}</span>
                  </li>
                  <li v-if="!plan.features || plan.features.length === 0" class="text-muted fst-italic">
                    Standard VAT Automation Features
                  </li>
                </ul>
              </div>

              <div class="d-flex gap-2 pt-3 border-top border-secondary border-opacity-50">
                <button class="btn btn-sm btn-outline-primary flex-grow-1 fw-semibold py-1.5" @click="openEditPlanTab(plan)">
                  <i class="bi bi-pencil me-1"></i> Edit Plan
                </button>
                <button class="btn btn-sm btn-outline-danger px-3 py-1.5" title="Delete Plan" @click="handleDeletePlan(plan)">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: DEDICATED FULL-TAB FORM (NO MODAL) -->
    <div v-else-if="activeTab === 'form'">
      <div class="row g-4">
        <!-- Form Column -->
        <div class="col-lg-7">
          <div class="idp-card p-4">
            <div class="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom border-secondary border-opacity-50">
              <div>
                <h5 class="text-white fw-bold mb-1">
                  {{ editingPlanId ? 'Edit Subscription Plan' : 'Create New Subscription Plan' }}
                </h5>
                <p class="text-muted small mb-0">Fill in the package pricing, user capacities, and access modules.</p>
              </div>
              <button class="btn btn-sm btn-outline-secondary" @click="cancelForm">
                <i class="bi bi-x-lg me-1"></i> Cancel
              </button>
            </div>

            <form @submit.prevent="handleSavePlan">
              <div class="mb-3">
                <label class="form-label text-light fw-semibold">Plan Name *</label>
                <input
                  v-model="planForm.name"
                  type="text"
                  class="form-control idp-input"
                  required
                  placeholder="e.g. Professional VAT Firm / Standard Business"
                />
              </div>

              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <label class="form-label text-light fw-semibold">Monthly Rate (Tk) *</label>
                  <div class="input-group">
                    <span class="input-group-text bg-dark border-secondary text-muted">৳</span>
                    <input
                      v-model.number="planForm.rateMonthly"
                      type="number"
                      class="form-control idp-input font-monospace"
                      required
                      min="0"
                      placeholder="e.g. 3000"
                      @input="calculateDiscount"
                    />
                  </div>
                </div>
                <div class="col-md-6">
                  <label class="form-label text-light fw-semibold">Yearly Rate (Tk) *</label>
                  <div class="input-group">
                    <span class="input-group-text bg-dark border-secondary text-muted">৳</span>
                    <input
                      v-model.number="planForm.rateYearly"
                      type="number"
                      class="form-control idp-input font-monospace"
                      required
                      min="0"
                      placeholder="e.g. 30000"
                      @input="calculateDiscount"
                    />
                  </div>
                </div>
              </div>

              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <label class="form-label text-light fw-semibold">Max Allowed Sub-users *</label>
                  <input
                    v-model.number="planForm.maxUsers"
                    type="number"
                    class="form-control idp-input font-monospace"
                    required
                    min="1"
                    placeholder="e.g. 5"
                  />
                  <div class="text-muted small mt-1">Number of staff accounts the admin can create.</div>
                </div>
                <div class="col-md-6">
                  <label class="form-label text-light fw-semibold">Max Allowed Clients *</label>
                  <input
                    v-model.number="planForm.maxClients"
                    type="number"
                    class="form-control idp-input font-monospace"
                    required
                    min="1"
                    placeholder="e.g. 50"
                  />
                  <div class="text-muted small mt-1">Maximum client companies the firm can manage.</div>
                </div>
              </div>

              <div class="row g-3 mb-3">
                <div class="col-md-6">
                  <label class="form-label text-light fw-semibold">Database Storage (MB) *</label>
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
                  <label class="form-label text-light fw-semibold">Yearly Discount (%)</label>
                  <div class="input-group">
                    <input
                      v-model.number="planForm.yearlyDiscountPercent"
                      type="number"
                      class="form-control idp-input font-monospace bg-dark text-muted"
                      readonly
                      placeholder="0"
                    />
                    <span class="input-group-text bg-dark border-secondary text-muted">%</span>
                  </div>
                  <div class="text-muted small mt-1">Calculated automatically from monthly vs yearly rate.</div>
                </div>
              </div>

              <div class="p-3 mb-3 rounded bg-dark border border-secondary border-opacity-75">
                <div class="form-check form-switch mb-0">
                  <input
                    id="hasAccountsSwitch"
                    v-model="planForm.hasAccounts"
                    class="form-check-input"
                    type="checkbox"
                    role="switch"
                  />
                  <label class="form-check-label text-light fw-semibold" for="hasAccountsSwitch">
                    Enable Accounts & Billing Module Access
                  </label>
                </div>
                <div class="text-muted small mt-1 ms-4">
                  When enabled, tenants on this plan can access Invoicing, Billing, Firm Accounts, and Collections.
                </div>
              </div>

              <div class="mb-4">
                <label class="form-label text-light fw-semibold">Features List (One feature per line)</label>
                <textarea
                  v-model="planForm.featuresText"
                  rows="5"
                  class="form-control idp-input"
                  placeholder="Enter features (one per line)&#10;e.g. Full Client Profile Management&#10;Unlimited Purchases & Bill of Entry Import&#10;Automated Mushak 9.1 & 6.1 Generation&#10;Dedicated Submissions Tracker"
                ></textarea>
              </div>

              <div class="d-flex gap-3 pt-3 border-top border-secondary border-opacity-50">
                <button type="button" class="btn btn-outline-secondary px-4 py-2 fw-semibold" @click="cancelForm">
                  Cancel
                </button>
                <button
                  type="submit"
                  class="btn btn-idp-primary flex-grow-1 py-2 fw-bold"
                  :disabled="isSubmittingPlan"
                >
                  <span v-if="isSubmittingPlan" class="spinner-border spinner-border-sm me-2"></span>
                  <i v-else class="bi bi-check2-circle me-1"></i>
                  {{ isSubmittingPlan ? 'Saving Plan...' : (editingPlanId ? 'Update Subscription Plan' : 'Save & Publish Plan') }}
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- Live Preview Column -->
        <div class="col-lg-5">
          <div class="idp-card p-4 sticky-top" style="top: 1rem;">
            <div class="d-flex align-items-center gap-2 mb-3">
              <i class="bi bi-eye text-primary"></i>
              <h6 class="text-white fw-bold mb-0">Live Plan Preview</h6>
            </div>
            <p class="text-muted small mb-3">This is how your subscription package will appear to users during checkout:</p>

            <div class="p-4 bg-dark bg-opacity-75 border border-primary border-opacity-50 rounded-3 shadow">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div>
                  <h5 class="text-white fw-bold mb-1">{{ planForm.name || 'Your Plan Name' }}</h5>
                  <div class="d-flex flex-wrap gap-1 mt-2">
                    <span class="badge bg-info bg-opacity-25 text-info border border-info small">
                      Max {{ planForm.maxUsers || 1 }} Users
                    </span>
                    <span class="badge bg-primary bg-opacity-25 text-primary border border-primary small">
                      Max {{ planForm.maxClients || 50 }} Clients
                    </span>
                    <span class="badge bg-secondary bg-opacity-25 text-light border border-secondary small">
                      <i class="bi bi-hdd me-1"></i>{{ (planForm.maxStorageMB || 1024) >= 1024 ? ((planForm.maxStorageMB || 1024) / 1024).toFixed((planForm.maxStorageMB || 1024) % 1024 === 0 ? 0 : 1) + ' GB' : (planForm.maxStorageMB || 1024) + ' MB' }}
                    </span>
                    <span v-if="planForm.hasAccounts" class="badge bg-success bg-opacity-25 text-success border border-success small">
                      <i class="bi bi-shield-check me-1"></i>Accounts
                    </span>
                    <span v-else class="badge bg-warning bg-opacity-25 text-warning border border-warning small">
                      <i class="bi bi-lock me-1"></i>No Accounts
                    </span>
                  </div>
                </div>
              </div>

              <div class="d-flex align-items-baseline gap-2 mb-2">
                <div class="text-success fw-bold font-monospace fs-4">৳ {{ planForm.rateMonthly ?? 0 }}</div>
                <div class="text-muted small">/ month</div>
              </div>

              <div class="text-muted small mb-3 pb-3 border-bottom border-secondary border-opacity-50">
                Yearly Rate: <strong class="text-light">৳ {{ planForm.rateYearly ?? 0 }}</strong>
                <span v-if="planForm.yearlyDiscountPercent > 0" class="badge bg-success bg-opacity-25 text-success ms-1">
                  Save {{ planForm.yearlyDiscountPercent }}%
                </span>
              </div>

              <div class="mb-2">
                <div class="text-muted small fw-semibold mb-2">Features Included:</div>
                <ul class="list-unstyled mb-0 small">
                  <li 
                    v-for="(f, i) in planForm.featuresText.split('\n').map(s => s.trim()).filter(Boolean)" 
                    :key="i" 
                    class="text-light mb-1.5 d-flex align-items-center gap-2"
                  >
                    <i class="bi bi-check2-circle text-primary flex-shrink-0"></i> <span>{{ f }}</span>
                  </li>
                  <li v-if="!planForm.featuresText.trim()" class="text-muted fst-italic">
                    Type features in the form to preview them here...
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 3: BKASH GATEWAY SETTINGS -->
    <div v-else-if="activeTab === 'gateway'">
      <div class="idp-card p-4" style="max-width: 600px;">
        <h5 class="text-white fw-bold mb-3 d-flex align-items-center gap-2">
          <i class="bi bi-wallet2 text-danger"></i> bKash Payment Gateway Configuration
        </h5>
        <p class="text-muted small mb-4">
          Live configuration for direct SaaS tenant signups with manual bKash Transaction ID (TrxID) verification.
        </p>

        <div class="mb-3">
          <label class="form-label text-light fw-semibold">bKash Merchant / Agent / Personal No</label>
          <input
            v-model="paymentSettings.bkashNumber"
            type="text"
            class="form-control idp-input font-monospace"
            placeholder="01XXXXXXXXX"
          />
        </div>

        <div class="mb-3">
          <label class="form-label text-light fw-semibold">bKash Send Money / Fee (%)</label>
          <input
            v-model.number="paymentSettings.bkashCharge"
            type="number"
            step="0.1"
            class="form-control idp-input font-monospace"
          />
          <div class="text-muted small mt-1">Default 1.8% added automatically at registration checkout.</div>
        </div>

        <div class="mb-4">
          <label class="form-label text-light fw-semibold">Nagad Number (Optional)</label>
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
          <span v-if="isSaving" class="spinner-border spinner-border-sm me-2"></span>
          {{ isSaving ? 'Saving to Database...' : 'Save Payment Config' }}
        </button>
      </div>
    </div>
  </div>
</template>
