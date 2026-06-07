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

  async getHealth(): Promise<boolean> {
    try {
      const response = await apiClient.get<{ status: string }>("/health");
      return response.data.status === "ok";
    } catch (error: unknown) {
      throw toApiError(error);
    }
  },
};
