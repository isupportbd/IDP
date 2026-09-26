<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import Header from "./Header.vue";
import WalletRechargeModal from "@/components/WalletRechargeModal.vue";
import { useAuthStore } from "@/stores/auth";

const showContactModal = ref(false);
const showRechargeModal = ref(false);
const authStore = useAuthStore();

const handleOpenRecharge = () => {
  showRechargeModal.value = true;
};

onMounted(() => {
  window.addEventListener("open-wallet-recharge", handleOpenRecharge);
});

onUnmounted(() => {
  window.removeEventListener("open-wallet-recharge", handleOpenRecharge);
});

const isSuperAdmin = computed(() => {
  const r = (authStore.user as any)?.role;
  return r === "superadmin" || (typeof r === "object" && (r?.name === "superadmin" || r?.slug === "superadmin"));
});

const isTenantAdmin = computed(() => {
  if (isSuperAdmin.value) return false;
  const user = authStore.user as any;
  if (!user) return false;
  const roleName = typeof user.role === "object" ? user.role?.name : user.role;
  return roleName === "admin" || !user.adminId;
});

const showSubscriptionAlert = computed(() => {
  if (!isTenantAdmin.value) return false;
  const user = authStore.user as any;
  if (!user || !user.planId) return false;
  return !user.isSubscriptionActive || (user.shortage && user.shortage > 0);
});
</script>

