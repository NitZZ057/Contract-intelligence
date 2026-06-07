import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  skip: number;
  limit: number;
  total: number;
  onChange: (nextSkip: number) => void;
}

export function Pagination({ skip, limit, total, onChange }: PaginationProps) {
  const currentPage = Math.floor(skip / limit) + 1;
  const totalPages = Math.max(Math.ceil(total / limit), 1);
  const canGoBack = skip > 0;
  const canGoForward = skip + limit < total;

  return (
    <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
      <p className="text-sm text-slate-500">
        Page <span className="font-semibold text-slate-900">{currentPage}</span> of{" "}
        <span className="font-semibold text-slate-900">{totalPages}</span>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(Math.max(skip - limit, 0))}
          disabled={!canGoBack}
          className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Previous
        </button>
        <button
          type="button"
          onClick={() => onChange(skip + limit)}
          disabled={!canGoForward}
          className="focus-ring inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
