import { ref, onMounted, onUnmounted } from "vue";
import axios from "axios";
import { pulse } from "@/plugins/pulse";

export interface CustomerType {
  id: number;
  typeName: string;
  description?: string;
  isActive: boolean;
}

export interface ClientReference {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  notes?: string;
  isActive: boolean;
}

export interface ServiceItem {
  id: number;
  itemName: string;
  isActive: boolean;
}

export interface ServiceUnit {
  id: number;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

export interface ServiceRate {
  id: number;
  serviceItemId: number;
  customerTypeId: number | null;
  unit?: string;
  regularRate: number;
  minimumCharge: number;
  effectiveFrom: string;
  itemName?: string;
  typeName?: string | null;
}

export function useServicesApi() {
  const customerTypes = ref<CustomerType[]>([]);
  const references = ref<ClientReference[]>([]);
  const serviceItems = ref<ServiceItem[]>([]);
  const serviceRates = ref<ServiceRate[]>([]);
  const serviceUnits = ref<ServiceUnit[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const onSettingsUpdated = (payload: any) => {
    const type = payload?.type;
    if (!type || type === "client-types") {
      if (customerTypes.value.length > 0) fetchCustomerTypes();
    }
    if (!type || type === "references") {
      if (references.value.length > 0) fetchReferences();
    }
    if (!type || type === "service-items") {
      if (serviceItems.value.length > 0) fetchServiceItems();
    }
    if (!type || type === "service-rates") {
      if (serviceRates.value.length > 0) fetchServiceRates();
    }
    if (!type || type === "service-units") {
      if (serviceUnits.value.length > 0) fetchServiceUnits();
    }
  };

  try {
    onMounted(() => {
      pulse.channel("auth").listen("global:settings-updated", onSettingsUpdated);
    });
    onUnmounted(() => {
      pulse.channel("auth").stopListening("global:settings-updated", onSettingsUpdated);
    });
  } catch {}

  // ── CUSTOMER TYPES ──────────────────────
  const fetchCustomerTypes = async () => {
    try {
      const res = await axios.get("/api/services/customer-types");
      customerTypes.value = res.data.data || [];
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
    }
  };

  const createCustomerType = async (typeName: string, description?: string) => {
    const res = await axios.post("/api/services/customer-types", { typeName, description });
    await fetchCustomerTypes();
    return res.data;
  };

  // ── REFERENCES ──────────────────────────
  const fetchReferences = async () => {
    try {
      const res = await axios.get("/api/services/references");
      references.value = res.data.data || [];
      return references.value;
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
      return [];
    }
  };

  const createReference = async (payload: Partial<ClientReference>) => {
    const res = await axios.post("/api/services/references", payload);
    await fetchReferences();
    return res.data;
  };

  const updateReference = async (id: number, payload: Partial<ClientReference>) => {
    const res = await axios.patch(`/api/services/references/${id}`, payload);
    await fetchReferences();
    return res.data;
  };

  const toggleReference = async (id: number) => {
    const res = await axios.patch(`/api/services/references/${id}/toggle`);
    await fetchReferences();
    return res.data;
  };

  const deleteReference = async (id: number) => {
    const res = await axios.delete(`/api/services/references/${id}`);
    await fetchReferences();
    return res.data;
  };

  // ── SERVICE ITEMS ───────────────────────
  const fetchServiceItems = async () => {
    loading.value = true;
    try {
      const res = await axios.get("/api/services/items");
      serviceItems.value = res.data.data || [];
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
    } finally {
      loading.value = false;
    }
  };

  const createServiceItem = async (itemName: string) => {
    const res = await axios.post("/api/services/items", { itemName });
    await fetchServiceItems();
    return res.data;
  };

  const toggleServiceItem = async (id: number) => {
    const res = await axios.patch(`/api/services/items/${id}/toggle`);
    await fetchServiceItems();
    return res.data;
  };

  const updateServiceItem = async (id: number, itemName: string) => {
    const res = await axios.patch(`/api/services/items/${id}`, { itemName });
    await fetchServiceItems();
    return res.data;
  };

  const deleteServiceItem = async (id: number) => {
    const res = await axios.delete(`/api/services/items/${id}`);
    await fetchServiceItems();
    return res.data;
  };

  // ── SERVICE RATES ───────────────────────
  const fetchServiceRates = async () => {
    loading.value = true;
    try {
      const res = await axios.get("/api/services/rates");
      serviceRates.value = (res.data.data || []).map((r: any) => ({
        ...r,
        itemName: r.serviceItem?.itemName || "General",
        typeName: r.customerType?.typeName || "All Customer Types"
      }));
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
    } finally {
      loading.value = false;
    }
  };

  const createServiceRate = async (payload: {
    serviceItemId: number;
    customerTypeId?: number | null;
    unit?: string;
    regularRate: number;
    minimumCharge: number;
    effectiveFrom: string;
  }) => {
    const res = await axios.post("/api/services/rates", payload);
    await fetchServiceRates();
    return res.data;
  };

  const updateServiceRate = async (id: number, payload: Partial<ServiceRate>) => {
    const res = await axios.patch(`/api/services/rates/${id}`, payload);
    await fetchServiceRates();
    return res.data;
  };

  const deleteServiceRate = async (id: number) => {
    const res = await axios.delete(`/api/services/rates/${id}`);
    await fetchServiceRates();
    return res.data;
  };

  const fetchServiceUnits = async () => {
    try {
      const res = await axios.get("/api/superadmin/service-units");
      if (res.data?.success && Array.isArray(res.data.data)) {
        serviceUnits.value = res.data.data;
      }
    } catch (err: any) {
      console.error("Failed to load service units:", err);
    }
  };

  return {
    customerTypes,
    references,
    serviceItems,
    serviceRates,
    serviceUnits,
    loading,
    error,
    fetchCustomerTypes,
    createCustomerType,
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
  };
}
