import axios from "axios";

export interface SmsTemplateVariable {
  name: string;
  label: string;
  sample: string;
  description?: string;
}

export interface SmsTemplate {
  id: number;
  adminId: number | null;
  key: string;
  name: string;
  description: string | null;
  body: string;
  variables: SmsTemplateVariable[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SmsLog {
  id: number;
  adminId: number | null;
  recipientMobile: string;
  message: string;
  templateKey: string | null;
  submissionId: string | null;
  status: string;
  providerResponse: string | null;
  sentBy: number | null;
  sentAt: string;
}

export interface SmsGatewaySettings {
  smsApiKey: string;
  maskedApiKey?: string;
  isConfigured?: boolean;
  smsSenderId: string;
  provider: string;
  endpoint: string;
}

export function useSmsTemplatesApi() {
  const fetchTemplates = async () => {
    const res = await axios.get("/api/sms-templates");
    return res.data?.data as SmsTemplate[];
  };

  const updateTemplate = async (id: number, payload: Partial<SmsTemplate>) => {
    const res = await axios.put(`/api/sms-templates/${id}`, payload);
    return res.data;
  };

  const resetTemplate = async (id: number) => {
    const res = await axios.post(`/api/sms-templates/${id}/reset`);
    return res.data;
  };

  const sendTestSms = async (recipientMobile: string, message: string) => {
    const res = await axios.post("/api/sms-templates/test", { recipientMobile, message });
    return res.data;
  };

  const fetchSmsLogs = async () => {
    const res = await axios.get("/api/sms-templates/logs");
    return res.data?.data as SmsLog[];
  };

  const fetchGatewaySettings = async () => {
    const res = await axios.get("/api/sms-templates/gateway");
    return res.data?.data as SmsGatewaySettings;
  };

  const updateGatewaySettings = async (payload: { smsApiKey: string; smsSenderId: string }) => {
    const res = await axios.put("/api/sms-templates/gateway", payload);
    return res.data;
  };

  const checkGatewayBalance = async () => {
    const res = await axios.get("/api/sms-templates/gateway/balance");
    return res.data as { success: boolean; balance: string };
  };

  return {
    fetchTemplates,
    updateTemplate,
    resetTemplate,
    sendTestSms,
    fetchSmsLogs,
    fetchGatewaySettings,
    updateGatewaySettings,
    checkGatewayBalance
  };
}
