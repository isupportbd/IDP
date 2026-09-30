<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useHead } from "@vueuse/head";
import { useToast } from "@/composables/useToast";
import {
  useSmsTemplatesApi,
  type SmsTemplate,
  type SmsLog,
  type SmsTemplateVariable
} from "@/composables/useSmsTemplatesApi";

useHead({ title: "SMS Templates" });

const toast = useToast();
const api = useSmsTemplatesApi();

const templates = ref<SmsTemplate[]>([]);
const logs = ref<SmsLog[]>([]);
const isLoading = ref(true);
const isSaving = ref<number | null>(null);
const isResetting = ref<number | null>(null);
const activeTab = ref<"templates" | "logs" | "gateway">("templates");

// Gateway Setup state
const gatewayForm = ref({
  smsApiKey: "",
  smsSenderId: "8809617614050",
  provider: "BulkSMSBD",
  endpoint: "http://bulksmsbd.net/api/smsapi"
});
const isSavingGateway = ref(false);
const isCheckingBalance = ref(false);
const liveBalance = ref<string | null>(null);
const showApiKey = ref(false);

// Gateway Quick Test SMS
const gatewayTestMobile = ref("");
const gatewayTestMessage = ref("এটি আইডিপি সিস্টেমের বাল্ক এসএমএস গেটওয়ে টেস্ট মেসেজ।");
const isSendingGatewayTest = ref(false);
const gatewayTestResponse = ref<{ ok: boolean; message: string; raw?: string } | null>(null);

// Active editing state per template
const editedBodies = ref<Record<number, string>>({});
const activeStatuses = ref<Record<number, boolean>>({});
const textareaRefs = ref<Record<number, HTMLTextAreaElement | null>>({});

// Test SMS modal state
const showTestModal = ref(false);
const testMobile = ref("");
const testMessage = ref("");
const isSendingTest = ref(false);

const loadData = async () => {
  isLoading.value = true;
  try {
    const data = await api.fetchTemplates();
    templates.value = data || [];

    for (const t of templates.value) {
      editedBodies.value[t.id] = t.body;
      activeStatuses.value[t.id] = t.isActive;
    }
  } catch (err: any) {
    toast.error(err?.response?.data?.message || "Failed to load SMS templates");
  } finally {
    isLoading.value = false;
  }
};

const loadLogs = async () => {
  try {
    const data = await api.fetchSmsLogs();
    logs.value = data || [];
  } catch (err: any) {
    toast.error("Failed to load SMS delivery logs");
  }
};

const loadGatewaySettings = async () => {
  try {
    const data = await api.fetchGatewaySettings();
    if (data) {
      gatewayForm.value = {
        smsApiKey: data.smsApiKey || "",
        smsSenderId: data.smsSenderId || "8809617614050",
        provider: data.provider || "BulkSMSBD",
        endpoint: data.endpoint || "http://bulksmsbd.net/api/smsapi"
      };
    }
  } catch {}
};

const handleSaveGateway = async () => {
  isSavingGateway.value = true;
  try {
    const res = await api.updateGatewaySettings({
      smsApiKey: gatewayForm.value.smsApiKey,
      smsSenderId: gatewayForm.value.smsSenderId
    });
    toast.success(res?.message || "Gateway configuration saved successfully!");
  } catch (err: any) {
    toast.error(err?.response?.data?.message || "Failed to save gateway settings");
  } finally {
    isSavingGateway.value = false;
  }
};

const handleCheckBalance = async () => {
  if (!gatewayForm.value.smsApiKey) {
    toast.error("Please enter and save your API Key first.");
    return;
  }
  isCheckingBalance.value = true;
  try {
    const res = await api.checkGatewayBalance();
    if (res?.balance) {
      liveBalance.value = res.balance;
      toast.success(`Current Live Balance: ${res.balance}`);
    }
  } catch (err: any) {
    toast.error(err?.response?.data?.message || "Failed to check balance. Check your API key.");
  } finally {
    isCheckingBalance.value = false;
  }
};

