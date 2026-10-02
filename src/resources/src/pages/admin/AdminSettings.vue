<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import { useAuthStore } from "@/stores/auth";
import { useFirmApi, type CompanySettings, type BankAccount, type ExpenseHead } from "@/composables/useFirmApi";
import { useServicesApi, type ServiceItem, type ServiceRate, type ClientReference } from "@/composables/useServicesApi";
import { useToast } from "@/composables/useToast";
import SearchInput from "@/components/common/SearchInput.vue";

const route = useRoute();
const router = useRouter();
const toast = useToast();
const authStore = useAuthStore();

const {
  company,
  bankAccounts,
  expenseHeads,
  loading: firmLoading,
  fetchCompanySettings,
  updateCompanySettings,
  fetchBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
  fetchExpenseHeads,
  createExpenseHead,
  updateExpenseHead,
  toggleExpenseHead,
  deleteExpenseHead
} = useFirmApi();

const {
  customerTypes,
  references,
  serviceItems,
  serviceRates,
  serviceUnits,
  loading: servicesLoading,
  fetchCustomerTypes,
  fetchReferences,
  createReference,
  updateReference,
  toggleReference,
  deleteReference,
  fetchServiceItems,
  createServiceItem,
  toggleServiceItem,
  updateServiceItem,
  deleteServiceItem,
  fetchServiceRates,
  createServiceRate,
  updateServiceRate,
  deleteServiceRate,
  fetchServiceUnits
} = useServicesApi();

// Working form model for Company Profile / Statutory / Invoice Branding
const form = ref<CompanySettings>({ ...company.value });

const validTabs = ["profile", "invoice", "bank", "items", "rates", "expenses", "references", "rules"] as const;
type TabType = typeof validTabs[number];

const getInitialTab = (): TabType => {
  const queryTab = route.query.tab as string;
  if (queryTab && validTabs.includes(queryTab as TabType)) {
    return queryTab as TabType;
  }
  const savedTab = localStorage.getItem("admin_settings_active_tab") as string;
  if (savedTab && validTabs.includes(savedTab as TabType)) {
    return savedTab as TabType;
  }
  return "profile";
};

const activeTab = ref<TabType>(getInitialTab());

watch(activeTab, (newTab) => {
  localStorage.setItem("admin_settings_active_tab", newTab);
  if (route.query.tab !== newTab) {
    router.replace({ query: { ...route.query, tab: newTab } });
  }
});

watch(
  () => route.query.tab,
  (queryTab) => {
    if (queryTab && validTabs.includes(queryTab as TabType) && activeTab.value !== queryTab) {
      activeTab.value = queryTab as TabType;
    }
  }
);
const saveSuccess = ref(false);
const showResetModal = ref(false);

const isEditingProfile = ref(false);
const isEditingBranding = ref(false);
const isEditingRules = ref(false);

// ── 1. FIRM PROFILE & BRANDING ACTIONS ───────────────────
const handleSaveProfile = async () => {
  try {
    await updateCompanySettings(form.value);
    isEditingProfile.value = false;
    toast.success("Firm profile saved and locked");
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to update firm profile");
  }
};

const cancelProfileEdit = () => {
  form.value = { ...company.value };
  isEditingProfile.value = false;
};

const handleSaveBranding = async () => {
  try {
    await updateCompanySettings(form.value);
    isEditingBranding.value = false;
    toast.success("Invoice branding saved and locked");
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to update invoice branding");
  }
};

const cancelBrandingEdit = () => {
  form.value = { ...company.value };
  isEditingBranding.value = false;
};

const handleSaveRules = async () => {
  try {
    await updateCompanySettings(form.value);
    isEditingRules.value = false;
    toast.success("Rules & SMS configuration saved and locked");
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to update rules");
  }
};

const cancelRulesEdit = () => {
  form.value = { ...company.value };
  isEditingRules.value = false;
};

// ── 2. BANK & MFS ACCOUNTS ──────────────────────────────
const showBankModal = ref(false);
const isEditingBank = ref(false);
const bankForm = ref({
  id: 0,
  bankName: "",
  accountName: "",
  accountNumber: "",
  branchName: "",
  routingNumber: "",
  bkashNumber: "",
  nagadNumber: "",
  isDefault: false,
  isActive: true
});

const openAddBankModal = () => {
  isEditingBank.value = false;
  bankForm.value = {
    id: 0,
    bankName: "",
    accountName: form.value.companyName || "",
    accountNumber: "",
    branchName: "",
    routingNumber: "",
    bkashNumber: form.value.phone || "",
    nagadNumber: "",
    isDefault: bankAccounts.value.length === 0,
    isActive: true
  };
  showBankModal.value = true;
};

const openEditBankModal = (b: BankAccount) => {
  isEditingBank.value = true;
  bankForm.value = {
    id: b.id,
    bankName: b.bankName,
    accountName: b.accountName,
    accountNumber: b.accountNumber,
    branchName: b.branchName || "",
    routingNumber: b.routingNumber || "",
    bkashNumber: b.bkashNumber || "",
    nagadNumber: b.nagadNumber || "",
    isDefault: b.isDefault,
    isActive: b.isActive
  };
  showBankModal.value = true;
};

const saveBankAccount = async () => {
  if (!bankForm.value.bankName.trim() || !bankForm.value.accountNumber.trim()) {
    toast.error("Bank name and account number are required");
    return;
  }

  try {
    if (isEditingBank.value) {
      await updateBankAccount(bankForm.value.id, bankForm.value);
      toast.success("Bank account updated");
    } else {
      await createBankAccount(bankForm.value);
      toast.success("Bank account added");
    }
    showBankModal.value = false;
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to save bank account");
  }
};

const handleDeleteBankAccount = async (id: number) => {
  if (confirm("Are you sure you want to remove this bank account?")) {
    try {
      await deleteBankAccount(id);
      toast.info("Bank account removed");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete bank account");
    }
  }
};

// ── 3. SERVICE ITEMS MASTER ─────────────────────────────
const newServiceItemName = ref("");
const showItemModal = ref(false);
const isEditingItem = ref(false);
const itemForm = ref({
  id: 0,
  itemName: "",
  isActive: true
});

const itemSearch = ref("");

const filteredItems = computed(() => {
  if (!itemSearch.value.trim()) return serviceItems.value;
  const q = itemSearch.value.toLowerCase().trim();
  return serviceItems.value.filter((s) => s.itemName.toLowerCase().includes(q));
});

const addQuickServiceItem = async () => {
  const trimmed = newServiceItemName.value.trim();
  if (!trimmed) {
    toast.error("Please enter a service name");
    return;
  }
  try {
    await createServiceItem(trimmed);
    newServiceItemName.value = "";
    toast.success("Service item added");
  } catch (err: any) {
    toast.error(err.response?.data?.message || err.message || "Failed to add service item");
  }
};

const openEditItemModal = (item: ServiceItem) => {
  isEditingItem.value = true;
  itemForm.value = {
    id: item.id,
    itemName: item.itemName,
    isActive: item.isActive
  };
  showItemModal.value = true;
};

const saveServiceItem = async () => {
  const trimmedName = itemForm.value.itemName.trim();
  if (!trimmedName) {
    toast.error("Please enter a service item name");
    return;
  }

  try {
    await updateServiceItem(itemForm.value.id, trimmedName);
    showItemModal.value = false;
    toast.success("Service item updated");
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to update service item");
  }
};

const handleToggleServiceStatus = async (id: number) => {
  try {
    await toggleServiceItem(id);
    toast.success("Status updated");
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to toggle status");
  }
};

const handleDeleteServiceItem = async (id: number) => {
  if (confirm("Are you sure you want to remove this service item from master catalog?")) {
    try {
      await deleteServiceItem(id);
      toast.info("Service item removed");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to remove service item");
    }
  }
};

// ── 4. SERVICE RATES ───────────────────────────────────
const showRateModal = ref(false);
const isEditingRate = ref(false);

const rateForm = ref({
  id: 0,
  serviceItemId: 0,
  customerTypeId: null as number | null,
  unit: "Month",
  regularRate: 0,
  minimumCharge: 0,
  effectiveFrom: new Date().toISOString().slice(0, 10)
});
const rateSearch = ref("");

const filteredRates = computed(() => {
  if (!rateSearch.value.trim()) return serviceRates.value;
  const q = rateSearch.value.toLowerCase().trim();
  return serviceRates.value.filter(
    (s) =>
      (s.itemName && s.itemName.toLowerCase().includes(q)) ||
      (s.typeName && s.typeName.toLowerCase().includes(q)) ||
      (s.unit && s.unit.toLowerCase().includes(q))
  );
});

const openAddRateModal = (prefillItem?: ServiceItem) => {
  isEditingRate.value = false;
  const firstItem = prefillItem || serviceItems.value[0];
  const firstType = customerTypes.value[0];
  const defaultUnit = firstItem?.itemName?.toLowerCase().includes("books") ? "MT" : "Month";
  rateForm.value = {
    id: 0,
    serviceItemId: firstItem?.id || 0,
    customerTypeId: firstType?.id || null,
    unit: defaultUnit,
    regularRate: 0,
    minimumCharge: 0,
    effectiveFrom: new Date().toISOString().slice(0, 10)
  };
  showRateModal.value = true;
};

