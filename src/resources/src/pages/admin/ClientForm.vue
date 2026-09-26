<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useClientsApi, type ClientItem, type AssignableUser } from "@/composables/useClientsApi";
import { useServicesApi } from "@/composables/useServicesApi";
import { useToast } from "@/composables/useToast";

const route = useRoute();
const router = useRouter();
const toast = useToast();

const isEditMode = computed(() => !!route.params.id && route.params.id !== "create");
const clientId = computed(() => Number(route.params.id) || 0);

const {
  fetchClient,
  createClient,
  updateClient,
  checkBinUnique,
  checkMobileExists,
  assignableUsers,
  fetchAssignableUsers
} = useClientsApi();

const {
  customerTypes,
  references,
  fetchCustomerTypes,
  fetchReferences
} = useServicesApi();

const activeTab = ref<"basic" | "contact" | "vat" | "managers">("basic");
const isSubmitting = ref(false);
const isLoading = ref(false);
const formError = ref("");
const showVatPassword = ref(false);

const binStatus = ref<"idle" | "checking" | "unique" | "taken">("idle");
const mobileWarning = ref<string | null>(null);

const form = ref<{
  id: number;
  companyName: string;
  proprietorName: string;
  binNumber: string;
  tinNumber: string;
  tradeLicenseNo: string;
  address: string;
  mobile: string;
  alternativeMobile: string;
  email: string;
  customerTypeId: number | null;
  referenceId: number | null;
  vatUserId: string;
  vatPassword: string;
  vatServiceType: "FULL" | "ONLY_RETURN";
  openingBalance: number;
  isActive: boolean;
  notes: string;
  managerIds: number[];
}>({
  id: 0,
  companyName: "",
  proprietorName: "",
  binNumber: "",
  tinNumber: "",
  tradeLicenseNo: "",
  address: "",
  mobile: "",
  alternativeMobile: "",
  email: "",
  customerTypeId: null,
  referenceId: null,
  vatUserId: "",
  vatPassword: "",
  vatServiceType: "FULL",
  openingBalance: 0,
  isActive: true,
  notes: "",
  managerIds: []
});

// Opening Balance
const balanceType = ref<'none' | 'due' | 'advance'>('none');
const balanceAmount = ref<number | null>(null);

onMounted(async () => {
  isLoading.value = true;
  try {
    await Promise.all([
      fetchCustomerTypes(),
      fetchReferences(),
      fetchAssignableUsers()
    ]);

    if (isEditMode.value) {
      const clientData = await fetchClient(clientId.value);
      if (clientData) {
        form.value = {
          id: clientData.id,
          companyName: clientData.companyName || "",
          proprietorName: clientData.proprietorName || "",
          binNumber: clientData.binNumber || "",
          tinNumber: clientData.tinNumber || "",
          tradeLicenseNo: clientData.tradeLicenseNo || "",
          address: clientData.address || "",
          mobile: clientData.mobile || "",
          alternativeMobile: clientData.alternativeMobile || "",
          email: clientData.email || "",
          customerTypeId: clientData.customerTypeId || null,
          referenceId: clientData.referenceId || null,
          vatUserId: clientData.vatUserId || "",
          vatPassword: clientData.vatPassword || "",
          vatServiceType: clientData.vatServiceType || "FULL",
          openingBalance: clientData.openingBalance || 0,
          isActive: clientData.isActive ?? true,
          notes: clientData.notes || "",
          managerIds: (clientData.managers || []).map((m: any) => m.id)
        };

        if (clientData.openingBalance > 0) {
          balanceType.value = 'due';
          balanceAmount.value = clientData.openingBalance;
        } else if (clientData.openingBalance < 0) {
          balanceType.value = 'advance';
          balanceAmount.value = Math.abs(clientData.openingBalance);
        } else {
          balanceType.value = 'none';
          balanceAmount.value = null;
        }
      }
    } else {
      // Set default customer type if available
      if (customerTypes.value.length > 0) {
        form.value.customerTypeId = customerTypes.value[0].id;
      }
    }
  } catch (err: any) {
    toast.error("Failed to load client data");
  } finally {
    isLoading.value = false;
  }
});

