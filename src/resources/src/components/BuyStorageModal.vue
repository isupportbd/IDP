<script setup lang="ts">
import { ref, computed } from "vue";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/composables/useToast";
import axios from "axios";

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "purchased"): void;
  (e: "open-recharge"): void;
}>();

const authStore = useAuthStore();
const toast = useToast();

const selectedGb = ref<number>(1);
const paymentSource = ref<"wallet" | "bkash">("wallet");
const trxId = ref("");
const isSubmitting = ref(false);
const isCopied = ref(false);

const bkashNumber = "01719950891";
const bkashChargePercent = 1.8;
const ratePerGb = 1000;

const user = computed(() => authStore.user as any);

const isSubscriptionActive = computed(() => {
  return !!user.value?.isSubscriptionActive;
});

const totalCost = computed(() => {
  return (selectedGb.value || 1) * ratePerGb;
});

const bkashFee = computed(() => {
  return Math.round((totalCost.value * bkashChargePercent) / 100);
});

const bkashTotal = computed(() => {
  return totalCost.value + bkashFee.value;
});

const totalPayable = computed(() => {
  return paymentSource.value === "bkash" ? bkashTotal.value : totalCost.value;
});

const walletBalance = computed(() => {
  return Number(user.value?.advanceBalance || 0);
});

const hasSufficientWalletBalance = computed(() => {
  return walletBalance.value >= totalCost.value;
});

const walletShortage = computed(() => {
  return Math.max(0, totalCost.value - walletBalance.value);
});

const currentStorageMB = computed(() => {
  return Number(user.value?.totalStorageMB || (user.value?.plan?.maxStorageMB || 1024) + (user.value?.extraStorageMB || 0));
});

const newProjectedStorageMB = computed(() => {
  return currentStorageMB.value + (selectedGb.value * 1024);
});

