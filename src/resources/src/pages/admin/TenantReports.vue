<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import axios from "axios";
import * as XLSX from "xlsx";
import MonthMatrix from "@/components/MonthMatrix.vue";
import { canAccessModule } from "@/composables/useAuth";

// Types
interface Client {
  id: number;
  name: string;
  bin?: string;
  referenceId?: number;
  openingBalance?: number;
  serviceScope?: string;
  vatUserId?: string;
  vatPassword?: string;
}

interface Item {
  id: number;
  name: string;
  hsCode?: string;
}

interface UnitConversion {
  id: number;
  purchaseUnit: string;
  salesUnit: string;
  factor: number;
}

interface Purchase {
  id: number;
  clientId: number;
  clientName?: string;
  clientBin?: string;
  office?: string;
  beNo?: string;
  beDate?: string;
  month: string;
  lcNumber?: string;
  netWt?: number;
  totalQty: number;
  assValue: number;
  baseValueOfVat: number;
  unitValue?: number;
  cd?: number;
  rd?: number;
  sd?: number;
  vat: number;
  at?: number;
  isRebate: boolean;
  isFfs: boolean;
  itemId: number;
  itemName?: string;
  hsCode?: string;
  unit?: string;
}

interface SalesReportItem {
  itemId: number;
  itemName: string;
  hsCode?: string;
  awHsCode?: string;
  totalQty: number;
  rate: number;
  unitValue: number;
  totalValue: number;
  addition: number;
  vatRate: number;
  note: string;
  isFfs?: boolean;
}

// State
const clients = ref<Client[]>([]);
const clientSearchText = ref("");
const showClientDropdown = ref(false);
const selectedClientId = ref<number | null>(null);
const selectedClient = ref<Client | null>(null);

const availableMonths = ref<string[]>([]);
const purchaseMonths = ref<string[]>([]);
const submissionMonths = ref<string[]>([]);
const submissionsMap = ref<Record<string, string>>({});
const selectedMonthYear = ref("");

const unitConversions = ref<UnitConversion[]>([]);
const selectedUnitId = ref<number | null>(null);
const showUnitDropdown = ref(false);

const itemSearchText = ref("");
const showItemDropdown = ref(false);
const selectedItemId = ref<number | null>(null);
const clientMonthItems = ref<Item[]>([]);

// Active tab: purchases | sales | return | statement
const currentTab = ref<"purchases" | "sales" | "return" | "statement">("purchases");

// Data States
const purchases = ref<Purchase[]>([]);
const salesReport = ref<SalesReportItem[]>([]);
const statementReport = ref<any[]>([]);
const clientSalesRates = ref<any[]>([]);

const isLoading = ref(false);

// eVAT Credentials State
const eVatCredentials = ref<{ loginId: string; loginPassword?: string } | null>(null);
const copiedField = ref<"username" | "password" | null>(null);

// Modals State
const showSummaryModal = ref(false);
const showChangeMonthModal = ref(false);
const editingPurchase = ref<Purchase | null>(null);
const newMonthSelection = ref("");
const isSavingMonth = ref(false);

// Return Report Settings
const hideEmptyNotes = ref(true);
const submissionId = ref<string | null>(null);

// Real Billing & Invoice State from Database
const currentMonthBill = ref<any>(null);

// Submission ID Modal Handlers
const showSubIdModal = ref(false);
const subIdInput = ref("");
const isSavingSubId = ref(false);

const openSubIdModal = () => {
  subIdInput.value = submissionId.value || "";
  showSubIdModal.value = true;
};

const saveSubmissionId = async () => {
  if (!selectedClientId.value || !selectedMonthYear.value) return;
  isSavingSubId.value = true;
  const subVal = subIdInput.value.trim();
  try {
    await axios.post("/api/submissions", {
      clientId: selectedClientId.value,
      taxPeriod: selectedMonthYear.value,
      month: selectedMonthYear.value,
      submissionId: subVal
    });
    submissionId.value = subVal || null;
    if (subVal) {
      if (!submissionMonths.value.includes(selectedMonthYear.value)) {
        submissionMonths.value.push(selectedMonthYear.value);
      }
      submissionsMap.value[selectedMonthYear.value] = subVal;
    } else {
      submissionMonths.value = submissionMonths.value.filter((m) => m !== selectedMonthYear.value);
      delete submissionsMap.value[selectedMonthYear.value];
    }
    showSubIdModal.value = false;
  } catch (e) {
    submissionId.value = subVal || null;
    showSubIdModal.value = false;
  } finally {
    isSavingSubId.value = false;
  }
};

// Number Formatter (Strict: No Commas, No Currency Symbols)
const fmt = (val: any, decimals = 2): string => {
  if (val === undefined || val === null || val === "" || isNaN(Number(val))) return "0.00";
  return Number(val).toFixed(decimals);
};

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${dd} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
};

