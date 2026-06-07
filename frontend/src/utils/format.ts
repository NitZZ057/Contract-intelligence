import type { ContractStatus, RiskLevel } from "@/types/contracts";

export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** unitIndex;
  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatStatus(status: ContractStatus): string {
  const labels: Record<ContractStatus, string> = {
    pending: "Pending",
    processing: "Processing",
    processed: "Processed",
    failed: "Failed",
  };
  return labels[status];
}

export function formatRiskLevel(riskLevel: RiskLevel): string {
  const labels: Record<RiskLevel, string> = {
    low: "Low risk",
    medium: "Medium risk",
    high: "High risk",
  };
  return labels[riskLevel];
}

export function truncateText(value: string, length: number): string {
  if (value.length <= length) {
    return value;
  }
  return `${value.slice(0, length).trim()}...`;
}
