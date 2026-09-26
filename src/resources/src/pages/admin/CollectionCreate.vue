<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useBillingApi, type Bill } from "@/composables/useBillingApi";
import { useClientsApi } from "@/composables/useClientsApi";
import { useToast } from "@/composables/useToast";

const router = useRouter();
const route = useRoute();
const toast = useToast();

const { createCollection, fetchBills, fetchClientBillingOverview } = useBillingApi();
const { clients, fetchClients } = useClientsApi();

const searchContainerRef = ref<HTMLElement | null>(null);
const selectedClientId = ref<number | null>(null);
const clientSearchText = ref("");
const isSearchDropdownOpen = ref(false);

const handleClickOutside = (event: MouseEvent) => {
  if (searchContainerRef.value && !searchContainerRef.value.contains(event.target as Node)) {
    isSearchDropdownOpen.value = false;
  }
};

const selectedBillId = ref<number | null>(null);
const clientBills = ref<Bill[]>([]);
const clientOverview = ref<any>(null);

const collectionDate = ref(new Date().toISOString().slice(0, 10));
const amount = ref<number>(0);
const paymentMethod = ref<"cash" | "bank" | "cheque" | "bkash" | "nagad" | "rocket" | "other">("cash");
const referenceNo = ref("");
const notes = ref("");
const isSaving = ref(false);

const filteredClients = computed(() => {
  if (!clientSearchText.value.trim()) return clients.value.filter((c) => c.isActive);
  const q = clientSearchText.value.toLowerCase().trim();
  return clients.value.filter(
    (c) =>
      c.isActive &&
      (c.companyName.toLowerCase().includes(q) ||
        (c.binNumber && c.binNumber.toLowerCase().includes(q)) ||
        (c.mobile && c.mobile.toLowerCase().includes(q)))
  );
});

const loadClientDetails = async () => {
  if (!selectedClientId.value) {
    clientOverview.value = null;
    clientBills.value = [];
    selectedBillId.value = null;
    return;
  }

  try {
    const [overviewData, billsData] = await Promise.all([
      fetchClientBillingOverview(selectedClientId.value),
      fetchBills({ clientId: selectedClientId.value, status: "unpaid" })
    ]);
    clientOverview.value = overviewData;
    clientBills.value = billsData.data || [];

    // If client has previous due, prefill amount with due
    if (overviewData.previousDue > 0 && amount.value === 0) {
      amount.value = overviewData.previousDue;
    }
  } catch (err: any) {
    toast.error("Failed to load client details");
  }
};

onMounted(async () => {
  document.addEventListener("click", handleClickOutside);
  await fetchClients();

  if (route.query.clientId) {
    selectedClientId.value = Number(route.query.clientId);
    const matched = clients.value.find((c) => c.id === selectedClientId.value);
    if (matched) clientSearchText.value = matched.companyName;
  }
  if (route.query.billId) {
    selectedBillId.value = Number(route.query.billId);
  }

  if (selectedClientId.value) {
    await loadClientDetails();
  }
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});

watch(selectedClientId, () => {
  loadClientDetails();
});

const selectClient = (c: any) => {
  selectedClientId.value = c.id;
  clientSearchText.value = c.companyName;
  isSearchDropdownOpen.value = false;
};

const currentDue = computed(() => {
  return clientOverview.value?.previousDue || 0;
});

const remainingDue = computed(() => {
  const entered = Number(amount.value) || 0;
  return Math.max(0, currentDue.value - entered);
});