// Debounced live BIN uniqueness check
let binTimer: any = null;
const handleBinInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value;
  form.value.binNumber = val;

  clearTimeout(binTimer);
  const trimmed = val.trim();
  if (!trimmed) {
    binStatus.value = "idle";
    return;
  }
  binStatus.value = "checking";
  binTimer = setTimeout(async () => {
    const res = await checkBinUnique(trimmed, isEditMode.value ? clientId.value : undefined);
    binStatus.value = res.unique ? "unique" : "taken";
  }, 400);
};

// Debounced live mobile match check
let mobileTimer: any = null;
const handleMobileInput = (e: Event) => {
  const val = (e.target as HTMLInputElement).value;
  form.value.mobile = val;

  clearTimeout(mobileTimer);
  const trimmed = val.trim();
  if (!trimmed || trimmed.length < 6) {
    mobileWarning.value = null;
    return;
  }
  mobileTimer = setTimeout(async () => {
    const matches = await checkMobileExists(trimmed, isEditMode.value ? clientId.value : undefined);
    if (matches && matches.length > 0) {
      mobileWarning.value = `Mobile matches existing client: ${matches[0].companyName}`;
    } else {
      mobileWarning.value = null;
    }
  }, 400);
};

const toggleManager = (userId: number) => {
  const current = [...form.value.managerIds];
  const idx = current.indexOf(userId);
  if (idx > -1) {
    current.splice(idx, 1);
  } else {
    current.push(userId);
  }
  form.value.managerIds = current;
};