<template>
  <div class="idp-layout-wrapper">
    <!-- Top Navigation Header (Horizontal Line & Left/Right Vertical Lines) -->
    <Header @open-recharge="showRechargeModal = true" />

    <!-- Subscription Alert Banner for Insufficient Balance / Inactive Subscription -->
    <div
      v-if="showSubscriptionAlert"
      class="bg-danger bg-opacity-10 border-bottom border-danger py-2.5 px-3 text-white"
    >
      <div class="idp-grid-container d-flex flex-wrap align-items-center justify-content-between gap-3">
        <div class="d-flex align-items-center gap-3 small">
          <i class="bi bi-exclamation-triangle-fill text-danger fs-5 flex-shrink-0"></i>
          <div class="d-flex flex-wrap align-items-center gap-2">
            <span class="badge bg-danger text-white px-2.5 py-1 fw-bold">Insufficient Balance</span>
            <span>
              To activate your selected plan <strong>{{ (authStore.user as any)?.plan?.name || 'Standard' }}</strong> (৳{{ (authStore.user as any)?.planPrice || 0 }}), 
              a recharge of <strong class="text-warning">৳{{ (authStore.user as any)?.shortage || 0 }}</strong> is required. Current Wallet Balance: <strong>৳{{ ((authStore.user as any)?.advanceBalance || 0).toLocaleString() }}</strong>.
            </span>
          </div>
        </div>
        <button
          type="button"
          class="btn btn-sm btn-warning text-dark fw-bold px-3 py-1.5 shadow-sm d-inline-flex align-items-center gap-2 flex-shrink-0"
          @click="showRechargeModal = true"
        >
          <i class="bi bi-wallet2 fs-6"></i>
          <span>Recharge Wallet</span>
        </button>
      </div>
    </div>

    <!-- Main Content Body (Continuous Left/Right Vertical Lines) -->
    <main class="flex-grow-1 w-100 d-flex flex-column">
      <div class="idp-grid-container flex-grow-1 px-0 py-3 py-md-4">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>

    <!-- Bottom Footer (Horizontal Line & Left/Right Vertical Lines) -->
    <footer class="idp-footer">
      <div class="idp-grid-container h-100 d-flex align-items-center justify-content-between px-3">
        <span class="text-muted small fst-italic">
          &copy; idp 2026-2029 <span class="heart-icon">💖</span> created by <a href="https://isupportbd.com" target="_blank" class="text-primary text-decoration-none fw-normal">iSupportBD</a>
        </span>
        <div class="d-flex align-items-center gap-3">
          <a href="https://isupportbd.com" target="_blank" class="text-primary text-decoration-none small footer-link">About</a>
          <a href="https://wa.me/8801719950891" target="_blank" class="text-primary text-decoration-none small footer-link">Support</a>
          <a href="#" class="text-primary text-decoration-none small footer-link" @click.prevent="showContactModal = true">Contact Us</a>
        </div>
      </div>
    </footer>

    <!-- Contact Us Modal -->
    <div
      v-if="showContactModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.75);"
    >
      <div class="modal-dialog modal-dialog-centered" style="max-width: 440px;">
        <div class="modal-content idp-card shadow-lg border-primary">
          <div class="modal-header border-secondary">
            <h5 class="modal-title text-white fw-bold d-flex align-items-center gap-2">
              <i class="bi bi-headset text-primary"></i> Contact & Support
            </h5>
            <button type="button" class="btn-close btn-close-white" @click="showContactModal = false"></button>
          </div>
          <div class="modal-body p-4">
            <div class="text-center mb-4">
              <div class="fw-bold text-white fs-5 mb-1">iSupportBD</div>
              <p class="text-muted small mb-0">Software & VAT Consultation Support</p>
            </div>

            <div class="d-flex flex-column gap-3">
              <!-- Mobile & WhatsApp -->
              <div class="p-3 rounded bg-dark border border-secondary d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center gap-3">
                  <div class="card-icon bg-success bg-opacity-10 text-success p-2 rounded">
                    <i class="bi bi-whatsapp fs-4"></i>
                  </div>
                  <div>
                    <div class="text-muted small" style="font-size: 0.75rem;">Mobile / WhatsApp</div>
                    <div class="text-white fw-bold font-monospace">01719950891</div>
                  </div>
                </div>
                <div class="d-flex gap-2">
                  <a href="https://wa.me/8801719950891" target="_blank" class="btn btn-sm btn-success px-3 py-1.5" title="Chat on WhatsApp">
                    <i class="bi bi-whatsapp"></i>
                  </a>
                  <a href="tel:01719950891" class="btn btn-sm btn-outline-light px-3 py-1.5" title="Call Direct">
                    <i class="bi bi-telephone"></i>
                  </a>
                </div>
              </div>

              <!-- Email -->
              <div class="p-3 rounded bg-dark border border-secondary d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center gap-3">
                  <div class="card-icon bg-primary bg-opacity-10 text-primary p-2 rounded">
                    <i class="bi bi-envelope fs-4"></i>
                  </div>
                  <div>
                    <div class="text-muted small" style="font-size: 0.75rem;">Email</div>
                    <div class="text-light small font-monospace">isupportbd.info@gmail.com</div>
                  </div>
                </div>
                <a href="mailto:isupportbd.info@gmail.com" class="btn btn-sm btn-primary px-3 py-1.5" title="Send Email">
                  <i class="bi bi-send"></i>
                </a>
              </div>

              <!-- Website -->
              <div class="p-3 rounded bg-dark border border-secondary d-flex align-items-center justify-content-between">
                <div class="d-flex align-items-center gap-3">
                  <div class="card-icon bg-info bg-opacity-10 text-info p-2 rounded">
                    <i class="bi bi-globe fs-4"></i>
                  </div>
                  <div>
                    <div class="text-muted small" style="font-size: 0.75rem;">Official Website</div>
                    <div class="text-light small font-monospace">isupportbd.com</div>
                  </div>
                </div>
                <a href="https://isupportbd.com" target="_blank" class="btn btn-sm btn-outline-info px-3 py-1.5" title="Visit Website">
                  <i class="bi bi-box-arrow-up-right"></i>
                </a>
              </div>
            </div>

            <div class="mt-4 pt-3 border-top border-secondary text-center">
              <button type="button" class="btn btn-secondary btn-sm w-100" @click="showContactModal = false">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Wallet Recharge Modal for Tenants -->
    <WalletRechargeModal v-model="showRechargeModal" />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.footer-link:hover {
  text-decoration: underline !important;
}
</style>