const copyBkashNumber = async () => {
  try {
    await navigator.clipboard.writeText(bkashNumber);
    isCopied.value = true;
    toast.info("bKash number copied to clipboard!", 2500);
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch {}
};

const handleBuyStorage = async () => {
  if (!isSubscriptionActive.value) {
    toast.warning("Subscription is inactive. Please renew your plan before purchasing extra storage.", 4000);
    return;
  }

  if (!selectedGb.value || selectedGb.value <= 0) {
    toast.warning("Please select at least 1 GB of storage.", 3000);
    return;
  }

  if (paymentSource.value === "wallet" && !hasSufficientWalletBalance.value) {
    toast.warning(`Insufficient wallet balance. Shortage: ৳${walletShortage.value}. Please recharge your wallet first.`, 4000);
    return;
  }

  if (paymentSource.value === "bkash" && !trxId.value.trim()) {
    toast.warning("Please enter your bKash TrxID.", 3000);
    return;
  }

  isSubmitting.value = true;
  try {
    const res = await axios.post("/api/auth/buy-storage", {
      gigabytes: Number(selectedGb.value),
      paymentSource: paymentSource.value,
      trxId: trxId.value.trim().toUpperCase()
    });

    if (res.data?.success) {
      if (paymentSource.value === "wallet") {
        toast.success(`Successfully added +${selectedGb.value} GB extra storage!`, 4000);
      } else {
        toast.success("Storage purchase request submitted for verification!", 4000);
      }
      emit("purchased");
      close();
      await authStore.bootstrap(true);
    } else {
      toast.error(res.data?.message || "Storage purchase failed.", 3500);
    }
  } catch (err: any) {
    toast.error(err?.response?.data?.message || err?.message || "Failed to process storage purchase.", 4000);
  } finally {
    isSubmitting.value = false;
  }
};

const close = () => {
  emit("update:modelValue", false);
};

const triggerRecharge = () => {
  close();
  emit("open-recharge");
  window.dispatchEvent(new CustomEvent("open-wallet-recharge"));
};
</script>

<template>
  <div
    v-if="modelValue"
    class="modal fade show d-block"
    tabindex="-1"
    style="background: rgba(0, 0, 0, 0.8); z-index: 1060;"
  >
    <div class="modal-dialog modal-dialog-centered" style="max-width: 520px;">
      <div class="modal-content idp-modal-card shadow-lg border-primary">
        <!-- Header -->
        <div class="modal-header border-secondary border-opacity-25 pb-3">
          <div class="d-flex align-items-center gap-2">
            <div class="icon-box-head">
              <i class="bi bi-hdd-stack-fill text-primary fs-5"></i>
            </div>
            <div>
              <h5 class="modal-title text-white fw-bold mb-0 fs-6">Buy Extra Database Storage</h5>
              <div class="text-muted small"><span class="currency-symbol">৳</span>1,000 per 1 GB · Permanent / Lifetime Add-on</div>
            </div>
          </div>
          <button type="button" class="btn-close btn-close-white" @click="close"></button>
        </div>

        <!-- Body -->
        <div class="modal-body p-4">
          <!-- Inactive Subscription Warning Block -->
          <div v-if="!isSubscriptionActive" class="alert alert-danger d-flex align-items-center gap-2 mb-3 py-2 px-3 small">
            <i class="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
            <div>
              <strong>Subscription Inactive:</strong> Extra storage can only be purchased while your subscription plan is active. Please renew your plan first.
            </div>
          </div>

          <!-- Current Storage Overview Card -->
          <div class="overview-card p-3 rounded mb-3">
            <div class="d-flex justify-content-between align-items-center mb-1 small">
              <span class="text-muted">Current Storage Quota</span>
              <span class="text-white fw-bold font-monospace">
                {{ user?.usedStorageMB || 0 }} MB / {{ currentStorageMB }} MB
              </span>
            </div>
            <div class="progress mb-2" style="height: 6px; background-color: #1e293b;">
              <div
                class="progress-bar"
                :class="(user?.storageUsagePercent || 0) >= 90 ? 'bg-danger' : 'bg-primary'"
                role="progressbar"
                :style="{ width: `${Math.min(100, Math.max(user?.storageUsagePercent || 0, 4))}%` }"
              ></div>
            </div>
            <div class="d-flex justify-content-between align-items-center small text-muted">
              <span>Usage: <strong class="text-white">{{ user?.storageUsagePercent || 0 }}%</strong></span>
              <span>After Add-on: <strong class="text-success font-monospace">{{ newProjectedStorageMB }} MB</strong> (+{{ selectedGb * 1024 }} MB)</span>
            </div>
          </div>

          <!-- Step 1: Select Storage Size -->
          <div class="mb-3">
            <label class="form-label text-muted small fw-semibold mb-2">SELECT EXTRA STORAGE (GB)</label>
            <div class="row g-2">
              <div
                v-for="gb in [1, 2, 5]"
                :key="gb"
                class="col-4"
              >
                <div
                  class="gb-selector-card p-2.5 rounded text-center cursor-pointer"
                  :class="{ 'gb-selector-active': selectedGb === gb }"
                  @click="selectedGb = gb"
                >
                  <div class="fw-bold text-white fs-6">+{{ gb }} GB</div>
                  <div class="text-primary small fw-semibold font-monospace"><span class="currency-symbol">৳</span>{{ (gb * 1000).toLocaleString() }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Step 2: Payment Source -->
          <div class="mb-3">
            <label class="form-label text-muted small fw-semibold mb-2">PAYMENT METHOD</label>
            <div class="d-flex gap-2 mb-2">
              <button
                type="button"
                class="btn btn-sm flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                :class="paymentSource === 'wallet' ? 'btn-primary' : 'btn-outline-secondary'"
                @click="paymentSource = 'wallet'"
              >
                <i class="bi bi-wallet2"></i> Pay from Wallet
              </button>
              <button
                type="button"
                class="btn btn-sm flex-grow-1 d-flex align-items-center justify-content-center gap-2"
                :class="paymentSource === 'bkash' ? 'btn-primary' : 'btn-outline-secondary'"
                @click="paymentSource = 'bkash'"
              >
                <i class="bi bi-phone"></i> bKash Direct
              </button>
            </div>

            <!-- Option A: Wallet Info -->
            <div v-if="paymentSource === 'wallet'" class="payment-info-box p-3 rounded">
              <div class="d-flex justify-content-between align-items-center mb-1 small">
                <span class="text-muted">Available Wallet Balance:</span>
                <span class="text-white fw-bold font-monospace"><span class="currency-symbol">৳</span>{{ walletBalance.toLocaleString() }}</span>
              </div>
              <div class="d-flex justify-content-between align-items-center mb-2 small">
                <span class="text-muted">Total Storage Cost:</span>
                <span class="text-warning fw-bold font-monospace"><span class="currency-symbol">৳</span>{{ totalCost.toLocaleString() }}</span>
              </div>

              <div v-if="hasSufficientWalletBalance" class="d-flex align-items-center gap-2 text-success small pt-1 border-top border-secondary border-opacity-25">
                <i class="bi bi-check-circle-fill"></i>
                <span>Sufficient balance. Storage will be activated instantly upon payment.</span>
              </div>
              <div v-else class="text-danger small pt-1 border-top border-secondary border-opacity-25 d-flex justify-content-between align-items-center">
                <span>Shortage: <strong><span class="currency-symbol">৳</span>{{ walletShortage.toLocaleString() }}</strong></span>
                <button
                  type="button"
                  class="btn btn-xs btn-outline-warning py-0.5 px-2 small"
                  @click="triggerRecharge"
                >
                  <i class="bi bi-plus-circle me-1"></i> Recharge Wallet
                </button>
              </div>
            </div>

            <!-- Option B: Direct bKash TrxID -->
            <div v-else class="payment-info-box p-3 rounded">
              <div class="d-flex justify-content-between align-items-center mb-2 small">
                <span class="text-muted">Send Money (Personal):</span>
                <div class="d-flex align-items-center gap-2">
                  <span class="text-white fw-bold font-monospace">{{ bkashNumber }}</span>
                  <button type="button" class="btn btn-xs btn-outline-secondary py-0 px-1.5" @click="copyBkashNumber">
                    <i class="bi" :class="isCopied ? 'bi-check-lg text-success' : 'bi-copy'"></i>
                  </button>
                </div>
              </div>

              <!-- Breakdown -->
              <div class="d-flex justify-content-between align-items-center mb-1 small">
                <span class="text-muted">Storage Price ({{ selectedGb }} GB):</span>
                <span class="text-white font-monospace"><span class="currency-symbol">৳</span>{{ totalCost.toLocaleString() }}</span>
              </div>
              <div class="d-flex justify-content-between align-items-center mb-2 small">
                <span class="text-muted">bKash Cashout Fee ({{ bkashChargePercent }}%):</span>
                <span class="text-danger font-monospace">+<span class="currency-symbol">৳</span>{{ bkashFee.toLocaleString() }}</span>
              </div>
              <div class="d-flex justify-content-between align-items-center mb-3 pt-1 border-top border-secondary border-opacity-25 small">
                <span class="text-light fw-semibold">Total Amount to Send:</span>
                <span class="text-warning fw-bold font-monospace fs-6"><span class="currency-symbol">৳</span>{{ bkashTotal.toLocaleString() }}</span>
              </div>

              <div>
                <label class="form-label text-muted small mb-1">bKash Transaction ID (TrxID) <span class="text-danger">*</span></label>
                <input
                  v-model="trxId"
                  type="text"
                  class="form-control form-control-sm font-monospace idp-input"
                  placeholder="e.g. BL92XK891Q"
                />
              </div>
            </div>
          </div>

          <!-- Total Summary Bar -->
          <div class="d-flex justify-content-between align-items-center p-2.5 rounded bg-dark border border-secondary border-opacity-25">
            <span class="text-muted small">Total Payable {{ paymentSource === 'bkash' ? '(inc. 1.8% bKash fee)' : '' }}:</span>
            <span class="text-white fw-bold fs-5 font-monospace"><span class="currency-symbol">৳</span>{{ totalPayable.toLocaleString() }}</span>
          </div>
        </div>

        <!-- Footer -->
        <div class="modal-footer border-secondary border-opacity-25 py-2.5">
          <button type="button" class="btn btn-outline-secondary btn-sm px-3" @click="close">
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm px-4 fw-semibold d-flex align-items-center gap-2"
            :disabled="isSubmitting || !isSubscriptionActive || (paymentSource === 'wallet' && !hasSufficientWalletBalance)"
            @click="handleBuyStorage"
          >
            <span v-if="isSubmitting" class="spinner-border spinner-border-sm"></span>
            <i v-else class="bi bi-lightning-charge-fill"></i>
            Confirm & Add Storage
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.currency-symbol {
  font-size: 0.76em;
  font-weight: 600;
  margin-right: 1.5px;
  opacity: 0.9;
  display: inline-block;
  vertical-align: baseline;
}
.idp-modal-card {
  background: #14181e;
  border-radius: 8px;
}

.icon-box-head {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: rgba(59, 130, 246, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.overview-card {
  background: #1e242d;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.gb-selector-card {
  background: #1e242d;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.2s ease;
}

.gb-selector-card:hover {
  background: rgba(59, 130, 246, 0.08);
  border-color: rgba(59, 130, 246, 0.4);
}

.gb-selector-active {
  background: rgba(59, 130, 246, 0.15) !important;
  border-color: #3b82f6 !important;
}

.payment-info-box {
  background: #1e242d;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.idp-input {
  background-color: #14181e !important;
  border: 1px solid rgba(255, 255, 255, 0.12) !important;
  color: #f8fafc !important;
}

.idp-input:focus {
  border-color: #3b82f6 !important;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
}

.cursor-pointer {
  cursor: pointer;
}
</style>
