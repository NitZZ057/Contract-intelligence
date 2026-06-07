import { GitCompare, Loader2 } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { CompareResults } from "@/components/compare/CompareResults";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { useCompareContracts, useContracts } from "@/hooks/useContracts";
import { useContractStore } from "@/store/useContractStore";

export function ContractCompare() {
  const [searchParams] = useSearchParams();
  const contractsQuery = useContracts({ skip: 0, limit: 100 });
  const compareMutation = useCompareContracts();
  const { compareSourceId, compareTargetId, setCompareSourceId, setCompareTargetId } = useContractStore();

  const processedContracts = useMemo(
    () => (contractsQuery.data?.items ?? []).filter((contract) => contract.status === "processed"),
    [contractsQuery.data?.items],
  );

  useEffect(() => {
    const sourceFromUrl = searchParams.get("source");
    if (sourceFromUrl) {
      setCompareSourceId(sourceFromUrl);
    }
  }, [searchParams, setCompareSourceId]);

  const canAnalyze = Boolean(compareSourceId && compareTargetId && compareSourceId !== compareTargetId);

  const handleAnalyze = async () => {
    if (!compareSourceId || !compareTargetId) {
      return;
    }
    await compareMutation.mutateAsync({ sourceContractId: compareSourceId, targetContractId: compareTargetId });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Change detection</p>
        <h2 className="mt-1 text-2xl font-bold text-slate-900">Analyze contract changes and risk</h2>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        {contractsQuery.isLoading ? (
          <LoadingSpinner label="Loading processed contracts" />
        ) : contractsQuery.isError ? (
          <ErrorMessage error={contractsQuery.error} title="Unable to load contracts" />
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Contract A</span>
              <select
                value={compareSourceId ?? ""}
                onChange={(event) => setCompareSourceId(event.target.value || null)}
                className="focus-ring mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm"
              >
                <option value="">Select source contract</option>
                {processedContracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.original_filename}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Contract B</span>
              <select
                value={compareTargetId ?? ""}
                onChange={(event) => setCompareTargetId(event.target.value || null)}
                className="focus-ring mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm"
              >
                <option value="">Select target contract</option>
                {processedContracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.original_filename}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void handleAnalyze()}
              disabled={!canAnalyze || compareMutation.isPending}
              className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {compareMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <GitCompare className="h-4 w-4" aria-hidden="true" />}
              Analyze Changes
            </button>
          </div>
        )}
      </div>

      {processedContracts.length < 2 && !contractsQuery.isLoading ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          At least two processed contracts are required for comparison.
        </div>
      ) : null}

      {compareMutation.isPending ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-8 text-center shadow-sm">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-bold text-blue-950">Analyzing contracts...</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-blue-800">
            The platform is reviewing added, removed, and modified clauses and assessing risk impact.
          </p>
        </div>
      ) : null}

      {compareMutation.isError ? <ErrorMessage error={compareMutation.error} title="Change analysis failed" /> : null}

      {compareMutation.data ? <CompareResults result={compareMutation.data} /> : null}
    </div>
  );
}
