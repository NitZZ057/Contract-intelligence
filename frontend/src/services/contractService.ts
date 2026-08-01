import type {
  ApiError,
  BackendCompareResponse,
  CompareRequest,
  CompareResponse,
  Contract,
  ContractListResponse,
  ContractUploadResponse,
  PaginationParams,
  QARequest,
  QAResponse,
  RiskLevel,
  UploadProgress,
  ContractSummaryResponse,
} from "@/types/contracts";
import { toApiError } from "@/utils/errors";
import { parseJsonFromStream, readStreamingText } from "@/utils/streaming";
import { apiClient, getApiBaseUrl } from "@/services/http";

function inferRiskLevel(similarity: number): RiskLevel {
  if (similarity < 0.55) {
    return "high";
  }
  if (similarity < 0.8) {
    return "medium";
  }
  return "low";
}

function normalizeBackendCompare(response: BackendCompareResponse): CompareResponse {
  const addedClauses = response.changes
    .filter((change) => change.change_type === "added" && change.target_text)
    .map((change) => change.target_text ?? "");

  const removedClauses = response.changes
    .filter((change) => change.change_type === "removed" && change.source_text)
    .map((change) => change.source_text ?? "");

  const modifiedClauses = response.changes
    .filter((change) => change.change_type === "modified")
    .map((change) => ({
      clause_type: "Contract clause",
      original: change.source_text ?? "",
      updated: change.target_text ?? "",
      risk_level: inferRiskLevel(change.similarity),
      explanation: `Detected a substantive wording change with ${(change.similarity * 100).toFixed(0)}% textual similarity.`,
    }));

  const highRiskCount = modifiedClauses.filter((clause) => clause.risk_level === "high").length;
  const mediumRiskCount = modifiedClauses.filter((clause) => clause.risk_level === "medium").length;
  const overallRiskLevel = highRiskCount > 0 ? "high" : mediumRiskCount > 0 ? "medium" : "low";

  return {
    added_clauses: addedClauses,
    removed_clauses: removedClauses,
    modified_clauses: modifiedClauses,
    risk_summary:
      response.total_changes === 0
        ? "No material textual changes were detected between the selected contracts."
        : `${response.total_changes} changes detected: ${response.added_count} added, ${response.removed_count} removed, and ${response.modified_count} modified.`,
    overall_risk_level: overallRiskLevel,
  };
}

function isBackendCompareResponse(value: unknown): value is BackendCompareResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "changes" in value &&
    Array.isArray(value.changes) &&
    "total_changes" in value
  );
}

async function fetchStreamedJson<TRequest, TResponse>(
  path: string,
  payload: TRequest,
  onChunk?: (chunk: string) => void,
): Promise<TResponse> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const apiError: ApiError = {
      message: errorText || `Request failed with status ${response.status}`,
      code: "stream_error",
      status: response.status,
    };
    throw apiError;
  }

  const streamedText = await readStreamingText(response, (chunk) => {
    onChunk?.(chunk);
  });
  return parseJsonFromStream<TResponse>(streamedText);
}

