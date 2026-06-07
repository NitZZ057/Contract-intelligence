import { FileText, RefreshCw, UploadCloud } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ContractsTable } from "@/components/contracts/ContractsTable";
import { useContracts } from "@/hooks/useContracts";
import type { ContractStatus } from "@/types/contracts";

function SummaryCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <div className="mt-3 flex items-end justify-between">
        <p className="text-3xl font-bold text-slate-900">{value}</p>
        <span className={`h-2 w-16 rounded-full ${accent}`} />
      </div>
    </div>
  );
}

export function Dashboard() {
  const contractsQuery = useContracts({ skip: 0, limit: 10 });
  const contracts = contractsQuery.data?.items ?? [];
  const total = contractsQuery.data?.total ?? 0;

  const countByStatus = (status: ContractStatus): number => contracts.filter((contract) => contract.status === status).length;

  if (contractsQuery.isLoading) {
    return <LoadingSpinner label="Loading contract workspace" />;
  }

  if (contractsQuery.isError) {
    return <ErrorMessage error={contractsQuery.error} title="Unable to load dashboard" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-medium text-slate-500">Operational overview</p>
          <h2 className="mt-1 text-2xl font-bold text-slate-900">Contract review command center</h2>
        </div>
        <Link
          to="/upload"
          className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-600"
        >
          <UploadCloud className="h-4 w-4" aria-hidden="true" />
          Upload contract
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total contracts" value={total} accent="bg-blue-500" />
        <SummaryCard label="Processed" value={countByStatus("processed")} accent="bg-green-500" />
        <SummaryCard label="Failed" value={countByStatus("failed")} accent="bg-red-500" />
        <SummaryCard
          label="In progress"
          value={countByStatus("pending") + countByStatus("processing")}
          accent="bg-amber-500"
        />
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Recent contracts</h2>
            <p className="text-sm text-slate-500">Auto-refreshes while ingestion is active.</p>
          </div>
          {contracts.some((contract) => contract.status === "pending" || contract.status === "processing") ? (
            <div className="hidden items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 sm:flex">
              <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
              Refreshing
            </div>
          ) : null}
        </div>

        {contracts.length > 0 ? (
          <ContractsTable contracts={contracts} />
        ) : (
          <EmptyState
            icon={FileText}
            title="No contracts uploaded"
            description="Upload the first PDF contract to start extraction, status tracking, comparison, and Q&A."
            ctaLabel="Upload contract"
            ctaHref="/upload"
          />
        )}
      </section>
    </div>
  );
}
