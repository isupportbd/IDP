<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";

interface ClientDetail {
  id: number;
  companyName: string;
  proprietorName?: string;
  mobile?: string;
  alternativeMobile?: string;
  email?: string;
  address?: string;
  binNumber?: string;
  tinNumber?: string;
  tradeLicenseNo?: string;
  customerTypeId?: number;
  customerTypeName?: string;
  referenceId?: number;
  referenceName?: string;
  vatUserId?: string;
  vatPassword?: string;
  vatServiceType?: string;
  openingBalance?: number;
  isActive: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  managers?: Array<{ id: number; name: string; email: string }>;
}

const route = useRoute();
const router = useRouter();
const clientId = computed(() => Number(route.params.id));

const client = ref<ClientDetail | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const showPassword = ref(false);
const copiedField = ref<string | null>(null);

const fetchClientData = async () => {
  if (!clientId.value || isNaN(clientId.value)) {
    error.value = "Invalid Client ID specified.";
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const res = await axios.get(`/api/clients/${clientId.value}`);
    if (res.data?.data) {
      client.value = res.data.data;
    } else {
      error.value = "Client not found in database.";
    }
  } catch (err: any) {
    error.value = err.response?.data?.message || "Failed to load client details.";
  } finally {
    loading.value = false;
  }
};

const copyToClipboard = async (text: string | undefined, fieldName: string) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    copiedField.value = fieldName;
    setTimeout(() => {
      if (copiedField.value === fieldName) {
        copiedField.value = null;
      }
    }, 2000);
  } catch (e) {
    console.error("Failed to copy:", e);
  }
};

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return iso;
  }
};

const printPage = () => {
  window.print();
};

onMounted(() => {
  fetchClientData();
});
</script>

