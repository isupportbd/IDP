import { ref, watch } from "vue";

export interface FirmServiceItem {
  id: number;
  name: string;
  defaultRate: number;
  minimumCharge: number;
  category?: string;
  description?: string;
  customerType?: string;
  effectiveFrom?: string;
  isActive: boolean;
}

export interface FirmExpenseHead {
  id: number;
  name: string;
  code?: string;
  category: "Operational" | "Administrative" | "Statutory & Fees" | "Marketing" | "Miscellaneous";
  description?: string;
  isActive: boolean;
}

export interface FirmSettings {
  // Company Profile
  companyName: string;
  proprietorName: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  logoUrl: string;
  binNumber: string;
  tinNumber: string;
  tradeLicenseNo: string;

  // Invoice & Receipt Branding
  invoiceActive: boolean;
  invoicePrefix: string;
  startingInvoiceNumber: number;
  currentInvoiceSequence: number;
  receiptPrefix: string;
  startingReceiptNumber: number;
  currentReceiptSequence: number;
  currency: string;
  decimalPlaces: number;
  invoiceTerms: string;
  invoiceFooterText: string;
  receiptFooterText: string;

  // Bank & MFS Accounts for Invoices
  bankName: string;
  branchName: string;
  accountName: string;
  accountNumber: string;
  routingNumber: string;
  bkashNumber: string;
  nagadNumber: string;

  // Print Setup
  printPageSize: "A4" | "A5" | "LETTER" | "LEGAL";
  printOrientation: "portrait" | "landscape";
  printMarginTop: number;
  printMarginBottom: number;
  printShowLogo: boolean;
  printShowHeader: boolean;
  printShowFooter: boolean;
  printCopies: "ORIGINAL" | "DUPLICATE" | "BOTH";
  printSignatureLine: boolean;
  printSignatureLabel: string;
  printSignatureUrl: string;

  // Rules & Controls
  autoDueCarryForward: boolean;
  allowNegativeBalance: boolean;
  defaultMinimumCharge: number;
  defaultTaxPercent: number;
  binUniqueEnforcement: boolean;
  allowDuplicateMobile: boolean;

  // Messaging / SMS
  smsApiKey: string;
  smsSenderId: string;
  autoMessagingEnabled: boolean;

  // Services Catalog
  services: FirmServiceItem[];

  // Expense Heads
  expenseHeads: FirmExpenseHead[];
}

const STORAGE_KEY = "idp_firm_settings";

