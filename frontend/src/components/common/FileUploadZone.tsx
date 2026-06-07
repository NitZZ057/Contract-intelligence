import { FileText, UploadCloud, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { cn } from "@/utils/cn";
import { formatBytes } from "@/utils/format";

const maxUploadBytes = 10 * 1024 * 1024;

interface FileUploadZoneProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

export function FileUploadZone({ selectedFile, onFileSelect, disabled = false }: FileUploadZoneProps) {
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): string | null => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return "Only PDF files can be uploaded.";
    }
    if (file.size > maxUploadBytes) {
      return "PDF files must be 10 MB or smaller.";
    }
    return null;
  }, []);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const nextFile = acceptedFiles[0];
      if (!nextFile) {
        return;
      }

      const error = validateFile(nextFile);
      setValidationError(error);
      onFileSelect(error ? null : nextFile);
    },
    [onFileSelect, validateFile],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled,
  });

  const stateLabel = useMemo(() => {
    if (selectedFile) {
      return selectedFile.name;
    }
    if (isDragActive) {
      return "Drop the contract PDF here";
    }
    return "Drag and drop a contract PDF";
  }, [isDragActive, selectedFile]);

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          "focus-ring flex min-h-72 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-white px-6 py-10 text-center shadow-sm transition",
          isDragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 hover:border-blue-400",
          disabled && "cursor-not-allowed opacity-60",
        )}
        aria-label="Upload contract PDF"
      >
        <input {...getInputProps()} />
        <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <UploadCloud className="h-7 w-7" aria-hidden="true" />
        </div>
        <p className="mt-5 text-lg font-semibold text-slate-900">{stateLabel}</p>
        <p className="mt-2 text-sm text-slate-500">PDF only, up to 10 MB</p>
      </div>

      {selectedFile ? (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-600">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">{selectedFile.name}</p>
              <p className="text-xs text-slate-500">{formatBytes(selectedFile.size)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setValidationError(null);
              onFileSelect(null);
            }}
            className="focus-ring rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Remove selected file"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {validationError ? <p className="mt-3 text-sm font-medium text-red-600">{validationError}</p> : null}
    </div>
  );
}