const handleSendGatewayLiveTest = async () => {
  if (!gatewayTestMobile.value) {
    toast.error("Please enter a recipient mobile number.");
    return;
  }
  if (!gatewayTestMessage.value) {
    toast.error("Message body cannot be empty.");
    return;
  }
  isSendingGatewayTest.value = true;
  gatewayTestResponse.value = null;
  try {
    const res = await api.sendTestSms(gatewayTestMobile.value.trim(), gatewayTestMessage.value.trim());
    gatewayTestResponse.value = {
      ok: true,
      message: res?.message || "Test SMS sent successfully!",
      raw: res?.response
    };
    toast.success("Test SMS sent successfully!");
  } catch (err: any) {
    const errorMsg = err?.response?.data?.message || "Failed to send test SMS.";
    gatewayTestResponse.value = {
      ok: false,
      message: errorMsg,
      raw: err?.response?.data?.response
    };
    toast.error(errorMsg);
  } finally {
    isSendingGatewayTest.value = false;
  }
};

onMounted(() => {
  loadData();
  loadGatewaySettings();
});

const switchTab = (tab: "templates" | "logs" | "gateway") => {
  activeTab.value = tab;
  if (tab === "logs") {
    loadLogs();
  } else if (tab === "gateway") {
    loadGatewaySettings();
  }
};

// Format template name to ensure only English title is displayed
const cleanTemplateName = (name: string) => {
  if (!name) return "";
  const match = name.match(/\(([^)]+)\)/);
  if (match && match[1] && /[a-zA-Z]/.test(match[1])) {
    return match[1].trim();
  }
  return name.replace(/[\u0980-\u09FF]/g, "").replace(/[()]/g, "").trim() || name;
};

// Render preview with sample variables
const getPreview = (template: SmsTemplate, body: string) => {
  if (!body) return "";
  let res = body;
  for (const v of template.variables || []) {
    const regex = new RegExp(`\\{\\{\\s*${v.name}\\s*\\}\\}`, "g");
    res = res.replace(regex, v.sample || `[${v.label}]`);
  }
  return res;
};

const isEditing = ref<Record<number, boolean>>({});

const startEditing = (template: SmsTemplate) => {
  isEditing.value[template.id] = true;
  setTimeout(() => {
    textareaRefs.value[template.id]?.focus();
  }, 50);
};

const cancelEditing = (template: SmsTemplate) => {
  editedBodies.value[template.id] = template.body;
  isEditing.value[template.id] = false;
};

const handleTextareaClick = (template: SmsTemplate) => {
  if (!isEditing.value[template.id]) {
    startEditing(template);
  }
};

// Insert variable token at cursor position
const insertVariable = (templateId: number, varName: string) => {
  isEditing.value[templateId] = true;
  const currentBody = editedBodies.value[templateId] || "";
  const el = textareaRefs.value[templateId];
  const token = `{{${varName}}}`;

  if (!el) {
    editedBodies.value[templateId] = currentBody + token;
    return;
  }

  const start = el.selectionStart ?? currentBody.length;
  const end = el.selectionEnd ?? currentBody.length;
  const next = currentBody.slice(0, start) + token + currentBody.slice(end);
  editedBodies.value[templateId] = next;

  setTimeout(() => {
    el.focus();
    const pos = start + token.length;
    el.setSelectionRange(pos, pos);
  }, 10);
};

// Calculate SMS Parts (Unicode / Bangla: 70 chars per 1 part, 67 per concatenated part)
const getSmsPartCount = (text: string) => {
  const len = text.length;
  if (len === 0) return { chars: 0, parts: 0 };
  const isUnicode = /[^\u0000-\u00ff]/.test(text);
  const partLimit = isUnicode ? 70 : 160;
  const concatLimit = isUnicode ? 67 : 153;
  if (len <= partLimit) return { chars: len, parts: 1 };
  return { chars: len, parts: Math.ceil(len / concatLimit) };
};

