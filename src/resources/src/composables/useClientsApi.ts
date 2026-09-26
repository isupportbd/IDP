import { ref } from "vue";
import axios from "axios";

export interface ClientItem {
  id: number;
  companyName: string;
  proprietorName?: string;
  mobile?: string;
  alternativeMobile?: string;
  email?: string;
  address?: string;
  binNumber?: string;
  tinNumber?: string;
  tradeLicenseNo?: string;
  customerTypeId?: number;
  customerTypeName?: string;
  referenceId?: number;
  referenceName?: string;
  vatUserId?: string;
  vatPassword?: string;
  vatServiceType?: "FULL" | "ONLY_RETURN";
  isActive: boolean;
  notes?: string;
  managers?: Array<{ id: number; name: string; email: string }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientManagerAssignment {
  id: number;
  companyName: string;
  binNumber?: string;
  mobile?: string;
  customerTypeId?: number;
  customerTypeName?: string;
  referenceId?: number;
  referenceName?: string;
  isActive: boolean;
  managerIds: number[];
  managers: Array<{ id: number; name: string; email: string }>;
}

export interface AssignableUser {
  id: number;
  name: string;
  email: string;
}

export function useClientsApi() {
  const clients = ref<ClientItem[]>([]);
  const assignments = ref<ClientManagerAssignment[]>([]);
  const assignableUsers = ref<AssignableUser[]>([]);
  const totalCount = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchClients = async (params: {
    search?: string;
    customerTypeId?: number;
    referenceId?: number;
    isActive?: string;
    page?: number;
    limit?: number;
  } = {}) => {
    loading.value = true;
    error.value = null;
    try {
      const res = await axios.get("/api/clients", { params });
      clients.value = res.data?.data || [];
      totalCount.value = res.data?.pagination?.total || clients.value.length;
      return res.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || "Failed to fetch clients";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const fetchClient = async (id: number) => {
    loading.value = true;
    error.value = null;
    try {
      const res = await axios.get(`/api/clients/${id}`);
      return res.data?.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || "Failed to fetch client details";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const createClient = async (payload: Partial<ClientItem> & { managerIds?: number[] }) => {
    loading.value = true;
    error.value = null;
    try {
      const res = await axios.post("/api/clients", payload);
      await fetchClients();
      return res.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || "Failed to create client";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const updateClient = async (id: number, payload: Partial<ClientItem> & { managerIds?: number[] }) => {
    loading.value = true;
    error.value = null;
    try {
      const res = await axios.patch(`/api/clients/${id}`, payload);
      await fetchClients();
      return res.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || "Failed to update client";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const toggleClient = async (id: number, isActive: boolean) => {
    loading.value = true;
    error.value = null;
    try {
      const res = await axios.patch(`/api/clients/${id}/toggle`, { isActive });
      const found = clients.value.find((c) => c.id === id);
      if (found) found.isActive = isActive;
      return res.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || "Failed to toggle client status";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteClient = async (id: number) => {
    loading.value = true;
    error.value = null;
    try {
      const res = await axios.delete(`/api/clients/${id}`);
      clients.value = clients.value.filter((c) => c.id !== id);
      return res.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || "Failed to delete client";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const checkBinUnique = async (bin: string, excludeId?: number) => {
    try {
      const res = await axios.post("/api/clients/check-bin", { bin, excludeId });
      return res.data as { unique: boolean; existingClient: any };
    } catch {
      return { unique: true, existingClient: null };
    }
  };

  const checkMobileExists = async (mobile: string, excludeId?: number) => {
    try {
      const res = await axios.post("/api/clients/check-mobile", { mobile, excludeId });
      return res.data?.matches || [];
    } catch {
      return [];
    }
  };

  const fetchAssignments = async (params: { search?: string; filter?: "all" | "assigned" | "shared" | "unassigned" } = {}) => {
    loading.value = true;
    error.value = null;
    try {
      const res = await axios.get("/api/clients/assignments", { params });
      assignments.value = res.data?.data || [];
      return assignments.value;
    } catch (err: any) {
      error.value = err.response?.data?.message || "Failed to fetch assignments";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const saveAssignments = async (clientId: number, managerIds: number[]) => {
    loading.value = true;
    error.value = null;
    try {
      const res = await axios.post("/api/clients/assignments", { clientId, managerIds });
      return res.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || "Failed to save assignments";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const fetchAssignableUsers = async () => {
    try {
      const res = await axios.get("/api/clients/users");
      assignableUsers.value = res.data?.data || [];
      return assignableUsers.value;
    } catch (err: any) {
      console.error("Failed to fetch assignable users", err);
      return [];
    }
  };

  return {
    clients,
    assignments,
    assignableUsers,
    totalCount,
    loading,
    error,
    fetchClients,
    fetchClient,
    createClient,
    updateClient,
    toggleClient,
    deleteClient,
    checkBinUnique,
    checkMobileExists,
    fetchAssignments,
    saveAssignments,
    fetchAssignableUsers
  };
}
