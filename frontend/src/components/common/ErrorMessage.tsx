import { AlertCircle } from "lucide-react";
import { toApiError } from "@/utils/errors";

interface ErrorMessageProps {
  error: unknown;
  title?: string;
}

export function ErrorMessage({ error, title = "Something went wrong" }: ErrorMessageProps) {
  const apiError = toApiError(error);

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 shadow-sm">
      <div className="flex gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 flex-none" aria-hidden="true" />
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-red-700">{apiError.message}</p>
        </div>
      </div>
    </div>
  );
}
