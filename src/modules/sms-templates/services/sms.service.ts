import { db } from "@/framework/facade.js";
import { eq, and, isNull, or } from "drizzle-orm";
import { smsTemplates, type SmsTemplateVariable } from "../database/models/sms_templates.js";
import { smsLogs } from "../database/models/sms_logs.js";
import { companySettings } from "@/modules/firm/database/models/company_settings.js";
import { users } from "@/modules/auth/database/models/user.js";
import { roles } from "@/modules/auth/database/models/role.js";

const BULKSMSBD_ENDPOINT = "http://bulksmsbd.net/api/smsapi";

export const DEFAULT_TEMPLATES = [
  {
    key: "vat_submission",
    name: "VAT Return Submission",
    description: null,
    body: "আপনার প্রতিষ্ঠানের {{tax_period}} কর মেয়াদের ভ্যাট রিটার্ণ অনলাইনে দাখিল করা হয়েছে। সাবমিশন আইডি: {{submission_id}}।\n\n- {{sender_role}}, {{company_name}}",
    variables: [
      { name: "customer_name", label: "Client Name", sample: "M/S. A. S. A ENTERPRISE", description: "Client Company Name" },
      { name: "tax_period", label: "Tax Period", sample: "July 2026", description: "Tax Period Month & Year" },
      { name: "submission_id", label: "Submission ID", sample: "VAT-2026-000123", description: "NBR e-VAT Submission Number" },
      { name: "bin_number", label: "BIN Number", sample: "001320903-0701", description: "Client 13 or 9-digit BIN" },
      { name: "sender_role", label: "Sender Role", sample: "Admin", description: "Admin / Consultant Role" },
      { name: "company_name", label: "Firm Name", sample: "One Associate", description: "VAT Consultant Firm Name" }
    ] as SmsTemplateVariable[]
  },
  {
    key: "mushak_submission",
    name: "Mushak 4.3 Submission",
    description: null,
    body: "আপনার প্রতিষ্ঠানের বিপরীতে {{boe_date}} তারিখে আনিত {{item_name}} এর মূল্য ঘোষণা (মূসক ৪.৩) দাখিল করা হয়েছে। সাবমিশন আইডি: {{submission_id}}।\n\n- {{sender_role}}, {{company_name}}",
    variables: [
      { name: "customer_name", label: "Client Name", sample: "M/S. ANKUR ENTERPRISE", description: "Client Company Name" },
      { name: "boe_date", label: "B/E Date", sample: "12 July 2026", description: "Bill of Entry Date" },
      { name: "item_name", label: "Item Name", sample: "Iron Plate", description: "Imported Item Name" },
      { name: "submission_id", label: "Submission ID", sample: "M43-2026-000456", description: "Mushak 4.3 Submission Number" },
      { name: "sender_role", label: "Sender Role", sample: "Admin", description: "Admin / Consultant Role" },
      { name: "company_name", label: "Firm Name", sample: "One Associate", description: "VAT Consultant Firm Name" }
    ] as SmsTemplateVariable[]
  },
  {
    key: "bill_notification",
    name: "Monthly Bill",
    description: null,
    body: "প্রিয় {{customer_name}}, {{month}} মাসের ভ্যাট কনসালট্যান্সি ফি বাবদ বিল {{current_bill}} টাকা। মোট বকেয়া {{grand_total}} টাকা।\n\n- {{company_name}}",
    variables: [
      { name: "customer_name", label: "Client Name", sample: "M/S. HASAN ENTERPRISE", description: "Client Company Name" },
      { name: "month", label: "Bill Month", sample: "July-2026", description: "Billing Month & Year" },
      { name: "current_bill", label: "Current Bill", sample: "1500", description: "Current Month Bill Amount" },
      { name: "due", label: "Previous Due", sample: "500", description: "Previous Unpaid Balance" },
      { name: "grand_total", label: "Grand Total", sample: "2000", description: "Total Payable Balance" },
      { name: "company_name", label: "Firm Name", sample: "One Associate", description: "VAT Consultant Firm Name" }
    ] as SmsTemplateVariable[]
  },
  {
    key: "collection_receipt",
    name: "Payment Receipt",
    description: null,
    body: "প্রিয় {{customer_name}}, আপনার নিকট হতে {{paid}} টাকা ফি বাবদ গ্রহণ করা হয়েছে। বর্তমান অবশিষ্ট বকেয়া {{due}} টাকা। ধন্যবাদ।\n\n- {{company_name}}",
    variables: [
      { name: "customer_name", label: "Client Name", sample: "M/S. HASAN ENTERPRISE", description: "Client Company Name" },
      { name: "paid", label: "Paid Amount", sample: "1500", description: "Collected / Received Amount" },
      { name: "due", label: "Remaining Due", sample: "0", description: "Due Balance after Payment" },
      { name: "receipt_no", label: "Receipt No", sample: "MR-2026-00001", description: "Money Receipt Number" },
      { name: "company_name", label: "Firm Name", sample: "One Associate", description: "VAT Consultant Firm Name" }
    ] as SmsTemplateVariable[]
  },
  {
    key: "due_reminder",
    name: "Due Reminder",
    description: null,
    body: "প্রিয় {{customer_name}}, অদ্য {{date}} তারিখ পর্যন্ত আপনার সর্বমোট বকেয়া {{due}} টাকা। বকেয়া পরিশোধের জন্য অনুরোধ করা হলো।\n\n- {{company_name}}",
    variables: [
      { name: "customer_name", label: "Client Name", sample: "ABC Traders", description: "Client Company Name" },
      { name: "date", label: "Date", sample: "10/08/2026", description: "Current Date" },
      { name: "due", label: "Due Amount", sample: "3500", description: "Total Outstanding Due" },
      { name: "company_name", label: "Firm Name", sample: "One Associate", description: "VAT Consultant Firm Name" }
    ] as SmsTemplateVariable[]
  }
];