function isContractSummaryResponse(value: unknown): value is ContractSummaryResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const summary = value as Partial<ContractSummaryResponse>;
  const parties = summary.parties as Partial<ContractSummaryResponse["parties"]> | undefined;
  const keyDates = summary.key_dates as Partial<ContractSummaryResponse["key_dates"]> | undefined;

  return (
    typeof summary.contract_id === "string" &&
    typeof summary.filename === "string" &&
    typeof summary.executive_summary === "string" &&
    (typeof summary.contract_type === "string" || summary.contract_type === null) &&
    (typeof summary.governing_law === "string" || summary.governing_law === null) &&
    typeof parties === "object" &&
    parties !== null &&
    (typeof parties.service_provider === "string" || parties.service_provider === null) &&
    (typeof parties.client === "string" || parties.client === null) &&
    Array.isArray(parties.other_parties) &&
    parties.other_parties.every((party) => typeof party === "string") &&
    typeof keyDates === "object" &&
    keyDates !== null &&
    (typeof keyDates.effective_date === "string" || keyDates.effective_date === null) &&
    (typeof keyDates.expiry_date === "string" || keyDates.expiry_date === null) &&
    (typeof keyDates.renewal_date === "string" || keyDates.renewal_date === null) &&
    (typeof keyDates.termination_notice_deadline === "string" ||
      keyDates.termination_notice_deadline === null) &&
    (typeof summary.payment_terms === "string" || summary.payment_terms === null) &&
    (typeof summary.termination_conditions === "string" || summary.termination_conditions === null) &&
    Array.isArray(summary.key_obligations) &&
    summary.key_obligations.every((obligation) => typeof obligation === "string") &&
    Array.isArray(summary.risk_flags) &&
    summary.risk_flags.every((risk) => typeof risk === "string") &&
    typeof summary.confidence === "number" &&
    typeof summary.model_used === "string" &&
    typeof summary.generated_at === "string" &&
    (typeof summary.contract_page_count === "number" || summary.contract_page_count === null)
  );
}

export const contractService = {
  async uploadContract(
    file: File,
    onProgress?: (progress: UploadProgress) => void,
  ): Promise<ContractUploadResponse> {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await apiClient.post<ContractUploadResponse>("/api/v1/contracts/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (event) => {
          const total = event.total ?? file.size;
          const loaded = event.loaded;
          const percent = total > 0 ? Math.round((loaded / total) * 100) : 0;
          onProgress?.({ loaded, total, percent });
        },
      });

      return response.data;
    } catch (error: unknown) {
      throw toApiError(error);
    }
  },

  async getContract(id: string): Promise<Contract> {
    try {
      const response = await apiClient.get<Contract>(`/api/v1/contracts/${id}`);
      return response.data;
    } catch (error: unknown) {
      throw toApiError(error);
    }
  },

  async listContracts(params: PaginationParams): Promise<ContractListResponse> {
    try {
      const response = await apiClient.get<ContractListResponse>("/api/v1/contracts/", { params });
      return response.data;
    } catch (error: unknown) {
      throw toApiError(error);
    }
  },

  async compareContracts(
    sourceContractId: string,
    targetContractId: string,
    onChunk?: (chunk: string) => void,
  ): Promise<CompareResponse> {
    try {
      const payload: CompareRequest = {
        source_contract_id: sourceContractId,
        target_contract_id: targetContractId,
      };
      const response = await fetchStreamedJson<CompareRequest, CompareResponse | BackendCompareResponse>(
        "/api/v1/contracts/compare",
        payload,
        onChunk,
      );

      if (isBackendCompareResponse(response)) {
        return normalizeBackendCompare(response);
      }

      return response;
    } catch (error: unknown) {
      throw toApiError(error);
    }
  },

  async askQuestion(
    contractId: string,
    question: string,
    onChunk?: (chunk: string) => void,
  ): Promise<QAResponse> {
    try {
      const payload: QARequest = { question };
      return await fetchStreamedJson<QARequest, QAResponse>(
        `/api/v1/contracts/${contractId}/ask`,
        payload,
        onChunk,
      );
    } catch (error: unknown) {
      throw toApiError(error);
    }
  },

  async summarizeContract(contractId: string): Promise<ContractSummaryResponse>{
    try{

      if (!contractId.trim()){
        throw {
          message: "Contract ID is required to generate a summary",
          code: "missing_contract_id",
        };
      }

      const response = await apiClient.post<ContractSummaryResponse>(`/api/v1/contracts/${contractId}/summary`,);
      
      if(!isContractSummaryResponse(response.data)){
        throw {
          message: "Summary response was missing required fields",
          code: "invalid_summary_response",
          status: response.status,
        }
      }

      return response.data;
    }catch (error: unknown){
      throw toApiError(error);
    }
  },

  async getHealth(): Promise<boolean> {
    try {
      const response = await apiClient.get<{ status: string }>("/health");
      return response.data.status === "ok";
    } catch (error: unknown) {
      throw toApiError(error);
    }
  },
};