const handleSave = async (template: SmsTemplate) => {
  isSaving.value = template.id;
  try {
    const newBody = editedBodies.value[template.id];
    const newActive = activeStatuses.value[template.id];

    await api.updateTemplate(template.id, {
      body: newBody,
      isActive: newActive
    });

    template.body = newBody;
    template.isActive = newActive;
    isEditing.value[template.id] = false;
    toast.success(`Template "${template.name}" updated successfully!`);
  } catch (err: any) {
    toast.error(err?.response?.data?.message || "Failed to update template");
  } finally {
    isSaving.value = null;
  }
};

const handleReset = async (template: SmsTemplate) => {
  if (!confirm(`Are you sure you want to reset "${template.name}" to default system template?`)) {
    return;
  }
  isResetting.value = template.id;
  try {
    const res = await api.resetTemplate(template.id);
    if (res?.data) {
      editedBodies.value[template.id] = res.data.body;
      activeStatuses.value[template.id] = res.data.isActive;
      template.body = res.data.body;
      template.isActive = res.data.isActive;
      isEditing.value[template.id] = false;
      toast.success("Template reset to default successfully!");
    }
  } catch (err: any) {
    toast.error(err?.response?.data?.message || "Failed to reset template");
  } finally {
    isResetting.value = null;
  }
};

const openTestModal = (template: SmsTemplate) => {
  const body = editedBodies.value[template.id] || template.body;
  testMessage.value = getPreview(template, body);
  testMobile.value = "";
  showTestModal.value = true;
};

const handleSendTestSms = async () => {
  if (!testMobile.value) {
    toast.error("Please enter a recipient mobile number.");
    return;
  }
  if (!testMessage.value) {
    toast.error("Message body cannot be empty.");
    return;
  }
  isSendingTest.value = true;
  try {
    const res = await api.sendTestSms(testMobile.value.trim(), testMessage.value.trim());
    toast.success(res?.message || "Test SMS sent successfully!");
    showTestModal.value = false;
  } catch (err: any) {
    toast.error(err?.response?.data?.message || "Failed to send test SMS. Check Firm Settings.");
  } finally {
    isSendingTest.value = false;
  }
};
</script>