<template>
  <div class="client-details-page py-3">
    <!-- Breadcrumb & Top Bar -->
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
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
          <span class="text-primary small fw-semibold">Client Profile</span>
        </div>
        <h4 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
          <i class="bi bi-building text-primary"></i>
          <span>{{ client?.companyName || 'Client Organization Details' }}</span>
        </h4>
      </div>

      <!-- Action Buttons -->
      <div class="d-flex align-items-center gap-2 no-print">
        <button
          type="button"
          class="btn btn-outline-secondary btn-sm px-3 d-flex align-items-center gap-1"
          @click="router.push('/admin/clients')"
        >
          <i class="bi bi-arrow-left"></i>
          <span>Back to List</span>
        </button>

        <button
          v-if="client"
          type="button"
          class="btn btn-outline-light btn-sm px-3 d-flex align-items-center gap-1 shadow-sm"
          @click="printPage"
        >
          <i class="bi bi-printer"></i>
          <span>Print Profile</span>
        </button>

        <router-link
          v-if="client"
          :to="`/admin/clients/${client.id}/edit`"
          class="btn btn-primary btn-sm px-3 fw-semibold d-flex align-items-center gap-1 shadow-sm"
        >
          <i class="bi bi-pencil-square"></i>
          <span>Edit Client</span>
        </router-link>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <div class="text-muted mt-2">Loading client profile and records...</div>
    </div>

    <!-- Error State -->
    <div v-else-if="error || !client" class="alert alert-danger bg-danger bg-opacity-10 border border-danger border-opacity-25 text-danger d-flex align-items-center gap-3 p-4 rounded shadow-sm">
      <i class="bi bi-exclamation-triangle-fill fs-2"></i>
      <div>
        <h5 class="fw-bold mb-1">Error Loading Client</h5>
        <p class="mb-0 small">{{ error || 'Client details could not be found.' }}</p>
      </div>
    </div>

    <!-- Client Content View -->
    <div v-else class="client-content">
      <!-- ── HERO HEADER CARD ────────────────────────────────────── -->
      <div class="idp-card p-4 mb-4 border border-secondary border-opacity-25 rounded shadow-sm">
        <div class="d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div class="d-flex align-items-start gap-3">
            <div class="client-avatar-badge shadow-sm">
              <i class="bi bi-building"></i>
            </div>
            <div>
              <div class="d-flex align-items-center gap-2 flex-wrap mb-2">
                <h3 class="text-white fw-bold mb-0">{{ client.companyName }}</h3>
                <span :class="client.isActive ? 'status-badge-active' : 'status-badge-inactive'">
                  <span class="status-dot" :style="client.isActive ? 'background: #20c997;' : 'background: #f87171;'"></span>
                  {{ client.isActive ? 'Active Organization' : 'Inactive' }}
                </span>
                <span v-if="client.customerTypeName" class="badge-customer-type">
                  {{ client.customerTypeName }}
                </span>
                <span v-if="client.vatServiceType" class="badge-scope">
                  Scope: {{ client.vatServiceType }}
                </span>
              </div>
              <div class="text-muted small d-flex flex-wrap align-items-center gap-3 mt-1">
                <span v-if="client.proprietorName">
                  <i class="bi bi-person text-secondary me-1"></i>
                  Proprietor: <strong class="text-light">{{ client.proprietorName }}</strong>
                </span>
                <span v-if="client.mobile">
                  <i class="bi bi-telephone text-secondary me-1"></i>
                  <a :href="`tel:${client.mobile}`" class="text-warning text-decoration-none font-monospace">{{ client.mobile }}</a>
                </span>
                <span v-if="client.email">
                  <i class="bi bi-envelope text-secondary me-1"></i>
                  <a :href="`mailto:${client.email}`" class="text-info text-decoration-none">{{ client.email }}</a>
                </span>
              </div>
            </div>
          </div>

          <!-- Opening Balance Display -->
          <div class="balance-card p-3 rounded bg-dark border border-secondary border-opacity-50 text-end">
            <div class="text-muted small mb-1">Opening Balance Status</div>
            <div
              v-if="client.openingBalance && client.openingBalance > 0"
              class="fs-5 fw-bold text-danger font-monospace"
            >
              -{{ client.openingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }) }} Tk
              <span class="badge bg-danger bg-opacity-20 text-danger border border-danger border-opacity-25 small ms-1">Due</span>
            </div>
            <div
              v-else-if="client.openingBalance && client.openingBalance < 0"
              class="fs-5 fw-bold text-success font-monospace"
            >
              +{{ Math.abs(client.openingBalance).toLocaleString('en-US', { minimumFractionDigits: 2 }) }} Tk
              <span class="badge bg-success bg-opacity-20 text-success border border-success border-opacity-25 small ms-1">Advance</span>
            </div>
            <div v-else class="fs-5 fw-bold text-muted font-monospace">
              0.00 Tk
            </div>
          </div>
        </div>
      </div>

      <!-- ── GRID OF DETAILED ATTRIBUTES ────────────────────────── -->
      <div class="row g-4">
        <!-- 1. Basic & Contact Information -->
        <div class="col-lg-6">
          <div class="idp-card p-4 h-100 border border-secondary border-opacity-25 rounded shadow-sm">
            <div class="card-title text-primary fw-bold mb-3 d-flex align-items-center gap-2 border-bottom border-secondary border-opacity-25 pb-2">
              <i class="bi bi-person-lines-fill"></i>
              <span>Basic & Contact Information</span>
            </div>

            <div class="detail-list d-flex flex-column gap-3">
              <div class="detail-row">
                <div class="label text-muted small">Company / Organization Name</div>
                <div class="value text-white fw-bold fs-6">{{ client.companyName }}</div>
              </div>

              <div class="detail-row">
                <div class="label text-muted small">Proprietor / Managing Director</div>
                <div class="value text-light">{{ client.proprietorName || '—' }}</div>
              </div>

              <div class="row g-2">
                <div class="col-sm-6">
                  <div class="label text-muted small">Primary Mobile</div>
                  <div class="value">
                    <span v-if="client.mobile" class="font-monospace text-warning fw-semibold">
                      <i class="bi bi-telephone-outbound me-1 small"></i>{{ client.mobile }}
                    </span>
                    <span v-else class="text-muted">—</span>
                  </div>
                </div>
                <div class="col-sm-6">
                  <div class="label text-muted small">Alternative Mobile</div>
                  <div class="value">
                    <span v-if="client.alternativeMobile" class="font-monospace text-light">
                      {{ client.alternativeMobile }}
                    </span>
                    <span v-else class="text-muted">—</span>
                  </div>
                </div>
              </div>

              <div class="detail-row">
                <div class="label text-muted small">Official Email</div>
                <div class="value">
                  <a v-if="client.email" :href="`mailto:${client.email}`" class="text-info text-decoration-none">
                    <i class="bi bi-envelope-at me-1"></i>{{ client.email }}
                  </a>
                  <span v-else class="text-muted">—</span>
                </div>
              </div>

              <div class="detail-row">
                <div class="label text-muted small">Office / Registered Address</div>
                <div class="value text-light bg-dark p-2 rounded border border-secondary border-opacity-25">
                  <i class="bi bi-geo-alt text-danger me-1"></i>
                  {{ client.address || 'No office address specified' }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Tax & Government Identifiers -->
        <div class="col-lg-6">
          <div class="idp-card p-4 h-100 border border-secondary border-opacity-25 rounded shadow-sm">
            <div class="card-title text-info fw-bold mb-3 d-flex align-items-center gap-2 border-bottom border-secondary border-opacity-25 pb-2">
              <i class="bi bi-shield-check"></i>
              <span>Government & Tax Identifiers</span>
            </div>

            <div class="detail-list d-flex flex-column gap-3">
              <!-- BIN Number -->
              <div class="detail-row">
                <div class="label text-muted small d-flex justify-content-between">
                  <span>Business Identification Number (BIN)</span>
                  <span v-if="copiedField === 'bin'" class="text-success small fw-semibold">Copied!</span>
                </div>
                <div class="value d-flex align-items-center justify-content-between bg-dark p-2 rounded border border-secondary border-opacity-25">
                  <span v-if="client.binNumber" class="font-monospace text-info fw-bold fs-6">
                    {{ client.binNumber }}
                  </span>
                  <span v-else class="text-muted font-monospace small">Not Specified</span>
                  <button
                    v-if="client.binNumber"
                    type="button"
                    class="btn btn-outline-secondary btn-sm py-0 px-2"
                    @click="copyToClipboard(client.binNumber, 'bin')"
                    title="Copy BIN"
                  >
                    <i class="bi bi-clipboard"></i>
                  </button>
                </div>
              </div>

              <!-- TIN Number -->
              <div class="detail-row">
                <div class="label text-muted small d-flex justify-content-between">
                  <span>Taxpayer Identification Number (TIN)</span>
                  <span v-if="copiedField === 'tin'" class="text-success small fw-semibold">Copied!</span>
                </div>
                <div class="value d-flex align-items-center justify-content-between bg-dark p-2 rounded border border-secondary border-opacity-25">
                  <span v-if="client.tinNumber" class="font-monospace text-light fw-semibold">
                    {{ client.tinNumber }}
                  </span>
                  <span v-else class="text-muted font-monospace small">Not Specified</span>
                  <button
                    v-if="client.tinNumber"
                    type="button"
                    class="btn btn-outline-secondary btn-sm py-0 px-2"
                    @click="copyToClipboard(client.tinNumber, 'tin')"
                    title="Copy TIN"
                  >
                    <i class="bi bi-clipboard"></i>
                  </button>
                </div>
              </div>

              <!-- Trade License -->
              <div class="detail-row">
                <div class="label text-muted small">Trade License Number</div>
                <div class="value bg-dark p-2 rounded border border-secondary border-opacity-25 font-monospace text-light">
                  {{ client.tradeLicenseNo || 'Not Specified' }}
                </div>
              </div>

              <div class="row g-2">
                <div class="col-sm-6">
                  <div class="label text-muted small">Customer Type</div>
                  <div class="value">
                    <span class="badge bg-secondary bg-opacity-25 text-light border border-secondary border-opacity-50 py-2 px-3">
                      {{ client.customerTypeName || 'Standard' }}
                    </span>
                  </div>
                </div>
                <div class="col-sm-6">
                  <div class="label text-muted small">Service Scope</div>
                  <div class="value">
                    <span class="badge bg-dark border border-secondary text-info py-2 px-3">
                      {{ client.vatServiceType || 'FULL' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. VAT Portal Credentials -->
        <div class="col-lg-6">
          <div class="idp-card p-4 h-100 border border-secondary border-opacity-25 rounded shadow-sm">
            <div class="card-title text-warning fw-bold mb-3 d-flex align-items-center justify-content-between border-bottom border-secondary border-opacity-25 pb-2">
              <div class="d-flex align-items-center gap-2">
                <i class="bi bi-key-fill"></i>
                <span>VAT Online Portal Credentials</span>
              </div>
              <a
                href="https://vat.gov.bd"
                target="_blank"
                class="btn btn-outline-warning btn-sm py-0 px-2 small d-inline-flex align-items-center gap-1 text-decoration-none"
              >
                <span>NBR Portal</span>
                <i class="bi bi-box-arrow-up-right small"></i>
              </a>
            </div>

            <div class="detail-list d-flex flex-column gap-3">
              <!-- VAT User ID -->
              <div class="detail-row">
                <div class="label text-muted small d-flex justify-content-between">
                  <span>Portal Username / User ID</span>
                  <span v-if="copiedField === 'vatUser'" class="text-success small fw-semibold">Copied!</span>
                </div>
                <div class="value d-flex align-items-center justify-content-between bg-dark p-2 rounded border border-secondary border-opacity-25">
                  <span v-if="client.vatUserId" class="font-monospace text-light fw-bold">
                    {{ client.vatUserId }}
                  </span>
                  <span v-else class="text-muted font-monospace small">Not Configured</span>
                  <button
                    v-if="client.vatUserId"
                    type="button"
                    class="btn btn-outline-secondary btn-sm py-0 px-2"
                    @click="copyToClipboard(client.vatUserId, 'vatUser')"
                    title="Copy Username"
                  >
                    <i class="bi bi-clipboard"></i>
                  </button>
                </div>
              </div>

              <!-- VAT Password -->
              <div class="detail-row">
                <div class="label text-muted small d-flex justify-content-between">
                  <span>Portal Password</span>
                  <span v-if="copiedField === 'vatPass'" class="text-success small fw-semibold">Copied!</span>
                </div>
                <div class="value d-flex align-items-center justify-content-between bg-dark p-2 rounded border border-secondary border-opacity-25">
                  <span v-if="client.vatPassword" class="font-monospace text-warning fw-bold">
                    {{ showPassword ? client.vatPassword : '••••••••••••' }}
                  </span>
                  <span v-else class="text-muted font-monospace small">Not Configured</span>
                  <div v-if="client.vatPassword" class="d-flex align-items-center gap-1">
                    <button
                      type="button"
                      class="btn btn-outline-secondary btn-sm py-0 px-2"
                      @click="showPassword = !showPassword"
                      :title="showPassword ? 'Hide Password' : 'Show Password'"
                    >
                      <i :class="showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
                    </button>
                    <button
                      type="button"
                      class="btn btn-outline-secondary btn-sm py-0 px-2"
                      @click="copyToClipboard(client.vatPassword, 'vatPass')"
                      title="Copy Password"
                    >
                      <i class="bi bi-clipboard"></i>
                    </button>
                  </div>
                </div>
              </div>

              <div class="alert alert-dark bg-dark border border-secondary border-opacity-25 text-muted small mb-0 p-2">
                <i class="bi bi-info-circle me-1 text-info"></i>
                These credentials are used by assigned managers to access the official NBR VAT Portal for monthly return submissions.
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Administration & Management -->
        <div class="col-lg-6">
          <div class="idp-card p-4 h-100 border border-secondary border-opacity-25 rounded shadow-sm">
            <div class="card-title text-success fw-bold mb-3 d-flex align-items-center gap-2 border-bottom border-secondary border-opacity-25 pb-2">
              <i class="bi bi-people-fill"></i>
              <span>Management & Assignments</span>
            </div>

            <div class="detail-list d-flex flex-column gap-3">
              <!-- Reference -->
              <div class="detail-row">
                <div class="label text-muted small">Client Reference / Agent</div>
                <div class="value">
                  <span v-if="client.referenceName" class="badge bg-dark border border-secondary text-info py-2 px-3">
                    <i class="bi bi-person-badge me-1"></i>{{ client.referenceName }}
                  </span>
                  <span v-else class="text-muted">—</span>
                </div>
              </div>

              <!-- Assigned Team Managers -->
              <div class="detail-row">
                <div class="label text-muted small mb-1">Assigned Team Managers</div>
                <div v-if="client.managers && client.managers.length > 0" class="d-flex flex-wrap gap-2">
                  <div
                    v-for="mgr in client.managers"
                    :key="mgr.id"
                    class="d-inline-flex align-items-center gap-2 bg-dark px-3 py-1 border border-secondary border-opacity-50 rounded"
                  >
                    <i class="bi bi-person-check-fill text-success"></i>
                    <div>
                      <div class="text-white small fw-semibold">{{ mgr.name }}</div>
                      <div class="text-muted" style="font-size: 0.72rem;">{{ mgr.email }}</div>
                    </div>
                  </div>
                </div>
                <div v-else class="text-muted small fst-italic bg-dark p-2 rounded border border-secondary border-opacity-25">
                  <i class="bi bi-shield-lock me-1"></i> No specific managers assigned. Handled directly by Administrators.
                </div>
              </div>

              <!-- System Timestamps -->
              <div class="row g-2 pt-2 border-top border-secondary border-opacity-25">
                <div class="col-sm-6">
                  <div class="label text-muted small">Created At</div>
                  <div class="value text-light small font-monospace">{{ formatDate(client.createdAt) }}</div>
                </div>
                <div class="col-sm-6">
                  <div class="label text-muted small">Last Modified</div>
                  <div class="value text-light small font-monospace">{{ formatDate(client.updatedAt) }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. Internal Notes & Remarks (Full Width) -->
        <div class="col-12">
          <div class="idp-card p-4 border border-secondary border-opacity-25 rounded shadow-sm">
            <div class="card-title text-light fw-bold mb-2 d-flex align-items-center gap-2">
              <i class="bi bi-chat-left-text-fill text-info"></i>
              <span>Internal Notes & Remarks</span>
            </div>
            <div class="bg-dark p-3 rounded border border-secondary border-opacity-25">
              <p v-if="client.notes" class="text-white mb-0" style="white-space: pre-wrap; font-size: 0.9rem;">
                {{ client.notes }}
              </p>
              <div v-else class="text-muted small fst-italic">
                No special notes or remarks recorded for this client.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.idp-card {
  background-color: #1a1e24;
  transition: all 0.2s ease;
}

.client-avatar-badge {
  width: 58px;
  height: 58px;
  border-radius: 12px;
  background: rgba(13, 110, 253, 0.12);
  border: 1px solid rgba(13, 110, 253, 0.3);
  color: #3b8eed;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.85rem;
  flex-shrink: 0;
}

.status-badge-active {
  background: rgba(25, 135, 84, 0.16);
  color: #20c997;
  border: 1px solid rgba(25, 135, 84, 0.35);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.status-badge-inactive {
  background: rgba(220, 53, 69, 0.16);
  color: #f87171;
  border: 1px solid rgba(220, 53, 69, 0.35);
  font-size: 0.8rem;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.badge-customer-type {
  background: rgba(13, 202, 240, 0.15);
  color: #0dcaf0;
  border: 1px solid rgba(13, 202, 240, 0.3);
  font-size: 0.8rem;
  font-weight: 500;
  padding: 5px 12px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
}

.badge-scope {
  background: #212529;
  color: #adb5bd;
  border: 1px solid #343a40;
  font-size: 0.8rem;
  font-weight: 500;
  padding: 5px 12px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
}

.detail-row .label {
  margin-bottom: 2px;
  font-weight: 500;
}

@media print {
  .no-print {
    display: none !important;
  }

  .idp-card {
    background-color: #ffffff !important;
    color: #000000 !important;
    border: 1px solid #dee2e6 !important;
  }

  .text-white, .text-light {
    color: #000000 !important;
  }

  .text-muted {
    color: #6c757d !important;
  }

  .bg-dark {
    background-color: #f8f9fa !important;
    color: #000000 !important;
    border-color: #dee2e6 !important;
  }
}
</style>
