import { ref } from "vue";
import axios from "axios";

export interface CompanySettings {
  id?: number;
  companyName: string;
  proprietorName?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  logoUrl?: string | null;
  binNumber?: string | null;
  tinNumber?: string | null;
  tradeLicenseNo?: string | null;
  invoicePrefix?: string;
  startingInvoiceNumber?: number;
  currentInvoiceSequence?: number;
  receiptPrefix?: string;
  startingReceiptNumber?: number;
  currentReceiptSequence?: number;
  currency?: string;
  decimalPlaces?: number;
  invoiceTerms?: string | null;
  invoiceFooterText?: string | null;
  receiptFooterText?: string | null;
  autoDueCarryForward: boolean;
  binUniqueEnforcement: boolean;
  allowDuplicateMobile: boolean;
  allowNegativeBalance?: boolean;
  smsApiKey?: string | null;
  smsSenderId?: string | null;
  services?: any[];
  expenseHeads?: any[];
}

export interface BankAccount {
  id: number;
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchName?: string | null;
  routingNumber?: string | null;
  bkashNumber?: string | null;
  nagadNumber?: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export interface ExpenseHead {
  id: number;
  name: string;
  code?: string | null;
  category: "Operational" | "Administrative" | "Statutory & Fees" | "Marketing" | "Miscellaneous";
  description?: string | null;
  isActive: boolean;
}

export function useFirmApi() {
  const company = ref<CompanySettings>({
    companyName: "",
    proprietorName: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    binNumber: "",
    tinNumber: "",
    tradeLicenseNo: "",
    invoicePrefix: "INV",
    startingInvoiceNumber: 1001,
    currentInvoiceSequence: 1001,
    receiptPrefix: "RCP",
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
    smsSenderId: "VAT-IDP",
    services: [],
    expenseHeads: []
  });

  const bankAccounts = ref<BankAccount[]>([]);
  const expenseHeads = ref<ExpenseHead[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // ── 1. COMPANY SETTINGS ─────────────────────────────
  const fetchCompanySettings = async () => {
    loading.value = true;
    try {
      const res = await axios.get("/api/firm/settings");
      if (res.data.data) {
        company.value = res.data.data;
      }
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
    } finally {
      loading.value = false;
    }
  };

  const updateCompanySettings = async (payload: Partial<CompanySettings>) => {
    loading.value = true;
    try {
      const res = await axios.put("/api/firm/settings", payload);
      company.value = res.data.data;
      return res.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      throw err;
    } finally {
      loading.value = false;
    }
  };

  // ── 2. BANK ACCOUNTS ────────────────────────────────
  const fetchBankAccounts = async () => {
    try {
      const res = await axios.get("/api/firm/bank-accounts");
      bankAccounts.value = res.data.data || [];
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
    }
  };

  const createBankAccount = async (payload: Omit<BankAccount, "id">) => {
    const res = await axios.post("/api/firm/bank-accounts", payload);
    await fetchBankAccounts();
    return res.data;
  };

  const updateBankAccount = async (id: number, payload: Partial<BankAccount>) => {
    const res = await axios.patch(`/api/firm/bank-accounts/${id}`, payload);
    await fetchBankAccounts();
    return res.data;
  };

  const deleteBankAccount = async (id: number) => {
    const res = await axios.delete(`/api/firm/bank-accounts/${id}`);
    bankAccounts.value = bankAccounts.value.filter((b) => b.id !== id);
    return res.data;
  };

  // ── 3. EXPENSE HEADS ────────────────────────────────
  const fetchExpenseHeads = async () => {
    try {
      const res = await axios.get("/api/firm/expense-heads");
      expenseHeads.value = res.data.data || [];
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
    }
  };

  const createExpenseHead = async (payload: Omit<ExpenseHead, "id">) => {
    const res = await axios.post("/api/firm/expense-heads", payload);
    await fetchExpenseHeads();
    return res.data;
  };

  const updateExpenseHead = async (id: number, payload: Partial<ExpenseHead>) => {
    const res = await axios.patch(`/api/firm/expense-heads/${id}`, payload);
    await fetchExpenseHeads();
    return res.data;
  };

  const toggleExpenseHead = async (id: number) => {
    const res = await axios.patch(`/api/firm/expense-heads/${id}/toggle`);
    const item = expenseHeads.value.find((e) => e.id === id);
    if (item) item.isActive = !item.isActive;
    return res.data;
  };

  const deleteExpenseHead = async (id: number) => {
    const res = await axios.delete(`/api/firm/expense-heads/${id}`);
    expenseHeads.value = expenseHeads.value.filter((e) => e.id !== id);
    return res.data;
  };

  return {
    company,
    bankAccounts,
    expenseHeads,
    loading,
    error,
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
  };
}