export function renderTemplate(
  body: string,
  vars: Record<string, string | number | null | undefined>
): string {
  if (!body) return "";
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}

export function normalizeBdMobile(rawMobile: string | null | undefined): string | null {
  if (!rawMobile) return null;
  const digits = rawMobile.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("880") && digits.length === 13) return digits;
  if (digits.startsWith("01") && digits.length === 11) return `88${digits}`;
  if (digits.length === 10 && digits.startsWith("1")) return `880${digits}`;
  if (digits.length >= 11 && digits.length <= 14) return digits;
  return null;
}

export async function resolveSenderRoleLabel(userId: number | null | undefined): Promise<string> {
  if (!userId) return "অ্যাডমিন";
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: { role: true }
    });
    const roleName = (user as any)?.role?.name;
    if (roleName === "admin" || roleName === "superadmin") return "অ্যাডমিন";
    if (roleName === "manager") return "ম্যানেজার";
    return "এক্সিকিউটিভ";
  } catch {
    return "অ্যাডমিন";
  }
}

export async function getEffectiveTemplate(key: string, adminId?: number | null) {
  try {
    if (adminId) {
      const tenantTpl = await db.query.smsTemplates.findFirst({
        where: and(eq(smsTemplates.key, key), eq(smsTemplates.adminId, adminId), eq(smsTemplates.isActive, true))
      });
      if (tenantTpl) return tenantTpl;
    }
    const globalTpl = await db.query.smsTemplates.findFirst({
      where: and(eq(smsTemplates.key, key), isNull(smsTemplates.adminId), eq(smsTemplates.isActive, true))
    });
    if (globalTpl) return globalTpl;

    // Fallback to built-in default
    return DEFAULT_TEMPLATES.find((t) => t.key === key) || null;
  } catch {
    return DEFAULT_TEMPLATES.find((t) => t.key === key) || null;
  }
}

export async function callSmsGateway(opts: {
  apiKey: string;
  senderId: string;
  number: string;
  message: string;
  endpointUrl?: string;
  provider?: string;
}): Promise<{ ok: boolean; raw: string }> {
  try {
    const endpoint = opts.endpointUrl || BULKSMSBD_ENDPOINT;
    const isBulkSmsBd = endpoint.includes("bulksmsbd");

    const params = new URLSearchParams({
      api_key: opts.apiKey.trim(),
      type: "text",
      number: opts.number.trim(),
      message: opts.message
    });
    
    if (isBulkSmsBd) {
      params.append("senderid", opts.senderId.trim());
    } else {
      params.append("senderid", opts.senderId.trim()); // Greenweb/others often use senderid too
    }

    const res = await fetch(`${endpoint}?${params.toString()}`, { method: "GET" });
    const text = await res.text();
    let ok = res.ok;
    let friendly = text;

    try {
      const j = JSON.parse(text);
      if (typeof j?.response_code === "number") {
        ok = j.response_code === 202;
        const code = j.response_code;
        const errMap: Record<number, string> = {
          1001: "Invalid Number",
          1002: "Sender ID not correct / disabled",
          1003: "Required fields missing",
          1004: "Balance validity expired",
          1005: "Sender ID not registered/approved on BulkSMSBD.",
          1006: "Balance insufficient",
          1007: "Number is blocked",
          1011: "User ID not found"
        };
        if (!ok && errMap[code]) friendly = `[${code}] ${errMap[code]}`;
      }
    } catch {}

    return { ok, raw: friendly.slice(0, 500) };
  } catch (e: any) {
    return { ok: false, raw: `Network error: ${e?.message || String(e)}` };
  }
}

