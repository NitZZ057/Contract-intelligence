import { Eye, FileQuestion, GitCompare } from "lucide-react";
import { Link } from "react-router-dom";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { Contract } from "@/types/contracts";
import { formatBytes, formatDate } from "@/utils/format";

interface ContractsTableProps {
  contracts: Contract[];
  compact?: boolean;
}

export function ContractsTable({ contracts, compact = false }: ContractsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">File</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Pages</th>
              {!compact ? (
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Size</th>
              ) : null}
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Uploaded</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {contracts.map((contract) => (
              <tr key={contract.id} className="hover:bg-slate-50">
                <td className="max-w-xs px-4 py-4">
                  <p className="truncate text-sm font-semibold text-slate-900">{contract.original_filename}</p>
                  <p className="truncate text-xs text-slate-500">{contract.filename}</p>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge status={contract.status} />
                </td>
                <td className="px-4 py-4 text-sm text-slate-600">{contract.page_count ?? "-"}</td>
                {!compact ? <td className="px-4 py-4 text-sm text-slate-600">{formatBytes(contract.file_size)}</td> : null}
                <td className="px-4 py-4 text-sm text-slate-600">{formatDate(contract.created_at)}</td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    <Link
                      to={`/contracts/${contract.id}`}
                      className="focus-ring rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                      aria-label={`View ${contract.original_filename}`}
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <Link
                      to={`/compare?source=${contract.id}`}
                      className="focus-ring rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                      aria-label={`Compare ${contract.original_filename}`}
                    >
                      <GitCompare className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <Link
                      to={`/qa?contract=${contract.id}`}
                      className="focus-ring rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-slate-100"
                      aria-label={`Ask questions about ${contract.original_filename}`}
                    >
                      <FileQuestion className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
