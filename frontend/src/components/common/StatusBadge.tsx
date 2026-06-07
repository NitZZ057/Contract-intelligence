import { cn } from "@/utils/cn";
import { formatStatus } from "@/utils/format";
import type { ContractStatus } from "@/types/contracts";

interface StatusBadgeProps {
  status: ContractStatus;
}

const statusClasses: Record<ContractStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  processing: "border-blue-200 bg-blue-50 text-blue-700",
  processed: "border-green-200 bg-green-50 text-green-700",
  failed: "border-red-200 bg-red-50 text-red-700",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold",
        statusClasses[status],
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "processing" && "animate-pulse bg-blue-500",
          status === "pending" && "bg-amber-500",
          status === "processed" && "bg-green-500",
          status === "failed" && "bg-red-500",
        )}
      />
      {formatStatus(status)}
    </span>
  );
}
