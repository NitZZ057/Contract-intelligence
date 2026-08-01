import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";
import { contractService } from "@/services/contractService";
import type {
  CompareResponse,
  Contract,
  ContractListResponse,
  ContractUploadResponse,
  PaginationParams,
  QAResponse,
  UploadProgress,
  ContractSummaryResponse,
} from "@/types/contracts";
import { toApiError } from "@/utils/errors";

export function useHealth() {
  return useQuery<boolean>({
    queryKey: ["health"],
    queryFn: () => contractService.getHealth(),
    refetchInterval: 30_000,
  });
}

export function useContracts(params: PaginationParams) {
  return useQuery<ContractListResponse>({
    queryKey: ["contracts", params.skip, params.limit],
    queryFn: () => contractService.listContracts(params),
    refetchInterval: (query) => {
      const hasActiveContracts = query.state.data?.items.some(
        (contract) => contract.status === "pending" || contract.status === "processing",
      );
      return hasActiveContracts ? 3_000 : false;
    },
  });
}

export function useContract(id: string | undefined) {
  return useQuery<Contract>({
    queryKey: ["contract", id],
    queryFn: () => contractService.getContract(id ?? ""),
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? 3_000 : false;
    },
  });
}

export function useUploadContract() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const mutation = useMutation<ContractUploadResponse, Error, File>({
    mutationFn: (file: File) =>
      contractService.uploadContract(file, (nextProgress) => {
        setProgress(nextProgress);
      }),
    onSuccess: async () => {
      toast.success("Contract uploaded and queued for processing");
      await queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
    onError: (error) => {
      const apiError = toApiError(error);
      toast.error(apiError.message);
    },
  });

  return {
    ...mutation,
    progress,
    resetProgress: () => setProgress(null),
  };
}

export function useCompareContracts() {
  const [streamedText, setStreamedText] = useState("");

  const mutation = useMutation<
    CompareResponse,
    Error,
    { sourceContractId: string; targetContractId: string }
  >({
    mutationFn: ({ sourceContractId, targetContractId }) => {
      setStreamedText("");
      return contractService.compareContracts(sourceContractId, targetContractId, (chunk) => {
        setStreamedText((current) => `${current}${chunk}`);
      });
    },
    onError: (error) => {
      const apiError = toApiError(error);
      toast.error(apiError.message);
    },
  });

  return {
    ...mutation,
    streamedText,
  };
}

export function useAskQuestion() {
  const [streamedText, setStreamedText] = useState("");

  const mutation = useMutation<QAResponse, Error, { contractId: string; question: string }>({
    mutationFn: ({ contractId, question }) => {
      setStreamedText("");
      return contractService.askQuestion(contractId, question, (chunk) => {
        setStreamedText((current) => `${current}${chunk}`);
      });
    },
    onError: (error) => {
      const apiError = toApiError(error);
      toast.error(apiError.message);
    },
  });

  return {
    ...mutation,
    streamedText,
  };
}

export function useSummarizeContract() {
  const mutation = useMutation<ContractSummaryResponse, Error, {contractId: string}>({
    mutationFn: ({contractId}) => contractService.summarizeContract(contractId),
    onError: (error) => {
      const apiError = toApiError(error);
      toast.error(apiError.message);
    },
  });

  return mutation;
}
