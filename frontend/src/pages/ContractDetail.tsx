import {
  AlertTriangle,
  CalendarDays,
  Clipboard,
  FileQuestion,
  FileText,
  GitCompare,
  type LucideIcon,
  Loader2,
  ReceiptText,
  ScrollText,
  Sparkles,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { StatusBadge } from "@/components/common/StatusBadge";
import { useContract, useSummarizeContract } from "@/hooks/useContracts";
import { formatBytes, formatDate } from "@/utils/format";
import type { ContractSummaryResponse } from "@/types/contracts";

function displayValue(value: string | null | undefined): string {
  return value?.trim() ? value : "Not specified";
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-2 break-words text-sm font-bold text-slate-900">{value}</dd>
    </div>
  );
}

function SummaryList({ items, emptyText }: { items: string[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-500">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
          {item}
        </li>
      ))}
    </ul>
  );
}

function SummaryPanel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function ContractSummary({ summary }: { summary: ContractSummaryResponse }) {
  const parties = [
    { label: "Service provider", value: displayValue(summary.parties.service_provider) },
    { label: "Client", value: displayValue(summary.parties.client) },
    {
      label: "Other parties",
      value: summary.parties.other_parties.length > 0 ? summary.parties.other_parties.join(", ") : "Not specified",
    },
  ];

  const keyDates = [
    { label: "Effective date", value: displayValue(summary.key_dates.effective_date) },
    { label: "Expiry date", value: displayValue(summary.key_dates.expiry_date) },
    { label: "Renewal date", value: displayValue(summary.key_dates.renewal_date) },
    { label: "Notice deadline", value: displayValue(summary.key_dates.termination_notice_deadline) },
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
            <Sparkles className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <span>AI summary</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Executive Summary</h2>
        </div>
        <span className="w-fit rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
          Generated {formatDate(summary.generated_at)}
        </span>
      </div>

      <p className="mt-4 text-sm leading-7 text-slate-700">{summary.executive_summary}</p>

      <dl className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric label="Contract type" value={displayValue(summary.contract_type)} />
        <SummaryMetric label="Governing law" value={displayValue(summary.governing_law)} />
        <SummaryMetric label="Confidence" value={`${Math.round(summary.confidence * 100)}%`} />
        <SummaryMetric label="Model" value={summary.model_used} />
      </dl>

      <div className="mt-6 grid gap-5 xl:grid-cols-2">
        <SummaryPanel title="Parties" icon={Users}>
          <dl className="grid gap-3">
            {parties.map((party) => (
              <div key={party.label} className="rounded-md bg-slate-50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{party.label}</dt>
                <dd className="mt-1 break-words text-sm font-semibold text-slate-900">{party.value}</dd>
              </div>
            ))}
          </dl>
        </SummaryPanel>

        <SummaryPanel title="Key Dates" icon={CalendarDays}>
          <dl className="grid gap-3 sm:grid-cols-2">
            {keyDates.map((date) => (
              <div key={date.label} className="rounded-md bg-slate-50 p-3">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{date.label}</dt>
                <dd className="mt-1 break-words text-sm font-semibold text-slate-900">{date.value}</dd>
              </div>
            ))}
          </dl>
        </SummaryPanel>

        <SummaryPanel title="Commercial Terms" icon={ReceiptText}>
          <div className="space-y-3">
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment terms</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{displayValue(summary.payment_terms)}</p>
            </div>
            <div className="rounded-md bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Termination</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">{displayValue(summary.termination_conditions)}</p>
            </div>
          </div>
        </SummaryPanel>

        <SummaryPanel title="Obligations" icon={FileText}>
          <SummaryList items={summary.key_obligations} emptyText="No key obligations were identified." />
        </SummaryPanel>
      </div>

      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-5">
        <div className="mb-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
          <h3 className="text-base font-bold text-amber-950">Risk Flags</h3>
        </div>
        <SummaryList items={summary.risk_flags} emptyText="No notable risk flags were identified." />
      </div>
    </section>
  );
}

export function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const contractQuery = useContract(id);
  const contract = contractQuery.data;
  const summaryMutation = useSummarizeContract();
  const summary = summaryMutation.data;

  const handleCopy = async () => {
    if (!contract?.extracted_text) {
      return;
    }
    await navigator.clipboard.writeText(contract.extracted_text);
    toast.success("Extracted text copied");
  };

  const handleGenerateSummary = async () => {
    if (!contract?.id) {
      return;
    }

    await summaryMutation.mutateAsync({ contractId: contract.id });
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
          <button
            type="button"
            onClick={() => void handleGenerateSummary()}
            disabled={contract.status !== "processed" || summaryMutation.isPending}
            className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {summaryMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            )}
            {summaryMutation.isPending ? "Generating..." : summary ? "Regenerate Summary" : "Generate Summary"}
          </button>
        </div>
      </div>

      {contract.status === "failed" ? (
        <ErrorMessage error={{ message: contract.error_message ?? "Processing failed", code: "processing_failed" }} title="Contract processing failed" />
      ) : null}

      {summaryMutation.isError ? <ErrorMessage error={summaryMutation.error} title="Summary generation failed" /> : null}

      {summary ? <ContractSummary summary={summary} /> : null}

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