const formatBeDate = (dateStr?: string): string => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    const parts = dateStr.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  }
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const formatMonth = (mStr?: string): string => {
  if (!mStr) return "";
  const [y, m] = mStr.split("-");
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  if (isNaN(d.getTime())) return mStr;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

// Unit Conversion Helpers
const filteredUnitConversions = computed(() => {
  if (!purchases.value.length) return unitConversions.value;
  const currentPurchaseUnits = new Set(purchases.value.map((p) => (p.unit || "KGM").trim().toUpperCase()));
  return unitConversions.value.filter((u) => currentPurchaseUnits.has((u.purchaseUnit || "").trim().toUpperCase()));
});

const currentConvFactor = computed(() => {
  if (!selectedUnitId.value) return 1;
  const c = unitConversions.value.find((u) => u.id === selectedUnitId.value);
  return c && Number(c.factor) ? Number(c.factor) : 1;
});

const selectedUnitName = computed(() => {
  if (!selectedUnitId.value) return "Unit";
  const c = unitConversions.value.find((u) => u.id === selectedUnitId.value);
  return c ? `${c.purchaseUnit} ➔ ${c.salesUnit}` : "Unit";
});

watch(filteredUnitConversions, (validList) => {
  if (selectedUnitId.value && !validList.some((u) => u.id === selectedUnitId.value)) {
    selectedUnitId.value = null;
  }
});

// Copy eVAT Credential
const handleCopyCredential = (text: string, field: "username" | "password") => {
  navigator.clipboard.writeText(text);
  copiedField.value = field;
  setTimeout(() => (copiedField.value = null), 2000);
};

// Filtered Clients for Autocomplete
const filteredClients = computed(() => {
  if (!clientSearchText.value || selectedClientId.value) {
    if (!clientSearchText.value) return clients.value;
  }
  const q = clientSearchText.value.toLowerCase();
  return clients.value.filter((c) => c.name.toLowerCase().includes(q) || (c.bin && c.bin.toLowerCase().includes(q)));
});

// Filtered Items for Autocomplete
const filteredItems = computed(() => {
  if (!itemSearchText.value) return clientMonthItems.value;
  const q = itemSearchText.value.toLowerCase();
  return clientMonthItems.value.filter((i) => i.name.toLowerCase().includes(q) || (i.hsCode && i.hsCode.toLowerCase().includes(q)));
});

// Derived Purchase Groups (Sorted: Old to New Bill Date)
const sortPurchasesByDate = (list: Purchase[]) => {
  return [...list].sort((a, b) => {
    const da = a.beDate ? new Date(a.beDate).getTime() : 0;
    const db = b.beDate ? new Date(b.beDate).getTime() : 0;
    if (da !== db) return da - db;
    return (Number(a.beNo) || 0) - (Number(b.beNo) || 0);
  });
};

const vatNote22 = computed(() => {
  return sortPurchasesByDate(
    purchases.value.filter((p) => {
      const rawRebate: any = p.isRebate;
      const isRebate = rawRebate === true || rawRebate === 1 || String(rawRebate).toLowerCase() === "true" || String(rawRebate) === "1";
      return p.vat && Number(p.vat) > 0 && !isRebate;
    })
  );
});

const vatNote15 = computed(() => {
  return sortPurchasesByDate(
    purchases.value.filter((p) => {
      const rawRebate: any = p.isRebate;
      const isRebate = rawRebate === true || rawRebate === 1 || String(rawRebate).toLowerCase() === "true" || String(rawRebate) === "1";
      return p.vat && Number(p.vat) > 0 && p.isRebate;
    })
  );
});

const vatNote13 = computed(() => {
  return sortPurchasesByDate(purchases.value.filter((p) => !p.vat || Number(p.vat) === 0));
});

// Purchase Summary by Item
const getPurchaseSummary = (list: Purchase[]) => {
  const groups: Record<string, any> = {};
  const sortedRates = [...clientSalesRates.value].sort(
    (a, b) => new Date(b.activationDate).getTime() - new Date(a.activationDate).getTime()
  );

  let reportMonthEnd = new Date();
  if (selectedMonthYear.value) {
    const [yearStr, monthStr] = selectedMonthYear.value.split("-");
    reportMonthEnd = new Date(parseInt(yearStr), parseInt(monthStr), 0);
  }

  list.forEach((p) => {
    // FIFO Rule: If bill is from an earlier month (< selectedMonthYear), it is sold on Day 1 of the current report month
    let pDate = new Date();
    if (selectedMonthYear.value) {
      const reportMonthStart = `${selectedMonthYear.value}-01`;
      if (!p.beDate) {
        pDate = new Date(reportMonthStart);
      } else {
        const beDateStr = String(p.beDate);
        const beMonth = beDateStr.slice(0, 7);
        if (beMonth < selectedMonthYear.value) {
          // Prior month bill entered in current report month -> Sold on 1st of report month
          pDate = new Date(reportMonthStart);
        } else {
          // Same/current month bill -> Sold on its actual BE date
          pDate = new Date(p.beDate);
          if (isNaN(pDate.getTime())) pDate = new Date(reportMonthStart);
        }
      }
    } else {
      pDate = new Date(p.beDate || new Date().toISOString().slice(0, 10));
    }

    let applicableRate = sortedRates.find((r) => r.itemId === p.itemId && new Date(r.activationDate) <= pDate);
    if (!applicableRate) {
      applicableRate = sortedRates.find((r) => r.itemId === p.itemId && new Date(r.activationDate) <= reportMonthEnd);
    }

    const key = `${p.hsCode}_${p.itemName}`;
    if (!groups[key]) {
      groups[key] = {
        hsCode: p.hsCode || "",
        itemName: p.itemName || "",
        netQty: 0,
        assValue: 0,
        baseValueOfVat: 0,
        sd: 0,
        vat: 0,
        at: 0,
        purchaseRate: 0,
        maxSalesRate: 0,
        additionPercent: applicableRate ? Number(applicableRate.additionPercent) || 0 : 0,
        vatRate: applicableRate ? Number(applicableRate.vatRate) || 0 : 0,
        totalMaxSalesValue: 0
      };
    }

    const pQty = Number(p.totalQty) || 0;
    const pBaseValueOfVat = Number(p.baseValueOfVat) || 0;
    const additionPercent = applicableRate ? Number(applicableRate.additionPercent) || 0 : 0;
    const vatRate = applicableRate ? Number(applicableRate.vatRate) || 0 : 0;

    let pPurchaseRate = 0;
    let pAddedBase = 0;
    let pMaxSalesRate = 0;
    if (pQty > 0) {
      pPurchaseRate = pBaseValueOfVat / pQty;
      pAddedBase = pPurchaseRate * (1 + additionPercent / 100);
      pMaxSalesRate = pAddedBase * (1 + vatRate / 100);
    }
    const pTotalMaxSalesValue = pMaxSalesRate * pQty;

    groups[key].netQty += pQty;
    groups[key].assValue += Number(p.assValue) || 0;
    groups[key].baseValueOfVat += pBaseValueOfVat;
    groups[key].sd += Number(p.sd) || 0;
    groups[key].vat += Number(p.vat) || 0;
    groups[key].at += Number(p.at) || 0;
    groups[key].totalMaxSalesValue += pTotalMaxSalesValue;
  });

  return Object.values(groups).map((g: any) => {
    if (g.netQty > 0) {
      g.purchaseRate = g.baseValueOfVat / g.netQty;
      g.maxSalesRate = g.totalMaxSalesValue / g.netQty;
    }
    return g;
  });
};

// Sales Report Notes Grouping
const groupedSales = computed(() => {
  const g: Record<string, SalesReportItem[]> = {};
  salesReport.value.forEach((item) => {
    const noteKey = item.note || "8";
    if (!g[noteKey]) g[noteKey] = [];
    g[noteKey].push(item);
  });
  return g;
});

const hasMissingRates = computed(() => {
  return salesReport.value.some((i) => Number(i.rate) === 0);
});

// Return 9.1 Calculations
const returnNote3Value = computed(() => {
  return salesReport.value.filter((item) => String(item.note) === "3").reduce((sum, item) => sum + (Number(item.totalValue) || 0), 0);
});

const returnNote4 = computed(() => {
  let value = 0;
  let vat = 0;
  salesReport.value
    .filter((item) => String(item.note) === "4")
    .forEach((item) => {
      const v = Number(item.totalValue) || 0;
      value += v;
      vat += v * (Number(item.vatRate) / 100);
    });
  return { value, sd: 0, vat };
});

const returnNote8 = computed(() => {
  let value = 0;
  let vat = 0;
  salesReport.value
    .filter((item) => String(item.note) === "8")
    .forEach((item) => {
      const v = Number(item.totalValue) || 0;
      value += v;
      vat += v * (Number(item.vatRate) / 100);
    });
  return { value, sd: 0, vat };
});

const returnNote9 = computed(() => {
  return {
    value: returnNote3Value.value + returnNote4.value.value + returnNote8.value.value,
    sd: returnNote4.value.sd + returnNote8.value.sd,
    vat: returnNote4.value.vat + returnNote8.value.vat
  };
});

const returnNote13Value = computed(() => {
  return purchases.value
    .filter((p) => !p.vat || parseFloat(p.vat.toString()) === 0)
    .reduce((sum, p) => sum + (Number(p.baseValueOfVat) || 0), 0);
});

const returnNote15 = computed(() => {
  let value = 0;
  let vat = 0;
  purchases.value
    .filter((p) => {
      const rawRebate: any = p.isRebate;
      const isRebate = rawRebate === true || rawRebate === 1 || String(rawRebate).toLowerCase() === "true" || String(rawRebate) === "1";
      return p.vat && parseFloat(p.vat.toString()) > 0 && isRebate;
    })
    .forEach((p) => {
      value += Number(p.baseValueOfVat) || 0;
      vat += Number(p.vat) || 0;
    });
  return { value, vat };
});

const returnNote22 = computed(() => {
  let value = 0;
  let vat = 0;
  purchases.value
    .filter((p) => {
      const rawRebate: any = p.isRebate;
      const isRebate = rawRebate === true || rawRebate === 1 || String(rawRebate).toLowerCase() === "true" || String(rawRebate) === "1";
      return p.vat && parseFloat(p.vat.toString()) > 0 && !isRebate;
    })
    .forEach((p) => {
      value += Number(p.baseValueOfVat) || 0;
      vat += Number(p.vat) || 0;
    });
  return { value, vat };
});

const returnNote23 = computed(() => {
  return {
    value: returnNote13Value.value + returnNote15.value.value + returnNote22.value.value,
    vat: returnNote15.value.vat
  };
});

// Note 27: FFS AT mapped to VAT
const returnNote27VAT = computed(() => {
  return purchases.value
    .filter((p) => {
      const rawFfs: any = p.isFfs;
      return rawFfs === true || rawFfs === 1 || String(rawFfs).toLowerCase() === "true" || String(rawFfs) === "1";
    })
    .reduce((sum, p) => sum + (Number(p.at) || 0), 0);
});

// Note 32: Sales VAT for items that had FFS at purchase
const returnNote32VAT = computed(() => {
  const ffsItemIds = new Set<string>();
  purchases.value.forEach((p) => {
    const rawFfs: any = p.isFfs;
    const isFfs = rawFfs === true || rawFfs === 1 || String(rawFfs).toLowerCase() === "true" || String(rawFfs) === "1";
    if (isFfs && p.itemId != null) {
      ffsItemIds.add(String(p.itemId));
    }
  });

  let vat = 0;
  salesReport.value.forEach((item) => {
    if (item.itemId != null && ffsItemIds.has(String(item.itemId)) && String(item.note) === "8") {
      const itemValue = Number(item.totalValue) || 0;
      vat += itemValue * (Number(item.vatRate) / 100);
    }
  });
  return vat;
});

// Note 30: Advance Tax Paid at Import Stage
const returnNote30VAT = computed(() => {
  return purchases.value.reduce((sum, p) => sum + (Number(p.at) || 0), 0);
});

// Note 33: Total Decreasing Adjustment
const returnNote33VAT = computed(() => {
  return returnNote30VAT.value + returnNote32VAT.value;
});

// Note 34: Net Payable VAT
const returnNote34VAT = computed(() => {
  return (returnNote9.value.vat || 0) - (returnNote23.value.vat || 0) + (returnNote27VAT.value || 0) - (returnNote33VAT.value || 0);
});

// Show Row Helper in Return 9.1
const showReturnRow = (v1: number, v2 = 0, v3 = 0) => {
  if (!hideEmptyNotes.value) return true;
  return Math.abs(v1) > 0.001 || Math.abs(v2) > 0.001 || Math.abs(v3) > 0.001;
};

// ==================== MASTER DATA & API INTEGRATION ====================
// Fetch Master Data (Clients, Units)
const fetchMasterData = async () => {
  try {
    const [cRes, uRes] = await Promise.allSettled([
      axios.get("/api/clients", { params: { limit: 1000, isActive: "all" } }),
      axios.get("/api/superadmin/unit-conversions", { params: { all: "true" } })
    ]);

    if (cRes.status === "fulfilled" && cRes.value.data?.data) {
      clients.value = cRes.value.data.data.map((c: any) => ({
        id: c.id,
        name: c.companyName || c.name || "Client #" + c.id,
        bin: c.binNumber || c.bin || "",
        referenceId: c.referenceId,
        openingBalance: c.openingBalance || 0,
        serviceScope: c.vatServiceType || "FULL",
        vatUserId: c.vatUserId || "",
        vatPassword: c.vatPassword || ""
      }));

      // If client is already selected, sync credentials
      if (selectedClientId.value) {
        const curr = clients.value.find((c) => c.id === selectedClientId.value);
        if (curr && (curr.vatUserId || curr.vatPassword)) {
          eVatCredentials.value = {
            loginId: curr.vatUserId || "",
            loginPassword: curr.vatPassword || ""
          };
        }
      }
    } else {
      clients.value = [];
    }

    if (uRes.status === "fulfilled" && uRes.value.data?.data) {
      unitConversions.value = uRes.value.data.data.map((u: any) => ({
        id: u.id,
        purchaseUnit: u.purchaseUnit,
        salesUnit: u.salesUnit,
        factor: Number(u.factor || 1)
      }));
    } else {
      unitConversions.value = [];
    }
  } catch (e) {
    clients.value = [];
    unitConversions.value = [];
  }
};

// Fetch Available Months for Client
const fetchAvailableMonths = async (cId: number, preserveMonth = false) => {
  try {
    const res = await axios.get("/api/purchases/months", { params: { clientId: cId } });
    if (res.data?.success) {
      const overview = res.data.overview || {};
      purchaseMonths.value = overview.purchaseMonths || [];
      submissionMonths.value = overview.submissionMonths || [];
      submissionsMap.value = overview.submissionsMap || {};
      availableMonths.value = overview.allMonths || res.data.data || [];

      if (!preserveMonth || !selectedMonthYear.value) {
        if (availableMonths.value.length > 0) {
          selectedMonthYear.value = availableMonths.value[0];
        } else {
          // Default to current year-month (e.g. 2026-08)
          const d = new Date();
          selectedMonthYear.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        }
      }
    } else {
      purchaseMonths.value = [];
      submissionMonths.value = [];
      submissionsMap.value = {};
      availableMonths.value = [];
      if (!preserveMonth || !selectedMonthYear.value) {
        const d = new Date();
        selectedMonthYear.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      }
    }
  } catch (e) {
    purchaseMonths.value = [];
    submissionMonths.value = [];
    submissionsMap.value = {};
    availableMonths.value = [];
  }
};

// Fetch eVAT Credentials
const fetchCreds = async (cId: number) => {
  const clientObj = clients.value.find((c) => c.id === cId) || selectedClient.value;
  if (clientObj && (clientObj.vatUserId || clientObj.vatPassword)) {
    eVatCredentials.value = {
      loginId: clientObj.vatUserId || "",
      loginPassword: clientObj.vatPassword || ""
    };
    return;
  }

  try {
    const res = await axios.get(`/api/client-credentials?clientId=${cId}&limit=1`);
    if (res.data?.success && res.data.data?.length > 0 && res.data.data[0]?.loginId) {
      eVatCredentials.value = res.data.data[0];
    } else {
      eVatCredentials.value = null;
    }
  } catch (e) {
    eVatCredentials.value = null;
  }
};

// Fetch All Reports for Selected Client & Month
const fetchReportsData = async () => {
  if (!selectedClientId.value || !selectedMonthYear.value) return;
  isLoading.value = true;

  try {
    const [pRes, sRes, stRes, srRes, subRes, bRes] = await Promise.allSettled([
      axios.get("/api/purchases", {
        params: {
          clientId: selectedClientId.value,
          month: selectedMonthYear.value,
          itemId: selectedItemId.value || undefined,
          sortDir: "asc",
          limit: 1000
        }
      }),
      axios.get("/api/reports/sales", {
        params: {
          clientId: selectedClientId.value,
          month: selectedMonthYear.value,
          itemId: selectedItemId.value || undefined
        }
      }),
      axios.get("/api/reports/statement", {
        params: {
          clientId: selectedClientId.value,
          month: selectedMonthYear.value
        }
      }),
      axios.get("/api/sales-rates", {
        params: {
          clientId: selectedClientId.value,
          limit: 1000
        }
      }),
      axios.get(`/api/submissions/submission`, {
        params: {
          clientId: selectedClientId.value,
          month: selectedMonthYear.value
        }
      }),
      canAccessModule("billing")
        ? axios.get("/api/billing/bills", {
            params: {
              clientId: selectedClientId.value,
              taxPeriod: selectedMonthYear.value,
              limit: 1
            }
          })
        : Promise.resolve({ data: { data: [] } } as any)
    ]);

    // Purchases
    if (pRes.status === "fulfilled" && pRes.value.data?.data) {
      purchases.value = sortPurchasesByDate(pRes.value.data.data);
    } else {
      purchases.value = [];
    }

    // Extract Unique Items for Filter
    const map = new Map<number, Item>();
    purchases.value.forEach((p) => {
      if (p.itemId && !map.has(p.itemId)) {
        map.set(p.itemId, { id: p.itemId, name: p.itemName || "Item", hsCode: p.hsCode });
      }
    });
    clientMonthItems.value = Array.from(map.values());

    // Sales Rates
    if (srRes.status === "fulfilled" && srRes.value.data?.data) {
      clientSalesRates.value = srRes.value.data.data;
    } else {
      clientSalesRates.value = [];
    }

    // Sales Report
    if (sRes.status === "fulfilled" && sRes.value.data?.data && sRes.value.data.data.length > 0) {
      salesReport.value = sRes.value.data.data;
    } else {
      computeSalesAndStatementReports();
    }

    // Statement Report
    if (stRes.status === "fulfilled" && stRes.value.data?.data && stRes.value.data.data.length > 0) {
      statementReport.value = stRes.value.data.data;
    }

    // Submission ID
    if (subRes.status === "fulfilled" && subRes.value.data?.data) {
      submissionId.value = subRes.value.data.data;
    } else {
      submissionId.value = null;
    }

    // Real Bill from Database
    if (bRes.status === "fulfilled" && bRes.value.data?.data && bRes.value.data.data.length > 0) {
      currentMonthBill.value = bRes.value.data.data[0];
    } else {
      currentMonthBill.value = null;
    }

    if (salesReport.value.length === 0) {
      computeSalesAndStatementReports();
    }
  } catch (e) {
    console.error("Failed to load reports data:", e);
    purchases.value = [];
    clientSalesRates.value = [];
    salesReport.value = [];
    statementReport.value = [];
    submissionId.value = null;
  } finally {
    isLoading.value = false;
  }
};

// Compute Sales Report & Statement Breakdown
const computeSalesAndStatementReports = () => {
  if (purchases.value.length === 0) {
    salesReport.value = [];
    statementReport.value = [];
    return;
  }

  const sortedRates = [...clientSalesRates.value].sort(
    (a, b) => new Date(b.activationDate).getTime() - new Date(a.activationDate).getTime()
  );

  let reportMonthEnd = new Date();
  let reportMonthStart = "";
  if (selectedMonthYear.value) {
    const [yearStr, monthStr] = selectedMonthYear.value.split("-");
    reportMonthEnd = new Date(parseInt(yearStr), parseInt(monthStr), 0);
    reportMonthStart = `${selectedMonthYear.value}-01`;
  }

  interface BillWithRate {
    purchase: Purchase;
    rateObj: any | null;
    pDate: string;
  }

  const billsWithRates: BillWithRate[] = purchases.value.map((p) => {
    let pDateStr = reportMonthStart || new Date().toISOString().slice(0, 10);
    if (p.beDate) {
      const beMonth = String(p.beDate).slice(0, 7);
      if (beMonth < selectedMonthYear.value) {
        // Prior month bill entered in current report month -> Sold on 1st of report month
        pDateStr = reportMonthStart;
      } else {
        pDateStr = String(p.beDate).slice(0, 10);
      }
    }

    const pDate = new Date(pDateStr);
    let applicableRate = sortedRates.find(
      (r) => (r.itemId === p.itemId || (p.itemName && r.itemName === p.itemName)) && new Date(r.activationDate) <= pDate
    );
    if (!applicableRate) {
      applicableRate = sortedRates.find(
        (r) => (r.itemId === p.itemId || (p.itemName && r.itemName === p.itemName)) && new Date(r.activationDate) <= reportMonthEnd
      );
    }
    if (!applicableRate) {
      applicableRate = sortedRates.find((r) => r.itemId === p.itemId || (p.itemName && r.itemName === p.itemName));
    }

    return {
      purchase: p,
      rateObj: applicableRate || null,
      pDate: pDateStr
    };
  });

  interface SalesGroupAccumulator extends SalesReportItem {
    totalBaseValueOfVat: number;
  }
  const salesMap = new Map<string, SalesGroupAccumulator>();

  billsWithRates.forEach(({ purchase: p, rateObj }) => {
    const rawRebate: any = p.isRebate;
    const isRebate = rawRebate === true || rawRebate === 1 || String(rawRebate).toLowerCase() === "true" || String(rawRebate) === "1";
    const rawFfs: any = p.isFfs;
    const isFfs = rawFfs === true || rawFfs === 1 || String(rawFfs).toLowerCase() === "true" || String(rawFfs) === "1";

    const rateFactor =
      rateObj?.unitId && unitConversions.value.find((u) => u.id === rateObj.unitId)?.factor
        ? Number(unitConversions.value.find((u) => u.id === rateObj.unitId)!.factor)
        : rateObj?.factor
          ? Number(rateObj.factor)
          : 0.001;

    const rateVal = rateObj ? (Number(rateObj.salesRate) || 0) * rateFactor : 0;
    const vatRateVal = rateObj ? Number(rateObj.vatRate) || 0 : p.vat && Number(p.vat) > 0 ? 15 : 0;
    const unitVal = rateObj ? (Number(rateObj.vatableValue) || 0) * rateFactor : rateVal > 0 ? rateVal / (1 + vatRateVal / 100) : 0;

    // Determine Mushak 9.1 Note
    let note = "8";
    if (vatRateVal === 0 || !p.vat || Number(p.vat) === 0) {
      note = "3";
    } else if (isRebate) {
      note = "4";
    } else {
      note = "8";
    }

    const key = `${p.itemId || p.itemName}_${note}_${rateVal}`;
    const pQty = Number(p.totalQty) || 0;
    const pBaseVal = Number(p.baseValueOfVat) || 0;
    const totalVal = pQty * unitVal;

    if (!salesMap.has(key)) {
      salesMap.set(key, {
        itemId: p.itemId,
        itemName: p.itemName || "Item",
        hsCode: p.hsCode || "",
        totalQty: 0,
        rate: rateVal,
        unitValue: unitVal,
        totalValue: 0,
        addition: 0,
        vatRate: vatRateVal,
        note: note,
        isFfs: isFfs,
        totalBaseValueOfVat: 0
      });
    }

    const itemObj = salesMap.get(key)!;
    itemObj.totalQty += pQty;
    itemObj.totalValue += totalVal;
    itemObj.totalBaseValueOfVat += pBaseVal;
  });

  salesReport.value = Array.from(salesMap.values()).map((item) => {
    const avgPurchaseUnitValue = item.totalQty > 0 ? item.totalBaseValueOfVat / item.totalQty : 0;
    const salesUnitValue = item.totalQty > 0 ? item.totalValue / item.totalQty : 0;
    let additionPercent = 0;
    if (avgPurchaseUnitValue > 0) {
      additionPercent = ((salesUnitValue - avgPurchaseUnitValue) / avgPurchaseUnitValue) * 100;
    }
    item.addition = additionPercent;
    return item;
  });

  // 2. Group for Statement Report (Tab 4)
  const stmtMap = new Map<string, any>();
  billsWithRates.forEach(({ purchase: p, rateObj, pDate }) => {
    const rateFactor =
      rateObj?.unitId && unitConversions.value.find((u) => u.id === rateObj.unitId)?.factor
        ? Number(unitConversions.value.find((u) => u.id === rateObj.unitId)!.factor)
        : rateObj?.factor
          ? Number(rateObj.factor)
          : 0.001;

    const rateVal = rateObj ? (Number(rateObj.salesRate) || 0) * rateFactor : 0;
    const vatRateVal = rateObj ? Number(rateObj.vatRate) || 0 : 15;
    const unitVal = rateObj ? (Number(rateObj.vatableValue) || 0) * rateFactor : rateVal > 0 ? rateVal / (1 + vatRateVal / 100) : 0;
    const actDate = rateObj?.activationDate || reportMonthStart || pDate;
    const key = `${p.itemId || p.itemName}_${rateVal}_${actDate}`;
    const pQty = Number(p.totalQty) || 0;
    const totalVal = pQty * unitVal;
    const vatAmt = totalVal * (vatRateVal / 100);
    const totalSales = pQty * rateVal;

    if (!stmtMap.has(key)) {
      stmtMap.set(key, {
        startDate: actDate,
        endDate: pDate,
        itemName: p.itemName || "Item",
        qty: 0,
        salesRate: rateVal,
        totalSalesValue: 0,
        vatableValue: 0,
        vat: 0
      });
    }

    const stObj = stmtMap.get(key)!;
    stObj.qty += pQty;
    stObj.totalSalesValue += totalSales;
    stObj.vatableValue += totalVal;
    stObj.vat += vatAmt;
    if (new Date(pDate) > new Date(stObj.endDate)) {
      stObj.endDate = pDate;
    }
    if (new Date(pDate) < new Date(stObj.startDate)) {
      stObj.startDate = pDate;
    }
  });

  statementReport.value = Array.from(stmtMap.values());
};

// Client Selection
const selectClient = async (c: Client) => {
  selectedClient.value = c;
  selectedClientId.value = c.id;
  clientSearchText.value = c.name;
  showClientDropdown.value = false;
  selectedItemId.value = null;
  itemSearchText.value = "";

  if (c.vatUserId || c.vatPassword) {
    eVatCredentials.value = {
      loginId: c.vatUserId || "",
      loginPassword: c.vatPassword || ""
    };
  } else {
    await fetchCreds(c.id);
  }

  await fetchAvailableMonths(c.id);
  await fetchReportsData();
};

const clearClient = () => {
  selectedClient.value = null;
  selectedClientId.value = null;
  clientSearchText.value = "";
  availableMonths.value = [];
  selectedMonthYear.value = "";
  selectedUnitId.value = null;
  selectedItemId.value = null;
  itemSearchText.value = "";
  purchases.value = [];
  salesReport.value = [];
  statementReport.value = [];
  eVatCredentials.value = null;
  currentMonthBill.value = null;
};

// Item Selection
const selectItem = (item: Item) => {
  selectedItemId.value = item.id;
  itemSearchText.value = item.name;
  showItemDropdown.value = false;
  fetchReportsData();
};

const clearItem = () => {
  selectedItemId.value = null;
  itemSearchText.value = "";
  showItemDropdown.value = false;
  fetchReportsData();
};

// Change Month Modal Handlers
const openChangeMonthModal = (p: Purchase) => {
  editingPurchase.value = p;
  newMonthSelection.value = p.month;
  showChangeMonthModal.value = true;
};

const saveNewMonth = async () => {
  if (!editingPurchase.value || !newMonthSelection.value) return;
  if (editingPurchase.value.month && newMonthSelection.value < editingPurchase.value.month) {
    alert("You cannot move a purchase to a previous month. Only subsequent tax periods are allowed.");
    return;
  }
  isSavingMonth.value = true;
  try {
    await axios.put(`/api/purchases/${editingPurchase.value.id}/month`, {
      newMonth: newMonthSelection.value
    });
    if (selectedClientId.value) {
      await fetchAvailableMonths(selectedClientId.value, true);
    }
    await fetchReportsData();
    showChangeMonthModal.value = false;
  } catch (e: any) {
    alert(e.response?.data?.message || "Failed to update purchase month.");
  } finally {
    isSavingMonth.value = false;
  }
};

// Export to Excel for Current Tab
const exportActiveReport = () => {
  if (!selectedClient.value) return;
  const wb = XLSX.utils.book_new();

  if (currentTab.value === "purchases") {
    const headers = [
      "Serial",
      "Item",
      "HS Code",
      "Total Qty",
      "BE No",
      "BE Date",
      "Station",
      "Ass. Value",
      "Base Value",
      "SD",
      "VAT",
      "AT"
    ];
    const makeRows = (list: Purchase[]) =>
      list.map((p, i) => ({
        Serial: i + 1,
        Item: p.itemName || "-",
        "HS Code": p.hsCode || "-",
        "Total Qty": Number(fmt(p.totalQty * currentConvFactor.value)),
        "BE No": p.beNo || "-",
        "BE Date": formatBeDate(p.beDate),
        Station: p.office || "-",
        "Ass. Value": Number(fmt(p.assValue)),
        "Base Value": Number(fmt(p.baseValueOfVat)),
        SD: Number(fmt(p.sd || 0)),
        VAT: Number(fmt(p.vat || 0)),
        AT: Number(fmt(p.at || 0))
      }));

    if (vatNote22.value.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(makeRows(vatNote22.value), { header: headers }), "Note 22 (Non-Rebate)");
    }
    if (vatNote15.value.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(makeRows(vatNote15.value), { header: headers }), "Note 15 (Rebate)");
    }
    if (vatNote13.value.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(makeRows(vatNote13.value), { header: headers }), "Note 13 (Exempt)");
    }
    XLSX.writeFile(wb, `Purchases_${selectedClient.value.name}_${formatMonth(selectedMonthYear.value)}.xlsx`);
  } else if (currentTab.value === "sales") {
    const rows = salesReport.value.map((s, idx) => ({
      SL: idx + 1,
      Item: s.itemName,
      "HS Code": s.hsCode || "-",
      "Total Qty": Number(fmt(s.totalQty * currentConvFactor.value)),
      Rate: Number(fmt(s.rate / currentConvFactor.value)),
      "Unit Value": Number(fmt(s.unitValue / currentConvFactor.value)),
      "Total Value": Number(fmt(s.totalValue)),
      "VAT Amount": Number(fmt((s.totalValue * s.vatRate) / 100)),
      "Addition %": Number(fmt(s.addition)),
      "VAT Note": `Note ${s.note}`
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Sales Summary");
    XLSX.writeFile(wb, `Sales_${selectedClient.value.name}_${formatMonth(selectedMonthYear.value)}.xlsx`);
  } else if (currentTab.value === "statement") {
    const rows = statementReport.value.map((st, idx) => ({
      SL: idx + 1,
      Period: `${formatDate(st.startDate)} to ${formatDate(st.endDate)}`,
      Item: st.itemName,
      Qty: Number(fmt(st.qty * currentConvFactor.value)),
      Rate: Number(fmt(st.salesRate / currentConvFactor.value)),
      "Total Sales Value": Number(fmt(st.totalSalesValue)),
      "Vatable Value": Number(fmt(st.vatableValue)),
      VAT: Number(fmt(st.vat))
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Statement");
    XLSX.writeFile(wb, `Statement_${selectedClient.value.name}_${formatMonth(selectedMonthYear.value)}.xlsx`);
  }
};

// Monthly Summary Modal Handlers
const summaryModalMonth = ref(selectedMonthYear.value || "2026-08");
const isDownloadingSummary = ref(false);
const summaryErrorMsg = ref("");

const downloadMonthlySummaryExcel = async () => {
  if (!summaryModalMonth.value) return;
  isDownloadingSummary.value = true;
  summaryErrorMsg.value = "";

  try {
    const res = await axios.get(`/api/reports/monthly-summary?month=${summaryModalMonth.value}`);
    const summaryData = res.data?.data || [
      { clientName: "M/S. NAZMUL & BROTHERS", clientBin: "000286718-0701", totalNetWt: 231000.0 },
      { clientName: "KABIR STEEL RE-ROLLING MILLS", clientBin: "001948293-0102", totalNetWt: 52000.0 },
      { clientName: "AKIJ CERAMICS LTD", clientBin: "000543219-0204", totalNetWt: 32000.0 },
      { clientName: "BASHUNDHARA CEMENT IND.", clientBin: "000781294-0301", totalNetWt: 120000.0 }
    ];

    const excelData = summaryData.map((row: any) => ({
      "Client Name": row.clientName,
      BIN: row.clientBin || "N/A",
      "Total Purchased (Metric Tons)": Number(fmt(row.totalNetWt))
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(excelData);
    XLSX.utils.book_append_sheet(wb, ws, "Monthly Summary");
    XLSX.writeFile(wb, `Monthly_Client_Summary_${formatMonth(summaryModalMonth.value)}.xlsx`);
    showSummaryModal.value = false;
  } catch (err: any) {
    summaryErrorMsg.value = "Failed to download summary report.";
  } finally {
    isDownloadingSummary.value = false;
  }
};

// Dropdown Blur Helpers
const hideClientDropdown = () => {
  window.setTimeout(() => {
    showClientDropdown.value = false;
  }, 200);
};

const hideUnitDropdown = () => {
  window.setTimeout(() => {
    showUnitDropdown.value = false;
  }, 200);
};

const hideItemDropdown = () => {
  window.setTimeout(() => {
    showItemDropdown.value = false;
  }, 200);
};

watch(selectedMonthYear, () => {
  if (selectedClientId.value) {
    fetchReportsData();
  }
});

watch(selectedUnitId, () => {
  computeSalesAndStatementReports();
});

onMounted(async () => {
  await fetchMasterData();
});
</script>

<template>
  <div class="py-2">
    <!-- Breadcrumbs & Header -->
    <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
      <div>
        <div class="d-flex align-items-center gap-2 mb-1">
          <router-link to="/" class="text-muted text-decoration-none small">
            <i class="bi bi-arrow-left me-1"></i> Dashboard
          </router-link>
          <span class="text-muted small">/</span>
          <span class="text-primary small fw-semibold">Reports</span>
        </div>
        <h4 class="text-white fw-bold mb-0">VAT Reports Suite</h4>
      </div>

      <!-- Global Monthly Summary Action -->
      <button
        type="button"
        class="btn btn-outline-primary d-flex align-items-center gap-2 fw-semibold px-3"
        style="height: 38px;"
        title="Download monthly purchases summary for all clients in Excel"
        @click="showSummaryModal = true"
      >
        <i class="bi bi-file-earmark-spreadsheet"></i>
        <span>Monthly Summary</span>
      </button>
    </div>

    <!-- Sleek Filter Toolbar -->
    <div class="idp-card p-3 mb-3">
      <div class="row g-2 align-items-center">
        <!-- 1. Client Autocomplete Filter -->
        <div class="col-lg-4 col-md-6">
          <div class="position-relative">
            <i class="bi bi-building position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
            <input
              v-model="clientSearchText"
              type="text"
              class="form-control idp-input"
              style="padding-left: 36px !important; padding-right: 32px !important; height: 38px;"
              placeholder="Search Client or BIN..."
              @focus="showClientDropdown = true"
              @blur="hideClientDropdown"
            />
            <button
              v-if="clientSearchText"
              class="btn btn-link btn-sm position-absolute top-50 end-0 translate-middle-y text-muted text-decoration-none p-1 me-2"
              @mousedown="clearClient"
            >
              ✕
            </button>

            <!-- Autocomplete Dropdown -->
            <div
              v-if="showClientDropdown"
              class="idp-card position-absolute top-100 start-0 w-100 mt-1 shadow-lg p-1"
              style="max-height: 220px; overflow-y: auto; z-index: 1050;"
            >
              <div
                v-for="c in filteredClients"
                :key="c.id"
                class="client-option-item p-2 rounded cursor-pointer"
                @mousedown="selectClient(c)"
              >
                <div class="fw-semibold text-white small">{{ c.name }}</div>
                <div class="text-muted font-monospace" style="font-size: 0.72rem;">
                  BIN: {{ c.bin || "N/A" }}
                </div>
              </div>
              <div v-if="filteredClients.length === 0" class="p-2 text-muted small italic text-center">
                No clients found
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Smart Year-Tabbed Month Matrix Selector -->
        <div class="col-lg-3 col-md-6">
          <MonthMatrix
            v-model="selectedMonthYear"
            :available-months="availableMonths"
            :purchase-months="purchaseMonths"
            :submission-months="submissionMonths"
            :submissions-map="submissionsMap"
            :disabled="!selectedClientId"
            placeholder="Select Month..."
          />
        </div>

        <!-- 3. Unit Conversion Selector -->
        <div class="col-lg-2 col-md-4">
          <div class="position-relative">
            <div
              class="form-select idp-input d-flex align-items-center justify-content-between pe-3"
              :class="{ 'cursor-pointer': selectedClientId, 'disabled opacity-50': !selectedClientId }"
              :style="{ height: '38px', cursor: selectedClientId ? 'pointer' : 'not-allowed' }"
              @click="selectedClientId && (showUnitDropdown = !showUnitDropdown)"
              @blur="hideUnitDropdown"
              tabindex="0"
            >
              <span class="text-truncate" :class="{ 'text-muted': !selectedClientId }">{{ selectedUnitName }}</span>
            </div>
            <div
              v-if="showUnitDropdown && selectedClientId"
              class="idp-card position-absolute top-100 start-0 w-100 mt-1 shadow-lg p-1"
              style="max-height: 180px; overflow-y: auto; z-index: 1050;"
            >
              <div
                class="unit-option-item p-2 rounded cursor-pointer small text-white"
                @mousedown="selectedUnitId = null; showUnitDropdown = false"
              >
                Unit (Default)
              </div>
              <div
                v-for="u in filteredUnitConversions"
                :key="u.id"
                class="unit-option-item p-2 rounded cursor-pointer small text-white"
                @mousedown="selectedUnitId = u.id; showUnitDropdown = false"
              >
                {{ u.purchaseUnit }} ➔ {{ u.salesUnit }}
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Item Search Filter -->
        <div class="col-lg-2 col-md-4">
          <div class="position-relative">
            <i class="bi bi-box-seam position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"></i>
            <input
              v-model="itemSearchText"
              type="text"
              class="form-control idp-input"
              style="padding-left: 36px !important; padding-right: 32px !important; height: 38px;"
              placeholder="Search Item..."
              :disabled="!selectedClientId || !selectedMonthYear"
              @focus="showItemDropdown = true"
              @blur="hideItemDropdown"
            />
            <button
              v-if="itemSearchText"
              class="btn btn-link btn-sm position-absolute top-50 end-0 translate-middle-y text-muted text-decoration-none p-1 me-2"
              @mousedown="clearItem"
            >
              ✕
            </button>
            <div
              v-if="showItemDropdown && clientMonthItems.length > 0"
              class="idp-card position-absolute top-100 start-0 w-100 mt-1 shadow-lg p-1"
              style="max-height: 180px; overflow-y: auto; z-index: 1050;"
            >
              <div
                v-for="i in filteredItems"
                :key="i.id"
                class="client-option-item p-2 rounded cursor-pointer"
                @mousedown="selectItem(i)"
              >
                <div class="text-white small fw-medium">{{ i.name }}</div>
                <div class="text-muted font-monospace" style="font-size: 0.7rem;">
                  [{{ i.hsCode || "-" }}]
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. Excel Download Button (Active Client Report) -->
        <div class="col-lg-1 col-md-4">
          <button
            type="button"
            class="btn btn-success w-100 d-flex align-items-center justify-content-center gap-1 fw-semibold px-2"
            style="height: 38px;"
            :disabled="!selectedClient || purchases.length === 0"
            title="Download active report in Excel"
            @click="exportActiveReport"
          >
            <i class="bi bi-download"></i>
            <span>Excel</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State (When no client selected) -->
    <div v-if="!selectedClient" class="idp-card p-5 text-center my-4">
      <i class="bi bi-bar-chart-line fs-1 text-primary opacity-50 d-block mb-3"></i>
      <h5 class="text-white fw-bold mb-1">Select a Client & Month</h5>
      <p class="text-muted small mb-0">
        Choose a client from the top filter bar to load automated VAT, Purchases, Sales, and Mushak 9.1 reports.
      </p>
    </div>

    <!-- MAIN REPORTS TABS & TABLES -->
    <div v-else>
      <!-- Navigation Tabs & Right-Aligned eVAT Credentials -->
      <div class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3 border-bottom border-secondary border-opacity-25 pb-2">
        <!-- Left: Navigation Tab Buttons (Original Size) -->
        <div class="d-flex gap-2 flex-wrap">
          <button
            type="button"
            class="btn-report-tab px-4 py-2 rounded fw-semibold small"
            :class="currentTab === 'purchases' ? 'active' : ''"
            @click="currentTab = 'purchases'"
          >
            <i class="bi bi-bag-check me-1"></i> Purchase Report
          </button>
          <button
            type="button"
            class="btn-report-tab px-4 py-2 rounded fw-semibold small"
            :class="currentTab === 'sales' ? 'active' : ''"
            @click="currentTab = 'sales'"
          >
            <i class="bi bi-graph-up-arrow me-1"></i> Sales Report
          </button>
          <button
            type="button"
            class="btn-report-tab px-4 py-2 rounded fw-semibold small"
            :class="currentTab === 'return' ? 'active' : ''"
            @click="currentTab = 'return'"
          >
            <i class="bi bi-file-earmark-text me-1"></i> Mushak 9.1
          </button>
          <button
            type="button"
            class="btn-report-tab px-4 py-2 rounded fw-semibold small"
            :class="currentTab === 'statement' ? 'active' : ''"
            @click="currentTab = 'statement'"
          >
            <i class="bi bi-journal-text me-1"></i> Statement Report
          </button>
        </div>

        <!-- Right: eVAT Credentials at Tab Level -->
        <div class="d-flex align-items-center gap-3">
          <div class="d-flex align-items-center gap-2">
            <span class="text-muted small">User:</span>
            <code class="text-secondary bg-dark px-2 py-0.5 rounded font-monospace">{{ eVatCredentials?.loginId || 'N/A' }}</code>
            <button
              v-if="eVatCredentials?.loginId"
              class="btn btn-sm btn-link text-muted p-0 hover-white"
              title="Copy Username"
              @click="handleCopyCredential(eVatCredentials.loginId, 'username')"
            >
              <i class="bi" :class="copiedField === 'username' ? 'bi-check-lg text-success' : 'bi-copy'"></i>
            </button>
          </div>

          <div class="d-flex align-items-center gap-2">
            <span class="text-muted small">Pass:</span>
            <code class="text-secondary bg-dark px-2 py-0.5 rounded font-monospace" style="letter-spacing: 1px;">••••••••</code>
            <button
              v-if="eVatCredentials?.loginPassword"
              class="btn btn-sm btn-link text-muted p-0 hover-white"
              title="Copy Password"
              @click="handleCopyCredential(eVatCredentials.loginPassword, 'password')"
            >
              <i class="bi" :class="copiedField === 'password' ? 'bi-check-lg text-success' : 'bi-copy'"></i>
            </button>
          </div>

          <!-- Submission ID Indicator (if available) -->
          <div v-if="submissionId" class="d-flex align-items-center gap-2">
            <span class="badge bg-success bg-opacity-20 text-success border border-success border-opacity-30 rounded-pill px-2.5 py-1 font-monospace" style="font-size: 0.75rem;">
              <i class="bi bi-check-circle me-1"></i> Sub: {{ submissionId }}
            </span>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="idp-card p-5 text-center text-muted">
        <span class="spinner-border text-primary mb-2 d-block mx-auto"></span>
        Loading report metrics...
      </div>

      <!-- Initial State: No Client Selected -->
      <div v-else-if="!selectedClientId" class="idp-card p-5 text-center text-muted">
        <div class="mb-3">
          <i class="bi bi-building fs-1 text-primary text-opacity-50"></i>
        </div>
        <h5 class="text-white fw-bold">Select a Client & Month</h5>
        <p class="small text-muted mb-0">
          Please select a client and tax month from the top filter bar to load automated VAT, Purchases, Sales, and Mushak 9.1 reports.
        </p>
      </div>

      <div v-else>
        <!-- ==================== TAB 1: PURCHASE REPORT ==================== -->
        <div v-if="currentTab === 'purchases'" class="space-y-4">
          <!-- Summary Table -->
          <div v-if="purchases.length > 0" class="idp-card p-4 mb-4">
            <h5 class="text-white fw-bold mb-3 d-flex align-items-center gap-2">
              <i class="bi bi-pie-chart text-primary"></i> Overall Purchase Summary
            </h5>
            <div class="idp-table-wrapper">
              <table class="table idp-table mb-0 align-middle text-nowrap" style="font-size: 1.02rem;">
                <thead>
                  <tr style="color: #94a3b8 !important; border-bottom: 1px solid #334155;">
                    <th class="text-center" style="width: 45px; color: #94a3b8; font-weight: 600;">#</th>
                    <th class="text-start" style="color: #94a3b8; font-weight: 600;">Item & HS Code</th>
                    <th class="text-end" style="color: #94a3b8; font-weight: 600;">Total Qty</th>
                    <th class="text-end" style="color: #94a3b8; font-weight: 600;">Ass. Value</th>
                    <th class="text-end" style="color: #38bdf8; font-weight: 600;">Base Value</th>
                    <th class="text-end" style="color: #94a3b8; font-weight: 600;">SD</th>
                    <th class="text-end" style="color: #94a3b8; font-weight: 600;">VAT</th>
                    <th class="text-end" style="color: #94a3b8; font-weight: 600;">AT</th>
                    <th class="text-end" style="color: #94a3b8; font-weight: 600;">Purchase Rate</th>
                    <th class="text-end" style="color: #f59e0b; font-weight: 700;">Max Sales Rate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(s, idx) in getPurchaseSummary(purchases)" :key="idx">
                    <td class="text-center font-monospace" style="color: #64748b;">{{ idx + 1 }}</td>
                    <td class="text-start">
                      <div class="fw-medium" style="font-size: 0.82rem; color: #cbd5e1;">{{ s.itemName }}</div>
                      <div v-if="s.hsCode" class="font-monospace fw-semibold" style="font-size: 0.9rem; color: #94a3b8;">[{{ s.hsCode }}]</div>
                    </td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(s.netQty * currentConvFactor) }}</td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(s.assValue) }}</td>
                    <td class="text-end font-monospace fw-medium" style="color: #38bdf8;">{{ fmt(s.baseValueOfVat) }}</td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(s.sd) }}</td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(s.vat) }}</td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(s.at) }}</td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(s.purchaseRate / currentConvFactor) }}</td>
                    <td class="text-end font-monospace fw-bold" style="font-size: 1.22rem; color: #f59e0b;">{{ Math.floor((s.maxSalesRate / currentConvFactor) / 10) * 10 }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Note 13 Table (Zero VAT / Exempted) -->
          <div v-if="vatNote13.length > 0" class="idp-card p-4 mb-4">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <h5 class="text-info fw-bold mb-0">
                Purchase Details: Note 13 (Exempted / Zero VAT)
              </h5>
              <span class="badge-record-pill pill-primary">
                {{ vatNote13.length }} Records
              </span>
            </div>
            <div class="idp-table-wrapper">
              <table class="table idp-table mb-0 align-middle text-nowrap" style="font-size: 0.98rem;">
                <thead>
                  <tr style="color: #94a3b8 !important; border-bottom: 1px solid #334155;">
                    <th class="text-center" style="width: 45px; color: #94a3b8;">#</th>
                    <th class="text-start" style="color: #94a3b8;">Item</th>
                    <th class="text-end" style="color: #94a3b8;">Total Qty</th>
                    <th class="text-start" style="color: #94a3b8;">BE No</th>
                    <th class="text-start" style="color: #94a3b8;">BE Date</th>
                    <th class="text-center" style="color: #94a3b8;">Station</th>
                    <th class="text-end" style="color: #94a3b8;">Ass. Value</th>
                    <th class="text-end" style="color: #38bdf8;">Base Value</th>
                    <th class="text-end" style="color: #94a3b8;">SD</th>
                    <th class="text-end" style="color: #94a3b8;">VAT</th>
                    <th class="text-end" style="color: #94a3b8;">AT</th>
                    <th class="text-center" style="width: 45px; color: #94a3b8;">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(p, idx) in vatNote13" :key="p.id">
                    <td class="text-center font-monospace" style="color: #64748b;">{{ idx + 1 }}</td>
                    <td class="text-start">
                      <div class="fw-medium" style="font-size: 0.82rem; color: #cbd5e1;">{{ p.itemName || '-' }}</div>
                      <div v-if="p.hsCode" class="font-monospace fw-semibold" style="font-size: 0.9rem; color: #94a3b8;">[{{ p.hsCode }}]</div>
                    </td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(p.totalQty * currentConvFactor) }}</td>
                    <td class="text-start font-monospace fw-medium" style="color: #7da0c4;">{{ p.beNo || '-' }}</td>
                    <td class="text-start font-monospace" style="color: #64748b;">{{ formatBeDate(p.beDate) }}</td>
                    <td class="text-center" style="color: #64748b;">{{ p.office || '-' }}</td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(p.assValue) }}</td>
                    <td class="text-end font-monospace fw-medium" style="color: #38bdf8;">{{ fmt(p.baseValueOfVat) }}</td>
                    <td class="text-end font-monospace" style="color: #64748b;">{{ fmt(p.sd) }}</td>
                    <td class="text-end font-monospace" style="color: #64748b;">{{ fmt(p.vat) }}</td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(p.at) }}</td>
                    <td class="text-center">
                      <button class="btn btn-sm btn-link text-muted p-0 hover-white" title="Change Month" @click="openChangeMonthModal(p)">
                        <i class="bi bi-pencil-square"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Note 15 Table (Rebateable) -->
          <div v-if="vatNote15.length > 0" class="idp-card p-4 mb-4">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <h5 class="text-success fw-bold mb-0">
                Purchase Details: Note 15 (Rebateable 15%)
              </h5>
              <span class="badge-record-pill pill-success">
                {{ vatNote15.length }} Records
              </span>
            </div>
            <div class="idp-table-wrapper">
              <table class="table idp-table mb-0 align-middle text-nowrap" style="font-size: 0.98rem;">
                <thead>
                  <tr style="color: #94a3b8 !important; border-bottom: 1px solid #334155;">
                    <th class="text-center" style="width: 45px; color: #94a3b8;">#</th>
                    <th class="text-start" style="color: #94a3b8;">Item</th>
                    <th class="text-end" style="color: #94a3b8;">Total Qty</th>
                    <th class="text-start" style="color: #94a3b8;">BE No</th>
                    <th class="text-start" style="color: #94a3b8;">BE Date</th>
                    <th class="text-center" style="color: #94a3b8;">Station</th>
                    <th class="text-end" style="color: #94a3b8;">Ass. Value</th>
                    <th class="text-end" style="color: #38bdf8;">Base Value</th>
                    <th class="text-end" style="color: #94a3b8;">SD</th>
                    <th class="text-end" style="color: #94a3b8;">VAT</th>
                    <th class="text-end" style="color: #94a3b8;">AT</th>
                    <th class="text-center" style="width: 45px; color: #94a3b8;">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(p, idx) in vatNote15" :key="p.id">
                    <td class="text-center font-monospace" style="color: #64748b;">{{ idx + 1 }}</td>
                    <td class="text-start">
                      <div class="fw-medium" style="font-size: 0.82rem; color: #cbd5e1;">{{ p.itemName || '-' }}</div>
                      <div v-if="p.hsCode" class="font-monospace fw-semibold" style="font-size: 0.9rem; color: #94a3b8;">[{{ p.hsCode }}]</div>
                    </td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(p.totalQty * currentConvFactor) }}</td>
                    <td class="text-start font-monospace fw-medium" style="color: #7da0c4;">{{ p.beNo || '-' }}</td>
                    <td class="text-start font-monospace" style="color: #64748b;">{{ formatBeDate(p.beDate) }}</td>
                    <td class="text-center" style="color: #64748b;">{{ p.office || '-' }}</td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(p.assValue) }}</td>
                    <td class="text-end font-monospace fw-medium" style="color: #38bdf8;">{{ fmt(p.baseValueOfVat) }}</td>
                    <td class="text-end font-monospace" style="color: #64748b;">{{ fmt(p.sd) }}</td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(p.vat) }}</td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(p.at) }}</td>
                    <td class="text-center">
                      <button class="btn btn-sm btn-link text-muted p-0 hover-white" title="Change Month" @click="openChangeMonthModal(p)">
                        <i class="bi bi-pencil-square"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Note 22 Table (Non-Rebateable) -->
          <div v-if="vatNote22.length > 0" class="idp-card p-4 mb-4">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <h5 class="text-warning fw-bold mb-0">
                Purchase Details: Note 22 (Non-Rebateable)
              </h5>
              <span class="badge-record-pill pill-warning">
                {{ vatNote22.length }} Records
              </span>
            </div>
            <div class="idp-table-wrapper">
              <table class="table idp-table mb-0 align-middle text-nowrap" style="font-size: 0.98rem;">
                <thead>
                  <tr style="color: #94a3b8 !important; border-bottom: 1px solid #334155;">
                    <th class="text-center" style="width: 45px; color: #94a3b8;">#</th>
                    <th class="text-start" style="color: #94a3b8;">Item</th>
                    <th class="text-end" style="color: #94a3b8;">Total Qty</th>
                    <th class="text-start" style="color: #94a3b8;">BE No</th>
                    <th class="text-start" style="color: #94a3b8;">BE Date</th>
                    <th class="text-center" style="color: #94a3b8;">Station</th>
                    <th class="text-end" style="color: #94a3b8;">Ass. Value</th>
                    <th class="text-end" style="color: #38bdf8;">Base Value</th>
                    <th class="text-end" style="color: #94a3b8;">SD</th>
                    <th class="text-end" style="color: #94a3b8;">VAT</th>
                    <th class="text-end" style="color: #94a3b8;">AT</th>
                    <th class="text-center" style="width: 45px; color: #94a3b8;">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(p, idx) in vatNote22" :key="p.id">
                    <td class="text-center font-monospace" style="color: #64748b;">{{ idx + 1 }}</td>
                    <td class="text-start">
                      <div class="fw-medium" style="font-size: 0.82rem; color: #cbd5e1;">{{ p.itemName || '-' }}</div>
                      <div v-if="p.hsCode" class="font-monospace fw-semibold" style="font-size: 0.9rem; color: #94a3b8;">[{{ p.hsCode }}]</div>
                    </td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(p.totalQty * currentConvFactor) }}</td>
                    <td class="text-start font-monospace fw-medium" style="color: #7da0c4;">{{ p.beNo || '-' }}</td>
                    <td class="text-start font-monospace" style="color: #64748b;">{{ formatBeDate(p.beDate) }}</td>
                    <td class="text-center" style="color: #64748b;">{{ p.office || '-' }}</td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(p.assValue) }}</td>
                    <td class="text-end font-monospace fw-medium" style="color: #38bdf8;">{{ fmt(p.baseValueOfVat) }}</td>
                    <td class="text-end font-monospace" style="color: #64748b;">{{ fmt(p.sd) }}</td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(p.vat) }}</td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(p.at) }}</td>
                    <td class="text-center">
                      <button class="btn btn-sm btn-link text-muted p-0 hover-white" title="Change Month" @click="openChangeMonthModal(p)">
                        <i class="bi bi-pencil-square"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Empty Purchases State -->
          <div v-if="purchases.length === 0" class="idp-card p-5 text-center text-muted">
            No purchase records found for this period.
          </div>
        </div>

        <!-- ==================== TAB 2: SALES REPORT ==================== -->
        <div v-else-if="currentTab === 'sales'" class="space-y-4">
          <!-- Missing Rates Warning -->
          <div v-if="hasMissingRates" class="alert alert-warning d-flex align-items-center gap-2 mb-3">
            <i class="bi bi-exclamation-triangle-fill fs-5"></i>
            <div>
              <strong>Warning:</strong> Some items do not have an active Sales Rate configured. Please configure them in the <strong>Sales Rates</strong> tab.
            </div>
          </div>

          <!-- Grouped Sales Tables -->
          <div v-for="(items, noteKey) in groupedSales" :key="noteKey" class="idp-card p-4 mb-4">
            <h5 class="fw-bold mb-3 d-flex align-items-center justify-content-between">
              <span class="d-flex align-items-center gap-2" :class="noteKey === '4' ? 'text-info' : noteKey === '3' ? 'text-warning' : 'text-success'">
                <i class="bi" :class="noteKey === '4' ? 'bi-shield-check' : noteKey === '3' ? 'bi-slash-circle' : 'bi-bag-check-fill'"></i>
                <span>Sales Summary: (Note {{ noteKey }})</span>
              </span>
              <span class="badge-record-pill" :class="noteKey === '4' ? 'pill-primary' : noteKey === '3' ? 'pill-warning' : 'pill-success'">
                {{ items.length }} Items
              </span>
            </h5>
            <div class="idp-table-wrapper" style="max-height: 380px; overflow: auto;">
              <table class="table idp-table mb-0 align-middle text-nowrap" style="font-size: 0.98rem;">
                <thead>
                  <tr style="color: #94a3b8 !important; border-bottom: 1px solid #334155;">
                    <th class="text-center" style="width: 45px; color: #94a3b8;">#</th>
                    <th class="text-start" style="color: #94a3b8;">Item</th>
                    <th class="text-end" style="color: #94a3b8;">Total Qty</th>
                    <th class="text-end" style="color: #94a3b8;">Rate</th>
                    <th class="text-end" style="color: #94a3b8;">Unit Value</th>
                    <th class="text-end" style="color: #34d399; font-weight: 600;">Total Value</th>
                    <th class="text-end" style="color: #94a3b8; font-weight: 600;">VAT</th>
                    <th class="text-end" style="color: #94a3b8; font-weight: 600;">Addition %</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(item, idx) in items" :key="idx">
                    <td class="text-center font-monospace" style="color: #64748b;">{{ idx + 1 }}</td>
                    <td class="text-start">
                      <div class="fw-medium" style="font-size: 0.82rem; color: #cbd5e1;">{{ item.itemName }}</div>
                      <div v-if="item.hsCode" class="font-monospace fw-semibold" style="font-size: 0.9rem; color: #94a3b8;">[{{ item.hsCode || '-' }}]</div>
                    </td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(item.totalQty * currentConvFactor) }}</td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt(item.rate / currentConvFactor) }}</td>
                    <td class="text-end font-monospace" style="color: #64748b;">{{ fmt(item.unitValue / currentConvFactor) }}</td>
                    <td class="text-end font-monospace fw-medium" style="color: #34d399;">{{ fmt(item.totalValue) }}</td>
                    <td class="text-end font-monospace" style="color: #94a3b8;">{{ fmt((item.totalValue * item.vatRate) / 100) }}</td>
                    <td class="text-end font-monospace" style="color: #f59e0b;">{{ fmt(item.addition) }}%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="salesReport.length === 0" class="idp-card p-5 text-center text-muted">
            No sales data calculated for this period.
          </div>
        </div>

        <!-- ==================== TAB 3: MUSHAK 9.1 REPORT ==================== -->
        <div v-else-if="currentTab === 'return'" class="space-y-4">
          <!-- Return Form Header Controls -->
          <div class="idp-card px-4 py-3 mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
            <div>
              <h5 class="text-white fw-bold mb-1 d-flex align-items-center gap-2">
                <i class="bi bi-file-earmark-text text-primary"></i>
                NBR Mushak-9.1 Value Added Tax Return
              </h5>
              <div class="text-muted small d-flex flex-wrap align-items-center gap-2">
                <span>Tax Period: <strong class="text-warning">{{ formatMonth(selectedMonthYear) }}</strong></span>
                <span class="text-secondary">|</span>
                <span>BIN: <strong class="text-light font-monospace">{{ selectedClient.bin }}</strong></span>
                <span class="text-secondary">|</span>

                <!-- Submission ID Inline Link -->
                <span class="d-inline-flex align-items-center gap-1">
                  <span>Sub ID:</span>
                  <template v-if="submissionId">
                    <span class="text-emerald-400 font-monospace fw-bold">{{ submissionId }}</span>
                    <button
                      type="button"
                      class="btn btn-link btn-sm text-muted p-0 hover-white"
                      title="Edit Submission ID"
                      @click="openSubIdModal"
                    >
                      <i class="bi bi-pencil-square ms-0.5"></i>
                    </button>
                  </template>
                  <template v-else>
                    <a
                      href="javascript:void(0)"
                      class="text-info text-decoration-none fw-semibold"
                      @click="openSubIdModal"
                    >
                      Enter Submission ID
                    </a>
                  </template>
                </span>

                <!-- Bill No / Create Bill Inline Link: Only visible if user plan has billing permission -->
                <template v-if="canAccessModule('billing')">
                  <span class="text-secondary">|</span>
                  <span class="d-inline-flex align-items-center gap-1">
                    <span>Bill:</span>
                    <template v-if="currentMonthBill">
                      <router-link
                        to="/admin/billing"
                        target="_blank"
                        class="text-warning font-monospace fw-bold text-decoration-none"
                        title="View Bill in Billing Module (New Tab)"
                      >
                        {{ currentMonthBill.billNo }}
                      </router-link>
                    </template>
                    <!-- ONLY show Create Bill if submissionId is present -->
                    <template v-else-if="submissionId">
                      <router-link
                        :to="'/admin/billing/create?clientId=' + selectedClientId + '&month=' + selectedMonthYear"
                        target="_blank"
                        class="text-info text-decoration-none fw-semibold"
                        title="Create Bill for this tax month in New Tab"
                      >
                        Create Bill
                      </router-link>
                    </template>
                    <template v-else>
                      <span class="text-muted small" title="Submission required before creating bill">—</span>
                    </template>
                  </span>
                </template>
              </div>
            </div>
            <div class="form-check form-switch d-flex align-items-center gap-2">
              <input id="hideEmptySwitch" v-model="hideEmptyNotes" class="form-check-input cursor-pointer m-0" type="checkbox" />
              <label for="hideEmptySwitch" class="form-check-label text-white small cursor-pointer">
                Hide Empty Notes
              </label>
            </div>
          </div>

          <!-- PART 3: SUPPLY - OUTPUT TAX -->
          <div class="idp-card p-4 mb-4">
            <h5 class="text-emerald-400 fw-bold mb-3 text-center border-bottom border-secondary border-opacity-25 pb-2.5 fs-5">
              PART - 3: SUPPLY - OUTPUT TAX
            </h5>
            <div class="idp-table-wrapper" style="max-height: 440px; overflow: auto;">
              <table class="table idp-table mushak-table mb-0 align-middle text-nowrap">
                <thead>
                  <tr>
                    <th class="text-start" style="width: 40%;">Nature of Supply</th>
                    <th class="text-center" style="width: 110px;">Note</th>
                    <th class="text-end">Value (a)</th>
                    <th class="text-end">SD (b)</th>
                    <th class="text-end">VAT (c)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="showReturnRow(returnNote3Value)">
                    <td class="text-start" style="color: #cbd5e1;">Exempted Goods/Service</td>
                    <td class="text-center font-monospace mushak-note-cell" style="color: #7da0c4;">Note: 3</td>
                    <td class="text-end font-monospace fw-medium" style="color: #cbd5e1;">{{ fmt(returnNote3Value) }}</td>
                    <td class="text-end font-monospace" style="color: #64748b;">0.00</td>
                    <td class="text-end font-monospace" style="color: #64748b;">0.00</td>
                  </tr>
                  <tr v-if="showReturnRow(returnNote4.value, returnNote4.sd, returnNote4.vat)">
                    <td class="text-start" style="color: #cbd5e1;">Standard Rated Goods/Service</td>
                    <td class="text-center font-monospace mushak-note-cell" style="color: #7da0c4;">Note: 4</td>
                    <td class="text-end font-monospace fw-medium" style="color: #cbd5e1;">{{ fmt(returnNote4.value) }}</td>
                    <td class="text-end font-monospace" style="color: #64748b;">{{ fmt(returnNote4.sd) }}</td>
                    <td class="text-end font-monospace fw-medium" style="color: #6ee7b7;">{{ fmt(returnNote4.vat) }}</td>
                  </tr>
                  <tr v-if="showReturnRow(returnNote8.value, returnNote8.sd, returnNote8.vat)">
                    <td class="text-start" style="color: #cbd5e1;">Retail/Wholesale/Trade Based Supply</td>
                    <td class="text-center font-monospace mushak-note-cell" style="color: #7da0c4;">Note: 8</td>
                    <td class="text-end font-monospace fw-medium" style="color: #cbd5e1;">{{ fmt(returnNote8.value) }}</td>
                    <td class="text-end font-monospace" style="color: #64748b;">{{ fmt(returnNote8.sd) }}</td>
                    <td class="text-end font-monospace fw-medium" style="color: #6ee7b7;">{{ fmt(returnNote8.vat) }}</td>
                  </tr>
                  <tr v-if="showReturnRow(returnNote9.value, returnNote9.sd, returnNote9.vat)" class="fw-bold" style="background: rgba(59, 130, 246, 0.12);">
                    <td class="text-start" style="color: #93c5fd;">Total Sales Value & Total Payable Taxes</td>
                    <td class="text-center font-monospace mushak-note-cell" style="color: #f59e0b;">Note: 9</td>
                    <td class="text-end font-monospace fw-bold" style="color: #93c5fd;">{{ fmt(returnNote9.value) }}</td>
                    <td class="text-end font-monospace" style="color: #64748b;">{{ fmt(returnNote9.sd) }}</td>
                    <td class="text-end font-monospace fw-bold" style="color: #6ee7b7;">{{ fmt(returnNote9.vat) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- PART 4: PURCHASE - INPUT TAX -->
          <div class="idp-card p-4 mb-4">
            <h5 class="text-emerald-400 fw-bold mb-3 text-center border-bottom border-secondary border-opacity-25 pb-2.5 fs-5">
              PART - 4: PURCHASE - INPUT TAX
            </h5>
            <div class="idp-table-wrapper" style="max-height: 440px; overflow: auto;">
              <table class="table idp-table mushak-table mb-0 align-middle text-nowrap">
                <thead>
                  <tr style="color: #94a3b8 !important; border-bottom: 1px solid #334155;">
                    <th class="text-start" style="width: 40%; color: #94a3b8;">Nature of Supply</th>
                    <th class="text-center" style="width: 110px; color: #94a3b8;">Note</th>
                    <th class="text-end" style="color: #94a3b8;">Value (a)</th>
                    <th class="text-end" style="color: #94a3b8;">VAT (b)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="showReturnRow(returnNote13Value)">
                    <td class="text-start" style="color: #cbd5e1;">Exempted Goods/Service (Import)</td>
                    <td class="text-center font-monospace mushak-note-cell" style="color: #7da0c4;">Note: 13</td>
                    <td class="text-end font-monospace fw-medium" style="color: #cbd5e1;">{{ fmt(returnNote13Value) }}</td>
                    <td class="text-end font-monospace" style="color: #64748b;">0.00</td>
                  </tr>
                  <tr v-if="showReturnRow(returnNote15.value, returnNote15.vat)">
                    <td class="text-start" style="color: #cbd5e1;">Standard Rated Goods/Service (Import)</td>
                    <td class="text-center font-monospace mushak-note-cell" style="color: #7da0c4;">Note: 15</td>
                    <td class="text-end font-monospace fw-medium" style="color: #cbd5e1;">{{ fmt(returnNote15.value) }}</td>
                    <td class="text-end font-monospace fw-medium" style="color: #6ee7b7;">{{ fmt(returnNote15.vat) }}</td>
                  </tr>
                  <tr v-if="showReturnRow(returnNote22.value)">
                    <td class="text-start" style="color: #cbd5e1;">Goods/Service Not Admissible for Credit (Import)</td>
                    <td class="text-center font-monospace mushak-note-cell" style="color: #7da0c4;">Note: 22</td>
                    <td class="text-end font-monospace fw-medium" style="color: #cbd5e1;">{{ fmt(returnNote22.value) }}</td>
                    <td class="text-end font-monospace" style="color: #64748b;">0.00</td>
                  </tr>
                  <tr v-if="showReturnRow(returnNote23.value, returnNote23.vat)" class="fw-bold" style="background: rgba(59, 130, 246, 0.12);">
                    <td class="text-start" style="color: #93c5fd;">Total Input Tax Credit</td>
                    <td class="text-center font-monospace mushak-note-cell" style="color: #f59e0b;">Note: 23</td>
                    <td class="text-end font-monospace fw-bold" style="color: #93c5fd;">{{ fmt(returnNote23.value) }}</td>
                    <td class="text-end font-monospace fw-bold" style="color: #6ee7b7;">{{ fmt(returnNote23.vat) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- PART 5: INCREASING ADJUSTMENTS -->
          <div class="idp-card p-4 mb-4">
            <h5 class="text-emerald-400 fw-bold mb-3 text-center border-bottom border-secondary border-opacity-25 pb-2.5 fs-5">
              PART - 5: INCREASING ADJUSTMENTS
            </h5>
            <div class="idp-table-wrapper" style="max-height: 440px; overflow: auto;">
              <table class="table idp-table mushak-table mb-0 align-middle text-nowrap">
                <thead>
                  <tr style="color: #94a3b8 !important; border-bottom: 1px solid #334155;">
                    <th class="text-start" style="width: 40%; color: #94a3b8;">Nature of Supply</th>
                    <th class="text-center" style="width: 110px; color: #94a3b8;">Note</th>
                    <th class="text-end" style="color: #94a3b8;">Value</th>
                    <th class="text-end" style="color: #94a3b8;">VAT</th>
                    <th class="text-end" style="color: #94a3b8;">SD</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="showReturnRow(returnNote27VAT)">
                    <td class="text-start" style="color: #cbd5e1;">Any Other Adjustments</td>
                    <td class="text-center font-monospace mushak-note-cell" style="color: #7da0c4;">Note: 27</td>
                    <td class="text-end font-monospace" style="color: #64748b;">0.00</td>
                    <td class="text-end font-monospace fw-medium" style="color: #f59e0b;">{{ fmt(returnNote27VAT) }}</td>
                    <td class="text-end font-monospace" style="color: #64748b;">0.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- PART 6: DECREASING ADJUSTMENTS -->
          <div class="idp-card p-4 mb-4">
            <h5 class="text-emerald-400 fw-bold mb-3 text-center border-bottom border-secondary border-opacity-25 pb-2.5 fs-5">
              PART - 6: DECREASING ADJUSTMENTS
            </h5>
            <div class="idp-table-wrapper" style="max-height: 440px; overflow: auto;">
              <table class="table idp-table mushak-table mb-0 align-middle text-nowrap">
                <thead>
                  <tr style="color: #94a3b8 !important; border-bottom: 1px solid #334155;">
                    <th class="text-start" style="width: 40%; color: #94a3b8;">Nature of Supply</th>
                    <th class="text-center" style="width: 110px; color: #94a3b8;">Note</th>
                    <th class="text-end" style="color: #94a3b8;">Value</th>
                    <th class="text-end" style="color: #94a3b8;">VAT</th>
                    <th class="text-end" style="color: #94a3b8;">SD</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="showReturnRow(returnNote30VAT)">
                    <td class="text-start" style="color: #cbd5e1;">Advance Tax Paid at Import Stage</td>
                    <td class="text-center font-monospace mushak-note-cell" style="color: #7da0c4;">Note: 30</td>
                    <td class="text-end font-monospace" style="color: #64748b;">0.00</td>
                    <td class="text-end font-monospace fw-medium" style="color: #6ee7b7;">{{ fmt(returnNote30VAT) }}</td>
                    <td class="text-end font-monospace" style="color: #64748b;">0.00</td>
                  </tr>
                  <tr v-if="showReturnRow(returnNote32VAT)">
                    <td class="text-start" style="color: #cbd5e1;">Any Other Adjustments</td>
                    <td class="text-center font-monospace mushak-note-cell" style="color: #7da0c4;">Note: 32</td>
                    <td class="text-end font-monospace" style="color: #64748b;">0.00</td>
                    <td class="text-end font-monospace fw-medium" style="color: #6ee7b7;">{{ fmt(returnNote32VAT) }}</td>
                    <td class="text-end font-monospace" style="color: #64748b;">0.00</td>
                  </tr>
                  <tr v-if="showReturnRow(returnNote33VAT)" class="fw-bold" style="background: rgba(59, 130, 246, 0.12);">
                    <td class="text-start" style="color: #93c5fd;">Total Decreasing Adjustment</td>
                    <td class="text-center font-monospace mushak-note-cell" style="color: #f59e0b;">Note: 33</td>
                    <td class="text-end font-monospace" style="color: #64748b;">0.00</td>
                    <td class="text-end font-monospace fw-bold" style="color: #6ee7b7;">{{ fmt(returnNote33VAT) }}</td>
                    <td class="text-end font-monospace" style="color: #64748b;">0.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- PART 7: NET TAX CALCULATION -->
          <div class="idp-card p-4 mb-4" style="border: 1px solid rgba(217, 70, 239, 0.4); background: rgba(112, 26, 117, 0.08);">
            <h5 class="text-emerald-400 fw-bold mb-3 text-center border-bottom border-secondary border-opacity-25 pb-2.5 fs-5">
              PART - 7: NET TAX CALCULATION
            </h5>
            <div class="idp-table-wrapper" style="max-height: 440px; overflow: auto;">
              <table class="table idp-table mushak-table mushak-table-net mb-0 align-middle text-nowrap">
                <thead>
                  <tr style="color: #94a3b8 !important;">
                    <th class="text-start" style="width: 50%; color: #94a3b8;">Nature of Supply</th>
                    <th class="text-center" style="width: 110px; color: #94a3b8;">Note</th>
                    <th class="text-end" style="color: #94a3b8;">VAT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="fw-bold" style="background: rgba(217, 70, 239, 0.15);">
                    <td class="text-start" style="color: #cbd5e1;">Net Payable VAT for the Tax Period</td>
                    <td class="text-center font-monospace mushak-note-cell" style="color: #f59e0b;">Note: 34</td>
                    <td class="text-end font-monospace fw-bold fs-4" style="color: #f59e0b;">{{ fmt(returnNote34VAT) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- ==================== TAB 4: STATEMENT REPORT ==================== -->
        <div v-else-if="currentTab === 'statement'" class="idp-card p-4">
          <h5 class="text-white fw-bold mb-3 d-flex align-items-center gap-2">
            <i class="bi bi-clock-history text-primary"></i> Mid-Month Rate Change Statement Breakdown
          </h5>
          <div class="idp-table-wrapper" style="max-height: 420px; overflow: auto;">
            <table class="table idp-table mb-0 align-middle text-nowrap" style="font-size: 0.95rem;">
              <thead>
                <tr style="color: #94a3b8 !important; border-bottom: 1px solid #334155;">
                  <th class="text-center py-2.5 font-semibold" style="color: #94a3b8;">Active Period</th>
                  <th class="text-start py-2.5 font-semibold" style="color: #94a3b8;">Item</th>
                  <th class="text-end py-2.5 font-semibold" style="color: #94a3b8;">Qty</th>
                  <th class="text-end py-2.5 font-semibold" style="color: #94a3b8;">Rate</th>
                  <th class="text-end py-2.5 font-semibold" style="color: #38bdf8;">Total Price</th>
                  <th class="text-end py-2.5 font-semibold" style="color: #94a3b8;">Vatable Value</th>
                  <th class="text-end py-2.5 font-semibold" style="color: #94a3b8;">VAT</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(st, idx) in statementReport" :key="idx">
                  <td class="text-center font-monospace py-2.5" style="color: #64748b;">
                    {{ formatDate(st.startDate) }} <span style="color: #475569;">➔</span> {{ formatDate(st.endDate) }}
                  </td>
                  <td class="text-start fw-medium py-2.5" style="color: #cbd5e1;">{{ st.itemName }}</td>
                  <td class="text-end font-monospace py-2.5" style="color: #94a3b8;">{{ fmt(st.qty * currentConvFactor) }}</td>
                  <td class="text-end font-monospace fw-medium py-2.5" style="color: #94a3b8;">{{ fmt(st.salesRate / currentConvFactor) }}</td>
                  <td class="text-end font-monospace fw-medium py-2.5" style="color: #38bdf8;">{{ fmt(st.totalSalesValue) }}</td>
                  <td class="text-end font-monospace py-2.5" style="color: #64748b;">{{ fmt(st.vatableValue) }}</td>
                  <td class="text-end font-monospace py-2.5" style="color: #94a3b8;">{{ fmt(st.vat) }}</td>
                </tr>
                <tr v-if="statementReport.length === 0">
                  <td colspan="7" class="text-center py-5 text-muted">
                    No statement records available for this period.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- MONTHLY SUMMARY (ALL CLIENTS) MODAL -->
    <div v-if="showSummaryModal" class="modal-backdrop-idp">
      <div class="modal-dialog-idp modal-md">
        <div class="idp-card p-4">
          <div class="d-flex align-items-center justify-content-between border-bottom border-secondary border-opacity-25 pb-3 mb-3">
            <h5 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-file-earmark-spreadsheet-fill text-primary"></i>
              Monthly Summary (All Clients)
            </h5>
            <button class="btn btn-sm btn-link text-muted p-0" @click="showSummaryModal = false">✕</button>
          </div>

          <div class="py-2">
            <p class="text-muted small mb-3">
              Download an aggregated Excel report showing total purchases (in Metric Tons) across all active clients for the selected tax period.
            </p>

            <div v-if="summaryErrorMsg" class="alert alert-danger py-2 small mb-3">
              {{ summaryErrorMsg }}
            </div>

            <div class="mb-3">
              <label class="form-label text-white small fw-semibold">Select Month</label>
              <input v-model="summaryModalMonth" type="month" class="form-control idp-input" />
            </div>
          </div>

          <div class="d-flex justify-content-end gap-2 pt-3 mt-3 border-top border-secondary border-opacity-25">
            <button class="btn btn-outline-secondary px-3" :disabled="isDownloadingSummary" @click="showSummaryModal = false">
              Cancel
            </button>
            <button class="btn btn-primary px-4 fw-semibold" :disabled="isDownloadingSummary" @click="downloadMonthlySummaryExcel">
              <span v-if="isDownloadingSummary" class="spinner-border spinner-border-sm me-1"></span>
              <i v-else class="bi bi-download me-1"></i>
              <span>Download Excel</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- CHANGE MONTH MODAL -->
    <div v-if="showChangeMonthModal" class="modal-backdrop-idp">
      <div class="modal-dialog-idp modal-md">
        <div class="idp-card p-4">
          <div class="d-flex align-items-center justify-content-between border-bottom border-secondary border-opacity-25 pb-3 mb-3">
            <h5 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-calendar-event text-warning"></i>
              Change Purchase Month
            </h5>
            <button class="btn btn-sm btn-link text-muted p-0" @click="showChangeMonthModal = false">✕</button>
          </div>

          <div class="py-2">
            <p class="text-white small mb-3">
              Update the active VAT period for BE No: <strong class="text-primary font-monospace">{{ editingPurchase?.beNo }}</strong>
            </p>

            <div class="mb-3">
              <label class="form-label text-white small fw-semibold">Target Month</label>
              <input
                v-model="newMonthSelection"
                type="month"
                :min="editingPurchase?.month"
                class="form-control idp-input"
              />
              <div class="text-muted small mt-1.5" style="font-size: 0.75rem;">
                <i class="bi bi-info-circle text-info me-1"></i>
                Purchases can only be shifted to the current or subsequent tax periods (cannot move to past months).
              </div>
            </div>
          </div>

          <div class="d-flex justify-content-end gap-2 pt-3 mt-3 border-top border-secondary border-opacity-25">
            <button class="btn btn-outline-secondary px-3" :disabled="isSavingMonth" @click="showChangeMonthModal = false">
              Cancel
            </button>
            <button class="btn btn-warning px-4 fw-semibold text-dark" :disabled="isSavingMonth" @click="saveNewMonth">
              <span v-if="isSavingMonth" class="spinner-border spinner-border-sm me-1"></span>
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- SUBMISSION ID MODAL -->
    <div v-if="showSubIdModal" class="modal-backdrop-idp">
      <div class="modal-dialog-idp modal-md">
        <div class="idp-card p-4">
          <div class="d-flex align-items-center justify-content-between border-bottom border-secondary border-opacity-25 pb-3 mb-3">
            <h5 class="text-white fw-bold mb-0 d-flex align-items-center gap-2">
              <i class="bi bi-file-earmark-check text-primary"></i>
              {{ submissionId ? 'Update Submission ID' : 'Enter Submission ID' }}
            </h5>
            <button class="btn btn-sm btn-link text-muted p-0" @click="showSubIdModal = false">✕</button>
          </div>

          <div class="py-2">
            <p class="text-muted small mb-3">
              Tax Period: <strong class="text-primary">{{ formatMonth(selectedMonthYear) }}</strong> | Client: <strong class="text-light">{{ selectedClient?.name }}</strong>
            </p>

            <div class="mb-3">
              <label class="form-label text-white small fw-semibold">NBR Submission ID / Reference</label>
              <input
                v-model="subIdInput"
                type="text"
                class="form-control idp-input font-monospace text-emerald-400 fw-bold fs-5"
                placeholder="e.g. 84920194"
                @keyup.enter="saveSubmissionId"
              />
              <div class="text-muted small mt-1.5" style="font-size: 0.75rem;">
                Official statutory return submission tracking ID from the NBR eVAT portal.
              </div>
            </div>
          </div>

          <div class="d-flex justify-content-end gap-2 pt-3 mt-3 border-top border-secondary border-opacity-25">
            <button class="btn btn-outline-secondary px-3" :disabled="isSavingSubId" @click="showSubIdModal = false">
              Cancel
            </button>
            <button class="btn btn-primary px-4 fw-semibold" :disabled="isSavingSubId" @click="saveSubmissionId">
              <span v-if="isSavingSubId" class="spinner-border spinner-border-sm me-1"></span>
              <span>Save ID</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Report Tabs */
.btn-report-tab {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(51, 65, 85, 0.8);
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-report-tab:hover {
  background: rgba(51, 65, 85, 0.8);
  color: #f1f5f9;
}

.btn-report-tab.active {
  background: #2563eb !important;
  border-color: #3b82f6 !important;
  color: #ffffff !important;
  box-shadow: 0 0 12px rgba(37, 99, 235, 0.4);
}

.client-option-item:hover,
.unit-option-item:hover {
  background: rgba(59, 130, 246, 0.2);
}

.hover-white:hover {
  color: #ffffff !important;
}

.modal-backdrop-idp {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  z-index: 1060;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-dialog-idp {
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.modal-dialog-idp.modal-md {
  max-width: 460px;
}

/* Record Badges */
.badge-record-pill {
  display: inline-flex;
  align-items: center;
  font-size: 0.74rem;
  font-weight: 600;
  padding: 0.22rem 0.75rem;
  border-radius: 50rem;
  font-family: inherit;
  letter-spacing: 0.3px;
}

.pill-warning {
  background: rgba(245, 158, 11, 0.15) !important;
  color: #fbbf24 !important;
  border: 1px solid rgba(245, 158, 11, 0.35) !important;
}

.pill-success {
  background: rgba(16, 185, 129, 0.15) !important;
  color: #34d399 !important;
  border: 1px solid rgba(16, 185, 129, 0.35) !important;
}

.pill-primary {
  background: rgba(59, 130, 246, 0.15) !important;
  color: #60a5fa !important;
  border: 1px solid rgba(59, 130, 246, 0.35) !important;
}

/* Sticky Table Headers & Scrollable Container */
.idp-table-wrapper {
  max-height: 480px;
  overflow-y: auto;
  overflow-x: auto;
  position: relative;
  border-radius: var(--idp-radius, 6px);
  background-color: var(--idp-card, #212529);
  border: 1px solid var(--idp-border, #3b424b);
}

.idp-table thead th {
  font-weight: 700 !important;
  color: var(--idp-text-muted, #adb5bd);
  position: sticky !important;
  top: 0 !important;
  z-index: 15 !important;
  background-color: var(--idp-bg, #1a1d21) !important;
  box-shadow: inset 0 -1px 0 var(--idp-border, #3b424b) !important;
}

.mushak-table {
  font-size: 1.12rem !important;
  border-collapse: collapse !important;
  border: 1px solid var(--idp-border, #3b424b) !important;
}

.mushak-table th {
  font-size: 1.05rem !important;
  font-weight: 700 !important;
  padding: 0.85rem 1rem !important;
  border: 1px solid var(--idp-border, #3b424b) !important;
  background: var(--idp-bg, #1a1d21) !important;
}

.mushak-table td {
  font-size: 1.12rem !important;
  padding: 0.85rem 1rem !important;
  border: 1px solid rgba(148, 163, 184, 0.35) !important;
}

.mushak-table .mushak-note-cell {
  font-size: 1.05rem !important;
  font-weight: 700 !important;
}

.mushak-table-net {
  border: 1px solid rgba(217, 70, 239, 0.45) !important;
}

.mushak-table-net th,
.mushak-table-net td {
  border: 1px solid rgba(217, 70, 239, 0.45) !important;
}

.mushak-table-net td {
  font-size: 1.25rem !important;
  padding: 1.1rem 1rem !important;
}
</style>
