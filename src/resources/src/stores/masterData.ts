import { defineStore } from "pinia";
import { ref } from "vue";
import axios from "axios";

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

export interface MeasurementUnit {
  id: number;
  code: string;
  name: string;
  symbol?: string;
  description?: string;
  isActive: boolean;
}

export const useMasterDataStore = defineStore("masterData", () => {
  const customerTypes = ref<CustomerType[]>([]);
  const references = ref<ClientReference[]>([]);
  const serviceItems = ref<ServiceItem[]>([]);
  const serviceRates = ref<ServiceRate[]>([]);
  const serviceUnits = ref<ServiceUnit[]>([]);
  const measurementUnits = ref<MeasurementUnit[]>([]);

  const loadedCustomerTypes = ref(false);
  const loadedReferences = ref(false);
  const loadedServiceItems = ref(false);
  const loadedServiceRates = ref(false);
  const loadedServiceUnits = ref(false);
  const loadedMeasurementUnits = ref(false);

  const fetchCustomerTypes = async (force = false): Promise<CustomerType[]> => {
    if (loadedCustomerTypes.value && !force && customerTypes.value.length > 0) {
      return customerTypes.value;
    }
    try {
      const res = await axios.get("/api/services/customer-types");
      customerTypes.value = res.data.data || [];
      loadedCustomerTypes.value = true;
      return customerTypes.value;
    } catch (e) {
      console.error("Failed to fetch customer types:", e);
      return customerTypes.value;
    }
  };

  const fetchReferences = async (force = false): Promise<ClientReference[]> => {
    if (loadedReferences.value && !force && references.value.length > 0) {
      return references.value;
    }
    try {
      const res = await axios.get("/api/services/references");
      references.value = res.data.data || [];
      loadedReferences.value = true;
      return references.value;
    } catch (e) {
      console.error("Failed to fetch references:", e);
      return references.value;
    }
  };

  const fetchServiceItems = async (force = false): Promise<ServiceItem[]> => {
    if (loadedServiceItems.value && !force && serviceItems.value.length > 0) {
      return serviceItems.value;
    }
    try {
      const res = await axios.get("/api/services/items");
      serviceItems.value = res.data.data || [];
      loadedServiceItems.value = true;
      return serviceItems.value;
    } catch (e) {
      console.error("Failed to fetch service items:", e);
      return serviceItems.value;
    }
  };

  const fetchServiceRates = async (force = false): Promise<ServiceRate[]> => {
    if (loadedServiceRates.value && !force && serviceRates.value.length > 0) {
      return serviceRates.value;
    }
    try {
      const res = await axios.get("/api/services/rates");
      serviceRates.value = (res.data.data || []).map((r: any) => ({
        ...r,
        itemName: r.serviceItem?.itemName || "General",
        typeName: r.customerType?.typeName || "All Customer Types"
      }));
      loadedServiceRates.value = true;
      return serviceRates.value;
    } catch (e) {
      console.error("Failed to fetch service rates:", e);
      return serviceRates.value;
    }
  };

  const fetchServiceUnits = async (force = false): Promise<ServiceUnit[]> => {
    if (loadedServiceUnits.value && !force && serviceUnits.value.length > 0) {
      return serviceUnits.value;
    }
    try {
      const res = await axios.get("/api/superadmin/service-units");
      if (res.data?.success && Array.isArray(res.data.data)) {
        serviceUnits.value = res.data.data;
      }
      loadedServiceUnits.value = true;
      return serviceUnits.value;
    } catch (e) {
      console.error("Failed to load service units:", e);
      return serviceUnits.value;
    }
  };

  const fetchMeasurementUnits = async (force = false): Promise<MeasurementUnit[]> => {
    if (loadedMeasurementUnits.value && !force && measurementUnits.value.length > 0) {
      return measurementUnits.value;
    }
    try {
      const res = await axios.get("/api/superadmin/measurement-units");
      if (res.data?.success && Array.isArray(res.data.data)) {
        measurementUnits.value = res.data.data;
      }
      loadedMeasurementUnits.value = true;
      return measurementUnits.value;
    } catch (e) {
      console.error("Failed to load measurement units:", e);
      return measurementUnits.value;
    }
  };

  const invalidate = (type?: string) => {
    if (!type || type === "client-types") {
      loadedCustomerTypes.value = false;
      loadedServiceRates.value = false;
    }
    if (!type || type === "references") loadedReferences.value = false;
    if (!type || type === "service-items") {
      loadedServiceItems.value = false;
      loadedServiceRates.value = false;
    }
    if (!type || type === "service-rates") loadedServiceRates.value = false;
    if (!type || type === "service-units") loadedServiceUnits.value = false;
    if (!type || type === "measurement-units") loadedMeasurementUnits.value = false;
  };

  return {
    customerTypes,
    references,
    serviceItems,
    serviceRates,
    serviceUnits,
    measurementUnits,
    fetchCustomerTypes,
    fetchReferences,
    fetchServiceItems,
    fetchServiceRates,
    fetchServiceUnits,
    fetchMeasurementUnits,
    invalidate
  };
});
