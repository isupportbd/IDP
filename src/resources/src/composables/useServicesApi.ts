import { ref, onMounted, onUnmounted, computed } from "vue";
import axios from "axios";
import { pulse } from "@/plugins/pulse";
import {
  useMasterDataStore,
  type CustomerType,
  type ClientReference,
  type ServiceItem,
  type ServiceUnit,
  type ServiceRate
} from "@/stores/masterData";

export type { CustomerType, ClientReference, ServiceItem, ServiceUnit, ServiceRate };

export function useServicesApi() {
  const masterStore = useMasterDataStore();

  const customerTypes = computed(() => masterStore.customerTypes);
  const references = computed(() => masterStore.references);
  const serviceItems = computed(() => masterStore.serviceItems);
  const serviceRates = computed(() => masterStore.serviceRates);
  const serviceUnits = computed(() => masterStore.serviceUnits);

  const loading = ref(false);
  const error = ref<string | null>(null);

  const onSettingsUpdated = (payload: any) => {
    const type = payload?.type;
    masterStore.invalidate(type);
    if (!type || type === "client-types") masterStore.fetchCustomerTypes(true);
    if (!type || type === "references") masterStore.fetchReferences(true);
    if (!type || type === "service-items") masterStore.fetchServiceItems(true);
    if (!type || type === "service-rates") masterStore.fetchServiceRates(true);
    if (!type || type === "service-units") masterStore.fetchServiceUnits(true);
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
  const fetchCustomerTypes = async (force = false) => {
    return masterStore.fetchCustomerTypes(force);
  };

  const createCustomerType = async (typeName: string, description?: string) => {
    const res = await axios.post("/api/services/customer-types", { typeName, description });
    await masterStore.fetchCustomerTypes(true);
    return res.data;
  };

  // ── REFERENCES ──────────────────────────
  const fetchReferences = async (force = false) => {
    return masterStore.fetchReferences(force);
  };

  const createReference = async (payload: Partial<ClientReference>) => {
    const res = await axios.post("/api/services/references", payload);
    await masterStore.fetchReferences(true);
    return res.data;
  };

  const updateReference = async (id: number, payload: Partial<ClientReference>) => {
    const res = await axios.patch(`/api/services/references/${id}`, payload);
    await masterStore.fetchReferences(true);
    return res.data;
  };

  const toggleReference = async (id: number) => {
    const res = await axios.patch(`/api/services/references/${id}/toggle`);
    await masterStore.fetchReferences(true);
    return res.data;
  };

  const deleteReference = async (id: number) => {
    const res = await axios.delete(`/api/services/references/${id}`);
    await masterStore.fetchReferences(true);
    return res.data;
  };

  // ── SERVICE ITEMS ───────────────────────
  const fetchServiceItems = async (force = false) => {
    loading.value = true;
    try {
      return await masterStore.fetchServiceItems(force);
    } catch (err: any) {
      error.value = err.response?.data?.message || err.message;
    } finally {
      loading.value = false;
    }
  };

  const createServiceItem = async (itemName: string) => {
    const res = await axios.post("/api/services/items", { itemName });
    await masterStore.fetchServiceItems(true);
    return res.data;
  };

  const toggleServiceItem = async (id: number) => {
    const res = await axios.patch(`/api/services/items/${id}/toggle`);
    await masterStore.fetchServiceItems(true);
    return res.data;
  };

  const updateServiceItem = async (id: number, itemName: string) => {
    const res = await axios.patch(`/api/services/items/${id}`, { itemName });
    await masterStore.fetchServiceItems(true);
    return res.data;
  };

  const deleteServiceItem = async (id: number) => {
    const res = await axios.delete(`/api/services/items/${id}`);
    await masterStore.fetchServiceItems(true);
    return res.data;
  };

  // ── SERVICE RATES ───────────────────────
  const fetchServiceRates = async (force = false) => {
    loading.value = true;
    try {
      return await masterStore.fetchServiceRates(force);
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
    await masterStore.fetchServiceRates(true);
    return res.data;
  };

  const updateServiceRate = async (id: number, payload: Partial<ServiceRate>) => {
    const res = await axios.patch(`/api/services/rates/${id}`, payload);
    await masterStore.fetchServiceRates(true);
    return res.data;
  };

  const deleteServiceRate = async (id: number) => {
    const res = await axios.delete(`/api/services/rates/${id}`);
    await masterStore.fetchServiceRates(true);
    return res.data;
  };

  const fetchServiceUnits = async (force = false) => {
    return masterStore.fetchServiceUnits(force);
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