<template>
  <div class="sms-templates-container py-2">
    <!-- Breadcrumbs -->
    <div class="d-flex align-items-center gap-2 mb-2">
      <router-link to="/" class="text-muted text-decoration-none small">
        <i class="bi bi-arrow-left me-1"></i> Dashboard
      </router-link>
      <span class="text-muted small">/</span>
      <span class="text-primary small fw-semibold">SMS Templates</span>
    </div>

    <!-- Header -->
    <div class="d-flex flex-wrap justify-content-between align-items-center mb-4 gap-3">
      <div>
        <h4 class="text-white fw-bold mb-1 d-flex align-items-center gap-2">
          <i class="bi bi-chat-square-text text-warning"></i>
          Automated SMS Templates
        </h4>
        <span class="text-muted small">
          Customize automated notification SMS templates for VAT submissions, billing invoices, and receipts.
        </span>
      </div>

      <!-- Tab Switcher -->
      <div class="btn-group bg-dark p-1 rounded border border-secondary">
        <button
          type="button"
          class="btn btn-sm px-3"
          :class="activeTab === 'templates' ? 'btn-primary' : 'btn-dark text-muted'"
          @click="switchTab('templates')"
        >
          <i class="bi bi-file-earmark-text me-1"></i> Templates
        </button>
        <button
          type="button"
          class="btn btn-sm px-3"
          :class="activeTab === 'logs' ? 'btn-primary' : 'btn-dark text-muted'"
          @click="switchTab('logs')"
        >
          <i class="bi bi-clock-history me-1"></i> Delivery Logs
        </button>
        <button
          type="button"
          class="btn btn-sm px-3"
          :class="activeTab === 'gateway' ? 'btn-primary' : 'btn-dark text-muted'"
          @click="switchTab('gateway')"
        >
          <i class="bi bi-hdd-network me-1"></i> Gateway Setup
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="text-muted mt-2">Loading SMS templates...</p>
    </div>

    <!-- TAB 1: TEMPLATES LIST -->
    <div v-else-if="activeTab === 'templates'" class="row g-4">
      <div v-for="template in templates" :key="template.id" class="col-12 col-xl-6">
        <div class="card h-100 bg-dark border-secondary shadow-sm template-card">
          <!-- Card Header -->
          <div class="card-header bg-dark border-secondary d-flex justify-content-between align-items-center py-3">
            <div>
              <h6 class="text-white fw-bold mb-0">{{ cleanTemplateName(template.name) }}</h6>
            </div>

            <!-- Active Switch -->
            <div class="form-check form-switch mb-0">
              <input
                class="form-check-input"
                type="checkbox"
                role="switch"
                :id="'switch-' + template.id"
                v-model="activeStatuses[template.id]"
              />
              <label class="form-check-label text-muted fs-8" :for="'switch-' + template.id">
                {{ activeStatuses[template.id] ? 'Active' : 'Disabled' }}
              </label>
            </div>
          </div>

          <!-- Card Body -->
          <div class="card-body p-3">
            <!-- Clickable Variables -->
            <div class="mb-3">
              <label class="form-label text-muted fs-8 fw-semibold mb-1 d-block">
                CLICK TO INSERT DYNAMIC VARIABLE:
              </label>
              <div class="d-flex flex-wrap gap-1">
                <button
                  v-for="v in template.variables"
                  :key="v.name"
                  type="button"
                  class="btn btn-xs var-pill text-start d-inline-flex align-items-center gap-1 py-1 px-2"
                  @click="insertVariable(template.id, v.name)"
                  :title="v.description || v.label"
                >
                  <span class="var-token">+&#123;&#123;{{ v.name }}&#125;&#125;</span>
                  <span class="var-label">({{ v.label }})</span>
                </button>
              </div>
            </div>

            <!-- Message Textarea -->
            <div class="mb-3">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <label class="form-label text-white fs-8 fw-semibold mb-0">
                  SMS Body Text:
                </label>
                <!-- Character & Part Count -->
                <span class="badge bg-dark border border-secondary text-muted fs-8">
                  {{ getSmsPartCount(editedBodies[template.id] || '').chars }} Chars
                  <span class="text-info ms-1">
                    ({{ getSmsPartCount(editedBodies[template.id] || '').parts }} SMS)
                  </span>
                </span>
              </div>

              <textarea
                :ref="(el) => (textareaRefs[template.id] = el as HTMLTextAreaElement)"
                v-model="editedBodies[template.id]"
                class="form-control bg-dark text-white font-monospace fs-8"
                :class="isEditing[template.id] ? 'border-primary' : 'border-secondary'"
                :readonly="!isEditing[template.id]"
                rows="4"
                placeholder="Enter SMS message body..."
                @click="handleTextareaClick(template)"
              ></textarea>
            </div>

            <!-- Live Sample Preview -->
            <div class="preview-box p-3 rounded border border-secondary mb-3">
              <div class="d-flex align-items-center justify-content-between mb-1">
                <span class="fs-8 fw-bold text-success d-flex align-items-center gap-1">
                  <i class="bi bi-eye"></i> Live Client Preview
                </span>
                <span class="fs-9 text-muted">Auto-rendered with sample client data</span>
              </div>
              <div class="preview-content text-light fs-8 font-monospace white-space-pre-wrap">
                {{ getPreview(template, editedBodies[template.id] || '') }}
              </div>
            </div>
          </div>

          <!-- Card Footer -->
          <div class="card-footer bg-dark border-secondary d-flex justify-content-between align-items-center py-2 px-3">
            <div class="d-flex gap-2">
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary"
                @click="handleReset(template)"
                :disabled="isResetting === template.id"
              >
                <i class="bi bi-arrow-counterclockwise me-1"></i>
                <span v-if="isResetting === template.id">Resetting...</span>
                <span v-else>Reset Default</span>
              </button>
              <button
                type="button"
                class="btn btn-sm btn-outline-warning"
                @click="openTestModal(template)"
              >
                <i class="bi bi-send me-1"></i> Test SMS
              </button>
            </div>

            <div class="d-flex gap-2 align-items-center">
              <button
                v-if="!isEditing[template.id]"
                type="button"
                class="btn btn-sm btn-outline-primary px-3"
                @click="startEditing(template)"
              >
                <i class="bi bi-pencil me-1"></i> Edit
              </button>
              <template v-else>
                <button
                  type="button"
                  class="btn btn-sm btn-outline-secondary px-2"
                  @click="cancelEditing(template)"
                  :disabled="isSaving === template.id"
                >
                  <i class="bi bi-x-lg me-1"></i> Cancel
                </button>
                <button
                  type="button"
                  class="btn btn-sm btn-primary px-3"
                  @click="handleSave(template)"
                  :disabled="isSaving === template.id"
                >
                  <i class="bi bi-check-lg me-1"></i>
                  <span v-if="isSaving === template.id">Saving...</span>
                  <span v-else>Save</span>
                </button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: SMS DELIVERY LOGS -->
    <div v-else-if="activeTab === 'logs'" class="card bg-dark border-secondary">
      <div class="card-header bg-dark border-secondary d-flex justify-content-between align-items-center py-3">
        <h6 class="text-white fw-bold mb-0">
          <i class="bi bi-clock-history me-1 text-info"></i> Recent SMS Delivery Logs
        </h6>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="loadLogs">
          <i class="bi bi-arrow-clockwise me-1"></i> Refresh
        </button>
      </div>

      <div class="card-body p-0">
        <div class="table-responsive">
          <table class="table table-dark table-hover align-middle mb-0 fs-8">
            <thead>
              <tr class="border-secondary text-muted">
                <th class="ps-3">Date & Time</th>
                <th>Recipient Number</th>
                <th>Template / Type</th>
                <th>Submission ID</th>
                <th>Message Content</th>
                <th>Status</th>
                <th class="pe-3">Provider Response</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="logs.length === 0">
                <td colspan="7" class="text-center py-4 text-muted">
                  No SMS delivery logs recorded yet.
                </td>
              </tr>
              <tr v-for="log in logs" :key="log.id" class="border-secondary">
                <td class="ps-3 text-nowrap text-muted">
                  {{ new Date(log.sentAt).toLocaleString('en-GB') }}
                </td>
                <td class="fw-semibold text-white">{{ log.recipientMobile }}</td>
                <td>
                  <span class="badge bg-secondary text-info">{{ log.templateKey || 'direct' }}</span>
                </td>
                <td class="font-monospace text-muted">{{ log.submissionId || '-' }}</td>
                <td class="text-truncate" style="max-width: 260px;" :title="log.message">
                  {{ log.message }}
                </td>
                <td>
                  <span
                    class="badge"
                    :class="log.status === 'SENT' ? 'bg-success' : 'bg-danger'"
                  >
                    {{ log.status }}
                  </span>
                </td>
                <td class="pe-3 text-muted text-truncate" style="max-width: 180px;" :title="log.providerResponse || ''">
                  {{ log.providerResponse || '-' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- TAB 3: GATEWAY SETUP -->
    <div v-else-if="activeTab === 'gateway'" class="row g-4">
      <!-- Left Column: Gateway Configuration -->
      <div class="col-12 col-lg-7">
        <div class="card bg-dark border-secondary h-100">
          <div class="card-header bg-dark border-secondary d-flex justify-content-between align-items-center py-3">
            <h6 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-hdd-network text-primary"></i> SMS Gateway Configuration
            </h6>
            <span class="badge bg-primary text-white">
              BulkSMSBD Provider
            </span>
          </div>

          <div class="card-body p-4">
            <!-- Provider Info -->
            <div class="row g-3 mb-4">
              <div class="col-sm-6">
                <label class="form-label fs-8 text-muted fw-semibold">SMS Provider:</label>
                <div class="form-control bg-dark text-white border-secondary fs-8 d-flex align-items-center justify-content-between">
                  <span>BulkSMSBD.net</span>
                  <span class="badge bg-success">Default</span>
                </div>
              </div>
              <div class="col-sm-6">
                <label class="form-label fs-8 text-muted fw-semibold">API Endpoint URL:</label>
                <input
                  type="text"
                  class="form-control bg-dark text-white border-secondary fs-8 font-monospace"
                  :value="gatewayForm.endpoint"
                  readonly
                />
              </div>
            </div>

            <!-- API Key -->
            <div class="mb-4">
              <label class="form-label fs-8 text-white fw-semibold mb-1">
                API Key:
              </label>
              <div class="input-group">
                <input
                  :type="showApiKey ? 'text' : 'password'"
                  v-model="gatewayForm.smsApiKey"
                  class="form-control bg-dark text-white border-secondary font-monospace fs-8"
                  placeholder="Enter BulkSMSBD API Key..."
                />
                <button
                  type="button"
                  class="btn btn-outline-secondary"
                  @click="showApiKey = !showApiKey"
                  :title="showApiKey ? 'Hide Key' : 'Show Key'"
                >
                  <i class="bi" :class="showApiKey ? 'bi-eye-slash' : 'bi-eye'"></i>
                </button>
              </div>
              <span class="fs-9 text-muted mt-1 d-block">
                Obtain your API Key from your BulkSMSBD dashboard account.
              </span>
            </div>

            <!-- Sender ID -->
            <div class="mb-4">
              <label class="form-label fs-8 text-white fw-semibold mb-1">
                Sender ID / Masking:
              </label>
              <input
                type="text"
                v-model="gatewayForm.smsSenderId"
                class="form-control bg-dark text-white border-secondary font-monospace fs-8"
                placeholder="e.g. 8809617614050 or Approved Brand Name"
              />
              <span class="fs-9 text-muted mt-1 d-block">
                Registered non-masking number (e.g. 8809617614050) or approved Brand Sender ID.
              </span>
            </div>

            <!-- Live Balance Box -->
            <div class="p-3 rounded border border-secondary bg-dark d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
              <div>
                <span class="fs-8 text-muted d-block fw-semibold">ACCOUNT SMS BALANCE:</span>
                <span class="fs-5 fw-bold text-success font-monospace">
                  {{ liveBalance || '0.00' }}
                </span>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-outline-info"
                @click="handleCheckBalance"
                :disabled="isCheckingBalance"
              >
                <i class="bi bi-wallet2 me-1"></i>
                <span v-if="isCheckingBalance">Checking...</span>
                <span v-else>Check Live Balance</span>
              </button>
            </div>

            <!-- Save Button -->
            <div class="d-flex justify-content-end">
              <button
                type="button"
                class="btn btn-primary px-4"
                @click="handleSaveGateway"
                :disabled="isSavingGateway"
              >
                <i class="bi bi-check-lg me-1"></i>
                <span v-if="isSavingGateway">Saving...</span>
                <span v-else>Save Configuration</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Direct Live SMS Test -->
      <div class="col-12 col-lg-5">
        <div class="card bg-dark border-secondary h-100">
          <div class="card-header bg-dark border-secondary py-3">
            <h6 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-send text-warning"></i> Instant Gateway Test
            </h6>
          </div>

          <div class="card-body p-4">
            <div class="mb-3">
              <label class="form-label fs-8 text-muted fw-semibold">Recipient Mobile Number:</label>
              <input
                v-model="gatewayTestMobile"
                type="text"
                class="form-control bg-dark text-white border-secondary fs-8 font-monospace"
                placeholder="017XXXXXXXX"
              />
              <span class="fs-9 text-muted mt-1 d-block">11-digit Bangladeshi mobile number.</span>
            </div>

            <div class="mb-3">
              <div class="d-flex justify-content-between align-items-center mb-1">
                <label class="form-label fs-8 text-muted fw-semibold mb-0">Test Message Content:</label>
                <span class="badge bg-dark border border-secondary text-muted fs-9">
                  {{ getSmsPartCount(gatewayTestMessage).chars }} chars
                </span>
              </div>
              <textarea
                v-model="gatewayTestMessage"
                class="form-control bg-dark text-white border-secondary font-monospace fs-8"
                rows="4"
              ></textarea>
            </div>

            <button
              type="button"
              class="btn btn-warning w-100 py-2 fw-semibold mb-3"
              @click="handleSendGatewayLiveTest"
              :disabled="isSendingGatewayTest"
            >
              <i class="bi bi-send-fill me-1"></i>
              <span v-if="isSendingGatewayTest">Sending SMS...</span>
              <span v-else>Send Test SMS</span>
            </button>

            <!-- Test Result Console -->
            <div
              v-if="gatewayTestResponse"
              class="alert mb-0 fs-8"
              :class="gatewayTestResponse.ok ? 'alert-success bg-dark border-success text-success' : 'alert-danger bg-dark border-danger text-danger'"
            >
              <div class="fw-bold d-flex align-items-center gap-2 mb-1">
                <i class="bi" :class="gatewayTestResponse.ok ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'"></i>
                {{ gatewayTestResponse.ok ? 'SMS Sent Successfully' : 'SMS Delivery Failed' }}
              </div>
              <div class="small font-monospace">{{ gatewayTestResponse.message }}</div>
              <div v-if="gatewayTestResponse.raw" class="small text-muted font-monospace mt-1">
                Response: {{ gatewayTestResponse.raw }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TEST SMS MODAL -->
    <div
      v-if="showTestModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0,0,0,0.75);"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content bg-dark border-secondary text-white">
          <div class="modal-header border-secondary">
            <h5 class="modal-title fs-6 fw-bold">
              <i class="bi bi-send text-warning me-2"></i>Send Test SMS
            </h5>
            <button
              type="button"
              class="btn-close btn-close-white"
              @click="showTestModal = false"
            ></button>
          </div>

          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label fs-8 text-muted fw-semibold">Recipient Mobile Number:</label>
              <input
                v-model="testMobile"
                type="text"
                class="form-control bg-dark border-secondary text-white fs-8"
                placeholder="017XXXXXXXX"
                autofocus
              />
              <span class="fs-9 text-muted mt-1 d-block">Must be a valid 11-digit Bangladeshi mobile number.</span>
            </div>

            <div class="mb-3">
              <label class="form-label fs-8 text-muted fw-semibold">Message Preview:</label>
              <textarea
                v-model="testMessage"
                class="form-control bg-dark border-secondary text-white font-monospace fs-8"
                rows="4"
              ></textarea>
            </div>
          </div>

          <div class="modal-footer border-secondary">
            <button
              type="button"
              class="btn btn-sm btn-secondary"
              @click="showTestModal = false"
            >
              Cancel
            </button>
            <button
              type="button"
              class="btn btn-sm btn-primary px-3"
              @click="handleSendTestSms"
              :disabled="isSendingTest"
            >
              <span v-if="isSendingTest">Sending...</span>
              <span v-else><i class="bi bi-send me-1"></i> Send Test</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.template-card {
  transition: border-color 0.15s ease;
}
.template-card:hover {
  border-color: #4f5762 !important;
}
.preview-box {
  background: #181b1e;
}
.preview-content {
  line-height: 1.5;
  white-space: pre-wrap;
  color: #e2e8f0;
}
.btn-xs {
  font-size: 0.72rem;
  padding: 0.2rem 0.45rem;
}
.fs-8 {
  font-size: 0.8rem;
}
.fs-9 {
  font-size: 0.72rem;
}
.var-pill {
  background: #1e2329;
  border: 1px solid #323942;
  border-radius: 4px;
  color: #e2e8f0;
  transition: all 0.15s ease-in-out;
  cursor: pointer;
  user-select: none;
}
.var-pill:hover {
  background: #252e3a;
  border-color: #3b8eed;
}
.var-pill:focus,
.var-pill:active {
  background: #1c2736 !important;
  border-color: #3b8eed !important;
  box-shadow: 0 0 0 2px rgba(59, 142, 237, 0.25) !important;
  outline: none !important;
}
.var-token {
  color: #f59e0b;
  font-family: monospace;
  font-weight: 600;
  font-size: 0.75rem;
}
.var-pill:hover .var-token {
  color: #fbbf24;
}
.var-label {
  color: #94a3b8;
  font-size: 0.72rem;
}
.var-pill:hover .var-label {
  color: #cbd5e1;
}
</style>
