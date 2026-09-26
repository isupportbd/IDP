import { ref } from "vue";
import axios from "axios";
import { useToast } from "./useToast";

export interface ActivityClientSubmission {
  submissionId: string;
  status: string;
  submittedAt?: string;
  submittedBy?: string;
  remarks?: string;
}

export interface ActivityClient {
  id: number;
  name: string;
  companyName: string;
  proprietorName?: string;
  bin?: string;
  binNumber?: string;
  tinNumber?: string;
  mobile?: string;
  username?: string;
  password?: string;
  clientTypeId?: number;
  clientType: string;
  referenceId?: number;
  reference: string;
  taxPeriod: string;
  purchaseAmount: number;
  isSubmitted: boolean;
  submission: ActivityClientSubmission | null;
}

export interface ActivityStats {
  totalClients: number;
  activeClients: number;
  activeFiledClients: number;
  activeUnfiledClients: number;
  inactiveClients: number;
  inactiveFiledClients: number;
  inactiveUnfiledClients: number;
  totalFiledClients: number;
  totalUnfiledClients: number;
  totalPurchaseSum: number;
}

export function useActivityFilterApi() {
  const toast = useToast();
  const loading = ref(false);
  const matrixData = ref<ActivityClient[]>([]);
  const stats = ref<ActivityStats>({
    totalClients: 0,
    activeClients: 0,
    activeFiledClients: 0,
    activeUnfiledClients: 0,
    inactiveClients: 0,
    inactiveFiledClients: 0,
    inactiveUnfiledClients: 0,
    totalFiledClients: 0,
    totalUnfiledClients: 0,
    totalPurchaseSum: 0
  });
  const clientTypes = ref<Array<{ id: number; name: string }>>([]);
  const references = ref<Array<{ id: number; name: string }>>([]);

  const loadActivityMatrix = async (month?: string) => {
    loading.value = true;
    try {
      const res = await axios.get("/api/activity-filter", {
        params: { month }
      });
      if (res.data && res.data.success) {
        matrixData.value = res.data.data || [];
        stats.value = res.data.stats || {
          totalClients: 0,
          activeClients: 0,
          activeFiledClients: 0,
          activeUnfiledClients: 0,
          inactiveClients: 0,
          inactiveFiledClients: 0,
          inactiveUnfiledClients: 0,
          totalFiledClients: 0,
          totalUnfiledClients: 0,
          totalPurchaseSum: 0
        };
        clientTypes.value = res.data.clientTypes || [];
        references.value = res.data.references || [];
      }
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to load activity matrix";
      toast.error(msg, 1000);
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const recordSubmission = async (payload: {
    clientId: number;
    taxPeriod: string;
    submissionId: string;
    remarks?: string;
  }) => {
    try {
      const res = await axios.post("/api/submissions", payload);
      toast.success("Submission ID recorded successfully", 1000);
      return res.data;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Failed to record submission";
      toast.error(msg, 1000);
      throw err;
    }
  };

  return {
    loading,
    matrixData,
    stats,
    clientTypes,
    references,
    loadActivityMatrix,
    recordSubmission
  };
}
