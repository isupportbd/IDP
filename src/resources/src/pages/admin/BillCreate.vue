<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useBillingApi, type BillItem } from "@/composables/useBillingApi";
import { useClientsApi } from "@/composables/useClientsApi";
import { useToast } from "@/composables/useToast";
import ClientSearchSelect from "@/components/common/ClientSearchSelect.vue";

const router = useRouter();
const route = useRoute();
const toast = useToast();

const { createBill, fetchClientBillingOverview } = useBillingApi();
const { clients, fetchClients } = useClientsApi();

// Form States
const selectedClientId = ref<number | null>(null);
const billingMonth = ref("");
const billDate = ref(new Date().toISOString().slice(0, 10));
const dueDate = ref("");
const discountAmount = ref<number>(0);
const notes = ref("");
const isSaving = ref(false);

// Client overview & loaded data
const clientOverview = ref<any>(null);
const allowedMonths = ref<any[]>([]);
const items = ref<BillItem[]>([]);

// Load Client Overview when selectedClientId or billingMonth changes
const loadClientData = async () => {
  if (!selectedClientId.value) {
    clientOverview.value = null;
    allowedMonths.value = [];
    items.value = [];
    return;
  }

  try {
    const data = await fetchClientBillingOverview(selectedClientId.value, billingMonth.value);
    clientOverview.value = data;
    allowedMonths.value = data.allowedMonths || [];

    // If billingMonth is empty, pick the first allowed month
    if (!billingMonth.value && allowedMonths.value.length > 0) {
      billingMonth.value = allowedMonths.value[0].taxPeriod;
    }

    // Set suggested line items if items are empty
    if (data.suggestedItems && data.suggestedItems.length > 0) {
      items.value = data.suggestedItems.map((it: any) => ({
        serviceItemId: it.serviceItemId,
        itemName: it.itemName,
        unit: it.unit || "Month",
        qty: it.qty || 1,
        rateUsed: it.rateUsed,
        minimumChargeUsed: it.minimumChargeUsed || 0,
        calculatedAmount: it.calculatedAmount,
        finalAmount: it.finalAmount,
        notes: it.notes
      }));
    }
  } catch (err: any) {
    toast.error("Failed to load client billing details");
  }
};

onMounted(async () => {
  await fetchClients();

  // If query parameter has clientId or month
  if (route.query.clientId) {
    selectedClientId.value = Number(route.query.clientId);
  }
  if (route.query.month) {
    billingMonth.value = String(route.query.month);
  }

  if (selectedClientId.value) {
    await loadClientData();
  }
});

watch(selectedClientId, () => {
  loadClientData();
});

watch(billingMonth, () => {
  if (selectedClientId.value) {
    loadClientData();
  }
});

// Line items handling
const addLineItem = () => {
  items.value.push({
    serviceItemId: null,
    itemName: "Additional VAT Consultancy",
    unit: "Job",
    qty: 1,
    rateUsed: 1000,
    minimumChargeUsed: 0,
    calculatedAmount: 1000,
    finalAmount: 1000,
    notes: ""
  });
};

const removeLineItem = (index: number) => {
  if (items.value.length > 1) {
    items.value.splice(index, 1);
  }
};

const updateItemCalculation = (it: BillItem) => {
  const qty = Number(it.qty) || 0;
  const rate = Number(it.rateUsed) || 0;
  const minCharge = Number(it.minimumChargeUsed) || 0;
  const calculated = qty * rate;
  it.calculatedAmount = calculated;
  it.finalAmount = Math.max(calculated, minCharge);
};

// Totals Calculation
const subtotal = computed(() => {
  return items.value.reduce((acc, it) => acc + (Number(it.finalAmount) || 0), 0);
});

const previousDue = computed(() => {
  return clientOverview.value?.previousDue || 0;
});

const netPayable = computed(() => {
  const discount = Number(discountAmount.value) || 0;
  return Math.max(0, subtotal.value - discount + previousDue.value);
});