const handleSubmit = async () => {
  formError.value = "";
  if (!form.value.companyName.trim()) {
    formError.value = "Company Name is required.";
    activeTab.value = "basic";
    return;
  }

  isSubmitting.value = true;
  try {
    let finalOpeningBalance = 0;
    if (balanceType.value === 'due' && balanceAmount.value && balanceAmount.value > 0) {
      finalOpeningBalance = Number(balanceAmount.value);
    } else if (balanceType.value === 'advance' && balanceAmount.value && balanceAmount.value > 0) {
      finalOpeningBalance = -Number(balanceAmount.value);
    }

    const payload = {
      companyName: form.value.companyName.trim(),
      proprietorName: form.value.proprietorName?.trim() || undefined,
      binNumber: form.value.binNumber?.trim() || undefined,
      tinNumber: form.value.tinNumber?.trim() || undefined,
      tradeLicenseNo: form.value.tradeLicenseNo?.trim() || undefined,
      address: form.value.address?.trim() || undefined,
      mobile: form.value.mobile?.trim() || undefined,
      alternativeMobile: form.value.alternativeMobile?.trim() || undefined,
      email: form.value.email?.trim() || undefined,
      customerTypeId: form.value.customerTypeId || undefined,
      referenceId: form.value.referenceId || undefined,
      vatUserId: form.value.vatUserId?.trim() || undefined,
      vatPassword: form.value.vatPassword?.trim() || undefined,
      vatServiceType: form.value.vatServiceType,
      openingBalance: finalOpeningBalance,
      isActive: form.value.isActive,
      notes: form.value.notes?.trim() || undefined,
      managerIds: form.value.managerIds
    };

    if (isEditMode.value) {
      await updateClient(clientId.value, payload);
      toast.success("Client organization updated successfully");
    } else {
      await createClient(payload);
      toast.success("Client organization created successfully");
    }
    router.push("/admin/clients");
  } catch (err: any) {
    formError.value = err.response?.data?.message || "Failed to save client organization.";
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <div class="client-form-page py-2">
    <!-- Header & Breadcrumbs -->
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Dashboard
          </router-link>
          <span class="text-muted small">/</span>
          <router-link to="/admin/clients" class="text-muted text-decoration-none small">
            Clients
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">
            {{ isEditMode ? 'Edit Client' : 'Add Client' }}
          </span>
        </div>
        <h4 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
          <i class="bi bi-building text-primary"></i>
          <span>{{ isEditMode ? `Edit Client: ${form.companyName || 'Organization'}` : 'Register New Client Organization' }}</span>
        </h4>
      </div>

      <div class="d-flex align-items-center gap-2">
        <router-link to="/admin/clients" class="btn btn-outline-secondary btn-sm px-3">
          Cancel
        </router-link>
        <button
          type="button"
          class="btn btn-primary btn-sm px-4 fw-semibold d-flex align-items-center gap-2 shadow-sm"
          :disabled="isSubmitting || isLoading"
          @click="handleSubmit"
        >
          <span v-if="isSubmitting" class="spinner-border spinner-border-sm" role="status"></span>
          <i v-else class="bi bi-check2"></i>
          <span>{{ isEditMode ? 'Update Client' : 'Save Client Organization' }}</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-5 text-muted">
      <div class="spinner-border text-primary mb-3" role="status"></div>
      <div>Loading client organization details...</div>
    </div>

    <div v-else>
      <!-- Error Alert -->
      <div v-if="formError" class="alert alert-danger alert-dismissible fade show d-flex align-items-center mb-4" role="alert">
        <i class="bi bi-exclamation-triangle-fill fs-5 me-2"></i>
        <div>{{ formError }}</div>
        <button type="button" class="btn-close ms-auto" @click="formError = ''"></button>
      </div>

      <!-- Navigation Tabs -->
      <div class="settings-tabs-wrapper mb-4">
        <ul class="nav nav-pills gap-2 flex-nowrap overflow-auto py-1">
          <li class="nav-item">
            <button
              type="button"
              class="nav-link"
              :class="{ active: activeTab === 'basic' }"
              @click="activeTab = 'basic'"
            >
              <i class="bi bi-info-circle me-1"></i> 1. Basic Profile & Identifiers
            </button>
          </li>
          <li class="nav-item">
            <button
              type="button"
              class="nav-link"
              :class="{ active: activeTab === 'contact' }"
              @click="activeTab = 'contact'"
            >
              <i class="bi bi-geo-alt me-1"></i> 2. Contact & Address
            </button>
          </li>
          <li class="nav-item">
            <button
              type="button"
              class="nav-link"
              :class="{ active: activeTab === 'vat' }"
              @click="activeTab = 'vat'"
            >
              <i class="bi bi-shield-lock me-1"></i> 3. VAT Credentials & Scope
            </button>
          </li>
          <li class="nav-item">
            <button
              type="button"
              class="nav-link"
              :class="{ active: activeTab === 'managers' }"
              @click="activeTab = 'managers'"
            >
              <i class="bi bi-people me-1"></i> 4. User Assignments
              <span v-if="form.managerIds.length > 0" class="badge bg-primary ms-1">
                {{ form.managerIds.length }}
              </span>
            </button>
          </li>
        </ul>
      </div>

      <!-- Form Content Cards -->
      <div class="idp-card p-4 shadow-sm mb-4">
        <!-- ── TAB 1: BASIC PROFILE & TAX IDENTIFIERS ── -->
        <div v-if="activeTab === 'basic'">
          <h5 class="text-white fw-bold mb-3 d-flex align-items-center gap-2 border-bottom border-secondary border-opacity-50 pb-2">
            <i class="bi bi-building-check text-primary"></i> Organization Profile & Statutory Data
          </h5>

          <div class="row g-3">
            <div class="col-md-7">
              <label class="form-label text-light small fw-medium mb-1">
                Company / Organization Name <span class="text-danger">*</span>
              </label>
              <input
                v-model="form.companyName"
                type="text"
                class="form-control idp-input"
                placeholder="e.g. Al Madina Steel Re-Rolling Mills Ltd."
                required
              />
            </div>

            <div class="col-md-5">
              <label class="form-label text-light small fw-medium mb-1">Proprietor / MD Name</label>
              <input
                v-model="form.proprietorName"
                type="text"
                class="form-control idp-input"
                placeholder="e.g. Alhaj Md. Shamsul Haque"
              />
            </div>

            <!-- Identifiers -->
            <div class="col-md-4">
              <label class="form-label text-light small fw-medium mb-1 d-flex justify-content-between align-items-center">
                <span>13-Digit BIN Number</span>
                <span v-if="binStatus === 'checking'" class="text-muted small">
                  <span class="spinner-border spinner-border-sm me-1"></span> Checking...
                </span>
                <span v-else-if="binStatus === 'unique'" class="text-success small fw-semibold">
                  <i class="bi bi-check-circle-fill me-1"></i> Unique BIN
                </span>
                <span v-else-if="binStatus === 'taken'" class="text-danger small fw-semibold">
                  <i class="bi bi-x-circle-fill me-1"></i> Already registered
                </span>
              </label>
              <input
                :value="form.binNumber"
                type="text"
                class="form-control idp-input font-monospace"
                placeholder="e.g. 001234567-0101"
                @input="handleBinInput"
              />
            </div>

            <div class="col-md-4">
              <label class="form-label text-light small fw-medium mb-1">12-Digit TIN Number</label>
              <input
                v-model="form.tinNumber"
                type="text"
                class="form-control idp-input font-monospace"
                placeholder="e.g. 782910384721"
              />
            </div>

            <div class="col-md-4">
              <label class="form-label text-light small fw-medium mb-1">Trade License Number</label>
              <input
                v-model="form.tradeLicenseNo"
                type="text"
                class="form-control idp-input"
                placeholder="e.g. TRAD/DNCC/038291"
              />
            </div>

            <!-- Customer Type & Reference -->
            <div class="col-md-6">
              <label class="form-label text-light small fw-medium mb-1">Customer Type</label>
              <select v-model="form.customerTypeId" class="form-select idp-input">
                <option :value="null">-- Select Customer Type --</option>
                <option v-for="t in customerTypes" :key="t.id" :value="t.id">{{ t.typeName }}</option>
              </select>
            </div>

            <div class="col-md-6">
              <label class="form-label text-light small fw-medium mb-1">Referral / Introducer Partner</label>
              <select v-model="form.referenceId" class="form-select idp-input">
                <option :value="null">Direct Client / No Reference</option>
                <option v-for="r in references" :key="r.id" :value="r.id">{{ r.name }}</option>
              </select>
            </div>

            <!-- Opening Balance Type & Amount -->
            <div class="col-md-6">
              <label class="form-label text-light small fw-medium mb-1">Opening Balance Type</label>
              <select v-model="balanceType" class="form-select idp-input">
                <option value="none">No Initial Balance (0.00)</option>
                <option value="due">Due (Client owes money)</option>
                <option value="advance">Advance (Paid in advance / Credit)</option>
              </select>
            </div>

            <div class="col-md-6">
              <label class="form-label text-light small fw-medium mb-1">Opening Balance Amount (Tk)</label>
              <input
                v-model.number="balanceAmount"
                type="number"
                step="0.01"
                min="0"
                class="form-control idp-input font-monospace text-end"
                placeholder="0.00"
                :disabled="balanceType === 'none'"
              />
            </div>

            <!-- Active Status Switch -->
            <div class="col-12 pt-2">
              <div class="p-3 bg-dark border border-secondary rounded d-flex align-items-center justify-content-between">
                <div>
                  <div class="text-white fw-semibold small">Client Active Status</div>
                  <div class="text-muted small">
                    {{ form.isActive ? 'Client is active: Data entry and Excel/CSV purchase uploads are enabled.' : 'Client is inactive: Ignored/dropped automatically during purchase file uploads.' }}
                  </div>
                </div>
                <div class="form-check form-switch ms-3">
                  <input
                    id="clientActiveSwitch"
                    v-model="form.isActive"
                    class="form-check-input"
                    type="checkbox"
                    role="switch"
                    style="width: 2.5rem; height: 1.3rem; cursor: pointer;"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── TAB 2: CONTACT & ADDRESS ── -->
        <div v-if="activeTab === 'contact'">
          <h5 class="text-white fw-bold mb-3 d-flex align-items-center gap-2 border-bottom border-secondary border-opacity-50 pb-2">
            <i class="bi bi-geo-alt text-primary"></i> Contact Numbers & Registered Location
          </h5>

          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label text-light small fw-medium mb-1">
                Primary Contact Mobile <span class="text-danger">*</span>
              </label>
              <input
                :value="form.mobile"
                type="text"
                class="form-control idp-input font-monospace"
                placeholder="e.g. 01711223344"
                @input="handleMobileInput"
              />
              <div v-if="mobileWarning" class="text-warning small mt-1">
                <i class="bi bi-exclamation-circle me-1"></i> {{ mobileWarning }}
              </div>
            </div>

            <div class="col-md-6">
              <label class="form-label text-light small fw-medium mb-1">Alternative Mobile / WhatsApp</label>
              <input
                v-model="form.alternativeMobile"
                type="text"
                class="form-control idp-input font-monospace"
                placeholder="e.g. 01819556677"
              />
            </div>

            <div class="col-12">
              <label class="form-label text-light small fw-medium mb-1">Billing / Official Email</label>
              <input
                v-model="form.email"
                type="email"
                class="form-control idp-input"
                placeholder="e.g. accounts@almadinasteel.com"
              />
            </div>

            <div class="col-12">
              <label class="form-label text-light small fw-medium mb-1">Registered Business / Factory Address</label>
              <textarea
                v-model="form.address"
                rows="3"
                class="form-control idp-input"
                placeholder="Full factory or registered office address..."
              ></textarea>
            </div>

            <div class="col-12">
              <label class="form-label text-light small fw-medium mb-1">Internal Notes / Staff Remarks</label>
              <textarea
                v-model="form.notes"
                rows="2"
                class="form-control idp-input"
                placeholder="Special notes or filing instructions for assigned staff..."
              ></textarea>
            </div>
          </div>
        </div>

        <!-- ── TAB 3: VAT CREDENTIALS & SERVICE SCOPE ── -->
        <div v-if="activeTab === 'vat'">
          <h5 class="text-white fw-bold mb-3 d-flex align-items-center gap-2 border-bottom border-secondary border-opacity-50 pb-2">
            <i class="bi bi-shield-lock text-primary"></i> NBR Online VAT Portal Credentials & Service Scope
          </h5>

          <!-- Security Notice -->
          <div class="p-3 rounded bg-dark border border-secondary mb-4">
            <div class="text-warning small fw-bold mb-1">
              <i class="bi bi-shield-exclamation me-1"></i> NBR VAT Portal Credentials
            </div>
            <div class="text-muted small">
              Store encrypted VAT login details for direct monthly return submissions and verification.
            </div>
          </div>

          <div class="row g-3 mb-4">
            <div class="col-md-6">
              <label class="form-label text-light small fw-medium mb-1">VAT Portal User ID</label>
              <input
                v-model="form.vatUserId"
                type="text"
                class="form-control idp-input font-monospace"
                placeholder="e.g. almadina_vat"
              />
            </div>

            <div class="col-md-6">
              <label class="form-label text-light small fw-medium mb-1">VAT Portal Password</label>
              <div class="position-relative">
                <input
                  v-model="form.vatPassword"
                  :type="showVatPassword ? 'text' : 'password'"
                  class="form-control idp-input font-monospace"
                  placeholder="Enter VAT password"
                  style="padding-right: 42px;"
                />
                <button
                  type="button"
                  class="btn btn-link position-absolute end-0 top-50 translate-middle-y text-muted text-decoration-none pe-3"
                  @click="showVatPassword = !showVatPassword"
                >
                  <i class="bi" :class="showVatPassword ? 'bi-eye-slash' : 'bi-eye'"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Modern Sleek Radio Cards for Service Scope -->
          <div class="mb-2">
            <label class="form-label text-light small fw-medium mb-2">VAT Service Scope</label>
            <div class="row g-3">
              <div class="col-md-6">
                <div
                  class="scope-card p-3 cursor-pointer"
                  :class="{ 'scope-card-active': form.vatServiceType === 'FULL' }"
                  @click="form.vatServiceType = 'FULL'"
                >
                  <div class="d-flex align-items-center justify-content-between mb-2">
                    <span class="fw-bold text-white small">
                      <i class="bi bi-check2-circle text-primary me-1"></i>
                      Full VAT Advisory & Monthly Return
                    </span>
                    <i
                      class="bi"
                      :class="form.vatServiceType === 'FULL' ? 'bi-check-circle-fill text-primary fs-5' : 'bi-circle text-secondary'"
                    ></i>
                  </div>
                  <p class="text-muted small mb-0">
                    Complete purchase/sales ledgers (Mushak 6.1, 6.2, 6.3), treasury challans, and 9.1 return filing.
                  </p>
                </div>
              </div>

              <div class="col-md-6">
                <div
                  class="scope-card p-3 cursor-pointer"
                  :class="{ 'scope-card-active': form.vatServiceType === 'ONLY_RETURN' }"
                  @click="form.vatServiceType = 'ONLY_RETURN'"
                >
                  <div class="d-flex align-items-center justify-content-between mb-2">
                    <span class="fw-bold text-white small">
                      <i class="bi bi-file-earmark-arrow-up text-info me-1"></i>
                      Only Monthly Return Filing
                    </span>
                    <i
                      class="bi"
                      :class="form.vatServiceType === 'ONLY_RETURN' ? 'bi-check-circle-fill text-primary fs-5' : 'bi-circle text-secondary'"
                    ></i>
                  </div>
                  <p class="text-muted small mb-0">
                    Simplified monthly 9.1 submission only based on client-provided summary numbers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ── TAB 4: USER ASSIGNMENTS ── -->
        <div v-if="activeTab === 'managers'">
          <h5 class="text-white fw-bold mb-2 d-flex align-items-center gap-2 border-bottom border-secondary border-opacity-50 pb-2">
            <i class="bi bi-person-check text-primary"></i> Responsible Team Users / Managers
          </h5>
          <p class="text-muted small mb-4">
            Select which firm team members will manage this client's purchases, sales, and return submissions. By default, unassigned clients belong to the Firm Admin.
          </p>

          <div v-if="assignableUsers.length === 0" class="text-center py-4 text-muted">
            <i class="bi bi-people fs-2 d-block mb-2"></i>
            No team users found. Manage team members in the Users module.
          </div>

          <div v-else class="row g-3">
            <div
              v-for="u in assignableUsers"
              :key="u.id"
              class="col-md-6 col-lg-4"
            >
              <div
                class="user-card p-3 cursor-pointer d-flex align-items-center justify-content-between"
                :class="{ 'user-card-active': form.managerIds.includes(u.id) }"
                @click="toggleManager(u.id)"
              >
                <div class="d-flex align-items-center gap-3">
                  <div class="avatar-circle">
                    {{ u.name.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <div class="fw-semibold text-white small">{{ u.name }}</div>
                    <div class="text-muted small font-monospace">{{ u.email }}</div>
                  </div>
                </div>
                <div>
                  <i
                    class="bi"
                    :class="form.managerIds.includes(u.id) ? 'bi-check-circle-fill text-primary fs-5' : 'bi-circle text-secondary'"
                  ></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Step Navigation & Submit -->
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 pt-2">
        <div>
          <button
            v-if="activeTab !== 'basic'"
            type="button"
            class="btn btn-outline-secondary btn-sm px-3"
            @click="activeTab = activeTab === 'managers' ? 'vat' : activeTab === 'vat' ? 'contact' : 'basic'"
          >
            <i class="bi bi-arrow-left me-1"></i> Previous Step
          </button>
        </div>

        <div class="d-flex align-items-center gap-2">
          <button
            v-if="activeTab !== 'managers'"
            type="button"
            class="btn btn-outline-primary btn-sm px-3"
            @click="activeTab = activeTab === 'basic' ? 'contact' : activeTab === 'contact' ? 'vat' : 'managers'"
          >
            <span>Next Step</span> <i class="bi bi-arrow-right ms-1"></i>
          </button>

          <button
            type="button"
            class="btn btn-primary btn-sm px-4 fw-semibold shadow-sm d-flex align-items-center gap-2"
            :disabled="isSubmitting"
            @click="handleSubmit"
          >
            <span v-if="isSubmitting" class="spinner-border spinner-border-sm" role="status"></span>
            <i v-else class="bi bi-check2"></i>
            <span>{{ isEditMode ? 'Update Client' : 'Save Client Organization' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.client-form-page {
  width: 100%;
}

.settings-tabs-wrapper {
  border-bottom: 1px solid #343a40;
  padding-bottom: 0.5rem;
}

.settings-tabs-wrapper .nav-link {
  color: #adb5bd;
  background: #212529;
  border: 1px solid #343a40;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.45rem 1rem;
  transition: all 0.15s ease;
}

.settings-tabs-wrapper .nav-link:hover {
  color: #fff;
  background: #2c3238;
}

.settings-tabs-wrapper .nav-link.active {
  color: #fff;
  background: #0d6efd;
  border-color: #0d6efd;
}

.idp-card {
  background: #1e2227;
  border: 1px solid #343a40;
  border-radius: 8px;
}

.idp-input {
  background-color: #15181c !important;
  border: 1px solid #3a4149 !important;
  color: #f8f9fa !important;
  border-radius: 6px;
}

.idp-input:focus {
  border-color: #0d6efd !important;
  box-shadow: 0 0 0 0.2rem rgba(13, 110, 253, 0.25) !important;
}

.cursor-pointer {
  cursor: pointer;
}

.scope-card {
  background: #15181c;
  border: 1px solid #343a40;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.scope-card:hover {
  border-color: #495057;
  background: #1a1e24;
}

.scope-card-active {
  border-color: #0d6efd !important;
  background: #192434 !important;
}

.user-card {
  background: #15181c;
  border: 1px solid #343a40;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.user-card:hover {
  border-color: #495057;
  background: #1a1e24;
}

.user-card-active {
  border-color: #0d6efd !important;
  background: #192434 !important;
}

.avatar-circle {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #0d6efd;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
}
</style>