export const callBulkSmsBd = callSmsGateway;

export async function sendVatSubmissionSms(params: {
  clientName: string;
  clientMobile?: string | null;
  clientAltMobile?: string | null;
  clientBin?: string | null;
  taxPeriod: string;
  submissionId: string;
  adminId: number;
  sentByUserId?: number | null;
}): Promise<{ ok: boolean; status: string; response: string; message: string }> {
  const recipient = normalizeBdMobile(params.clientMobile) || normalizeBdMobile(params.clientAltMobile);

  // 1. Fetch Company Settings
  let smsApiKey = "";
  let senderId = "";
  let companyName = "IDP System";
  let autoMessagingEnabled = true;
  let settings: any = null;

  try {
    settings = await db.query.companySettings.findFirst({
      where: eq(companySettings.adminId, params.adminId)
    });
    if (settings) {
      smsApiKey = settings.smsApiKey || "";
      senderId = settings.smsSenderId || "";
      companyName = settings.companyName || companyName;
    }
    // Fallback to global superadmin gateway settings if tenant hasn't configured custom key
    if (!smsApiKey) {
      const globalSettings = await db.query.companySettings.findFirst({
        where: isNull(companySettings.adminId)
      });
      if (globalSettings?.smsApiKey) {
        smsApiKey = globalSettings.smsApiKey;
        if (!senderId) senderId = globalSettings.smsSenderId || "VAT-IDP";
      }
    }
    if (!senderId) senderId = "VAT-IDP";
  } catch {}

  const senderRole = await resolveSenderRoleLabel(params.sentByUserId);

  // 2. Render Template
  const tpl = await getEffectiveTemplate("vat_submission", params.adminId);
  const rawBody = tpl?.body || DEFAULT_TEMPLATES[0].body;

  const renderedMessage = renderTemplate(rawBody, {
    customer_name: params.clientName,
    tax_period: params.taxPeriod,
    submission_id: params.submissionId,
    bin_number: params.clientBin || "",
    sender_role: senderRole,
    company_name: companyName
  });

  if (!recipient) {
    await db.insert(smsLogs).values({
      adminId: params.adminId,
      recipientMobile: params.clientMobile || "NO_MOBILE",
      message: renderedMessage,
      templateKey: "vat_submission",
      submissionId: params.submissionId,
      status: "FAILED",
      providerResponse: "No valid Bangladesh mobile number found for client",
      sentBy: params.sentByUserId ?? null
    }).catch(() => {});
    return { ok: false, status: "FAILED", response: "No valid mobile number", message: renderedMessage };
  }

  if (!autoMessagingEnabled) {
    return { ok: false, status: "SKIPPED", response: "Auto messaging disabled in Firm Settings", message: renderedMessage };
  }

  if (!smsApiKey || !senderId) {
    await db.insert(smsLogs).values({
      adminId: params.adminId,
      recipientMobile: recipient,
      message: renderedMessage,
      templateKey: "vat_submission",
      submissionId: params.submissionId,
      status: "FAILED",
      providerResponse: "SMS Gateway API Key or Sender ID not configured in Firm Settings",
      sentBy: params.sentByUserId ?? null
    }).catch(() => {});
    return { ok: false, status: "FAILED", response: "SMS Gateway not configured", message: renderedMessage };
  }

  // 3. Send SMS via Gateway
  const result = await callSmsGateway({
    apiKey: smsApiKey,
    senderId: senderId,
    number: recipient,
    message: renderedMessage,
    endpointUrl: settings?.smsEndpointUrl || undefined,
    provider: settings?.smsProvider || undefined
  });

  const finalStatus = result.ok ? "SENT" : "FAILED";

  await db.insert(smsLogs).values({
    adminId: params.adminId,
    recipientMobile: recipient,
    message: renderedMessage,
    templateKey: "vat_submission",
    submissionId: params.submissionId,
    status: finalStatus,
    providerResponse: result.raw,
    sentBy: params.sentByUserId ?? null
  }).catch(() => {});

  return { ok: result.ok, status: finalStatus, response: result.raw, message: renderedMessage };
}
