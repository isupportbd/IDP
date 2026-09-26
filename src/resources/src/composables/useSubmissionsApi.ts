import { ref } from "vue";
import axios from "axios";

export interface SubmissionItem {
  id: number; // Client ID
  submissionRecordId: number | null; // vat_submissions.id
  companyName: string;
  binNumber?: string;
  mobile?: string;
  customerTypeId?: number;
  customerTypeName?: string;
  referenceId?: number;
  referenceName?: string;
  taxPeriod: string;
  submissionId: string | null;
  status: "submitted" | "pending" | "late_submitted";
  submittedById?: number | null;
  submittedByName?: string | null;
  submittedAt?: string | null;
  remarks?: string | null;
  managers: Array<{ id: number; name: string }>;
}

export interface SubmissionsStats {
  totalActive: number;
  submittedCount: number;
  pendingCount: number;
  lateSubmittedCount: number;
}

export function useSubmissionsApi() {
  const submissions = ref<SubmissionItem[]>([]);
  const stats = ref<SubmissionsStats>({
    totalActive: 0,
    submittedCount: 0,
    pendingCount: 0,
    lateSubmittedCount: 0
  });
  const loading = ref(false);
  const error = ref<string | null>(null);

  const fetchSubmissions = async (params: {
    month?: string;
    taxPeriod?: string;
    customerTypeId?: number | string;
    referenceId?: number | string;
    managerId?: number | string;
    status?: string;
    search?: string;
  } = {}) => {
    loading.value = true;
    error.value = null;
    try {
      const cleanParams: Record<string, any> = {};
      if (params.month) cleanParams.month = params.month;
      if (params.taxPeriod) cleanParams.taxPeriod = params.taxPeriod;
      if (params.customerTypeId && params.customerTypeId !== "all") cleanParams.customerTypeId = params.customerTypeId;
      if (params.referenceId && params.referenceId !== "all") cleanParams.referenceId = params.referenceId;
      if (params.managerId && params.managerId !== "all") cleanParams.managerId = params.managerId;
      if (params.status && params.status !== "all") cleanParams.status = params.status;
      if (params.search && params.search.trim()) cleanParams.search = params.search.trim();

      const res = await axios.get("/api/submissions", { params: cleanParams });
      submissions.value = res.data?.data || [];
      if (res.data?.stats) {
        stats.value = res.data.stats;
      }
      return res.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || "Failed to fetch submissions";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const recordSubmission = async (payload: {
    clientId: number;
    taxPeriod: string;
    submissionId: string;
    submittedAt?: string;
    remarks?: string;
  }) => {
    loading.value = true;
    error.value = null;
    try {
      const res = await axios.post("/api/submissions", payload);
      return res.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || "Failed to record submission";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const deleteSubmission = async (id: number) => {
    loading.value = true;
    error.value = null;
    try {
      const res = await axios.delete(`/api/submissions/${id}`);
      return res.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || "Failed to delete submission";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const batchDeleteSubmissions = async (ids: number[]) => {
    loading.value = true;
    error.value = null;
    try {
      const res = await axios.post("/api/submissions/batch-delete", { ids });
      return res.data;
    } catch (err: any) {
      error.value = err.response?.data?.message || "Failed to batch delete submissions";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  return {
    submissions,
    stats,
    loading,
    error,
    fetchSubmissions,
    recordSubmission,
    deleteSubmission,
    batchDeleteSubmissions
  };
}
