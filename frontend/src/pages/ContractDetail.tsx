import { Clipboard, FileQuestion, GitCompare, ScrollText } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useContract } from "@/hooks/useContracts";
import { formatBytes, formatDate } from "@/utils/format";

export function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const contractQuery = useContract(id);
  const contract = contractQuery.data;

  const handleCopy = async () => {
    if (!contract?.extracted_text) {
      return;
    }
    await navigator.clipboard.writeText(contract.extracted_text);
    toast.success("Extracted text copied");
  };

  if (contractQuery.isLoading) {
    return <LoadingSpinner label="Loading contract detail" />;
  }

  if (contractQuery.isError) {
    return <ErrorMessage error={contractQuery.error} title="Unable to load contract" />;
  }

  if (!contract) {
    return <ErrorMessage error={{ message: "Contract not found", code: "not_found" }} title="Missing contract" />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <p className="text-sm font-medium text-slate-500">Contract metadata</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900">{contract.original_filename}</h2>
          </div>
          <StatusBadge status={contract.status} />
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">File size</dt>
            <dd className="mt-2 text-sm font-bold text-slate-900">{formatBytes(contract.file_size)}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pages</dt>
            <dd className="mt-2 text-sm font-bold text-slate-900">{contract.page_count ?? "-"}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uploaded</dt>
            <dd className="mt-2 text-sm font-bold text-slate-900">{formatDate(contract.created_at)}</dd>
          </div>
          <div className="rounded-lg bg-slate-50 p-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Updated</dt>
            <dd className="mt-2 text-sm font-bold text-slate-900">{formatDate(contract.updated_at)}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={`/compare?source=${contract.id}`} className="focus-ring inline-flex items-center gap-2 rounded-md bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-600">
            <GitCompare className="h-4 w-4" aria-hidden="true" />
            Compare with another contract
          </Link>
          <Link to={`/qa?contract=${contract.id}`} className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <FileQuestion className="h-4 w-4" aria-hidden="true" />
            Ask a question
          </Link>
        </div>
      </div>

      {contract.status === "failed" ? (
        <ErrorMessage error={{ message: contract.error_message ?? "Processing failed", code: "processing_failed" }} title="Contract processing failed" />
      ) : null}

      {contract.status === "processed" ? (
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <ScrollText className="h-5 w-5 text-blue-500" aria-hidden="true" />
              <h2 className="text-lg font-bold text-slate-900">Extracted text</h2>
            </div>
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Clipboard className="h-4 w-4" aria-hidden="true" />
              Copy
            </button>
          </div>
          <div className="max-h-[620px] overflow-y-auto whitespace-pre-wrap px-6 py-5 text-sm leading-7 text-slate-700">
            {contract.extracted_text}
          </div>
        </section>
      ) : null}
    </div>
  );
}