const openEditRateModal = (rate: ServiceRate) => {
  isEditingRate.value = true;
  rateForm.value = {
    id: rate.id,
    serviceItemId: rate.serviceItemId,
    customerTypeId: rate.customerTypeId,
    unit: rate.unit || "Month",
    regularRate: rate.regularRate,
    minimumCharge: rate.minimumCharge,
    effectiveFrom: rate.effectiveFrom || new Date().toISOString().slice(0, 10)
  };
  showRateModal.value = true;
};

const handleSaveServiceRate = async () => {
  if (!rateForm.value.serviceItemId) {
    toast.error("Please select a service item");
    return;
  }
  if (rateForm.value.regularRate < 0) {
    toast.error("Regular rate cannot be negative");
    return;
  }

  try {
    if (isEditingRate.value && rateForm.value.id) {
      await updateServiceRate(rateForm.value.id, {
        serviceItemId: Number(rateForm.value.serviceItemId),
        customerTypeId: rateForm.value.customerTypeId ? Number(rateForm.value.customerTypeId) : null,
        unit: rateForm.value.unit || "Month",
        regularRate: Number(rateForm.value.regularRate) || 0,
        minimumCharge: Number(rateForm.value.minimumCharge) || 0,
        effectiveFrom: rateForm.value.effectiveFrom
      });
      toast.success("Service rate updated");
    } else {
      await createServiceRate({
        serviceItemId: Number(rateForm.value.serviceItemId),
        customerTypeId: rateForm.value.customerTypeId ? Number(rateForm.value.customerTypeId) : null,
        unit: rateForm.value.unit || "Month",
        regularRate: Number(rateForm.value.regularRate) || 0,
        minimumCharge: Number(rateForm.value.minimumCharge) || 0,
        effectiveFrom: rateForm.value.effectiveFrom
      });
      toast.success("Service rate saved");
    }
    showRateModal.value = false;
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to save service rate");
  }
};

const handleDeleteRate = async (id: number) => {
  if (confirm("Are you sure you want to remove this service rate?")) {
    try {
      await deleteServiceRate(id);
      toast.info("Service rate removed");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete rate");
    }
  }
};

// ── 5. EXPENSE HEADS ────────────────────────────────────
const showExpenseModal = ref(false);
const isEditingExpense = ref(false);
const expenseForm = ref<ExpenseHead>({
  id: 0,
  name: "",
  code: "",
  category: "Operational",
  description: "",
  isActive: true
});

const expenseCategories = ["Operational", "Administrative", "Statutory & Fees", "Marketing", "Miscellaneous"] as const;
const expenseSearch = ref("");

const filteredExpenses = computed(() => {
  if (!expenseSearch.value.trim()) return expenseHeads.value;
  const q = expenseSearch.value.toLowerCase().trim();
  return expenseHeads.value.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      (e.code && e.code.toLowerCase().includes(q)) ||
      (e.category && e.category.toLowerCase().includes(q))
  );
});

const openAddExpenseModal = () => {
  isEditingExpense.value = false;
  const count = expenseHeads.value.length + 1;
  expenseForm.value = {
    id: 0,
    name: "",
    code: `EXP-${String(count).padStart(2, "0")}`,
    category: "Operational",
    description: "",
    isActive: true
  };
  showExpenseModal.value = true;
};

const openEditExpenseModal = (item: ExpenseHead) => {
  isEditingExpense.value = true;
  expenseForm.value = { ...item };
  showExpenseModal.value = true;
};

const saveExpenseHead = async () => {
  const trimmedName = expenseForm.value.name.trim();
  if (!trimmedName) {
    toast.error("Please enter an expense head name");
    return;
  }

  try {
    if (isEditingExpense.value) {
      await updateExpenseHead(expenseForm.value.id, {
        name: trimmedName,
        code: expenseForm.value.code?.trim() || null,
        category: expenseForm.value.category,
        description: expenseForm.value.description?.trim() || null,
        isActive: expenseForm.value.isActive
      });
      toast.success("Expense head updated");
    } else {
      await createExpenseHead({
        name: trimmedName,
        code: expenseForm.value.code?.trim() || null,
        category: expenseForm.value.category,
        description: expenseForm.value.description?.trim() || null,
        isActive: expenseForm.value.isActive
      });
      toast.success("Expense head created");
    }
    showExpenseModal.value = false;
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to save expense head");
  }
};

const handleToggleExpenseStatus = async (id: number) => {
  try {
    await toggleExpenseHead(id);
    toast.success("Status updated");
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to toggle status");
  }
};

const handleDeleteExpenseHead = async (id: number) => {
  if (confirm("Are you sure you want to remove this expense head?")) {
    try {
      await deleteExpenseHead(id);
      toast.info("Expense head removed");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to remove expense head");
    }
  }
};

// ── 6. CLIENT REFERENCES & INTRODUCERS ──────────────────────
const showReferenceModal = ref(false);
const isEditingReference = ref(false);
const referenceForm = ref<ClientReference>({
  id: 0,
  name: "",
  phone: "",
  email: "",
  notes: "",
  isActive: true
});
const referenceSearch = ref("");

const filteredReferences = computed(() => {
  if (!referenceSearch.value.trim()) return references.value;
  const q = referenceSearch.value.toLowerCase().trim();
  return references.value.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      (r.phone && r.phone.toLowerCase().includes(q)) ||
      (r.email && r.email.toLowerCase().includes(q)) ||
      (r.notes && r.notes.toLowerCase().includes(q))
  );
});

const openAddReferenceModal = () => {
  isEditingReference.value = false;
  referenceForm.value = {
    id: 0,
    name: "",
    phone: "",
    email: "",
    notes: "",
    isActive: true
  };
  showReferenceModal.value = true;
};

const openEditReferenceModal = (refItem: ClientReference) => {
  isEditingReference.value = true;
  referenceForm.value = { ...refItem };
  showReferenceModal.value = true;
};

const saveReference = async () => {
  const trimmedName = referenceForm.value.name.trim();
  if (!trimmedName) {
    toast.error("Please enter a reference name");
    return;
  }

  try {
    if (isEditingReference.value) {
      await updateReference(referenceForm.value.id, {
        name: trimmedName,
        phone: referenceForm.value.phone?.trim() || undefined,
        email: referenceForm.value.email?.trim() || undefined,
        notes: referenceForm.value.notes?.trim() || undefined,
        isActive: referenceForm.value.isActive
      });
      toast.success("Reference updated");
    } else {
      await createReference({
        name: trimmedName,
        phone: referenceForm.value.phone?.trim() || undefined,
        email: referenceForm.value.email?.trim() || undefined,
        notes: referenceForm.value.notes?.trim() || undefined,
        isActive: referenceForm.value.isActive
      });
      toast.success("Reference added");
    }
    showReferenceModal.value = false;
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to save reference");
  }
};

const handleToggleReferenceStatus = async (refItem: ClientReference) => {
  try {
    await toggleReference(refItem.id);
    toast.success("Status updated");
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to update status");
  }
};

const handleDeleteReference = async (id: number) => {
  if (confirm("Are you sure you want to remove this reference?")) {
    try {
      await deleteReference(id);
      toast.info("Reference removed");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to remove reference");
    }
  }
};

// Term presets
const termPresets = [
  { label: "Standard (Due in 15 days)", value: "1. Payment is due within 15 days of invoice date.\n2. Please mention the invoice number as reference in payment.\n3. Checks/Transfers are subject to realization." },
  { label: "Due on Receipt", value: "1. Payment is due immediately upon receipt of this bill.\n2. Please settle via bank transfer or bKash merchant account." },
  { label: "Net 30 Days", value: "1. Payment term is Net 30 days from billing date.\n2. Overdue bills may accrue statutory late processing fees." },
  { label: "Advance Payment Condition", value: "1. 50% advance required before submission filing.\n2. Balance payable upon receipt of Mushak submission acknowledgment." }
];

const applyTermPreset = (e: Event) => {
  const val = (e.target as HTMLSelectElement).value;
  if (val) {
    form.value.invoiceTerms = val;
  }
};

const testMobile = ref("");
const isSendingTestSms = ref(false);
const testSmsSuccess = ref(false);

const sendTestSms = async () => {
  const cleanNumber = testMobile.value.trim().replace(/[\s\-\+]/g, "");
  if (!cleanNumber) {
    toast.error("Please enter a mobile number for test SMS");
    return;
  }
  isSendingTestSms.value = true;
  testSmsSuccess.value = false;
  try {
    const res = await axios.post("/api/auth/send-test-sms", {
      mobile: cleanNumber,
      apiKey: form.value.smsApiKey?.trim() || undefined,
      senderId: form.value.smsSenderId?.trim() || undefined
    });
    if (res.data?.success) {
      testSmsSuccess.value = true;
      toast.success(res.data?.message || "Test SMS sent successfully!");
      if (res.data?.smsBalance !== undefined && authStore.user) {
        (authStore.user as any).smsBalance = res.data.smsBalance;
      }
    } else {
      toast.error(res.data?.message || "Failed to send test SMS");
    }
  } catch (err: any) {
    const msg = err.response?.data?.message || err.response?.data?.error || err.message || "Error sending test SMS";
    toast.error(msg);
  } finally {
    isSendingTestSms.value = false;
  }
};