const handleSaveCollection = async () => {
  if (!selectedClientId.value) {
    toast.error("Please select a client");
    return;
  }
  if (!amount.value || amount.value <= 0) {
    toast.error("Please enter a valid collection amount");
    return;
  }

  isSaving.value = true;
  try {
    await createCollection({
      clientId: selectedClientId.value,
      billId: selectedBillId.value || null,
      collectionDate: collectionDate.value,
      amount: Number(amount.value),
      paymentMethod: paymentMethod.value,
      referenceNo: referenceNo.value || null,
      notes: notes.value || null
    });
    router.push("/admin/billing");
  } catch (err: any) {
    // Toast already shown
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="collection-create-page py-3">
    <!-- Header with Breadcrumbs -->
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/admin/billing" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Back to Invoices & Collections
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">Receive Payment</span>
        </div>
        <h4 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
          <i class="bi bi-cash-coin text-success"></i>
          <span>Record Money Receipt (Collection)</span>
        </h4>
      </div>

      <div class="d-flex align-items-center gap-2">
        <button
          type="button"
          class="btn btn-outline-secondary btn-sm px-3"
          @click="router.push('/admin/billing')"
        >
          Cancel
        </button>
        <button
          type="button"
          class="btn btn-success btn-sm px-4 fw-semibold d-flex align-items-center gap-1 shadow-sm"
          :disabled="isSaving || !selectedClientId || amount <= 0"
          @click="handleSaveCollection"
        >
          <span v-if="isSaving" class="spinner-border spinner-border-sm me-1"></span>
          <i v-else class="bi bi-check2-circle"></i>
          <span>Save Money Receipt</span>
        </button>
      </div>
    </div>

    <div class="row g-4">
      <!-- Left Column: Client & Payment Details -->
      <div class="col-md-7">
        <!-- 1. Client Selection Card -->
        <div class="idp-card p-4 mb-4">
          <h6 class="text-white fw-bold mb-3 border-bottom border-secondary border-opacity-25 pb-2 d-flex align-items-center gap-2">
            <span class="badge bg-primary rounded-circle">1</span>
            <span>Client Information</span>
          </h6>

          <div ref="searchContainerRef" class="position-relative mb-3">
            <label class="form-label text-secondary small fw-semibold">
              Select Client Organization <span class="text-danger">*</span>
            </label>
            <div class="search-input-group position-relative">
              <i class="bi bi-search position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
              <input
                v-model="clientSearchText"
                type="text"
                class="form-control idp-input ps-5"
                placeholder="Search by company name, BIN, or mobile..."
                @focus="isSearchDropdownOpen = true"
              />
              <button
                v-if="clientSearchText"
                type="button"
                class="btn-clear position-absolute top-50 end-0 translate-middle-y me-2"
                @click="clientSearchText = ''; selectedClientId = null;"
              >
                <i class="bi bi-x"></i>
              </button>
            </div>

            <!-- Dropdown Results -->
            <div
              v-if="isSearchDropdownOpen && filteredClients.length > 0"
              class="search-dropdown-menu shadow-lg"
            >
              <div
                v-for="c in filteredClients"
                :key="c.id"
                class="search-item p-2 border-bottom border-secondary border-opacity-25 cursor-pointer"
                @click="selectClient(c)"
              >
                <div class="fw-bold text-light">{{ c.companyName }}</div>
                <div class="small text-muted font-monospace">
                  BIN: {{ c.binNumber || 'N/A' }} • Mobile: {{ c.mobile || 'N/A' }}
                </div>
              </div>
            </div>
          </div>

          <!-- Client Details & Outstanding Balance Banner -->
          <div v-if="clientOverview?.client" class="client-detail-banner p-3 rounded border border-secondary border-opacity-50">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div>
                <div class="fw-bold text-light fs-6">{{ clientOverview.client.companyName }}</div>
                <div class="text-muted small font-monospace">BIN: {{ clientOverview.client.binNumber || 'N/A' }}</div>
              </div>
              <div class="text-end">
                <span class="text-secondary small d-block">Current Total Due</span>
                <span class="fw-bold font-monospace fs-5 text-danger">{{ currentDue.toFixed(2) }} Tk</span>
              </div>
            </div>
          </div>

          <!-- Link to Specific Bill (Optional) -->
          <div v-if="clientBills.length > 0" class="mt-3">
            <label class="form-label text-secondary small fw-semibold">
              Link to Specific Unpaid Invoice (Optional)
            </label>
            <select v-model="selectedBillId" class="form-select idp-input font-monospace">
              <option :value="null">-- General Account Payment (Auto-adjust against oldest dues) --</option>
              <option
                v-for="b in clientBills"
                :key="b.id"
                :value="b.id"
              >
                {{ b.billNo }} ({{ b.taxPeriod }}) — Due: {{ b.dueAmount.toFixed(2) }} Tk
              </option>
            </select>
          </div>
        </div>

        <!-- 2. Payment Details Card -->
        <div class="idp-card p-4">
          <h6 class="text-white fw-bold mb-3 border-bottom border-secondary border-opacity-25 pb-2 d-flex align-items-center gap-2">
            <span class="badge bg-primary rounded-circle">2</span>
            <span>Payment Method & Transaction</span>
          </h6>

          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label text-secondary small fw-semibold">
                Collection Date <span class="text-danger">*</span>
              </label>
              <input
                v-model="collectionDate"
                type="date"
                class="form-control idp-input font-monospace"
                required
              />
            </div>

            <div class="col-md-6">
              <label class="form-label text-secondary small fw-semibold">
                Payment Method <span class="text-danger">*</span>
              </label>
              <select v-model="paymentMethod" class="form-select idp-input">
                <option value="cash">Cash in Hand</option>
                <option value="bank">Bank Transfer / Deposit</option>
                <option value="cheque">Bank Cheque</option>
                <option value="bkash">bKash (MFS)</option>
                <option value="nagad">Nagad (MFS)</option>
                <option value="rocket">Rocket (MFS)</option>
                <option value="other">Other Payment</option>
              </select>
            </div>

            <div class="col-md-12">
              <label class="form-label text-secondary small fw-semibold">
                Received Amount (Tk) <span class="text-danger">*</span>
              </label>
              <div class="input-group">
                <span class="input-group-text bg-dark border-secondary text-secondary">Tk</span>
                <input
                  v-model.number="amount"
                  type="number"
                  step="any"
                  min="1"
                  class="form-control form-control-lg idp-input font-monospace fw-bold text-success"
                  placeholder="0.00"
                  required
                />
              </div>

              <!-- Quick Pay Shortcuts -->
              <div v-if="currentDue > 0" class="d-flex gap-2 mt-2">
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm py-0 px-2 small"
                  @click="amount = currentDue"
                >
                  Pay Full Due ({{ currentDue.toFixed(2) }})
                </button>
                <button
                  type="button"
                  class="btn btn-outline-secondary btn-sm py-0 px-2 small"
                  @click="amount = Math.round(currentDue / 2)"
                >
                  50% Partial ({{ (currentDue / 2).toFixed(2) }})
                </button>
              </div>
            </div>

            <div class="col-md-12">
              <label class="form-label text-secondary small fw-semibold">
                Reference / Transaction / Cheque No
              </label>
              <input
                v-model="referenceNo"
                type="text"
                class="form-control idp-input font-monospace"
                placeholder="e.g. Trx-889922, Cheque No: 994411, Deposit Slip..."
              />
            </div>

            <div class="col-md-12">
              <label class="form-label text-secondary small fw-semibold">
                Collection Remarks / Notes
              </label>
              <textarea
                v-model="notes"
                class="form-control idp-input"
                rows="3"
                placeholder="Payment received against August VAT compliance fee..."
              ></textarea>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Money Receipt Live Summary Card -->
      <div class="col-md-5">
        <div class="idp-card p-4">
          <h6 class="text-white fw-bold mb-3 border-bottom border-secondary border-opacity-25 pb-2 d-flex align-items-center gap-2">
            <i class="bi bi-file-earmark-medical text-info"></i>
            <span>Receipt Summary</span>
          </h6>

          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="text-secondary small">Previous Balance</span>
            <span class="font-monospace text-danger fw-bold">{{ currentDue.toFixed(2) }} Tk</span>
          </div>

          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="text-secondary small">Amount Being Collected</span>
            <span class="font-monospace text-success fw-bold fs-6">{{ (amount || 0).toFixed(2) }} Tk</span>
          </div>

          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="text-secondary small">Payment Mode</span>
            <span class="badge bg-secondary text-uppercase">{{ paymentMethod }}</span>
          </div>

          <hr class="border-secondary border-opacity-50 my-3" />

          <div class="d-flex justify-content-between align-items-center">
            <span class="fw-bold text-white fs-6">Remaining Due</span>
            <span class="fw-bold font-monospace fs-5" :class="remainingDue > 0 ? 'text-warning' : 'text-success'">
              {{ remainingDue.toFixed(2) }} Tk
            </span>
          </div>

          <div class="mt-4 d-grid gap-2">
            <button
              type="button"
              class="btn btn-success fw-semibold py-2 shadow-sm d-flex align-items-center justify-content-center gap-2"
              :disabled="isSaving || !selectedClientId || amount <= 0"
              @click="handleSaveCollection"
            >
              <span v-if="isSaving" class="spinner-border spinner-border-sm"></span>
              <i v-else class="bi bi-printer"></i>
              <span>Save & Issue Money Receipt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.collection-create-page {
  max-width: 1200px;
  margin: 0 auto;
}

.idp-card {
  background: #181b1f;
  border: 1px solid #343a40;
  border-radius: 8px;
}

.idp-input {
  background-color: #121418 !important;
  border: 1px solid #3b424b !important;
  color: #f8f9fa !important;
  border-radius: 6px;
}

.idp-input:focus {
  border-color: #3b8eed !important;
  box-shadow: 0 0 0 0.15rem rgba(59, 142, 237, 0.25) !important;
}

.search-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 1050;
  background: #1e2227;
  border: 1px solid #3b424b;
  border-radius: 6px;
  max-height: 250px;
  overflow-y: auto;
}

.search-item:hover {
  background: #282e36;
}

.client-detail-banner {
  background: #121418;
}

.cursor-pointer {
  cursor: pointer;
}

.btn-clear {
  background: transparent;
  border: none;
  color: #adb5bd;
  cursor: pointer;
}
</style>
