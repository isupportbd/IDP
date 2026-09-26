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
  (e: "recharged"): void;
}>();

const authStore = useAuthStore();
const toast = useToast();

const rechargeAmount = ref<number | null>(null);
const trxId = ref("");
const isSubmitting = ref(false);
const isCopied = ref(false);

const bkashNumber = "01719950891";
const bkashChargePercent = 1.8;

const user = computed(() => authStore.user as any);

const calculatedCharge = computed(() => {
  const amt = rechargeAmount.value || 0;
  return Math.round((amt * bkashChargePercent) / 100);
});

const netCredit = computed(() => {
  const amt = rechargeAmount.value || 0;
  return Math.max(0, amt - calculatedCharge.value);
});

const projectedBalance = computed(() => {
  return (user.value?.advanceBalance || 0) + netCredit.value;
});

const recommendedAmount = computed(() => {
  const shortage = user.value?.shortage || 0;
  if (shortage <= 0) return 500;
  return Math.ceil(shortage / (1 - bkashChargePercent / 100));
});

const fillRecommended = () => {
  rechargeAmount.value = recommendedAmount.value;
};

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

const handleRecharge = async () => {
  if (!rechargeAmount.value || rechargeAmount.value <= 0) {
    toast.warning("Please enter a valid recharge amount.", 3000);
    return;
  }

  if (!trxId.value.trim()) {
    toast.warning("Please enter the bKash TrxID.", 3000);
    return;
  }

  isSubmitting.value = true;
  try {
    const res = await axios.post("/api/auth/recharge-wallet", {
      paidAmount: Number(rechargeAmount.value),
      trxId: trxId.value.trim().toUpperCase()
    });

    if (res.data?.success) {
      toast.success("Recharge request submitted successfully! Your wallet balance will be credited once verified by SuperAdmin.", 4000);
      rechargeAmount.value = null;
      trxId.value = "";
      emit("recharged");
      close();
      await authStore.bootstrap(true);
    } else {
      toast.error(res.data?.message || "Recharge request failed.", 3500);
    }
  } catch (err: any) {
    toast.error(err?.response?.data?.message || err?.message || "Could not submit recharge request.", 3500);
  } finally {
    isSubmitting.value = false;
  }
};

const close = () => {
  emit("update:modelValue", false);
};
</script>

<template>
  <div
    v-if="modelValue"
    class="modal fade show d-block"
    tabindex="-1"
    style="background: rgba(0, 0, 0, 0.75); z-index: 1090;"
    @click.self="close"
  >
    <div class="modal-dialog modal-dialog-centered" style="max-width: 480px;">
      <div class="modal-content idp-card border-secondary shadow-lg">
        <div class="modal-header border-secondary py-3 px-4">
          <h5 class="modal-title text-white fw-bold d-flex align-items-center gap-2">
            <i class="bi bi-wallet2 text-primary"></i> Wallet Recharge
          </h5>
          <button type="button" class="btn-close btn-close-white" @click="close"></button>
        </div>

        <div class="modal-body p-4">
          <!-- Current Account Status Card -->
          <div class="card bg-dark border-secondary p-3 mb-3">
            <div class="d-flex justify-content-between align-items-center mb-2 small">
              <span class="text-muted">Selected Plan:</span>
              <strong class="text-white">{{ user?.plan?.name || 'Standard Plan' }} (৳{{ user?.planPrice || 0 }})</strong>
            </div>
            <div class="d-flex justify-content-between align-items-center mb-2 small">
              <span class="text-muted">Current Wallet Balance:</span>
              <strong class="text-success font-monospace">৳{{ (user?.advanceBalance || 0).toLocaleString() }}</strong>
            </div>
            <div v-if="user?.shortage > 0" class="d-flex justify-content-between align-items-center pt-2 mt-1 border-top border-secondary small">
              <span class="text-warning fw-semibold d-flex align-items-center gap-1">
                <i class="bi bi-exclamation-triangle-fill"></i> Shortage to Activate:
              </span>
              <strong class="text-warning fs-6 font-monospace">৳{{ user.shortage.toLocaleString() }}</strong>
            </div>
          </div>

          <!-- bKash Send Money Instruction Box -->
          <div class="card bg-dark border-secondary p-3 mb-3">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <div class="d-flex align-items-center gap-2">
                <span class="badge bg-danger text-white px-2 py-1" style="font-size: 0.7rem;">bKash</span>
                <span class="text-muted small">Send Money Number:</span>
              </div>
              <button
                v-if="user?.shortage > 0"
                type="button"
                class="btn btn-sm btn-outline-warning py-0.5 px-2"
                style="font-size: 0.75rem;"
                @click="fillRecommended"
              >
                <i class="bi bi-lightning-charge-fill me-1"></i>Pay Shortage ৳{{ recommendedAmount }}
              </button>
            </div>
            <div class="d-flex justify-content-between align-items-center pt-1 border-top border-secondary">
              <span class="text-white font-monospace fs-5 fw-bold">{{ bkashNumber }}</span>
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary text-light py-0.5 px-2"
                style="font-size: 0.75rem;"
                @click="copyBkashNumber"
              >
                <i class="bi" :class="isCopied ? 'bi-check2 text-success' : 'bi-clipboard'"></i>
                <span class="ms-1">{{ isCopied ? 'Copied' : 'Copy' }}</span>
              </button>
            </div>
          </div>

          <!-- Recharge Form -->
          <form @submit.prevent="handleRecharge">
            <div class="row g-3 mb-3">
              <div class="col-6">
                <label class="form-label small text-light">Amount Sent (Gross ৳) *</label>
                <input
                  v-model.number="rechargeAmount"
                  type="number"
                  class="form-control idp-input font-monospace text-white"
                  placeholder="e.g. 500"
                  required
                  min="10"
                />
              </div>
              <div class="col-6">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <label class="form-label small text-light mb-0">bKash TrxID *</label>
                  <span class="badge bg-danger text-white px-2 py-0.5" style="font-size: 0.68rem;">
                    Fee: {{ bkashChargePercent }}%
                  </span>
                </div>
                <input
                  v-model="trxId"
                  type="text"
                  class="form-control idp-input font-monospace text-uppercase"
                  placeholder="e.g. 8N3A5B2C"
                  required
                />
              </div>
            </div>

            <!-- Live Calculation Breakdown -->
            <div v-if="rechargeAmount && rechargeAmount > 0" class="card bg-dark border-secondary p-3 mb-3 small">
              <div class="d-flex justify-content-between text-muted mb-1" style="font-size: 0.78rem;">
                <span>bKash Fee ({{ bkashChargePercent }}%):</span>
                <span class="text-danger font-monospace">-৳{{ calculatedCharge }}</span>
              </div>
              <div class="d-flex justify-content-between text-white fw-semibold mb-1" style="font-size: 0.82rem;">
                <span>Net Wallet Credit:</span>
                <span class="text-success font-monospace">+৳{{ netCredit }}</span>
              </div>
              <div class="d-flex justify-content-between pt-1 border-top border-secondary text-info fw-bold" style="font-size: 0.85rem;">
                <span>New Wallet Balance:</span>
                <span class="font-monospace">৳{{ projectedBalance }}</span>
              </div>
            </div>

            <button
              type="submit"
              class="btn btn-idp-primary w-100 py-2 fw-bold d-flex align-items-center justify-content-center gap-2"
              :disabled="isSubmitting"
            >
              <i v-if="isSubmitting" class="spinner-border spinner-border-sm"></i>
              <i v-else class="bi bi-wallet2"></i>
              <span>{{ isSubmitting ? 'Submitting Request...' : 'Complete Recharge' }}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
