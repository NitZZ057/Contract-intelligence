import type { ApiError } from "@/types/contracts";

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    "code" in value &&
    typeof value.message === "string" &&
    typeof value.code === "string"
  );
}

export function toApiError(value: unknown): ApiError {
  if (isApiError(value)) {
    return value;
  }

  if (value instanceof Error) {
    return {
      message: value.message,
      code: "client_error",
    };
  }

  return {
    message: "Unexpected application error",
    code: "unknown_error",
  };
}
