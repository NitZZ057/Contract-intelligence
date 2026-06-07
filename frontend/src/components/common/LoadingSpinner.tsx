import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

interface LoadingSpinnerProps {
  label?: string;
  className?: string;
}

export function LoadingSpinner({ label = "Loading", className }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex items-center justify-center gap-3 py-10 text-sm font-medium text-slate-500", className)}>
      <Loader2 className="h-5 w-5 animate-spin text-blue-500" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