const handleResetToDefault = async () => {
  try {
    const userName = (authStore.user as any)?.name || "";
    const userEmail = (authStore.user as any)?.email || "";
    const userPhone = (authStore.user as any)?.mobile || "";
    form.value = {
      companyName: userName,
      proprietorName: userName,
      phone: userPhone,
      email: userEmail,
      website: "",
      address: "",
      binNumber: "",
      tinNumber: "",
      tradeLicenseNo: "",
      invoicePrefix: "INV",
      startingInvoiceNumber: 1001,
      currentInvoiceSequence: 1001,
      receiptPrefix: "MR",
      startingReceiptNumber: 5001,
      currentReceiptSequence: 5001,
      currency: "BDT (৳)",
      decimalPlaces: 2,
      invoiceTerms: "1. Payment is due within 15 days of invoice date.\n2. Please mention the invoice number as reference in payment.\n3. Checks/Transfers are subject to realization.",
      invoiceFooterText: "",
      receiptFooterText: "This is a computer-generated money receipt and does not require a physical signature.",
      autoDueCarryForward: true,
      binUniqueEnforcement: true,
      allowDuplicateMobile: true,
      allowNegativeBalance: false,
      smsApiKey: "",
      smsSenderId: "",
      smsProvider: "",
      smsEndpointUrl: "",
      services: [],
      expenseHeads: []
    };
    await updateCompanySettings(form.value);
    toast.success("Settings restored to defaults");
    showResetModal.value = false;
  } catch (err: any) {
    toast.error(err.response?.data?.message || "Failed to reset settings");
  }
};

onMounted(async () => {
  await Promise.all([
    fetchCompanySettings(),
    fetchBankAccounts(),
    fetchExpenseHeads(),
    fetchCustomerTypes(),
    fetchReferences(),
    fetchServiceItems(),
    fetchServiceRates(),
    fetchServiceUnits()
  ]);
  form.value = { ...company.value };
});
</script>