// Submit / Create Bill Action
const handleCreateBill = async (status: "finalized" | "draft" = "finalized") => {
  if (!selectedClientId.value) {
    toast.error("Please select a client organization");
    return;
  }
  if (!billingMonth.value) {
    toast.error("Please select a billing month with a finalized submission");
    return;
  }
  if (items.value.length === 0) {
    toast.error("At least one line item is required");
    return;
  }

  isSaving.value = true;
  try {
    await createBill({
      clientId: selectedClientId.value,
      referenceId: clientOverview.value?.client?.referenceId || null,
      taxPeriod: billingMonth.value,
      billDate: billDate.value,
      dueDate: dueDate.value || null,
      discountAmount: Number(discountAmount.value) || 0,
      notes: notes.value || null,
      status: status,
      items: items.value
    });

    router.push("/admin/billing");
  } catch (err: any) {
    // Toast is handled in useBillingApi composable
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="bill-create-page py-3">
    <!-- Header with Breadcrumbs & Action Buttons -->
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/admin/billing" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Back to Invoices
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">New Bill</span>
        </div>
        <h4 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
          <i class="bi bi-receipt-cutoff text-primary"></i> Create Client Invoice
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
          class="btn btn-secondary btn-sm px-3 fw-semibold"
          :disabled="isSaving || !selectedClientId"
          @click="handleCreateBill('draft')"
        >
          Save as Draft
        </button>
        <button
          type="button"
          class="btn btn-primary btn-sm px-4 fw-semibold d-flex align-items-center gap-1 shadow-sm"
          :disabled="isSaving || !selectedClientId || !billingMonth || !clientOverview?.targetMonthSubmission"
          @click="handleCreateBill('finalized')"
        >
          <span v-if="isSaving" class="spinner-border spinner-border-sm me-1"></span>
          <i v-else class="bi bi-check2-circle"></i>
          <span>Finalize Bill</span>
        </button>
      </div>
    </div>

    <!-- 1. Client Selection & Header Card -->
    <div class="idp-card p-4 mb-4">
      <h6 class="text-white fw-bold mb-3 border-bottom border-secondary border-opacity-25 pb-2 d-flex align-items-center gap-2">
        <span class="badge bg-primary rounded-circle">1</span>
        <span>Bill Header & Client Selection</span>
      </h6>

      <div class="row g-3">
        <!-- Client Search & Select -->
        <div class="col-md-6">
          <label class="form-label text-secondary small fw-semibold">
            Company / Client Organization <span class="text-danger">*</span>
          </label>
          <ClientSearchSelect
            v-model="selectedClientId"
            :clients="clients"
            placeholder="Type to search company name, BIN, or mobile..."
          />
        </div>

        <!-- Billing Month (Showing YYYY-MM — #SubmissionID) -->
        <div class="col-md-3">
          <label class="form-label text-secondary small fw-semibold">
            Billing Month <span class="text-danger">*</span>
          </label>
          <select
            v-model="billingMonth"
            class="form-select idp-input font-monospace"
            :disabled="!selectedClientId || allowedMonths.length === 0"
          >
            <option value="" disabled>
              {{ !selectedClientId ? 'Select client first' : allowedMonths.length === 0 ? 'No finalized submissions' : 'Select Month' }}
            </option>
            <option
              v-for="m in allowedMonths"
              :key="m.taxPeriod"
              :value="m.taxPeriod"
            >
              {{ m.label }} {{ m.isBilled ? '(Already Billed)' : '' }}
            </option>
          </select>
        </div>

        <!-- Bill Date -->
        <div class="col-md-3">
          <label class="form-label text-secondary small fw-semibold">
            Billing Date <span class="text-danger">*</span>
          </label>
          <input
            v-model="billDate"
            type="date"
            class="form-control idp-input font-monospace"
            required
          />
        </div>
      </div>

      <!-- Client Details Banner (If selected) -->
      <div v-if="clientOverview?.client" class="client-detail-banner p-3 mt-3 rounded border border-secondary border-opacity-50">
        <div class="row g-2 align-items-center">
          <div class="col-md-4">
            <div class="fw-bold text-white text-truncate" style="font-size: 0.95rem;">{{ clientOverview.client.companyName }}</div>
            <div class="text-info font-monospace small mt-0.5">
              <span class="text-muted">BIN:</span> {{ clientOverview.client.binNumber || 'N/A' }}
            </div>
          </div>
          <div class="col-md-2">
            <div class="text-muted small">Customer Type</div>
            <div class="text-light">{{ clientOverview.client.customerTypeName || 'Standard' }}</div>
          </div>
          <div class="col-md-2">
            <div class="text-muted small">Mobile Number</div>
            <div class="font-monospace text-light small">{{ clientOverview.client.mobile || 'N/A' }}</div>
          </div>
          <div class="col-md-2">
            <div class="text-muted small">Reference</div>
            <div class="text-light small text-truncate">
              {{ clientOverview.client.referenceName || 'Direct Acquisition' }}
            </div>
          </div>
          <div class="col-md-2 text-md-end">
            <div class="text-muted small">Previous Balance</div>
            <div class="fw-bold font-monospace fs-6" :class="previousDue > 0 ? 'text-danger' : 'text-success'">
              {{ previousDue > 0 ? `+${previousDue.toFixed(2)} Tk (Due)` : '0.00 Tk' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Submissions Verification Cards (VAT 9.1 + Future-Ready 4.3) -->
      <div v-if="selectedClientId && billingMonth" class="row g-3 mt-1">
        <!-- VAT Return 9.1 Status Card -->
        <div class="col-md-6">
          <div class="submission-check-card p-3 rounded border" :class="clientOverview?.targetMonthSubmission ? 'border-success bg-success bg-opacity-10' : 'border-danger bg-danger bg-opacity-10'">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div class="text-muted small fw-semibold">VAT Return (Mushak 9.1)</div>
                <div v-if="clientOverview?.targetMonthSubmission" class="text-success fw-bold mt-1">
                  <i class="bi bi-check-circle-fill me-1"></i>
                  Finalized Submission: <span class="font-monospace">#{{ clientOverview.targetMonthSubmission.submissionId }}</span>
                </div>
                <div v-else class="text-danger fw-bold mt-1">
                  <i class="bi bi-x-circle-fill me-1"></i> No finalized VAT return for {{ billingMonth }}
                </div>
              </div>
              <span class="badge" :class="clientOverview?.targetMonthSubmission ? 'bg-success' : 'bg-danger'">
                {{ clientOverview?.targetMonthSubmission ? 'Ready to Bill' : 'Submission Required' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Mushak 4.3 Future-Ready Card -->
        <div class="col-md-6">
          <div class="submission-check-card p-3 rounded border border-secondary border-opacity-25 bg-dark bg-opacity-50">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <div class="text-muted small fw-semibold">Mushak 4.3 (Price Declaration)</div>
                <div class="text-muted small mt-1">
                  <i class="bi bi-info-circle me-1"></i> No Mushak 4.3 declarations for {{ billingMonth }}
                </div>
              </div>
              <span class="badge bg-secondary bg-opacity-50 text-light">Standby</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. Service Line Items Table Card (Standard IDP ERP Table Design) -->
    <div class="table-card shadow-sm mb-4">
      <div class="px-3 py-2.5 bg-dark bg-opacity-40 border-bottom border-secondary border-opacity-25 d-flex justify-content-between align-items-center">
        <div class="d-flex align-items-center gap-2">
          <span class="badge bg-primary rounded-circle" style="width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem;">2</span>
          <span class="fw-bold text-white fs-6">Service Line Items & Calculations</span>
        </div>
        <button
          type="button"
          class="btn btn-primary btn-sm d-flex align-items-center gap-1.5 px-3 fw-semibold shadow-sm"
          style="height: 32px; font-size: 0.82rem;"
          @click="addLineItem"
        >
          <i class="bi bi-plus-lg"></i>
          <span>Add Line Item</span>
        </button>
      </div>

      <!-- Purchase Volume Info Banner (If purchases found) -->
      <div v-if="clientOverview?.purchaseVolume?.totalPurchaseKg > 0" class="px-3 py-2 bg-info bg-opacity-10 border-bottom border-info border-opacity-25 d-flex align-items-center justify-content-between">
        <div class="small text-info">
          <i class="bi bi-box-seam me-1.5"></i>
          <strong>Purchase Volume for {{ billingMonth }}:</strong>
          {{ clientOverview.purchaseVolume.totalPurchaseKg.toLocaleString() }} KG
          ({{ clientOverview.purchaseVolume.totalPurchaseMt.toLocaleString() }} Metric Tons)
        </div>
        <span class="badge bg-info bg-opacity-25 text-info border border-info border-opacity-25 font-monospace">
          Auto-computed into 6.2.1 Service Rate
        </span>
      </div>

      <!-- Standard Table -->
      <table class="table-custom">
        <thead>
          <tr>
            <th style="width: 5%;">#</th>
            <th style="width: 40%;">Service Item</th>
            <th style="width: 14%;">Unit</th>
            <th style="width: 12%; text-align: right;">Quantity</th>
            <th style="width: 14%; text-align: right;">Rate (Tk)</th>
            <th style="width: 15%; text-align: right;">Amount (Tk)</th>
            <th style="width: 5%; text-align: center;" class="d-print-none">Action</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="items.length === 0">
            <td colspan="7" class="text-center py-4 text-muted">
              Select client to load default items or click "Add Line Item".
            </td>
          </tr>
          <tr v-for="(it, idx) in items" :key="idx">
            <!-- Index -->
            <td class="text-muted small align-middle">{{ idx + 1 }}</td>

            <!-- Item Name -->
            <td class="align-middle">
              <input
                v-model="it.itemName"
                type="text"
                class="form-control table-cell-input fw-semibold text-white"
                placeholder="Service description"
                required
              />
            </td>

            <!-- Unit -->
            <td class="align-middle">
              <input
                v-model="it.unit"
                type="text"
                class="form-control table-cell-input text-light"
                placeholder="Month / MT / Job"
              />
            </td>

            <!-- Qty -->
            <td class="align-middle text-end">
              <input
                v-model.number="it.qty"
                type="number"
                step="any"
                class="form-control table-cell-input text-end font-monospace text-light ms-auto"
                style="max-width: 100px;"
                @input="updateItemCalculation(it)"
              />
            </td>

            <!-- Rate -->
            <td class="align-middle text-end">
              <input
                v-model.number="it.rateUsed"
                type="number"
                step="any"
                class="form-control table-cell-input text-end font-monospace text-light ms-auto"
                style="max-width: 120px;"
                @input="updateItemCalculation(it)"
              />
            </td>

            <!-- Final Amount -->
            <td class="align-middle text-end">
              <div class="font-monospace fw-bold text-white pe-1">
                {{ (Number(it.finalAmount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </div>
            </td>

            <!-- Action -->
            <td class="align-middle text-center d-print-none">
              <button
                type="button"
                class="btn btn-sm btn-link text-danger p-1 text-decoration-none"
                title="Remove Item"
                :disabled="items.length <= 1"
                @click="removeLineItem(idx)"
              >
                <i class="bi bi-trash fs-6"></i>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 3. Totals & Notes Section -->
    <div class="row g-4">
      <div class="col-md-7">
        <div class="idp-card p-4 h-100">
          <h6 class="text-white fw-bold mb-3 border-bottom border-secondary border-opacity-25 pb-2 d-flex align-items-center gap-2">
            <span class="badge bg-primary rounded-circle">3</span>
            <span>Invoice Notes & Remarks</span>
          </h6>
          <textarea
            v-model="notes"
            rows="5"
            class="form-control idp-input"
            placeholder="Enter payment instructions, bank account details, or terms..."
          ></textarea>
        </div>
      </div>

      <div class="col-md-5">
        <div class="idp-card p-4 h-100">
          <h6 class="text-white fw-bold mb-3 border-bottom border-secondary border-opacity-25 pb-2">
            Payment & Total Summary
          </h6>

          <div class="d-flex justify-content-between align-items-center py-2 border-bottom border-secondary border-opacity-25">
            <span class="text-secondary small">Current Subtotal</span>
            <span class="font-monospace text-light fw-semibold">{{ subtotal.toFixed(2) }} Tk</span>
          </div>

          <div class="d-flex justify-content-between align-items-center py-2 border-bottom border-secondary border-opacity-25">
            <span class="text-secondary small">Special Discount</span>
            <div style="width: 140px;">
              <input
                v-model.number="discountAmount"
                type="number"
                min="0"
                step="any"
                class="form-control form-control-sm idp-input text-end font-monospace text-warning"
                placeholder="0.00"
              />
            </div>
          </div>

          <div class="d-flex justify-content-between align-items-center py-2 border-bottom border-secondary border-opacity-25">
            <span class="text-secondary small">Previous Balance / Due</span>
            <span class="font-monospace fw-semibold" :class="previousDue > 0 ? 'text-danger' : 'text-success'">
              {{ previousDue > 0 ? `+${previousDue.toFixed(2)} Tk` : '0.00 Tk' }}
            </span>
          </div>

          <div class="d-flex justify-content-between align-items-center py-3 mt-2 bg-dark bg-opacity-50 px-3 rounded border border-primary border-opacity-50">
            <span class="fw-bold text-white fs-6">Net Payable Amount</span>
            <span class="font-monospace fw-bold text-primary fs-5">{{ netPayable.toFixed(2) }} Tk</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bill-create-page {
  width: 100%;
}

.idp-card {
  background: #1e2227;
  border: 1px solid #343a40;
  border-radius: 8px;
}

.idp-input {
  background-color: #181b1f !important;
  border: 1px solid #3b424b !important;
  color: #f8f9fa !important;
  border-radius: 6px;
}

.idp-input:focus {
  border-color: #3b8eed !important;
  box-shadow: 0 0 0 0.15rem rgba(59, 142, 237, 0.25) !important;
}

.table-card {
  background: #1e2227;
  border: 1px solid #343a40;
  border-radius: 8px;
  overflow: hidden;
}

.table-custom {
  width: 100%;
  border-collapse: collapse;
}

.table-custom thead th {
  background: #181b1f;
  color: #adb5bd;
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid #343a40;
  white-space: nowrap;
}

.table-custom tbody td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #2a3038;
  vertical-align: middle;
}

.table-custom tbody tr:hover {
  background-color: #242930;
}

.table-cell-input {
  background-color: transparent !important;
  border: 1px solid transparent !important;
  color: #f8f9fa !important;
  border-radius: 4px;
  height: 32px;
  font-size: 0.88rem;
  padding: 0.25rem 0.5rem !important;
  transition: all 0.15s ease;
}

.table-cell-input:hover {
  background-color: rgba(24, 27, 31, 0.7) !important;
  border-color: #3b424b !important;
}

.table-cell-input:focus {
  background-color: #14171a !important;
  border-color: #0d6efd !important;
  box-shadow: 0 0 0 2px rgba(13, 110, 253, 0.25) !important;
}

.search-dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #1e2227;
  border: 1px solid #3b424b;
  border-radius: 6px;
  max-height: 250px;
  overflow-y: auto;
  z-index: 1050;
  margin-top: 4px;
}

.search-item:hover {
  background-color: #2a3038;
}

.cursor-pointer {
  cursor: pointer;
}

.client-detail-banner {
  background: #181b1f;
}

.btn-clear {
  background: transparent;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 0 4px;
}

.btn-clear:hover {
  color: #f8f9fa;
}
</style>
