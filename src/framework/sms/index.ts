import axios from "axios";

export interface SmsSendOptions {
  apiKey?: string;
  senderId?: string;
  mobile: string;
  message: string;
}

/**
 * Fetch live remaining balance directly from SMS Gateway Provider API (BulkSMSBD / Greenweb)
 */
export async function fetchProviderBalance(apiKey?: string | null): Promise<number | null> {
  if (!apiKey || !apiKey.trim()) return null;

  try {
    // 1. Try BulkSMSBD Get Balance API
    const res = await axios.get("http://bulksmsbd.net/api/getBalanceApi", {
      params: { api_key: apiKey.trim() },
      timeout: 5000
    });

    if (res.data) {
      if (typeof res.data === "object" && res.data.balance !== undefined) {
        const num = parseFloat(String(res.data.balance));
        if (!isNaN(num)) return parseFloat(num.toFixed(2));
      }
      const rawNum = parseFloat(String(res.data));
      if (!isNaN(rawNum)) return parseFloat(rawNum.toFixed(2));
    }
  } catch (err) {
    // 2. Try Greenweb Balance API if BulkSMSBD fails
    try {
      const gwRes = await axios.get("https://api.greenweb.com.bd/gsi.php", {
        params: { token: apiKey.trim() },
        timeout: 5000
      });
      const gwNum = parseFloat(String(gwRes.data));
      if (!isNaN(gwNum)) return parseFloat(gwNum.toFixed(2));
    } catch { }
  }

  return null;
}

/**
 * Send SMS via Gateway Provider API and fetch live remaining balance directly from the provider
 */
export async function dispatchProviderSms(options: SmsSendOptions): Promise<{ success: boolean; message: string; liveBalance?: number }> {
  const { apiKey, senderId = "", mobile, message } = options;

  if (!apiKey || !apiKey.trim()) {
    return { success: false, message: "SMS Gateway API Key is missing in Firm Settings." };
  }

  try {
    // Clean mobile number (strip spaces, dashes, plus signs, brackets)
    const cleanMobile = mobile.replace(/[\s\-\+\(\)]/g, "");

    // 1. Dispatch SMS through BulkSMSBD API
    const sendRes = await axios.get("http://bulksmsbd.net/api/smsapi", {
      params: {
        api_key: apiKey.trim(),
        type: "text",
        number: cleanMobile,
        senderid: senderId || "",
        message: message
      },
      timeout: 10000
    });

    if (sendRes.data && typeof sendRes.data === "object") {
      if (sendRes.data.response_code && sendRes.data.response_code !== 202) {
        return {
          success: false,
          message: sendRes.data.error_message || `Gateway returned error code: ${sendRes.data.response_code}`
        };
      }
    }

    // 2. Query provider balance directly after sending
    const liveBalance = await fetchProviderBalance(apiKey);

    return {
      success: true,
      message: (sendRes.data?.success_message || "SMS sent successfully via Provider Gateway"),
      liveBalance: liveBalance !== null ? liveBalance : undefined
    };
  } catch (err: any) {
    console.error("SMS Gateway dispatch error:", err?.response?.data || err.message);
    return {
      success: false,
      message: err?.response?.data?.message || err.message || "Failed to dispatch SMS through gateway."
    };
  }
}
