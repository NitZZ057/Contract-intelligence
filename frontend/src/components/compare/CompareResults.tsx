import { ChevronDown, FileText, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { RiskBadge } from "@/components/common/RiskBadge";
import type { CompareResponse, ModifiedClause, RiskLevel } from "@/types/contracts";
import { cn } from "@/utils/cn";

interface CompareResultsProps {
  result: CompareResponse;
}

const bannerClasses: Record<RiskLevel, string> = {
  low: "border-green-200 bg-green-50 text-green-900",
  medium: "border-amber-200 bg-amber-50 text-amber-900",
  high: "border-red-200 bg-red-50 text-red-900",
};

function ClauseList({ title, clauses, tone }: { title: string; clauses: string[]; tone: "green" | "red" }) {
  const borderClass = tone === "green" ? "border-l-green-500" : "border-l-red-500";

  return (
    <section className={cn("rounded-lg border border-slate-200 border-l-4 bg-white p-5 shadow-sm", borderClass)}>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{clauses.length}</span>
      </div>
      {clauses.length > 0 ? (
        <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-2">
          {clauses.map((clause, index) => (
            <li key={`${title}-${index}`} className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              {clause}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No clauses in this category.</p>
      )}
    </section>
  );
}

function ModifiedClauseCard({ clause, index }: { clause: ModifiedClause; index: number }) {
  const [isOpen, setIsOpen] = useState(index === 0);

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="focus-ring flex w-full items-center justify-between gap-4 bg-white px-6 py-5 text-left hover:bg-slate-50"
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="hidden h-11 w-11 flex-none items-center justify-center rounded-lg bg-amber-50 text-amber-600 sm:flex">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-slate-900">{clause.clause_type}</p>
            <p className="mt-1 text-sm text-slate-500">AI-reviewed modification #{index + 1}</p>
          </div>
        </div>
        <div className="flex flex-none items-center gap-3">
          <RiskBadge riskLevel={clause.risk_level} />
          <ChevronDown className={cn("h-4 w-4 text-slate-500 transition", isOpen && "rotate-180")} aria-hidden="true" />
        </div>
      </button>
      {isOpen ? (
        <div className="border-t border-slate-200 bg-slate-50/70 p-5 sm:p-6">
          <div className="grid gap-5 2xl:grid-cols-2">
            <section className="min-w-0 overflow-hidden rounded-lg border border-red-200 bg-white shadow-sm">
              <div className="sticky top-0 border-b border-red-100 bg-red-50 px-5 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-red-700">Original clause</p>
              </div>
              <div className="max-h-[460px] overflow-y-auto p-5">
                <p className="whitespace-pre-wrap break-words text-sm leading-7 text-red-950 line-through decoration-red-400 decoration-2">
                  {clause.original}
                </p>
              </div>
            </section>

            <section className="min-w-0 overflow-hidden rounded-lg border border-green-200 bg-white shadow-sm">
              <div className="sticky top-0 border-b border-green-100 bg-green-50 px-5 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-green-700">Updated clause</p>
              </div>
              <div className="max-h-[460px] overflow-y-auto p-5">
                <p className="whitespace-pre-wrap break-words text-sm leading-7 text-green-950">
                  {clause.updated}
                </p>
              </div>
            </section>
          </div>

          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-700">AI explanation</p>
                <p className="mt-2 text-sm leading-6 text-amber-950">{clause.explanation}</p>
              </div>
              <RiskBadge riskLevel={clause.risk_level} />
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function CompareResults({ result }: CompareResultsProps) {
  return (
    <div className="space-y-6">
      <div className={cn("rounded-lg border p-5 shadow-sm", bannerClasses[result.overall_risk_level])}>
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-white/70">
            <ShieldAlert className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-bold">Overall change risk</h2>
              <RiskBadge riskLevel={result.overall_risk_level} />
            </div>
            <p className="mt-2 text-sm leading-6">{result.risk_summary}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ClauseList title="Added Clauses" clauses={result.added_clauses} tone="green" />
        <ClauseList title="Removed Clauses" clauses={result.removed_clauses} tone="red" />
      </div>

      <section className="rounded-lg border border-slate-200 border-l-4 border-l-amber-500 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Modified Clauses</h2>
            <p className="mt-1 text-sm text-slate-500">Full-width clause review with side-by-side original and updated text.</p>
          </div>
          <span className="w-fit rounded-md bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-700">
            {result.modified_clauses.length} modifications
          </span>
        </div>

        <div className="mt-5 space-y-5">
          {result.modified_clauses.length > 0 ? (
            result.modified_clauses.map((clause, index) => (
              <ModifiedClauseCard key={`${clause.clause_type}-${index}`} clause={clause} index={index} />
            ))
          ) : (
            <p className="rounded-lg bg-slate-50 p-5 text-sm text-slate-500">No modified clauses detected.</p>
          )}
        </div>
      </section>
    </div>
  );
}