const defaultFirmSettings: FirmSettings = {
  companyName: "ASSOCIATES & CO. VAT & TAX CONSULTANCY",
  proprietorName: "Advocate Md. Ruhul Amin",
  phone: "+880 1819-234567",
  email: "billing@associatesvat.com",
  website: "https://associatesvat.com",
  address: "Suite # 504, City Heart Building, 67 Naya Paltan, VIP Road, Dhaka-1000",
  logoUrl: "",
  binNumber: "001234567-0101",
  tinNumber: "782910384721",
  tradeLicenseNo: "TRAD/DSCC/038291",

  invoiceActive: true,
  invoicePrefix: "INV-",
  startingInvoiceNumber: 1,
  currentInvoiceSequence: 105,
  receiptPrefix: "REC-",
  startingReceiptNumber: 1,
  currentReceiptSequence: 48,
  currency: "Tk",
  decimalPlaces: 2,
  invoiceTerms: "1. Payment is due within 15 days of invoice date.\n2. Please mention the invoice number as reference in payment.\n3. Checks/Transfers are subject to realization.",
  invoiceFooterText: "Thank you for your trusted partnership. For any billing queries, please contact our accounts department.",
  receiptFooterText: "Official payment acknowledgment. Thank you for your payment.",

  bankName: "Dutch-Bangla Bank Limited",
  branchName: "Principal Branch, Motijheel, Dhaka",
  accountName: "Associates & Co. Consultancy",
  accountNumber: "115.120.0039482",
  routingNumber: "090271829",
  bkashNumber: "01819-234567 (Merchant)",
  nagadNumber: "01711-987654 (Personal)",

  printPageSize: "A4",
  printOrientation: "portrait",
  printMarginTop: 10,
  printMarginBottom: 10,
  printShowLogo: true,
  printShowHeader: true,
  printShowFooter: true,
  printCopies: "ORIGINAL",
  printSignatureLine: true,
  printSignatureLabel: "Authorized Signatory",
  printSignatureUrl: "",

  autoDueCarryForward: true,
  allowNegativeBalance: false,
  defaultMinimumCharge: 1500,
  defaultTaxPercent: 0,
  binUniqueEnforcement: true,
  allowDuplicateMobile: false,

  smsApiKey: "",
  smsSenderId: "VAT-IDP",
  autoMessagingEnabled: false,

  services: [],

  expenseHeads: [
    { id: 1, name: "Office Rent", code: "EXP-01", category: "Operational", description: "Monthly commercial space rental charges", isActive: true },
    { id: 2, name: "Electricity & Utility Bills", code: "EXP-02", category: "Operational", description: "Power, gas, and water utility bills", isActive: true },
    { id: 3, name: "Staff Conveyance & Travel", code: "EXP-03", category: "Operational", description: "Field client visit, VAT circle visit, and local transport allowance", isActive: true },
    { id: 4, name: "Entertainment & Refreshment", code: "EXP-04", category: "Administrative", description: "Client tea, coffee, snacks, and office pantry supplies", isActive: true },
    { id: 5, name: "Government Challan & NBR Fees", code: "EXP-05", category: "Statutory & Fees", description: "Treasury deposit challan, appeal fees, and regulatory stamp charges", isActive: true },
    { id: 6, name: "Printing, Stationery & Photocopy", code: "EXP-06", category: "Administrative", description: "Mushak registers, letterheads, cartridges, and paper reams", isActive: true },
    { id: 7, name: "Internet, Software & Server Subscription", code: "EXP-07", category: "Administrative", description: "Broadband, portal fees, cloud hosting, and bulk SMS bundles", isActive: true },
    { id: 8, name: "Legal, Advisory & Auditor Retainer", code: "EXP-08", category: "Statutory & Fees", description: "Senior advocate opinion, barrister honorarium, and tribunal fees", isActive: true },
    { id: 9, name: "Office Maintenance & Cleaning", code: "EXP-09", category: "Operational", description: "Janitorial supplies, AC servicing, and repairs", isActive: true },
    { id: 10, name: "Miscellaneous Office Expenses", code: "EXP-10", category: "Miscellaneous", description: "Incidental and petty cash office disbursements", isActive: true }
  ]
};

// Global reactive singleton for firm settings
const firmSettings = ref<FirmSettings>(loadSettings());

function loadSettings(): FirmSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...defaultFirmSettings,
        ...parsed,
        services: (parsed.services && parsed.services.length >= defaultFirmSettings.services.length)
          ? parsed.services
          : defaultFirmSettings.services,
        expenseHeads: (parsed.expenseHeads && parsed.expenseHeads.length >= defaultFirmSettings.expenseHeads.length)
          ? parsed.expenseHeads
          : defaultFirmSettings.expenseHeads
      };
    }
  } catch (e) {
    console.warn("Failed to parse firm settings from localStorage, using default", e);
  }
  return { ...defaultFirmSettings };
}

function saveSettings(newSettings: FirmSettings) {
  firmSettings.value = { ...newSettings };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(firmSettings.value));
  } catch (e) {
    console.error("Failed to save firm settings", e);
  }
}

function resetSettings() {
  firmSettings.value = { ...defaultFirmSettings };
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error("Failed to reset firm settings", e);
  }
}

export function useFirmSettings() {
  return {
    firmSettings,
    saveSettings,
    resetSettings
  };
}
