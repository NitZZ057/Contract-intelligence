import { ArrowRight, CheckCircle2, FileText, GitCompare, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { FileUploadZone } from "@/components/common/FileUploadZone";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useContract, useUploadContract } from "@/hooks/useContracts";
import { formatDate } from "@/utils/format";

export function ContractUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedContractId, setUploadedContractId] = useState<string | undefined>();
  const uploadMutation = useUploadContract();
  const contractQuery = useContract(uploadedContractId);
  const contract = contractQuery.data;

  useEffect(() => {
    if (contract?.status === "processed") {
      toast.success("Contract processing complete");
    }
    if (contract?.status === "failed") {
      toast.error(contract.error_message ?? "Contract processing failed");
    }
  }, [contract?.error_message, contract?.status]);

  const handleUpload = async () => {
    if (!selectedFile) {
      return;
    }

    const response = await uploadMutation.mutateAsync(selectedFile);
    setUploadedContractId(response.id);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">PDF ingestion</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Upload a contract for AI processing</h2>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <FileUploadZone
          selectedFile={selectedFile}
          onFileSelect={setSelectedFile}
          disabled={uploadMutation.isPending}
        />

        {uploadMutation.progress ? (
          <div className="mt-5">
            <div className="flex justify-between text-sm font-medium text-slate-600">
              <span>Upload progress</span>
              <span>{uploadMutation.progress.percent}%</span>
            </div>
            <progress
              className="mt-2 h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:bg-blue-500"
              value={uploadMutation.progress.percent}
              max={100}
              aria-label="Upload progress"
            />
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={!selectedFile || uploadMutation.isPending}
          className="focus-ring mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-500 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {uploadMutation.isPending ? "Uploading..." : "Upload and process"}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {uploadMutation.isError ? <ErrorMessage error={uploadMutation.error} title="Upload failed" /> : null}

      {uploadedContractId ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          {contractQuery.isLoading ? (
            <LoadingSpinner label="Waiting for processing status" />
          ) : contractQuery.isError ? (
            <ErrorMessage error={contractQuery.error} title="Unable to fetch uploaded contract" />
          ) : contract ? (
            <div className="space-y-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                    <FileText className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{contract.original_filename}</h3>
                    <p className="mt-1 text-sm text-slate-500">Uploaded {formatDate(contract.created_at)}</p>
                  </div>
                </div>
                <StatusBadge status={contract.status} />
              </div>

              {contract.status === "processed" ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-center gap-3 text-green-800">
                    <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                    <p className="font-semibold">Processing complete</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link to={`/contracts/${contract.id}`} className="focus-ring rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600">
                      View Detail
                    </Link>
                    <Link to={`/compare?source=${contract.id}`} className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      <GitCompare className="h-4 w-4" aria-hidden="true" />
                      Compare
                    </Link>
                    <Link to={`/qa?contract=${contract.id}`} className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      <MessageSquare className="h-4 w-4" aria-hidden="true" />
                      Ask a Question
                    </Link>
                  </div>
                </div>
              ) : null}

              {contract.status === "failed" ? <ErrorMessage error={{ message: contract.error_message ?? "Processing failed", code: "processing_failed" }} title="Processing failed" /> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