<template>
  <div class="py-2">
    <!-- Header & Breadcrumbs -->
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Dashboard
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">Firm Settings</span>
        </div>
        <h4 class="text-white fw-bold mb-0">Firm & Organization Settings</h4>
      </div>
    </div>

    <!-- Tabs Navigation Bar -->
    <div class="settings-tabs-wrapper mb-4">
      <ul class="nav nav-pills gap-2 flex-nowrap overflow-auto py-1">
        <li class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'profile' }"
            @click="activeTab = 'profile'"
          >
            <i class="bi bi-building me-1"></i> Firm Profile
          </button>
        </li>
        <li class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'invoice' }"
            @click="activeTab = 'invoice'"
          >
            <i class="bi bi-receipt me-1"></i> Invoice & Receipt
          </button>
        </li>
        <li class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'bank' }"
            @click="activeTab = 'bank'"
          >
            <i class="bi bi-bank me-1"></i> Bank & MFS ({{ bankAccounts?.length || 0 }})
          </button>
        </li>
        <li class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'items' }"
            @click="activeTab = 'items'"
          >
            <i class="bi bi-briefcase me-1"></i> Service Items ({{ serviceItems?.length || 0 }})
          </button>
        </li>
        <li class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'rates' }"
            @click="activeTab = 'rates'"
          >
            <i class="bi bi-tag me-1"></i> Service Rates ({{ serviceRates?.length || 0 }})
          </button>
        </li>
        <li class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'expenses' }"
            @click="activeTab = 'expenses'"
          >
            <i class="bi bi-cash-coin me-1"></i> Expense Heads ({{ expenseHeads?.length || 0 }})
          </button>
        </li>
        <li class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'references' }"
            @click="activeTab = 'references'"
          >
            <i class="bi bi-people-fill me-1"></i> References ({{ references?.length || 0 }})
          </button>
        </li>
        <li class="nav-item">
          <button
            class="nav-link"
            :class="{ active: activeTab === 'rules' }"
            @click="activeTab = 'rules'"
          >
            <i class="bi bi-sliders me-1"></i> Rules & Settings
          </button>
        </li>
      </ul>
    </div>

    <!-- Tab 1: Firm Profile -->
    <div v-if="activeTab === 'profile'" class="row g-4">
      <div class="col-lg-8">
        <div class="idp-card p-4 h-100">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-building-gear text-primary"></i> Company / Firm Information
            </h5>
            <span v-if="!isEditingProfile" class="badge bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-25 font-monospace">
              <i class="bi bi-lock-fill me-1"></i> Locked
            </span>
            <span v-else class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25 font-monospace">
              <i class="bi bi-pencil-fill me-1"></i> Editing
            </span>
          </div>

          <div class="row g-3">
            <div class="col-md-12">
              <label class="form-label text-light small fw-medium">Firm / Company Name <span class="text-danger">*</span></label>
              <input
                v-model="form.companyName"
                type="text"
                class="form-control idp-input"
                :disabled="!isEditingProfile"
                placeholder="e.g. ASSOCIATES & CO. VAT & TAX CONSULTANCY"
              />
              <div class="form-text text-muted small">This name will appear as the header on all printed Invoices and Money Receipts.</div>
            </div>

            <div class="col-md-6">
              <label class="form-label text-light small fw-medium">Authorized Signatory / Proprietor</label>
              <input
                v-model="form.proprietorName"
                type="text"
                class="form-control idp-input"
                :disabled="!isEditingProfile"
                placeholder="e.g. Advocate Md. Ruhul Amin"
              />
            </div>

            <div class="col-md-6">
              <label class="form-label text-light small fw-medium">Official Contact Phone</label>
              <input
                v-model="form.phone"
                type="text"
                class="form-control idp-input"
                :disabled="!isEditingProfile"
                placeholder="e.g. +880 1819-234567"
              />
            </div>

            <div class="col-md-6">
              <label class="form-label text-light small fw-medium">Billing / Support Email</label>
              <input
                v-model="form.email"
                type="email"
                class="form-control idp-input"
                :disabled="!isEditingProfile"
                placeholder="billing@associatesvat.com"
              />
            </div>

            <div class="col-md-6">
              <label class="form-label text-light small fw-medium">Website</label>
              <input
                v-model="form.website"
                type="text"
                class="form-control idp-input"
                :disabled="!isEditingProfile"
                placeholder="https://associatesvat.com"
              />
            </div>

            <div class="col-md-12">
              <label class="form-label text-light small fw-medium">Full Office Address</label>
              <textarea
                v-model="form.address"
                rows="2"
                class="form-control idp-input"
                :disabled="!isEditingProfile"
                placeholder="Suite # 504, City Heart Building, 67 Naya Paltan, VIP Road, Dhaka-1000"
              ></textarea>
            </div>
          </div>

          <h5 class="text-white fw-bold mt-4 mb-3 d-flex align-items-center gap-2 border-top border-secondary pt-3">
            <i class="bi bi-shield-check text-info"></i> Statutory Identifiers
          </h5>

          <div class="row g-3">
            <div class="col-md-4">
              <label class="form-label text-light small fw-medium">Firm BIN (13-Digit)</label>
              <input
                v-model="form.binNumber"
                type="text"
                class="form-control idp-input"
                :disabled="!isEditingProfile"
                placeholder="001234567-0101"
              />
            </div>

            <div class="col-md-4">
              <label class="form-label text-light small fw-medium">TIN Number (12-Digit)</label>
              <input
                v-model="form.tinNumber"
                type="text"
                class="form-control idp-input"
                :disabled="!isEditingProfile"
                placeholder="782910384721"
              />
            </div>

            <div class="col-md-4">
              <label class="form-label text-light small fw-medium">Trade License Number</label>
              <input
                v-model="form.tradeLicenseNo"
                type="text"
                class="form-control idp-input"
                :disabled="!isEditingProfile"
                placeholder="TRAD/DSCC/038291"
              />
            </div>
          </div>

          <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top border-secondary border-opacity-50">
            <button
              v-if="!isEditingProfile"
              type="button"
              class="btn btn-warning btn-sm px-4 fw-semibold text-dark shadow-sm"
              @click="isEditingProfile = true"
            >
              <i class="bi bi-pencil-square me-1"></i> Edit Profile
            </button>
            <template v-else>
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm px-3"
                @click="cancelProfileEdit"
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm px-4 fw-semibold shadow-sm"
                @click="handleSaveProfile"
              >
                <i class="bi bi-check2-circle me-1"></i> Save Changes
              </button>
            </template>
          </div>
        </div>
      </div>

      <!-- Firm Header Live Preview -->
      <div class="col-lg-4">
        <div class="idp-card p-4 h-100">
          <h6 class="text-white fw-bold mb-3 d-flex align-items-center gap-2">
            <i class="bi bi-eye text-warning"></i> Header Preview
          </h6>
          <div class="preview-bill-header p-3 rounded bg-dark border border-secondary text-center">
            <div class="fw-bold text-white fs-6 mb-1 text-uppercase">{{ form.companyName || 'YOUR FIRM NAME' }}</div>
            <div class="text-muted small mb-1">{{ form.address || 'Your office address here' }}</div>
            <div class="text-muted small">
              <span v-if="form.phone">📞 {{ form.phone }}</span>
              <span v-if="form.email" class="ms-2">✉️ {{ form.email }}</span>
            </div>
            <div v-if="form.binNumber" class="mt-2 text-info small font-monospace">
              BIN: {{ form.binNumber }}
            </div>
          </div>

          <div class="mt-4 p-3 rounded border border-secondary border-opacity-50 bg-dark small text-light text-opacity-75">
            <i class="bi bi-info-circle text-primary me-1"></i>
            This firm profile is uniquely tied to your admin account. When generating printable invoices, money receipts, and VAT compliance documents, these details will be rendered automatically.
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 2: Invoice & Receipt Branding -->
    <div v-if="activeTab === 'invoice'" class="row g-4">
      <div class="col-lg-8">
        <div class="idp-card p-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-file-earmark-text text-primary"></i> Numbering & Formats
            </h5>
            <span v-if="!isEditingBranding" class="badge bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-25 font-monospace">
              <i class="bi bi-lock-fill me-1"></i> Locked
            </span>
            <span v-else class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25 font-monospace">
              <i class="bi bi-pencil-fill me-1"></i> Editing
            </span>
          </div>

          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label text-light small fw-medium">Invoice Number Prefix</label>
              <input
                v-model="form.invoicePrefix"
                type="text"
                class="form-control idp-input font-monospace"
                :disabled="!isEditingBranding"
                placeholder="INV"
              />
            </div>

            <div class="col-md-6">
              <label class="form-label text-light small fw-medium">Money Receipt Prefix</label>
              <input
                v-model="form.receiptPrefix"
                type="text"
                class="form-control idp-input font-monospace"
                :disabled="!isEditingBranding"
                placeholder="RCP"
              />
            </div>

            <div class="col-md-6">
              <label class="form-label text-light small fw-medium">Currency Label</label>
              <input
                v-model="form.currency"
                type="text"
                class="form-control idp-input"
                :disabled="!isEditingBranding"
                placeholder="BDT (৳)"
              />
            </div>

            <div class="col-md-6">
              <label class="form-label text-light small fw-medium">Decimal Places</label>
              <select v-model="form.decimalPlaces" class="form-select idp-input" :disabled="!isEditingBranding">
                <option :value="0">0 (e.g. 5000 Tk)</option>
                <option :value="2">2 (e.g. 5000.00 Tk)</option>
              </select>
            </div>
          </div>

          <h5 class="text-white fw-bold mt-4 mb-3 d-flex align-items-center gap-2 border-top border-secondary pt-3">
            <i class="bi bi-card-text text-info"></i> Terms & Footer Branding
          </h5>

          <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <label class="form-label text-light small fw-medium mb-0">Invoice Terms & Conditions</label>
              <select class="form-select form-select-sm idp-input py-0" style="width: auto;" :disabled="!isEditingBranding" @change="applyTermPreset">
                <option value="">-- Apply Preset Terms --</option>
                <option v-for="(t, idx) in termPresets" :key="idx" :value="t.value">{{ t.label }}</option>
              </select>
            </div>
            <textarea
              v-model="form.invoiceTerms"
              rows="3"
              class="form-control idp-input small"
              :disabled="!isEditingBranding"
              placeholder="Enter standard payment terms and billing conditions..."
            ></textarea>
          </div>

          <div class="mb-3">
            <label class="form-label text-light small fw-medium">Invoice Footer Note</label>
            <textarea
              v-model="form.invoiceFooterText"
              rows="2"
              class="form-control idp-input small"
              :disabled="!isEditingBranding"
              placeholder="Thank you for your trusted business relationship..."
            ></textarea>
          </div>

          <div class="mb-3">
            <label class="form-label text-light small fw-medium">Money Receipt Footer Note</label>
            <textarea
              v-model="form.receiptFooterText"
              rows="2"
              class="form-control idp-input small"
              :disabled="!isEditingBranding"
              placeholder="Official money receipt acknowledgment..."
            ></textarea>
          </div>

          <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top border-secondary border-opacity-50">
            <button
              v-if="!isEditingBranding"
              type="button"
              class="btn btn-warning btn-sm px-4 fw-semibold text-dark shadow-sm"
              @click="isEditingBranding = true"
            >
              <i class="bi bi-pencil-square me-1"></i> Edit Branding & Terms
            </button>
            <template v-else>
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm px-3"
                @click="cancelBrandingEdit"
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm px-4 fw-semibold shadow-sm"
                @click="handleSaveBranding"
              >
                <i class="bi bi-check2-circle me-1"></i> Save Changes
              </button>
            </template>
          </div>
        </div>
      </div>

      <!-- Live Numbering Preview Card -->
      <div class="col-lg-4">
        <div class="idp-card p-4">
          <h6 class="text-white fw-bold mb-3 d-flex align-items-center gap-2">
            <i class="bi bi-tag text-success"></i> Live Formatting Preview
          </h6>

          <div class="p-3 bg-dark border border-secondary rounded mb-3">
            <div class="text-muted small mb-1">Next Generated Invoice No:</div>
            <div class="text-success font-monospace fs-5 fw-bold">
              {{ (form.invoicePrefix || 'INV').replace(/-+$/, '') }}-{{ new Date().getFullYear() }}-{{ String(form.currentInvoiceSequence || 1).padStart(6, '0') }}
            </div>
          </div>

          <div class="p-3 bg-dark border border-secondary rounded mb-3">
            <div class="text-muted small mb-1">Next Money Receipt No:</div>
            <div class="text-info font-monospace fs-5 fw-bold">
              {{ (form.receiptPrefix || 'RCP').replace(/-+$/, '') }}-{{ new Date().getFullYear() }}-{{ String(form.currentReceiptSequence || 1).padStart(6, '0') }}
            </div>
          </div>

          <div class="p-3 bg-dark border border-secondary rounded">
            <div class="text-muted small mb-1">Currency Preview:</div>
            <div class="text-light font-monospace fw-bold">
              {{ form.decimalPlaces === 2 ? '5000.00' : '5000' }} {{ form.currency }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab 3: Bank & MFS Accounts -->
    <div v-if="activeTab === 'bank'" class="d-flex flex-column gap-3">
      <div class="table-card">
        <div class="d-flex flex-wrap justify-content-between align-items-center p-3 p-md-4 pb-3 gap-2 border-bottom border-secondary border-opacity-25">
          <div>
            <h6 class="text-white fw-bold mb-1 d-flex align-items-center gap-2">
              <i class="bi bi-bank2 text-primary"></i> Firm Bank & MFS Accounts
            </h6>
            <p class="text-muted small mb-0">
              Manage bank accounts, routing numbers, and mobile financial services (bKash/Nagad) for invoice payment instructions.
            </p>
          </div>

          <button
            type="button"
            class="btn btn-primary btn-sm px-3 fw-semibold d-flex align-items-center gap-1 text-nowrap flex-shrink-0 shadow-sm"
            style="white-space: nowrap; height: 38px;"
            @click="openAddBankModal"
          >
            <i class="bi bi-plus-lg"></i> <span>Add Bank Account</span>
          </button>
        </div>

        <div class="table-responsive">
          <table class="table-custom">
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th>Bank & Branch</th>
                <th>Account Title & Number</th>
                <th>MFS (bKash / Nagad)</th>
                <th style="width: 100px; text-align: center;">Default</th>
                <th style="width: 100px; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(b, idx) in bankAccounts" :key="b.id">
                <td class="text-muted">{{ idx + 1 }}</td>
                <td>
                  <div class="fw-semibold text-white">{{ b.bankName }}</div>
                  <div class="text-muted small">{{ b.branchName || 'Main Branch' }}</div>
                  <div v-if="b.routingNumber" class="text-muted font-monospace" style="font-size: 0.75rem;">Routing: {{ b.routingNumber }}</div>
                </td>
                <td>
                  <div class="font-monospace text-info fw-bold">{{ b.accountNumber }}</div>
                  <div class="text-muted small">{{ b.accountName }}</div>
                </td>
                <td>
                  <div v-if="b.bkashNumber" class="small" style="color: #e2136e;">
                    <strong>bKash:</strong> {{ b.bkashNumber }}
                  </div>
                  <div v-if="b.nagadNumber" class="text-warning small">
                    <strong>Nagad:</strong> {{ b.nagadNumber }}
                  </div>
                  <div v-if="!b.bkashNumber && !b.nagadNumber" class="text-muted small">—</div>
                </td>
                <td style="text-align: center;">
                  <span v-if="b.isDefault" class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-50">
                    Primary
                  </span>
                  <span v-else class="text-muted small">—</span>
                </td>
                <td style="text-align: right;">
                  <div class="d-flex gap-1 justify-content-end">
                    <button class="action-btn btn-edit" title="Edit Bank Account" @click="openEditBankModal(b)">
                      <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button class="action-btn btn-del" title="Delete Bank Account" @click="handleDeleteBankAccount(b.id)">
                      <i class="bi bi-trash3-fill"></i>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="bankAccounts.length === 0">
                <td colspan="6" class="text-center py-5 text-muted">
                  <div class="d-flex flex-column align-items-center gap-2">
                    <i class="bi bi-bank fs-2 text-secondary"></i>
                    <span>No bank accounts found in database. Click "Add Bank Account" to add one.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab 4: Service Items -->
    <div v-if="activeTab === 'items'" class="d-flex flex-column gap-3">
      <!-- Add Service Item Card -->
      <div class="idp-card p-3 p-md-4">
        <div class="d-flex align-items-center gap-2 mb-3">
          <div class="p-2 rounded-2 bg-primary bg-opacity-10 text-primary">
            <i class="bi bi-briefcase-fill fs-5"></i>
          </div>
          <div>
            <h6 class="text-white fw-bold mb-0">Add Master Service Item</h6>
            <div class="text-muted small">Define a billable consulting, filing, or audit service item for your firm.</div>
          </div>
        </div>
        <form @submit.prevent="addQuickServiceItem" class="d-flex gap-2">
          <input
            v-model="newServiceItemName"
            type="text"
            class="form-control idp-input"
            placeholder="Item name (e.g. Monthly VAT Return Submission - Mushak 9.1)"
            required
            maxlength="100"
          />
          <button type="submit" class="btn btn-primary px-4 fw-semibold text-nowrap d-flex align-items-center gap-1">
            <i class="bi bi-plus-lg"></i> <span>Add Item</span>
          </button>
        </form>
      </div>

      <!-- Service Items Table Card -->
      <div class="table-card">
        <div class="d-flex flex-wrap justify-content-between align-items-center p-3 p-md-4 pb-3 gap-2 border-bottom border-secondary border-opacity-25">
          <div>
            <h6 class="text-white fw-bold mb-1">Master Service Items</h6>
            <p class="text-muted small mb-0">
              Master catalog of billable services for automatic invoicing and rate mapping.
            </p>
          </div>

          <SearchInput
            v-model="itemSearch"
            placeholder="Search service items..."
            max-width="260px"
          />
        </div>

        <div class="table-responsive">
          <table class="table-custom">
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th>Service Item Name</th>
                <th style="width: 140px;">Status</th>
                <th style="width: 100px; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(s, idx) in filteredItems" :key="s.id">
                <td class="text-muted">{{ idx + 1 }}</td>
                <td>
                  <span class="fw-semibold text-white">{{ s.itemName }}</span>
                </td>
                <td>
                  <button
                    type="button"
                    class="badge-btn"
                    :class="s.isActive ? 'badge-active' : 'badge-inactive'"
                    @click="handleToggleServiceStatus(s.id)"
                    title="Click to toggle active status"
                  >
                    <span class="dot"></span> {{ s.isActive ? 'Active' : 'Inactive' }}
                  </button>
                </td>
                <td style="text-align: right;">
                  <div class="d-flex gap-1 justify-content-end">
                    <button class="action-btn btn-edit" title="Edit Service Item" @click="openEditItemModal(s)">
                      <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button class="action-btn btn-del" title="Delete Service Item" @click="handleDeleteServiceItem(s.id)">
                      <i class="bi bi-trash3-fill"></i>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredItems.length === 0">
                <td colspan="4" class="text-center py-5 text-muted">
                  <div class="d-flex flex-column align-items-center gap-2">
                    <i class="bi bi-inbox fs-2 text-secondary"></i>
                    <span>No service items found. Add your first service item above.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab 5: Service Rates -->
    <div v-if="activeTab === 'rates'" class="d-flex flex-column gap-3">
      <div class="table-card">
        <div class="d-flex flex-wrap justify-content-between align-items-center p-3 p-md-4 pb-3 gap-2 border-bottom border-secondary border-opacity-25">
          <div>
            <h6 class="text-white fw-bold mb-1 d-flex align-items-center gap-2">
              <i class="bi bi-tag-fill text-success"></i> Standard Service Rates & Limits
            </h6>
            <p class="text-muted small mb-0">
              Configure billable service rates (Regular Rate) and minimum charge limits mapped by customer type.
            </p>
          </div>

          <div class="d-flex align-items-center gap-2 flex-nowrap">
            <SearchInput
              v-model="rateSearch"
              placeholder="Search rates..."
              max-width="240px"
            />
            <button
              type="button"
              class="btn btn-success btn-sm px-3 fw-semibold d-flex align-items-center gap-1 text-nowrap flex-shrink-0 shadow-sm"
              style="white-space: nowrap; height: 38px;"
              @click="openAddRateModal()"
            >
              <i class="bi bi-plus-lg"></i> <span>Add Rate</span>
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table-custom">
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th>Service Item</th>
                <th>Customer Type</th>
                <th style="text-align: right;">Regular Rate</th>
                <th style="text-align: right;">Min Charge</th>
                <th>Effective From</th>
                <th style="width: 100px; text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(s, idx) in filteredRates" :key="s.id">
                <td class="text-muted">{{ idx + 1 }}</td>
                <td>
                  <span class="fw-semibold text-white">{{ s.itemName || '—' }}</span>
                </td>
                <td>
                  <span class="badge bg-dark border border-secondary text-info fw-medium px-2 py-1">
                    {{ s.typeName || 'All Clients' }}
                  </span>
                </td>
                <td style="text-align: right;" class="font-monospace text-success fw-bold">
                  ৳ {{ s.regularRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                  <span class="text-muted fw-normal small" style="font-size: 0.72rem;">/ {{ s.unit || 'Month' }}</span>
                </td>
                <td style="text-align: right;" class="font-monospace text-warning fw-semibold">
                  ৳ {{ s.minimumCharge.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                </td>
                <td class="font-monospace text-muted small">
                  {{ s.effectiveFrom || '—' }}
                </td>
                <td style="text-align: right;">
                  <div class="d-flex gap-1 justify-content-end">
                    <button class="action-btn btn-edit" title="Update Rate" @click="openEditRateModal(s)">
                      <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button class="action-btn btn-del" title="Delete Rate" @click="handleDeleteRate(s.id)">
                      <i class="bi bi-trash3-fill"></i>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredRates.length === 0">
                <td colspan="7" class="text-center py-5 text-muted">
                  <div class="d-flex flex-column align-items-center gap-2">
                    <i class="bi bi-tag fs-2 text-secondary"></i>
                    <span>No service rates configured yet. Click "Add Rate" above.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab 6: Expense Heads -->
    <div v-if="activeTab === 'expenses'" class="d-flex flex-column gap-3">
      <div class="table-card">
        <div class="d-flex flex-wrap justify-content-between align-items-center p-3 p-md-4 pb-3 gap-2 border-bottom border-secondary border-opacity-25">
          <div>
            <h6 class="text-white fw-bold mb-1 d-flex align-items-center gap-2">
              <i class="bi bi-cash-coin text-warning"></i> Office Expense Heads
            </h6>
            <p class="text-muted small mb-0">
              Manage office operating expense heads, utility accounts, and statutory disbursement categories.
            </p>
          </div>

          <div class="d-flex align-items-center gap-2 flex-nowrap">
            <SearchInput
              v-model="expenseSearch"
              placeholder="Search expense heads..."
              max-width="240px"
            />
            <button
              type="button"
              class="btn btn-warning btn-sm px-3 fw-semibold text-dark d-flex align-items-center gap-1 text-nowrap flex-shrink-0 shadow-sm"
              style="white-space: nowrap; height: 38px;"
              @click="openAddExpenseModal"
            >
              <i class="bi bi-plus-lg"></i> <span>Add Expense Head</span>
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="table-custom">
            <thead>
              <tr>
                <th style="width: 50px;">#</th>
                <th style="width: 100px;">Code</th>
                <th>Expense Head Name & Description</th>
                <th>Category</th>
                <th style="width: 120px; text-align: center;">Status</th>
                <th style="width: 100px; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(exp, idx) in filteredExpenses" :key="exp.id">
                <td class="text-muted">{{ idx + 1 }}</td>
                <td>
                  <span class="font-monospace text-info small fw-bold">{{ exp.code || '—' }}</span>
                </td>
                <td>
                  <div class="fw-semibold text-white">{{ exp.name }}</div>
                  <div v-if="exp.description" class="text-muted small text-truncate" style="max-width: 400px;">
                    {{ exp.description }}
                  </div>
                </td>
                <td>
                  <span
                    class="badge"
                    :class="
                      exp.category === 'Operational' ? 'bg-primary' :
                      exp.category === 'Statutory & Fees' ? 'bg-danger' :
                      exp.category === 'Administrative' ? 'bg-info text-dark' : 'bg-secondary'
                    "
                  >
                    {{ exp.category }}
                  </span>
                </td>
                <td style="text-align: center;">
                  <button
                    type="button"
                    class="badge-btn"
                    :class="exp.isActive ? 'badge-active' : 'badge-inactive'"
                    @click="handleToggleExpenseStatus(exp.id)"
                    title="Click to toggle status"
                  >
                    <span class="dot"></span> {{ exp.isActive ? 'Active' : 'Inactive' }}
                  </button>
                </td>
                <td style="text-align: right;">
                  <div class="d-flex gap-1 justify-content-end">
                    <button class="action-btn btn-edit" title="Edit Expense Head" @click="openEditExpenseModal(exp)">
                      <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button class="action-btn btn-del" title="Delete Expense Head" @click="handleDeleteExpenseHead(exp.id)">
                      <i class="bi bi-trash3-fill"></i>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredExpenses.length === 0">
                <td colspan="6" class="text-center py-5 text-muted">
                  <div class="d-flex flex-column align-items-center gap-2">
                    <i class="bi bi-cash fs-2 text-secondary"></i>
                    <span>No expense heads found matching your search.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab 7: Client References & Introducers -->
    <div v-if="activeTab === 'references'" class="row g-4">
      <div class="col-12">
        <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
          <div>
            <h5 class="text-white fw-bold mb-1 d-flex align-items-center gap-2">
              <i class="bi bi-people-fill text-primary"></i> Client References & Introducers
            </h5>
            <p class="text-muted small mb-0">
              Manage partner references, tax associates, and introducers who refer client organizations to your firm.
            </p>
          </div>
          <button
            type="button"
            class="btn btn-primary btn-sm px-3 fw-semibold d-flex align-items-center gap-1 text-nowrap flex-shrink-0 shadow-sm"
            style="white-space: nowrap; height: 38px;"
            @click="openAddReferenceModal"
          >
            <i class="bi bi-plus-lg"></i>
            <span>Add Reference</span>
          </button>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="p-3 mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2 idp-card">
          <div class="d-flex flex-wrap align-items-center gap-2 flex-grow-1">
            <SearchInput
              v-model="referenceSearch"
              placeholder="Search reference name, phone, email..."
              min-width="260px"
              max-width="360px"
            />
          </div>
          <div class="text-muted small ps-2">
            Total: <strong class="text-white">{{ filteredReferences.length }}</strong> References
          </div>
        </div>

        <!-- References Table Card -->
        <div class="table-card shadow-sm">
          <table class="table-custom">
            <thead>
              <tr>
                <th style="width: 28%;">Reference / Introducer Name</th>
                <th style="width: 18%;">Phone Number</th>
                <th style="width: 22%;">Email Address</th>
                <th style="width: 16%;">Notes</th>
                <th style="width: 8%; text-align: center;">Status</th>
                <th style="width: 8%; text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="refItem in filteredReferences" :key="refItem.id">
                <td>
                  <div class="fw-semibold text-white">{{ refItem.name }}</div>
                </td>
                <td>
                  <span v-if="refItem.phone" class="font-monospace text-info small">
                    <i class="bi bi-telephone me-1"></i>{{ refItem.phone }}
                  </span>
                  <span v-else class="text-muted small">—</span>
                </td>
                <td>
                  <span v-if="refItem.email" class="text-light small">
                    <i class="bi bi-envelope me-1 text-muted"></i>{{ refItem.email }}
                  </span>
                  <span v-else class="text-muted small">—</span>
                </td>
                <td>
                  <span v-if="refItem.notes" class="text-muted small text-truncate d-inline-block" style="max-width: 220px;" :title="refItem.notes">
                    {{ refItem.notes }}
                  </span>
                  <span v-else class="text-muted small">—</span>
                </td>
                <td style="text-align: center;">
                  <button
                    type="button"
                    class="badge-btn"
                    :class="refItem.isActive ? 'badge-active' : 'badge-inactive'"
                    @click="handleToggleReferenceStatus(refItem)"
                    title="Click to toggle active status"
                  >
                    <span class="dot"></span> {{ refItem.isActive ? 'Active' : 'Inactive' }}
                  </button>
                </td>
                <td style="text-align: right;">
                  <div class="d-flex gap-1 justify-content-end">
                    <button class="action-btn btn-edit" title="Edit Reference" @click="openEditReferenceModal(refItem)">
                      <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button class="action-btn btn-del" title="Delete Reference" @click="handleDeleteReference(refItem.id)">
                      <i class="bi bi-trash3-fill"></i>
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="filteredReferences.length === 0">
                <td colspan="6" class="text-center py-5 text-muted">
                  <div class="d-flex flex-column align-items-center gap-2">
                    <i class="bi bi-people fs-2 text-secondary"></i>
                    <span>No references found. Click "Add Reference" to register an introducer.</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Tab 8: Rules & SMS -->
    <div v-if="activeTab === 'rules'" class="row g-4">
      <div class="col-lg-6">
        <div class="idp-card p-4 h-100">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-sliders text-primary"></i> Accounting & Validation Rules
            </h5>
            <span v-if="!isEditingRules" class="badge bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-25 font-monospace">
              <i class="bi bi-lock-fill me-1"></i> Locked
            </span>
            <span v-else class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25 font-monospace">
              <i class="bi bi-pencil-fill me-1"></i> Editing
            </span>
          </div>

          <div class="d-flex flex-column gap-3">
            <div class="d-flex justify-content-between align-items-center p-3 bg-dark border border-secondary rounded">
              <div>
                <div class="text-white fw-semibold small">Auto Carry-Forward Dues</div>
                <div class="text-muted small">Automatically carry forward previous unpaid dues into new monthly invoices.</div>
              </div>
              <div class="form-check form-switch mb-0">
                <input v-model="form.autoDueCarryForward" :disabled="!isEditingRules" class="form-check-input" type="checkbox" />
              </div>
            </div>

            <div class="d-flex justify-content-between align-items-center p-3 bg-dark border border-secondary rounded">
              <div>
                <div class="text-white fw-semibold small">Enforce Unique Client BIN</div>
                <div class="text-muted small">Disallow adding two separate clients with identical 13-digit BIN numbers.</div>
              </div>
              <div class="form-check form-switch mb-0">
                <input v-model="form.binUniqueEnforcement" :disabled="!isEditingRules" class="form-check-input" type="checkbox" />
              </div>
            </div>

            <div class="d-flex justify-content-between align-items-center p-3 bg-dark border border-secondary rounded">
              <div>
                <div class="text-white fw-semibold small">Allow Duplicate Mobile Numbers</div>
                <div class="text-muted small">Allow multiple sister concerns to share the same contact phone number.</div>
              </div>
              <div class="form-check form-switch mb-0">
                <input v-model="form.allowDuplicateMobile" :disabled="!isEditingRules" class="form-check-input" type="checkbox" />
              </div>
            </div>
          </div>

          <div class="d-flex justify-content-end gap-2 mt-4 pt-3 border-top border-secondary border-opacity-50">
            <button
              v-if="!isEditingRules"
              type="button"
              class="btn btn-warning btn-sm px-4 fw-semibold text-dark shadow-sm"
              @click="isEditingRules = true"
            >
              <i class="bi bi-pencil-square me-1"></i> Edit Rules & SMS
            </button>
            <template v-else>
              <button
                type="button"
                class="btn btn-outline-secondary btn-sm px-3"
                @click="cancelRulesEdit"
              >
                Cancel
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm px-4 fw-semibold shadow-sm"
                @click="handleSaveRules"
              >
                <i class="bi bi-check2-circle me-1"></i> Save Configuration
              </button>
            </template>
          </div>
        </div>
      </div>

      <!-- SMS Integration -->
      <div class="col-lg-6">
        <div class="idp-card p-4 h-100">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-chat-dots text-success"></i> Bulk SMS Notification Gateway
            </h5>
            <span v-if="!isEditingRules" class="badge bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-25 font-monospace">
              <i class="bi bi-lock-fill me-1"></i> Locked
            </span>
            <span v-else class="badge bg-warning bg-opacity-25 text-warning border border-warning border-opacity-25 font-monospace">
              <i class="bi bi-pencil-fill me-1"></i> Editing
            </span>
          </div>

          <div class="mb-3">
            <label class="form-label text-light small fw-medium">SMS Gateway Provider Name</label>
            <input 
              v-model="form.smsProvider" 
              type="text" 
              class="form-control idp-input" 
              :disabled="!isEditingRules" 
              placeholder="e.g. BulkSMSBD, GreenWeb, etc." 
            />
          </div>

          <div class="mb-3">
            <label class="form-label text-light small fw-medium">API Endpoint URL</label>
            <input 
              v-model="form.smsEndpointUrl" 
              type="text" 
              class="form-control idp-input font-monospace" 
              :disabled="!isEditingRules" 
              placeholder="e.g. http://bulksmsbd.net/api/smsapi" 
            />
          </div>

          <div class="mb-3">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <label class="form-label text-light small fw-medium mb-0">SMS API Key</label>
              <span v-if="company.isSmsConfigured" class="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 fs-9">
                <i class="bi bi-shield-check me-1"></i> Saved: {{ company.maskedSmsApiKey }}
              </span>
            </div>
            <input
              v-model="form.smsApiKey"
              type="password"
              class="form-control idp-input"
              :disabled="!isEditingRules"
              :placeholder="company.isSmsConfigured ? '•••••••••••••••• (Leave blank to keep existing key)' : 'Enter your BulkSMSBD API token...'"
            />
          </div>

          <div class="mb-3">
            <label class="form-label text-light small fw-medium">Sender ID / Masking</label>
            <input
              v-model="form.smsSenderId"
              type="text"
              class="form-control idp-input"
              :disabled="!isEditingRules"
              placeholder="e.g. MyBrand"
            />
          </div>

          <!-- Test SMS Row -->
          <div class="p-3 bg-dark border border-secondary rounded mt-3">
            <label class="form-label text-light small fw-medium">Test SMS Sending</label>
            <div class="d-flex gap-2">
              <input
                v-model="testMobile"
                type="text"
                class="form-control form-control-sm idp-input"
                placeholder="017XXXXXXXX"
              />
              <button
                type="button"
                class="btn btn-sm btn-outline-success px-3 d-flex align-items-center gap-1"
                :disabled="isSendingTestSms"
                @click="sendTestSms"
              >
                <span v-if="isSendingTestSms" class="spinner-border spinner-border-sm"></span>
                <i v-else class="bi bi-send"></i>
                <span>{{ isSendingTestSms ? 'Sending...' : 'Send Test' }}</span>
              </button>
            </div>
            <div v-if="testSmsSuccess" class="text-success small mt-2">
              <i class="bi bi-check-circle me-1"></i> Test SMS dispatched successfully to {{ testMobile }}.
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 1. Add / Edit Service Item Modal -->
    <!-- 1. Edit Service Item Modal -->
    <div
      v-if="showItemModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.75);"
    >
      <div class="modal-dialog modal-dialog-centered" style="max-width: 460px;">
        <div class="modal-content idp-card shadow-lg border border-secondary border-opacity-25" style="border-radius: 12px;">
          <div class="modal-header border-0 pb-0 pt-4 px-4 d-flex justify-content-between align-items-start">
            <h5 class="modal-title text-white fw-bold mb-0">
              <i class="bi bi-briefcase text-primary me-2"></i> Edit Service Item
            </h5>
            <button type="button" class="btn-close btn-close-white" @click="showItemModal = false"></button>
          </div>
          <div class="modal-body px-4 py-3">
            <div class="mb-3">
              <label class="form-label text-light small fw-medium">Service Item Name <span class="text-danger">*</span></label>
              <input
                v-model="itemForm.itemName"
                type="text"
                class="form-control idp-input"
                placeholder="Item name (e.g. Books Of Accounts Maintenance)"
                required
              />
            </div>

            <div class="form-check form-switch pt-1">
              <input v-model="itemForm.isActive" class="form-check-input" type="checkbox" id="itemActiveCheck" />
              <label class="form-check-label text-light small" for="itemActiveCheck">Active in Firm Service List</label>
            </div>
          </div>
          <div class="modal-footer border-0 pt-0 pb-4 px-4 d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-secondary btn-sm px-3 text-light" style="background-color: #1e293b; border: 1px solid #334155;" @click="showItemModal = false">Cancel</button>
            <button type="button" class="btn btn-primary btn-sm px-4 fw-semibold" @click="saveServiceItem">
              Save Service Item
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. Add / Edit Service Rate Modal -->
    <div
      v-if="showRateModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.75);"
    >
      <div class="modal-dialog modal-dialog-centered" style="max-width: 460px;">
        <div class="modal-content idp-card shadow-lg border border-secondary border-opacity-25" style="border-radius: 12px;">
          <div class="modal-header border-0 pb-0 pt-4 px-4 d-flex justify-content-between align-items-start">
            <div>
              <h5 class="modal-title text-white fw-bold mb-1">{{ isEditingRate ? 'Edit Service Rate' : 'Add Service Rate' }}</h5>
              <p class="text-muted small mb-0">
                {{ isEditingRate ? 'Update rate and unit settings for this service' : 'Add a new rate with billing unit. Previous rates remain as history.' }}
              </p>
            </div>
            <button type="button" class="btn-close btn-close-white" @click="showRateModal = false"></button>
          </div>
          <div class="modal-body px-4 py-3">
            <!-- Service Item -->
            <div class="mb-3">
              <label class="form-label text-light small fw-medium mb-1">Service Item <span class="text-danger">*</span></label>
              <select
                v-model="rateForm.serviceItemId"
                class="form-select idp-input"
              >
                <option :value="0" disabled>Select service item</option>
                <option v-for="srv in serviceItems" :key="srv.id" :value="srv.id">
                  {{ srv.itemName }}
                </option>
              </select>
            </div>

            <!-- Customer Type -->
            <div class="mb-3">
              <label class="form-label text-light small fw-medium mb-1">Customer Type</label>
              <select
                v-model="rateForm.customerTypeId"
                class="form-select idp-input"
              >
                <option :value="null">All / General Client</option>
                <option v-for="ct in customerTypes" :key="ct.id" :value="ct.id">
                  {{ ct.typeName }}
                </option>
              </select>
            </div>

            <!-- Billing Unit / Basis -->
            <div class="mb-3">
              <label class="form-label text-light small fw-medium mb-1">Billing Unit / Basis <span class="text-danger">*</span></label>
              <select
                v-model="rateForm.unit"
                class="form-select idp-input font-monospace"
                required
              >
                <option v-for="u in serviceUnits" :key="u.id" :value="u.code">
                  {{ u.name }} ({{ u.code }})
                </option>
                <option v-if="serviceUnits.length === 0" value="Month">Per Month / Return</option>
                <option v-if="serviceUnits.length === 0" value="MT">Per MT (Metric Ton)</option>
                <option v-if="serviceUnits.length === 0" value="Entry">Per Entry / Invoice</option>
                <option v-if="serviceUnits.length === 0" value="Job">Per Job / One-time</option>
                <option v-if="serviceUnits.length === 0" value="PCS">Per Piece / Item</option>
                <option v-if="serviceUnits.length === 0" value="Fixed">Flat / Fixed Fee</option>
              </select>
            </div>

            <!-- Regular Rate & Minimum Charge -->
            <div class="row g-3 mb-3">
              <div class="col-6">
                <label class="form-label text-light small fw-medium mb-1">Regular Rate (৳)</label>
                <input
                  v-model.number="rateForm.regularRate"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-control idp-input font-monospace text-emerald-400 fw-bold"
                  placeholder="0.00"
                />
              </div>
              <div class="col-6">
                <label class="form-label text-light small fw-medium mb-1">Minimum Charge (৳)</label>
                <input
                  v-model.number="rateForm.minimumCharge"
                  type="number"
                  min="0"
                  step="0.01"
                  class="form-control idp-input font-monospace text-warning fw-bold"
                  placeholder="0.00"
                />
              </div>
            </div>

            <!-- Effective From (Date Picker Only - No manual typing) -->
            <div class="mb-2">
              <label class="form-label text-light small fw-medium mb-1">Effective From</label>
              <input
                v-model="rateForm.effectiveFrom"
                type="date"
                class="form-control idp-input font-monospace cursor-pointer"
                onkeydown="return false"
                required
              />
            </div>
          </div>
          <div class="modal-footer border-0 pt-0 pb-4 px-4 d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-secondary btn-sm px-3 text-light" style="background-color: #1e293b; border: 1px solid #334155;" @click="showRateModal = false">Cancel</button>
            <button type="button" class="btn btn-light btn-sm px-4 fw-semibold text-dark" @click="handleSaveServiceRate">
              Save Rate
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add / Edit Expense Head Modal -->
    <div
      v-if="showExpenseModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.75);"
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content idp-card">
          <div class="modal-header">
            <h5 class="modal-title text-white">
              <i class="bi bi-cash-coin text-warning me-2"></i>
              {{ isEditingExpense ? 'Edit Expense Head' : 'Add New Expense Head' }}
            </h5>
            <button type="button" class="btn-close" @click="showExpenseModal = false"></button>
          </div>
          <div class="modal-body p-4">
            <div class="row g-3 mb-3">
              <div class="col-8">
                <label class="form-label text-light small fw-medium">Expense Head Name <span class="text-danger">*</span></label>
                <input
                  v-model="expenseForm.name"
                  type="text"
                  class="form-control idp-input"
                  placeholder="e.g. Office Rent"
                />
              </div>
              <div class="col-4">
                <label class="form-label text-light small fw-medium">Code</label>
                <input
                  v-model="expenseForm.code"
                  type="text"
                  class="form-control idp-input font-monospace text-uppercase"
                  placeholder="EXP-01"
                />
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label text-light small fw-medium">Category</label>
              <select v-model="expenseForm.category" class="form-select idp-input">
                <option v-for="cat in expenseCategories" :key="cat" :value="cat">{{ cat }}</option>
              </select>
            </div>

            <div class="mb-3">
              <label class="form-label text-light small fw-medium">Description / Details</label>
              <textarea
                v-model="expenseForm.description"
                rows="2"
                class="form-control idp-input small"
                placeholder="What this expense covers..."
              ></textarea>
            </div>

            <div class="form-check form-switch">
              <input v-model="expenseForm.isActive" class="form-check-input" type="checkbox" id="expActiveCheck" />
              <label class="form-check-label text-light small" for="expActiveCheck">Active in Expense Ledger</label>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-idp-secondary btn-sm" @click="showExpenseModal = false">Cancel</button>
            <button type="button" class="btn btn-warning btn-sm px-4 fw-semibold text-dark" @click="saveExpenseHead">
              <i class="bi bi-check-lg me-1"></i> Save Expense Head
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Add / Edit Bank Account Modal -->
    <div
      v-if="showBankModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.75);"
    >
      <div class="modal-dialog modal-dialog-centered" style="max-width: 500px;">
        <div class="modal-content idp-card shadow-lg border border-secondary border-opacity-25" style="border-radius: 12px;">
          <div class="modal-header border-0 pb-0 pt-4 px-4 d-flex justify-content-between align-items-start">
            <h5 class="modal-title text-white fw-bold mb-0">
              <i class="bi bi-bank text-primary me-2"></i> {{ isEditingBank ? 'Edit Bank Account' : 'Add Bank Account' }}
            </h5>
            <button type="button" class="btn-close btn-close-white" @click="showBankModal = false"></button>
          </div>
          <div class="modal-body px-4 py-3">
            <div class="row g-3 mb-3">
              <div class="col-12">
                <label class="form-label text-light small fw-medium mb-1">Bank Name <span class="text-danger">*</span></label>
                <input
                  v-model="bankForm.bankName"
                  type="text"
                  class="form-control idp-input"
                  placeholder="e.g. Dutch-Bangla Bank PLC"
                  required
                />
              </div>

              <div class="col-12">
                <label class="form-label text-light small fw-medium mb-1">Account Title / Name <span class="text-danger">*</span></label>
                <input
                  v-model="bankForm.accountName"
                  type="text"
                  class="form-control idp-input"
                  placeholder="e.g. Associates & Co. Consultancy"
                  required
                />
              </div>

              <div class="col-md-7">
                <label class="form-label text-light small fw-medium mb-1">Account Number <span class="text-danger">*</span></label>
                <input
                  v-model="bankForm.accountNumber"
                  type="text"
                  class="form-control idp-input font-monospace"
                  placeholder="115.120.987654"
                  required
                />
              </div>

              <div class="col-md-5">
                <label class="form-label text-light small fw-medium mb-1">Routing Number</label>
                <input
                  v-model="bankForm.routingNumber"
                  type="text"
                  class="form-control idp-input font-monospace"
                  placeholder="090271829"
                />
              </div>

              <div class="col-12">
                <label class="form-label text-light small fw-medium mb-1">Branch Name</label>
                <input
                  v-model="bankForm.branchName"
                  type="text"
                  class="form-control idp-input"
                  placeholder="e.g. Naya Paltan Branch, Dhaka"
                />
              </div>

              <div class="col-md-6">
                <label class="form-label text-light small fw-medium mb-1">bKash Account (Optional)</label>
                <input
                  v-model="bankForm.bkashNumber"
                  type="text"
                  class="form-control idp-input font-monospace"
                  placeholder="01819234567"
                />
              </div>

              <div class="col-md-6">
                <label class="form-label text-light small fw-medium mb-1">Nagad Account (Optional)</label>
                <input
                  v-model="bankForm.nagadNumber"
                  type="text"
                  class="form-control idp-input font-monospace"
                  placeholder="01711234567"
                />
              </div>
            </div>

            <div class="d-flex gap-4 pt-1">
              <div class="form-check form-switch">
                <input v-model="bankForm.isDefault" class="form-check-input" type="checkbox" id="bankDefaultCheck" />
                <label class="form-check-label text-light small" for="bankDefaultCheck">Primary / Default for Invoices</label>
              </div>
              <div class="form-check form-switch">
                <input v-model="bankForm.isActive" class="form-check-input" type="checkbox" id="bankActiveCheck" />
                <label class="form-check-label text-light small" for="bankActiveCheck">Active</label>
              </div>
            </div>
          </div>
          <div class="modal-footer border-0 pt-0 pb-4 px-4 d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-secondary btn-sm px-3 text-light" style="background-color: #1e293b; border: 1px solid #334155;" @click="showBankModal = false">Cancel</button>
            <button type="button" class="btn btn-primary btn-sm px-4 fw-semibold" @click="saveBankAccount">
              Save Bank Account
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Add / Edit Reference Modal -->
    <div
      v-if="showReferenceModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.75);"
    >
      <div class="modal-dialog modal-dialog-centered" style="max-width: 480px;">
        <div class="modal-content idp-card shadow-lg border border-secondary border-opacity-25" style="border-radius: 12px;">
          <div class="modal-header border-0 pb-0 pt-4 px-4 d-flex justify-content-between align-items-start">
            <div>
              <h5 class="modal-title text-white fw-bold mb-1">
                <i class="bi bi-people-fill text-primary me-2"></i>
                {{ isEditingReference ? 'Edit Reference' : 'Add Client Reference' }}
              </h5>
              <p class="text-muted small mb-0">
                {{ isEditingReference ? 'Update introducer details and contact info' : 'Register a new referral person or partner organization' }}
              </p>
            </div>
            <button type="button" class="btn-close btn-close-white" @click="showReferenceModal = false"></button>
          </div>
          <div class="modal-body px-4 py-3">
            <div class="mb-3">
              <label class="form-label text-light small fw-medium">Reference / Introducer Name <span class="text-danger">*</span></label>
              <input
                v-model="referenceForm.name"
                type="text"
                class="form-control idp-input"
                placeholder="e.g. Md. Aminul Islam or Rahman & Associates"
                required
              />
            </div>

            <div class="row g-3 mb-3">
              <div class="col-6">
                <label class="form-label text-light small fw-medium">Phone Number</label>
                <input
                  v-model="referenceForm.phone"
                  type="text"
                  class="form-control idp-input"
                  placeholder="017XXXXXXXX"
                />
              </div>
              <div class="col-6">
                <label class="form-label text-light small fw-medium">Email Address</label>
                <input
                  v-model="referenceForm.email"
                  type="email"
                  class="form-control idp-input"
                  placeholder="name@email.com"
                />
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label text-light small fw-medium">Notes / Remarks</label>
              <textarea
                v-model="referenceForm.notes"
                rows="2"
                class="form-control idp-input"
                placeholder="Designation, firm name, commission arrangement, or notes..."
              ></textarea>
            </div>

            <div class="form-check form-switch pt-1">
              <input v-model="referenceForm.isActive" class="form-check-input" type="checkbox" id="refActiveCheck" />
              <label class="form-check-label text-light small" for="refActiveCheck">Active (Selectable when adding clients)</label>
            </div>
          </div>
          <div class="modal-footer border-0 pt-0 pb-4 px-4 d-flex justify-content-end gap-2">
            <button type="button" class="btn btn-secondary btn-sm px-3 text-light" style="background-color: #1e293b; border: 1px solid #334155;" @click="showReferenceModal = false">Cancel</button>
            <button type="button" class="btn btn-primary btn-sm px-4 fw-semibold" @click="saveReference">
              {{ isEditingReference ? 'Update Reference' : 'Save Reference' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reset Confirmation Modal -->
    <div
      v-if="showResetModal"
      class="modal fade show d-block"
      tabindex="-1"
      style="background: rgba(0, 0, 0, 0.75);"
    >
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content idp-card text-center p-4">
          <i class="bi bi-exclamation-triangle text-warning fs-1 mb-2"></i>
          <h5 class="text-white fw-bold">Reset Settings?</h5>
          <p class="text-muted small">
            This will restore all firm profile fields, branding texts, service rates, and expense heads back to the system defaults.
          </p>
          <div class="d-flex justify-content-center gap-2 mt-3">
            <button type="button" class="btn btn-idp-secondary btn-sm px-3" @click="showResetModal = false">Cancel</button>
            <button type="button" class="btn btn-danger btn-sm px-3" @click="handleResetToDefault">Reset All</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.admin-settings-container {
  width: 100%;
  padding-bottom: 2.5rem;
}

.settings-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #f8f9fa;
  margin: 0 0 0.25rem;
  letter-spacing: -0.3px;
}

.settings-subtitle {
  font-size: 0.86rem;
  color: #adb5bd;
  margin: 0;
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
  padding: 0.45rem 0.95rem;
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

.btn-idp-secondary {
  background-color: #343a40;
  color: #f8f9fa;
  border: 1px solid #495057;
}

.btn-idp-secondary:hover {
  background-color: #495057;
  color: #fff;
}

.cursor-pointer {
  cursor: pointer;
}

/* ── Integrated Search Box ───────────────────────────── */
.search-box {
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #6c757d;
  pointer-events: none;
  font-size: 0.82rem;
}

.idp-search-input {
  background-color: #15181c !important;
  border: 1px solid #3a4149 !important;
  color: #f8f9fa !important;
  padding-left: 36px !important;
  padding-right: 32px !important;
  border-radius: 6px;
  font-size: 0.85rem;
  height: 36px;
}

.idp-search-input:focus {
  border-color: #0d6efd !important;
  box-shadow: 0 0 0 0.15rem rgba(13, 110, 253, 0.25) !important;
}

.clear-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: #6c757d;
  cursor: pointer;
  padding: 2px 6px;
  font-size: 0.95rem;
}

.clear-btn:hover {
  color: #f8f9fa;
}

/* ── Modern Dark Table & Card Styles ─────────────────── */
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

.table-custom thead tr {
  background: #16191d;
  border-bottom: 1px solid #343a40;
}

.table-custom th {
  padding: 12px 16px;
  font-size: 0.74rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #adb5bd;
  text-align: left;
  border-bottom: 1px solid #343a40;
}

.table-custom td {
  padding: 13px 16px;
  font-size: 0.85rem;
  border-bottom: 1px solid #282d34;
  vertical-align: middle;
  color: #e2e8f0;
}

.table-custom tbody tr:hover td {
  background: #252a30;
}

.table-custom tbody tr:last-child td {
  border-bottom: none;
}

/* ── Status Badges ───────────────────────────────────── */
.badge-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.73rem;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.badge-active {
  background: rgba(25, 135, 84, 0.15);
  color: #20c997;
  border: 1px solid rgba(25, 135, 84, 0.35);
}

.badge-active:hover {
  background: rgba(25, 135, 84, 0.25);
}

.badge-inactive {
  background: rgba(108, 117, 125, 0.15);
  color: #adb5bd;
  border: 1px solid rgba(108, 117, 125, 0.35);
}

.badge-inactive:hover {
  background: rgba(108, 117, 125, 0.25);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

/* ── Action Buttons ──────────────────────────────────── */
.action-btn {
  width: 30px;
  height: 30px;
  border-radius: 5px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-edit {
  background: rgba(59, 142, 237, 0.12);
  color: #3b8eed;
  border: 1px solid rgba(59, 142, 237, 0.3);
}

.btn-edit:hover {
  background: rgba(59, 142, 237, 0.25);
  color: #60a5fa;
}

.btn-del {
  background: rgba(220, 53, 69, 0.12);
  color: #ea868f;
  border: 1px solid rgba(220, 53, 69, 0.28);
}

.btn-del:hover {
  background: rgba(220, 53, 69, 0.25);
  color: #f87171;
}

.idp-input:disabled,
.form-select.idp-input:disabled {
  background-color: rgba(18, 21, 26, 0.65) !important;
  border-color: rgba(255, 255, 255, 0.08) !important;
  color: #94a3b8 !important;
  cursor: not-allowed;
  opacity: 0.82;
}

.form-check-input:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
