import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import type { ApiError } from "@/types/contracts";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;

export const apiClient = axios.create({
  baseURL: apiBaseUrl ?? "http://localhost:8000",
  timeout: 30_000,
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (import.meta.env.DEV) {
    console.info("[api:request]", config.method?.toUpperCase(), config.url);
  }
  return config;
});

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    if (import.meta.env.DEV) {
      console.info("[api:response]", response.status, response.config.url);
    }
    return response;
  },
  (error: AxiosError<{ detail?: string; code?: string }>) => {
    const apiError: ApiError = {
      message:
        error.response?.data?.detail ??
        error.message ??
        "Unable to connect to the Contract Intelligence API",
      code: error.response?.data?.code ?? "api_error",
      status: error.response?.status,
    };

    if (import.meta.env.DEV) {
      console.error("[api:error]", apiError);
    }

    return Promise.reject(apiError);
  },
);

export function getApiBaseUrl(): string {
  return apiClient.defaults.baseURL ?? "http://localhost:8000";
}
