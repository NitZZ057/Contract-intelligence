import { cn } from "@/utils/cn";
import { formatRiskLevel } from "@/utils/format";
import type { RiskLevel } from "@/types/contracts";

interface RiskBadgeProps {
  riskLevel: RiskLevel;
}

const riskClasses: Record<RiskLevel, string> = {
  low: "border-green-200 bg-green-50 text-green-700",
  medium: "border-amber-200 bg-amber-50 text-amber-700",
  high: "border-red-200 bg-red-50 text-red-700",
};

export function RiskBadge({ riskLevel }: RiskBadgeProps) {
  return (
    <span className={cn("inline-flex rounded-md border px-2 py-1 text-xs font-semibold", riskClasses[riskLevel])}>
      {formatRiskLevel(riskLevel)}
    </span>
  );
}
